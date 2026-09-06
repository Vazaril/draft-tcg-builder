from flask import Blueprint, jsonify, request, Response

from services.generation.deck_generator import generate_deck_proposal_stream

decks_bp = Blueprint("decks", __name__, url_prefix="/api/decks")


@decks_bp.get("")
def list_decks():
    return jsonify(message="not implemented"), 501


@decks_bp.post("")
def create_deck():
    return jsonify(message="not implemented"), 501


@decks_bp.post("/generate")
def generate_deck():
    body = request.get_json(silent=True) or {}

    prompt = body.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return jsonify(message="prompt fehlt."), 400

    game = body.get("game", "mtg")
    if game != "mtg":
        return jsonify(
            message="Deck-Generierung ist aktuell nur fuer Magic (game=mtg) verfuegbar."
        ), 400

    return Response(
        generate_deck_proposal_stream(prompt.strip()),
        mimetype="text/event-stream"
    )
