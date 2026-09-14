import os
import json
import concurrent.futures
from google import genai
from google.genai import types

from .schemas import DeckBlueprint, CategoryScores
from ..retrieval.search import filtered_hybrid_search_mtg

gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = os.environ.get("GEMINI_MODEL")


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def extract_oracle_text(metadata: dict) -> str:
    """Extracts card text from LlamaIndex's nested _node_content string."""
    try:
        node_content = json.loads(metadata.get("_node_content", "{}"))
        return node_content.get("text", "")
    except Exception:
        return ""


def generate_deck_blueprint(user_prompt: str, explicit_format: str | None,
                            explicit_colors: list[str] | None) -> DeckBlueprint:
    constraint_text = ""
    if explicit_format or explicit_colors is not None:
        fmt = explicit_format or "Auto-detect"
        cols = explicit_colors if explicit_colors is not None else "Auto-detect"
        constraint_text = f"\nCRITICAL CONSTRAINTS: You MUST use format='{fmt}' and color_identity={cols}. Do not deviate."

    system_instruction = (
            "You are an expert MTG deck builder. Analyze the user's request and construct a structural blueprint. "
            "Define color identity, format, and package categories (e.g., Ramp, Draw, Synergy). "
            "Category quotas + land count MUST equal the format deck size exactly (100 for Commander, 60 for 60-card formats)."
            + constraint_text
    )

    response = gemini_client.models.generate_content(
        model=gemini_model,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=DeckBlueprint
        )
    )

    blueprint = DeckBlueprint.model_validate_json(response.text)

    # Strictly enforce the UI parameters to guarantee safe SQL queries
    if explicit_format:
        blueprint.format = explicit_format.lower()
    if explicit_colors is not None:
        blueprint.color_identity = explicit_colors

    return blueprint


def generate_mana_base(land_count: int, color_identity: list[str]) -> list[dict]:
    if not color_identity or color_identity == ["C"]:
        return [{"card_id": "basic-c", "name": "Wastes", "quantity": land_count, "type": "Basic Land"}]

    split = land_count // len(color_identity)
    remainder = land_count % len(color_identity)
    basic_map = {"W": "Plains", "U": "Island", "B": "Swamp", "R": "Mountain", "G": "Forest"}

    lands = []
    for i, color in enumerate(color_identity):
        if color in basic_map:
            lands.append({
                "card_id": f"basic-{color.lower()}",
                "name": basic_map[color],
                "quantity": split + (1 if i < remainder else 0),
                "type": "Basic Land"
            })
    return lands


def _score_category_candidates(category_name: str, quota: int, candidates: list[dict], commander: str,
                               format_name: str) -> list[dict]:
    if not candidates:
        return []

    max_copies = 1 if format_name.lower() == "commander" else 4

    candidate_text = "\n".join([
        f"- ID: {c['id']} | {c['name']} (CMC: {c['cmc']}): {c['oracle_text']}"
        for c in candidates
    ])

    prompt = (
        f"Score these candidates for the '{category_name}' package in a {format_name} deck led by {commander}.\n"
        f"Rate each card from 0 to 10 based on synergy. Max copies per card: {max_copies}.\n\n"
        f"Candidates:\n{candidate_text}"
    )

    try:
        response = gemini_client.models.generate_content(
            model=gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=CategoryScores
            )
        )
        scores_data = CategoryScores.model_validate_json(response.text).scores
        scores_by_id = {s.card_id: s for s in scores_data}

        scored_candidates = []
        for c in candidates:
            score_obj = scores_by_id.get(c["id"])
            if score_obj and score_obj.score > 0:
                c["score"] = score_obj.score
                c["quantity"] = min(max(1, score_obj.quantity), max_copies)
                c["reasoning"] = score_obj.reasoning
                scored_candidates.append(c)
            else:
                c["score"] = 1
                c["quantity"] = 1
                c["reasoning"] = "RAG search match"
                scored_candidates.append(c)

        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        return scored_candidates

    except Exception as e:
        print(f"Scoring fallback for {category_name}: {e}")
        for c in candidates:
            c["score"] = 1
            c["quantity"] = 1
            c["reasoning"] = "Vector fallback"
        return candidates


def generate_deck_stream(user_prompt: str, explicit_format: str | None = None, explicit_colors: list[str] | None = None):
    try:
        yield _sse({"type": "status", "stage": "intent", "message": "Designing deck blueprint..."})

        blueprint = generate_deck_blueprint(user_prompt, explicit_format, explicit_colors)

        decklist = {
            "commander": blueprint.commander,
            "format": blueprint.format,
            "color_identity": blueprint.color_identity,
            "categories": {},
            "lands": generate_mana_base(blueprint.land_count, blueprint.color_identity)
        }

        yield _sse({
            "type": "partial",
            "stage": "blueprint",
            "message": f"Blueprint created. Searching for {len(blueprint.categories)} packages...",
            "data": decklist
        })

        seen_ids = set()
        if blueprint.commander:
            seen_ids.add(blueprint.commander.lower())

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            future_to_category = {}

            for category in blueprint.categories:
                # 1. Pre-filtered search via PostgreSQL
                raw_candidates = filtered_hybrid_search_mtg(
                    query_text=category.search_query,
                    color_identity=blueprint.color_identity,
                    format_name=blueprint.format,
                    match_count=max(category.quota * 3, 15)
                )

                # 2. Extract full oracle text from _node_content
                clean_candidates = []
                for row in raw_candidates:
                    meta = row.get("metadata", {})
                    card_id = meta.get("oracle_id", row.get("id"))
                    name = meta.get("name", "Unknown")

                    if card_id not in seen_ids and name.lower() not in seen_ids:
                        clean_candidates.append({
                            "id": card_id,
                            "name": name,
                            "cmc": meta.get("cmc", 0),
                            "colors": meta.get("colors", []),
                            "type": meta.get("type", "card"),
                            "oracle_text": extract_oracle_text(meta)
                        })

                # 3. Concurrent scoring
                future = executor.submit(
                    _score_category_candidates,
                    category.name,
                    category.quota,
                    clean_candidates,
                    blueprint.commander or "the deck",
                    blueprint.format
                )
                future_to_category[future] = (category.name, category.quota)

            # 4. Greedy knapsack slot allocation
            for future in concurrent.futures.as_completed(future_to_category):
                cat_name, cat_quota = future_to_category[future]
                scored_cards = future.result()

                selected_for_cat = []
                remaining_slots = cat_quota

                for card in scored_cards:
                    if remaining_slots <= 0:
                        break
                    if card["id"] not in seen_ids and card["name"].lower() not in seen_ids:
                        qty = min(card["quantity"], remaining_slots)
                        card["quantity"] = qty
                        selected_for_cat.append(card)
                        seen_ids.add(card["id"])
                        seen_ids.add(card["name"].lower())
                        remaining_slots -= qty

                decklist["categories"][cat_name] = selected_for_cat
                yield _sse({"type": "partial", "stage": "category", "category": cat_name, "cards": selected_for_cat})

        yield _sse({"type": "status", "stage": "saving", "message": "Finalizing deck..."})
        yield _sse({"type": "done", "proposal": decklist})

    except Exception as e:
        yield _sse({"type": "error", "message": str(e)})