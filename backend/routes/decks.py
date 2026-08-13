from flask import Blueprint, jsonify

decks_bp = Blueprint("decks", __name__, url_prefix="/api/decks")


@decks_bp.get("")
def list_decks():
    return jsonify(message="not implemented"), 501


@decks_bp.post("")
def create_deck():
    return jsonify(message="not implemented"), 501
