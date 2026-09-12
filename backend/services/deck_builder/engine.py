import os
import concurrent.futures
from google import genai
from google.genai import types

from .schemas import DeckBlueprint, CardSelection
from ..retrieval.search import hybrid_search_mtg

gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = os.environ.get("GEMINI_MODEL")


def generate_deck_blueprint(user_prompt: str) -> DeckBlueprint:
    """Step 1: Use the LLM to design the strategy and category quotas."""
    system_instruction = (
        "You are an expert MTG deck builder. Analyze the user's request and construct a structural blueprint. "
        "Define the exact color identity, format, and package categories (e.g., Ramp, Draw, Synergy, Removal). "
        "The total category quotas plus the land count MUST equal exactly the deck size (100 for Commander, 60 for Standard)."
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
    return DeckBlueprint.model_validate_json(response.text)


def clean_card_data(metadata: dict) -> dict:
    """Strips LlamaIndex bloat so the LLM only reads relevant data."""
    return {
        "id": metadata.get("oracle_id"),
        "name": metadata.get("name", "Unknown"),
        "cmc": metadata.get("cmc", 0),
        "type": metadata.get("type", "card"),
        "colors": metadata.get("colors", []),
        "oracle_text": metadata.get("text", "")
    }


def is_color_legal(card_colors: list[str], allowed_colors: list[str]) -> bool:
    """Strictly enforces color identity in Python to prevent LLM mistakes."""
    if not card_colors:
        return True
    return all(color in allowed_colors for color in card_colors)


def select_synergy_cards_with_llm(category_name: str, quota: int, candidates: list[dict], commander: str) -> list[dict]:
    """Step 3: A focused LLM call just for selecting cards within a single category."""
    if not candidates:
        return []

    # Format cleanly for the LLM prompt to save tokens
    candidate_text = "\n".join([
        f"- {c['name']} (Type: {c['type']}, CMC: {c['cmc']}): {c['oracle_text']}"
        for c in candidates
    ])

    prompt = (
        f"You are selecting cards for the '{category_name}' category of a deck led by {commander}.\n"
        f"Select EXACTLY {quota} cards from the candidates below that offer the best synergy and mana curve.\n"
        f"Output ONLY a JSON list of the exact card names chosen.\n\n"
        f"Candidates:\n{candidate_text}"
    )

    try:
        response = gemini_client.models.generate_content(
            model=gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=CardSelection
            )
        )

        selection = CardSelection.model_validate_json(response.text)
        selected_names = [name.lower().strip() for name in selection.selected_card_names]

        # Map the LLM's text output back to the rich Python dictionaries
        return [c for c in candidates if c['name'].lower().strip() in selected_names]

    except Exception as e:
        print(f"LLM selection failed for {category_name}: {e}")
        return []


def build_deck_pipeline(user_prompt: str) -> dict:
    """Master Orchestrator."""
    blueprint = generate_deck_blueprint(user_prompt)

    decklist = {
        "commander": blueprint.commander,
        "format": blueprint.format,
        "color_identity": blueprint.color_identity,
        "categories": {},
        "lands": generate_mana_base(blueprint.land_count, blueprint.color_identity)  # Standard Python generation
    }

    seen_cards = set([blueprint.commander.lower()] if blueprint.commander else [])

    # Run the LLM category selections concurrently to keep response times under 5 seconds
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        future_to_category = {}

        for category in blueprint.categories:
            # 1. Fetch raw candidates from Postgres
            raw_candidates = hybrid_search_mtg(
                query_text=category.search_query,
                match_count=category.quota * 4
            )

            # 2. Pre-filter in Python to guarantee legality and strip JSON bloat
            clean_candidates = []
            for c in raw_candidates:
                meta = c.get("metadata", {})
                card_name = meta.get("name", "").strip()

                if card_name and card_name.lower() not in seen_cards:
                    if meta.get("type") == "card" and is_color_legal(meta.get("colors", []), blueprint.color_identity):
                        clean_candidates.append(clean_card_data(meta))
                        seen_cards.add(card_name.lower())

            # 3. Dispatch the filtered list to a concurrent LLM thread for synergy selection
            future = executor.submit(
                select_synergy_cards_with_llm,
                category.name,
                category.quota,
                clean_candidates,
                blueprint.commander
            )
            future_to_category[future] = category.name

        # 4. Gather results as threads complete
        for future in concurrent.futures.as_completed(future_to_category):
            cat_name = future_to_category[future]
            decklist["categories"][cat_name] = future.result()

    return decklist


def generate_mana_base(land_count: int, color_identity: list[str]) -> list[dict]:
    lands = []
    if not color_identity or color_identity == ["C"]:
        return [{"name": "Wastes", "quantity": land_count}]

    split = land_count // len(color_identity)
    remainder = land_count % len(color_identity)
    basic_map = {"W": "Plains", "U": "Island", "B": "Swamp", "R": "Mountain", "G": "Forest"}

    for i, color in enumerate(color_identity):
        qty = split + (1 if i < remainder else 0)
        if color in basic_map:
            lands.append({"name": basic_map[color], "quantity": qty})
    return lands