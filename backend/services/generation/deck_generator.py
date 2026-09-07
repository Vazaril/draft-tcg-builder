"""
Batched-scoring deck generation.

Earlier version asked the small local model (qwen2.5:1.5b-instruct) to pick
AND count cards from one big candidate pool in a single call - it reliably
failed at that: either never closing the JSON array (n_gen climbing past
7600 tokens before a 600s timeout killed it) or, once a hard num_predict
cap was added, getting cut off mid-JSON before finishing. The model isn't
reliable at "pick the right N from a long list and know when to stop."

So the slot-count decision is moved entirely out of the model's hands:

1. Intent extraction (Ollama by default - see INTENT_EXTRACTION_PROVIDER;
   Gemini is available but was observed taking 20-180s+ per call for
   reasons never root-caused).
2. ONE hybrid-search candidate pool (CANDIDATE_POOL_SIZE), covering both
   creatures and other spells together.
3. The pool is split into small batches (BATCH_SIZE) run with limited
   concurrency (BATCH_CONCURRENCY). Each batch call asks the model for
   exactly one bounded, easy thing: rate every card in ~12 at a time
   (score 0-10 + suggested quantity + one-line reasoning) - never "pick N",
   never "how many total". Small input, small output, low risk of runaway
   generation.
4. All scored candidates get merged and sorted by score; our own code
   greedily fills the skeleton's slot target from the top, capping the
   last card's quantity to fit exactly instead of overshooting. This is
   the part that guarantees the deck hits its target size - never the LLM.

This still uses the RAG-retrieved pool in full (nothing is discarded before
the model sees it, unlike the narrower two-category search from the very
first version) - it's just chunked for reliability instead of stuffed into
one long-context call. See deck-generation-concept-v2-rag-longcontext.md
for the fuller context on why long-context handling specifically matters
for this project, and deck-generation-pipeline-extension.md /
deck-generation-streaming.md for the rest of this pipeline's history.

Lands are still filled deterministically from the extracted colors, never
via semantic search - a search for "aggressive red creatures" structurally
never surfaces a Mountain.

`keep_alive` is set on every card_picker call so the model stays resident
across the many small batch calls (and across requests) instead of being
reloaded from disk each time.

Still no legality repair loop beyond the copy-count cap, MTG only. Card
metadata in vecs.data_mtg_nodes has no type_line (only cmc/colors/keywords/
legalities - see services/ingestion/chunker.py), so retrieval can only bias
results semantically via the query text, not hard-filter by card type.
"""
import json
import os
from concurrent.futures import ThreadPoolExecutor

import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel
from supabase import create_client
from typing import Literal

from services.retrieval.search import hybrid_search_mtg

gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = os.environ.get("GEMINI_MODEL")

CARD_PICKER_BASE_URL = os.environ.get("CARD_PICKER_BASE_URL") or "http://localhost:11434"
CARD_PICKER_MODEL = os.environ.get("CARD_PICKER_MODEL") or "qwen2.5:1.5b-instruct"

# Batch prompts are small (a dozen candidate lines + a short system
# instruction), so these can stay modest - unlike the earlier single-call
# design, there's no need to stretch toward the model's 32k ceiling here.
CARD_PICKER_NUM_CTX = int(os.environ.get("CARD_PICKER_NUM_CTX", "2048"))

# Ceiling on generated tokens per call. A batch of BATCH_SIZE cards needs
# roughly BATCH_SIZE * ~50 tokens (id + score + quantity + short reasoning
# + JSON overhead); this leaves comfortable margin without permitting the
# runaway generation observed in the single-big-call version.
CARD_PICKER_NUM_PREDICT = int(os.environ.get("CARD_PICKER_NUM_PREDICT", "1200"))

# Keeps the model loaded across the many small calls in one generation (and
# across requests) instead of Ollama unloading it after its default idle
# timeout - reloading a model from disk is itself a real cost at this call
# volume.
CARD_PICKER_KEEP_ALIVE = os.environ.get("CARD_PICKER_KEEP_ALIVE", "30m")

# "ollama" | "gemini" - switch for the intent-extraction call. Defaults to
# ollama: a single Gemini call was observed taking 20-180s+ (unclear cause,
# quota looked fine), unreliable enough to keep out of the hot path for now.
# Flip back to "gemini" once/if that's understood, no code change needed.
INTENT_EXTRACTION_PROVIDER = os.environ.get("INTENT_EXTRACTION_PROVIDER", "ollama").lower()

# One wide hybrid-search pool covering both creatures and other spells -
# safe to size generously since cost now scales as (pool / BATCH_SIZE)
# small independent calls, not one call whose context grows with the pool.
CANDIDATE_POOL_SIZE = 108
BATCH_SIZE = 12

# Measured: an isolated single batch call took 18.5s; the same batches run
# 3-at-a-time took 120s+ each and frequently timed out. This card_picker's
# Ollama only actually processes one generation at a time regardless of how
# many concurrent HTTP requests it receives (no OLLAMA_NUM_PARALLEL tuning
# here) - "concurrent" batches were queueing behind each other, and our own
# client-side timeout was cutting off requests that were merely waiting in
# that queue, not slow to generate. Sequential is both faster and more
# reliable for this deployment; revisit if OLLAMA_NUM_PARALLEL is ever
# raised (would need more RAM per parallel slot too).
BATCH_CONCURRENCY = 1

MAX_COPIES_PER_CARD = 4
TARGET_DECK_SIZE = 60
LAND_SLOTS = 17

# (creature_slots, other_slots) out of 43 non-land slots, by archetype.
ARCHETYPE_SPLITS = {
    "aggro": (28, 15),
    "midrange": (20, 23),
    "control": (15, 28),
    "combo": (18, 25),
}
DEFAULT_SPLIT = (20, 23)

COLOR_TO_BASIC_LAND = {
    "W": "Plains",
    "U": "Island",
    "B": "Swamp",
    "R": "Mountain",
    "G": "Forest",
}


class IntentExtraction(BaseModel):
    # Literal, not str: the smaller local model has been observed
    # misspelling free-text values (e.g. "agro"), which silently fell
    # through to DEFAULT_SPLIT in build_skeleton() instead of the actual
    # archetype's split. An enum in the JSON schema forces the model to
    # pick one of these exact strings instead of generating free text.
    archetype: Literal["aggro", "midrange", "control", "combo"]
    colors: list[str]
    strategy_notes: str
    confidence: Literal["high", "low"]


class CardScore(BaseModel):
    card_id: str
    score: int
    quantity: int
    reasoning: str


class BatchScores(BaseModel):
    scores: list[CardScore]


INTENT_SYSTEM_INSTRUCTION = (
    "Du extrahierst strukturierte Deckbau-Praeferenzen aus einem Magic: The Gathering "
    "Nutzerwunsch. Keine Kreativitaet, nur Extraktion.\n"
    "- archetype: einer von aggro, midrange, control, combo (bestmoegliche Einschaetzung, "
    "auch wenn nicht explizit genannt)\n"
    "- colors: Liste aus W, U, B, R, G (MTG-Farbcodes) - nur Farben, die klar erkennbar "
    "sind, leer lassen wenn nicht bestimmbar\n"
    "- strategy_notes: 1-2 Saetze, worauf das Deck abzielt (fuer die spaetere Kartensuche)\n"
    "- confidence: 'low' falls Farben UND Archetyp beide unklar sind, sonst 'high'"
)

BATCH_SYSTEM_INSTRUCTION = (
    "You are a Magic: The Gathering deckbuilding assistant helping build a {archetype} deck "
    "in colors {colors}. Strategy: {strategy_notes}\n\n"
    "Rate EVERY card in the list below for how well it fits this deck - exactly one entry "
    "per card_id, using ONLY the ids given, never invent ids or cards.\n"
    "- score: 0-10 fit rating (0 = doesn't fit at all, 10 = perfect fit)\n"
    "- quantity: how many copies you'd play if included (1-4, MTG limits nonland cards to "
    "4 copies)\n"
    "- reasoning: max 5 words, IN ENGLISH ONLY (no German, no special characters like "
    "umlauts - this model's output corrupts non-ASCII characters). Keep it terse, not a "
    "full sentence - e.g. 'cheap haste, fits curve' not 'This card provides cheap haste "
    "which fits well into the curve of an aggressive deck'"
)


def extract_intent(prompt: str) -> IntentExtraction:
    if INTENT_EXTRACTION_PROVIDER == "ollama":
        raw = _ollama_chat(INTENT_SYSTEM_INSTRUCTION, prompt, IntentExtraction.model_json_schema())
        return IntentExtraction.model_validate_json(raw)

    response = gemini_client.models.generate_content(
        model=gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=INTENT_SYSTEM_INSTRUCTION,
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=IntentExtraction,
        ),
    )
    return IntentExtraction.model_validate_json(response.text)


def build_skeleton(intent: IntentExtraction) -> dict:
    creatures, other = ARCHETYPE_SPLITS.get(intent.archetype.lower(), DEFAULT_SPLIT)
    return {"lands": LAND_SLOTS, "creatures": creatures, "other": other}


def _fetch_basic_lands(colors: list[str], slot_count: int) -> tuple[list[dict], list[str]]:
    """Deterministic, no LLM: distributes slot_count evenly across the given
    colors' basic lands, looked up directly in Supabase's mtg_cards (not the
    embedded vector store - basics may not be embedded yet, and this needs
    no semantic search anyway)."""
    warnings = []
    valid_colors = [c for c in colors if c in COLOR_TO_BASIC_LAND]

    if not valid_colors:
        warnings.append(
            "Keine eindeutige Farbe fuer die Land-Befuellung erkannt - Lands wurden "
            "uebersprungen, Deck ist dadurch unvollstaendig."
        )
        return [], warnings

    land_names = [COLOR_TO_BASIC_LAND[c] for c in valid_colors]

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    response = supabase.table("mtg_cards").select("oracle_id, name").in_("name", land_names).execute()

    by_name = {}
    for row in response.data or []:
        by_name.setdefault(row["name"], row)

    lands = []
    base = slot_count // len(valid_colors)
    remainder = slot_count % len(valid_colors)

    for i, color in enumerate(valid_colors):
        name = COLOR_TO_BASIC_LAND[color]
        row = by_name.get(name)
        if not row:
            warnings.append(f"Basic Land {name} nicht in mtg_cards gefunden - uebersprungen.")
            continue

        quantity = base + (1 if i < remainder else 0)
        lands.append({
            "card_id": row["oracle_id"],
            "name": name,
            "quantity": quantity,
            "reasoning": f"Basic Land ({color}), deterministisch nach Farbverteilung ergaenzt.",
        })

    return lands, warnings


def _fetch_candidates(query_text: str, exclude_ids: set) -> list[dict]:
    """Embeds query_text and hybrid-searches vecs.data_mtg_nodes; keeps card
    nodes only (the table also holds ruling nodes) and drops ids already
    picked (currently just the lands)."""
    results = hybrid_search_mtg(query_text=query_text, match_count=CANDIDATE_POOL_SIZE)

    candidates = []
    for row in results:
        metadata = row.get("metadata") or {}
        if metadata.get("type") != "card" or row["id"] in exclude_ids:
            continue
        candidates.append({
            "id": row["id"],
            "name": metadata.get("name", "Unknown Card"),
            "cmc": metadata.get("cmc"),
            "keywords": metadata.get("keywords") or [],
        })
    return candidates


def _ollama_chat(system_instruction: str, user_prompt: str, schema: dict, timeout: float = 120.0) -> str:
    """Calls the local card_picker (Ollama) /api/chat with a JSON-schema
    format constraint, mirroring how response_schema forces structured
    output on the Gemini side. Returns the raw JSON string the model
    produced (message.content). Used for both intent extraction and batch
    scoring - same mechanism, different schema/prompt."""
    resp = httpx.post(
        f"{CARD_PICKER_BASE_URL}/api/chat",
        json={
            "model": CARD_PICKER_MODEL,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            "format": schema,
            "stream": False,
            "keep_alive": CARD_PICKER_KEEP_ALIVE,
            "options": {
                "temperature": 0.3,
                "num_ctx": CARD_PICKER_NUM_CTX,
                "num_predict": CARD_PICKER_NUM_PREDICT,
            },
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def _build_batch_prompt(batch: list[dict]) -> str:
    # No "id=" label before the id - it was observed being echoed back
    # verbatim as part of card_id ("id=<uuid>" instead of "<uuid>"), which
    # silently failed every candidates_by_id lookup and made every card in
    # the batch look "not found" regardless of its actual score.
    lines = "\n".join(
        f"- {c['id']} | {c['name']} | CMC {c['cmc']} | Keywords: {', '.join(c['keywords']) or '-'}"
        for c in batch
    )
    return f"Cards to rate (card_id is the part before the first '|'):\n{lines}"


def _score_batch(batch: list[dict], archetype: str, colors_str: str, strategy_notes: str) -> list[dict]:
    """Scores one small batch of candidates - see module docstring for why
    this replaced asking the model to pick/count across the whole pool at
    once. Returns [] on any failure (bad JSON, empty result, ...) rather
    than raising - one failed batch just means fewer scored candidates for
    the final selection, not an aborted generation."""
    system_instruction = BATCH_SYSTEM_INSTRUCTION.format(
        archetype=archetype, colors=colors_str or "unbestimmt", strategy_notes=strategy_notes
    )
    candidates_by_id = {c["id"]: c for c in batch}

    try:
        raw = _ollama_chat(system_instruction, _build_batch_prompt(batch), BatchScores.model_json_schema())
        scores = BatchScores.model_validate_json(raw).scores
    except Exception:
        return []

    results = []
    for s in scores:
        # Defensive: strip a stray "id=" prefix in case the model still
        # echoes labels back occasionally despite the prompt no longer
        # showing one.
        card_id = s.card_id.strip().removeprefix("id=")
        candidate = candidates_by_id.get(card_id)
        if not candidate or s.score <= 0:
            continue
        results.append({
            "id": card_id,
            "name": candidate["name"],
            "score": s.score,
            "quantity": max(1, min(s.quantity, MAX_COPIES_PER_CARD)),
            "reasoning": s.reasoning,
        })
    return results


def _pick_cards(
    query_text: str,
    archetype: str,
    colors_str: str,
    strategy_notes: str,
    target_total: int,
    seen_ids: set,
) -> tuple[list[dict], list[str]]:
    """Fetches one candidate pool, scores it in small concurrent batches,
    then deterministically fills target_total from the highest-scored
    candidates down - the LLM never decides how many cards to return, so it
    can't overshoot or undershoot the slot budget the way the single-call
    version did."""
    warnings = []
    candidates = _fetch_candidates(query_text, seen_ids)

    if not candidates:
        warnings.append(
            "Keine passenden Kandidaten gefunden (Embedding-Katalog vermutlich noch nicht "
            "vollstaendig befuellt)."
        )
        return [], warnings

    batches = [candidates[i:i + BATCH_SIZE] for i in range(0, len(candidates), BATCH_SIZE)]

    scored = []
    with ThreadPoolExecutor(max_workers=BATCH_CONCURRENCY) as pool:
        for batch_results in pool.map(
            lambda batch: _score_batch(batch, archetype, colors_str, strategy_notes), batches
        ):
            scored.extend(batch_results)

    if not scored:
        warnings.append(
            f"Card-Picker hat aus {len(candidates)} Kandidaten keine bewertbaren Karten "
            "zurueckgegeben (alle Batches fehlgeschlagen oder alles mit Score 0 bewertet)."
        )
        return [], warnings

    scored.sort(key=lambda c: c["score"], reverse=True)

    cards = []
    remaining = target_total
    for c in scored:
        if c["id"] in seen_ids or remaining <= 0:
            continue
        seen_ids.add(c["id"])
        quantity = min(c["quantity"], remaining)
        cards.append({
            "card_id": c["id"],
            "name": c["name"],
            "quantity": quantity,
            "reasoning": c["reasoning"],
        })
        remaining -= quantity

    return cards, warnings


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _resolve_printings(oracle_ids: list[str]) -> dict[str, str]:
    """Maps oracle_id -> one concrete mtg_cards.id (first printing found).
    Needed because mtg_deck_cards.card_id is a foreign key to a specific
    printing, while every card_id in a generated proposal is an oracle_id
    (deduped across printings, matching the embedded vecs.data_mtg_nodes
    rows) - see deck-generation-streaming.md. Read-only catalog lookup, so
    the service-role client is fine here (same as _fetch_basic_lands)."""
    if not oracle_ids:
        return {}

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    response = supabase.table("mtg_cards").select("id, oracle_id").in_("oracle_id", oracle_ids).execute()

    mapping = {}
    for row in response.data or []:
        mapping.setdefault(row["oracle_id"], row["id"])
    return mapping


def _save_deck(supabase, user_id: str, format_id: str, proposal: dict) -> tuple[str, list[str]]:
    """Persists the generated proposal as a real mtg_decks row (owned by
    user_id, via the caller's RLS-scoped client - mtg_decks/mtg_deck_cards
    are only reachable via user JWT, never the service-role key) plus its
    mtg_deck_cards rows, all in the "mainboard" zone. Returns
    (deck_id, skipped_card_names) - a card is skipped if no printing could
    be resolved for its oracle_id."""
    deck_insert = (
        supabase.table("mtg_decks")
        .insert({"user_id": user_id, "format_id": format_id, "name": proposal["name"]})
        .execute()
    )
    deck_id = deck_insert.data[0]["id"]

    printing_by_oracle_id = _resolve_printings([c["card_id"] for c in proposal["cards"]])

    rows = []
    skipped = []
    for card in proposal["cards"]:
        printing_id = printing_by_oracle_id.get(card["card_id"])
        if not printing_id:
            skipped.append(card["name"])
            continue
        rows.append({
            "deck_id": deck_id,
            "card_id": printing_id,
            "quantity": card["quantity"],
            "zone": "mainboard",
        })

    if rows:
        supabase.table("mtg_deck_cards").insert(rows).execute()

    return deck_id, skipped


def generate_deck_proposal_stream(prompt: str, user_id: str, format_id: str, supabase):
    """Generator yielding SSE-formatted progress events, same wire format as
    services/retrieval/engine.py's chat stream (`data: {...}\\n\\n`, JSON per
    line, `type` field discriminates). Event types:

    - status  {type, stage, message}                - a stage has started
    - partial {type, stage, cards}                   - a stage's cards, as soon as ready
    - done    {type, proposal: {...}}                - final result, including the
                                                        persisted deck's id
    - error   {type, message}                        - stream ends after this, no `done`

    `stage` is a stable machine-readable id (intent, lands, cards, saving);
    `message` is the human-readable (German) status text - see
    deck-generation-streaming.md for the full contract.

    `supabase` must be a client already authenticated with the requesting
    user's JWT (see routes/decks.py's get_supabase_and_user()) - the final
    save step writes to mtg_decks/mtg_deck_cards under that user's RLS
    policies, not the service-role key."""
    try:
        yield _sse({"type": "status", "stage": "intent", "message": "Ueberlege Struktur..."})
        intent = extract_intent(prompt)

        warnings = []
        if intent.confidence == "low":
            warnings.append(
                "Prompt war fuer Farben/Archetyp mehrdeutig (confidence=low) - es wurde "
                "trotzdem mit bestmoeglicher Einschaetzung weitergemacht statt "
                "abzubrechen. Ergebnis ggf. mit Vorsicht pruefen."
            )

        skeleton = build_skeleton(intent)
        colors_str = "/".join(intent.colors) or "unbestimmt"

        yield _sse({
            "type": "status",
            "stage": "skeleton",
            "message": f"Archetyp: {intent.archetype}, Farben: {colors_str or 'unbestimmt'}",
            "detail": {"archetype": intent.archetype, "colors": intent.colors, "skeleton": skeleton},
        })

        all_cards = []
        seen_ids = set()

        yield _sse({"type": "status", "stage": "lands", "message": "Suche Laender..."})
        lands, land_warnings = _fetch_basic_lands(intent.colors, skeleton["lands"])
        all_cards.extend(lands)
        seen_ids.update(c["card_id"] for c in lands)
        warnings.extend(land_warnings)
        yield _sse({"type": "partial", "stage": "lands", "cards": lands})

        yield _sse({
            "type": "status",
            "stage": "cards",
            "message": f"Bewerte {CANDIDATE_POOL_SIZE} Kandidaten in kleinen Batches...",
        })
        pick_query = f"{intent.strategy_notes} fuer ein {intent.archetype}-Deck in den Farben {colors_str}"
        target_total = skeleton["creatures"] + skeleton["other"]
        picked_cards, pick_warnings = _pick_cards(
            pick_query, intent.archetype, colors_str, intent.strategy_notes, target_total, seen_ids
        )
        all_cards.extend(picked_cards)
        warnings.extend(pick_warnings)
        yield _sse({"type": "partial", "stage": "cards", "cards": picked_cards})

        total_cards = sum(c["quantity"] for c in all_cards)
        if total_cards < TARGET_DECK_SIZE:
            warnings.append(
                f"Deck hat nur {total_cards}/{TARGET_DECK_SIZE} Karten - Kandidatenpool war "
                "vermutlich zu klein oder zu thematisch eng. Kein automatisches Auffuellen "
                "in dieser Version (siehe deck-generation-concept.md Schritt 5 fuer den "
                "geplanten Repair-Schritt)."
            )

        proposal = {
            "name": f"Vorschlag: {prompt[:40]}",
            "archetype": intent.archetype,
            "colors": intent.colors,
            "cards": all_cards,
            "warnings": warnings,
        }

        yield _sse({"type": "status", "stage": "saving", "message": "Speichere Deck..."})
        try:
            deck_id, skipped = _save_deck(supabase, user_id, format_id, proposal)
            proposal["deck_id"] = deck_id
            if skipped:
                proposal["warnings"].append(
                    "Nicht gespeichert (keine Druckversion gefunden fuer): " + ", ".join(skipped)
                )
        except Exception as e:
            proposal["deck_id"] = None
            proposal["warnings"].append(f"Deck konnte nicht gespeichert werden: {e}")

        yield _sse({"type": "done", "proposal": proposal})

    except Exception as e:
        yield _sse({"type": "error", "message": str(e)})
