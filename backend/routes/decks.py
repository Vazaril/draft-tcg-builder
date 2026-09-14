from flask import Blueprint, jsonify, request, Response
from services.deck_builder.engine import generate_deck_stream

decks_bp = Blueprint("decks", __name__, url_prefix="/api/decks")


@decks_bp.post("/generate")
def generate_deck():
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt")

    if not isinstance(prompt, str) or not prompt.strip():
        return jsonify(error="prompt is required"), 400

    try:
        stream_generator = generate_deck_stream(prompt)
        return Response(stream_generator, mimetype='text/event-stream')
    except Exception as exc:
        return jsonify(error=str(exc)), 502