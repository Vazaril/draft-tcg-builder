"""
Two-phase deck generation, per deck-generation-pipeline-extension.md, with
Gemini reduced to a single call after Gemini latency turned out to be the
bottleneck (isolated timing: a single Gemini call with a small response
schema took 20-180s in testing - reasons unclear, but three sequential
Gemini calls reliably blew Gunicorn's 300s worker timeout).

Phase 1 - Intent + Skeleton: ONE Gemini call extracts archetype/colors/
strategy from the free-text prompt, then a fixed heuristic (no LLM) turns
that into a slot budget per category. Lands are filled deterministically
from the extracted colors, never via semantic search - a search for
"aggressive red creatures" structurally never surfaces a Mountain.

Phase 2 - Category-targeted picks: one hybrid-search + local-LLM pick call
per non-land category (creatures, other), each with its own candidate pool
and slot target, instead of one big undifferentiated pool. The pick step
itself - "choose sensible cards from this pre-filtered list" - doesn't need
Gemini's reasoning depth, so it runs against a small local Ollama model
(card_picker service, see docker-compose.yaml) instead, both to cut Gemini
calls to one and to avoid the observed per-call latency entirely for the
repeated part of the pipeline. Still no legality/copy-limit repair loop, no
persistence, MTG only - see deck-generation-concept.md for the full planned
pipeline this remains a slice of.

Card metadata in vecs.mtg_nodes has no type_line (only cmc/colors/keywords/
legalities - see services/ingestion/chunker.py), so category retrieval can
only bias results semantically via the query text, not hard-filter by card
type. The pick model's own knowledge of the card names in each category's
candidate list is what keeps picks on-category in practice.
"""
import os

import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel
from supabase import create_client

from services.retrieval.search import hybrid_search_mtg

gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = os.environ.get("GEMINI_MODEL")

CARD_PICKER_BASE_URL = os.environ.get("CARD_PICKER_BASE_URL") or "http://localhost:11434"
CARD_PICKER_MODEL = os.environ.get("CARD_PICKER_MODEL") or "qwen2.5:3b-instruct"

# "ollama" | "gemini" - switch for the intent-extraction call. Defaults to
# ollama: a single Gemini call was observed taking 20-180s+ (unclear cause,
# quota looked fine), unreliable enough to keep out of the hot path for now.
# Flip back to "gemini" once/if that's understood, no code change needed.
INTENT_EXTRACTION_PROVIDER = os.environ.get("INTENT_EXTRACTION_PROVIDER", "ollama").lower()

CANDIDATE_POOL_SIZE = 60
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
    archetype: str
    colors: list[str]
    strategy_notes: str
    confidence: str  # "high" | "low"


class CardPick(BaseModel):
    card_id: str
    quantity: int
    reasoning: str


class DeckPicks(BaseModel):
    picks: list[CardPick]


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

CATEGORY_SYSTEM_INSTRUCTION = (
    "You are a Magic: The Gathering deckbuilding assistant. Choose cards from the given "
    "candidate list for the '{category}' category of a {archetype} deck. Use ONLY "
    "card_ids from the list - never invent ids or card names that aren't listed. Target "
    "roughly {slot_count} cards total (counting quantity per card). For each pick, give "
    "a short reasoning IN ENGLISH ONLY (no German, no special characters like umlauts - "
    "this model's output corrupts non-ASCII characters)."
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
    """Embeds query_text and hybrid-searches vecs.mtg_nodes; keeps card nodes
    only (the table also holds ruling nodes) and drops ids already picked in
    an earlier category."""
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


def _ollama_chat(system_instruction: str, user_prompt: str, schema: dict, timeout: float = 400.0) -> str:
    """Calls the local card_picker (Ollama) /api/chat with a JSON-schema
    format constraint, mirroring how response_schema forces structured
    output on the Gemini side. Returns the raw JSON string the model
    produced (message.content). Used for both intent extraction and
    category card-picking - same mechanism, different schema/prompt."""
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
            "options": {"temperature": 0.3},
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def _build_category_prompt(user_prompt: str, candidates: list[dict]) -> str:
    candidate_lines = "\n".join(
        f"- id={c['id']} | {c['name']} | CMC {c['cmc']} | Keywords: {', '.join(c['keywords']) or '-'}"
        for c in candidates
    )
    return (
        f"Nutzerwunsch: {user_prompt}\n\n"
        f"Verfuegbare Karten (waehle NUR aus dieser Liste, referenziere per id):\n{candidate_lines}"
    )


def _pick_cards_for_category(
    user_prompt: str,
    query_text: str,
    category: str,
    archetype: str,
    slot_count: int,
    seen_ids: set,
) -> tuple[list[dict], list[str]]:
    warnings = []
    candidates = _fetch_candidates(query_text, seen_ids)

    if not candidates:
        warnings.append(
            f"Kategorie '{category}': keine passenden Kandidaten gefunden (Embedding-"
            "Katalog vermutlich noch nicht vollstaendig befuellt)."
        )
        return [], warnings

    candidates_by_id = {c["id"]: c for c in candidates}

    system_instruction = CATEGORY_SYSTEM_INSTRUCTION.format(
        category=category, archetype=archetype, slot_count=slot_count
    )

    try:
        raw = _ollama_chat(
            system_instruction, _build_category_prompt(user_prompt, candidates), DeckPicks.model_json_schema()
        )
        picks = DeckPicks.model_validate_json(raw).picks
    except Exception as e:
        warnings.append(f"Kategorie '{category}': Antwort des Card-Pickers konnte nicht geparst werden: {e}")
        return [], warnings

    cards = []
    for pick in picks:
        if pick.card_id not in candidates_by_id:
            warnings.append(
                f"Kategorie '{category}': ignoriert card_id {pick.card_id}, war nicht in "
                "der Kandidatenliste (vermutlich halluziniert)."
            )
            continue

        if pick.card_id in seen_ids:
            continue
        seen_ids.add(pick.card_id)

        quantity = max(1, min(pick.quantity, MAX_COPIES_PER_CARD))
        if quantity != pick.quantity:
            warnings.append(
                f"{candidates_by_id[pick.card_id]['name']}: quantity von "
                f"{pick.quantity} auf {quantity} korrigiert (Limit {MAX_COPIES_PER_CARD})."
            )

        cards.append({
            "card_id": pick.card_id,
            "name": candidates_by_id[pick.card_id]["name"],
            "quantity": quantity,
            "reasoning": pick.reasoning,
        })

    return cards, warnings


def generate_deck_proposal(prompt: str) -> dict:
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

    all_cards = []
    seen_ids = set()

    lands, land_warnings = _fetch_basic_lands(intent.colors, skeleton["lands"])
    all_cards.extend(lands)
    seen_ids.update(c["card_id"] for c in lands)
    warnings.extend(land_warnings)

    creature_query = (
        f"{intent.strategy_notes} - Kreaturen (Creatures) fuer ein {intent.archetype}-Deck "
        f"in den Farben {colors_str}"
    )
    creature_cards, creature_warnings = _pick_cards_for_category(
        prompt, creature_query, "Kreaturen", intent.archetype, skeleton["creatures"], seen_ids
    )
    all_cards.extend(creature_cards)
    warnings.extend(creature_warnings)

    other_query = (
        f"{intent.strategy_notes} - Removal, Interaktion, Card Draw, Combat Tricks fuer "
        f"ein {intent.archetype}-Deck in den Farben {colors_str}"
    )
    other_cards, other_warnings = _pick_cards_for_category(
        prompt, other_query, "Removal/Interaktion/Sonstiges", intent.archetype, skeleton["other"], seen_ids
    )
    all_cards.extend(other_cards)
    warnings.extend(other_warnings)

    total_cards = sum(c["quantity"] for c in all_cards)
    if total_cards < TARGET_DECK_SIZE:
        warnings.append(
            f"Deck hat nur {total_cards}/{TARGET_DECK_SIZE} Karten - Kandidatenpool war "
            "vermutlich zu klein oder zu thematisch eng in einer Kategorie. Kein "
            "automatisches Auffuellen in dieser Version (siehe deck-generation-concept.md "
            "Schritt 5 fuer den geplanten Repair-Schritt)."
        )

    return {
        "name": f"Vorschlag: {prompt[:40]}",
        "archetype": intent.archetype,
        "colors": intent.colors,
        "cards": all_cards,
        "warnings": warnings,
    }
