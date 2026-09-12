from flask import Blueprint, jsonify, request
from services.deck_builder.engine import build_deck_pipeline

decks_bp = Blueprint("decks", __name__, url_prefix="/api/decks")


@decks_bp.post("/generate")
def generate_deck():
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt")

    if not isinstance(prompt, str) or not prompt.strip():
        return jsonify(error="prompt is required"), 400

    try:
        # Trigger the 5-step orchestrator pipeline
        decklist = build_deck_pipeline(prompt)
        return jsonify(decklist), 200

    except Exception as exc:
        print(f"Deck generation failed: {exc}")
        return jsonify(error=str(exc)), 500