import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from supabase import create_client


# .env.local laden
env_path = Path(__file__).resolve().parents[2] / ".env.local"
load_dotenv(env_path)

# Supabase
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]

# Routes
decks_bp = Blueprint("decks", __name__, url_prefix="/api/decks")


def get_supabase():
    """Supabase Client mit dem Token des eingeloggten Users erstellen."""

    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.removeprefix("Bearer ").strip()

    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
    )

    # Token für RLS verwenden
    supabase.postgrest.auth(token)

    return supabase


@decks_bp.get("")
def list_decks():
    """Alle Decks des eingeloggten Users."""

    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    try:
        response = (
            supabase
            .table("decks")
            .select("*")
            .order("updated_at", desc=True)
            .execute()
        )

        return jsonify(response.data), 200

    except Exception as error:
        print("Fehler beim Laden der Decks:", error)

        return jsonify(
            message="Decks konnten nicht geladen werden."
        ), 500


@decks_bp.get("/<deck_id>")
def get_deck(deck_id):
    """Ein Deck inklusive seiner Pokémon-Karten."""

    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    try:
        # Deck laden
        deck_response = (
            supabase
            .table("decks")
            .select("*")
            .eq("id", deck_id)
            .maybe_single()
            .execute()
        )

        deck = deck_response.data

        if not deck:
            return jsonify(message="Deck nicht gefunden."), 404

        # Karten des Decks laden
        cards_response = (
            supabase
            .table("pokemon_deck_cards")
            .select(
                """
                id,
                card_id,
                quantity,
                position,
                reasoning,
                pokemon_cards (
                    id,
                    name,
                    card_type,
                    subtype,
                    regulation_mark
                )
                """
            )
            .eq("deck_id", deck_id)
            .order("position")
            .execute()
        )

        deck["cards"] = cards_response.data or []

        return jsonify(deck), 200

    except Exception as error:
        print("Fehler beim Laden des Decks:", error)

        return jsonify(
            message="Deck konnte nicht geladen werden."
        ), 500


@decks_bp.post("")
def create_deck():
    return jsonify(message="not implemented"), 501