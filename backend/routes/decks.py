from flask import Blueprint, jsonify, request

from services.generation.deck_generator import generate_deck_proposal

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

    try:
        proposal = generate_deck_proposal(prompt.strip())
        return jsonify(proposal), 200
    except Exception as error:
        return jsonify(
            message="Deck konnte nicht generiert werden.",
            error=str(error)
        ), 500
