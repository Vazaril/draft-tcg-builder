import os

from flask import Blueprint, jsonify, request, Response
from supabase import create_client

from services.generation.deck_generator import generate_deck_proposal_stream

# Same backend/.env this whole app already loads via docker-compose's
# env_file: (the repo-root .env.local the frontend uses isn't reachable
# from inside the container - only backend/ is bind-mounted). Same values,
# already used elsewhere under these names (see deck_generator.py).
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

decks_bp = Blueprint("decks", __name__, url_prefix="/api/decks")


def get_supabase_and_user():
    """Validates the request's Bearer token against Supabase Auth and
    returns (client, user) - the client is RLS-scoped to that user (needed
    since mtg_decks/mtg_deck_cards are only reachable via user JWT, not the
    service-role key). Returns (None, None) if the token is missing/invalid."""
    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return None, None

    token = authorization.removeprefix("Bearer ").strip()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        return None, None

    if not user_response or not user_response.user:
        return None, None

    supabase.postgrest.auth(token)
    return supabase, user_response.user


@decks_bp.get("")
def list_decks():
    return jsonify(message="not implemented"), 501


@decks_bp.post("")
def create_deck():
    return jsonify(message="not implemented"), 501


@decks_bp.post("/generate")
def generate_deck():
    supabase, user = get_supabase_and_user()
    if not supabase or not user:
        return jsonify(message="Unauthorized"), 401

    body = request.get_json(silent=True) or {}

    prompt = body.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return jsonify(message="prompt fehlt."), 400

    game = body.get("game", "mtg")
    if game != "mtg":
        return jsonify(
            message="Deck-Generierung ist aktuell nur fuer Magic (game=mtg) verfuegbar."
        ), 400

    format_name = body.get("format", "Standard")
    format_response = (
        supabase.table("mtg_formats")
        .select("id")
        .ilike("name", format_name)
        .limit(1)
        .execute()
    )
    if not format_response.data:
        return jsonify(message=f"Format '{format_name}' nicht gefunden."), 400
    format_id = format_response.data[0]["id"]

    return Response(
        generate_deck_proposal_stream(prompt.strip(), user.id, format_id, supabase),
        mimetype="text/event-stream"
    )
