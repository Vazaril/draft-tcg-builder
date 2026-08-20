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
            .select("""
                *,
                games (
                    id,
                   name
                )
            """)
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
        # Bewusst .limit(1) statt .maybe_single() — siehe Kommentar in
        # delete_deck_card() weiter unten für den Grund.
        deck_response = (
            supabase
            .table("decks")
            .select("""
        *,
        games (
            id,
            name
        )
    """)
            .eq("id", deck_id)
            .limit(1)
            .execute()
        )

        deck_rows = deck_response.data or []

        if not deck_rows:
            return jsonify(message="Deck nicht gefunden."), 404

        deck = deck_rows[0]

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


@decks_bp.delete("/<deck_id>/cards/<card_id>")
def delete_deck_card(deck_id, card_id):
    """
    Entfernt eine Karte aus dem Deck.

    Ohne Query-Parameter 'amount' (oder amount >= aktueller Anzahl) wird die
    Karte komplett entfernt. Mit 'amount' < aktueller Anzahl wird nur die
    Anzahl verringert (z.B. 2 von 4 Kopien löschen).

    card_id bezieht sich hier auf die id der pokemon_deck_cards-Zeile
    (nicht auf pokemon_cards.id).
    """

    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    try:
        amount = request.args.get("amount", type=int)

        # Aktuelle Karte laden, um die vorhandene Anzahl zu kennen.
        # .eq("deck_id", deck_id) stellt zusätzlich sicher, dass die Karte
        # wirklich zu diesem Deck gehört.
        #
        # Bewusst .limit(1) statt .maybe_single(): maybe_single() gibt in
        # manchen supabase-py-Versionen bei 0 Treffern None als GESAMTE
        # Response zurück (statt response.data = None), was beim Zugriff
        # auf .data zu 'NoneType' object has no attribute 'data' crasht.
        card_response = (
            supabase
            .table("pokemon_deck_cards")
            .select("id, quantity")
            .eq("id", card_id)
            .eq("deck_id", deck_id)
            .limit(1)
            .execute()
        )

        rows = card_response.data or []

        if not rows:
            return jsonify(message="Karte nicht gefunden."), 404

        card = rows[0]

        current_quantity = card["quantity"]
        amount_to_remove = amount if amount is not None else current_quantity

        if amount_to_remove <= 0:
            return jsonify(message="amount muss größer als 0 sein."), 400

        if amount_to_remove >= current_quantity:
            # Karte komplett entfernen
            supabase.table("pokemon_deck_cards").delete().eq("id", card_id).execute()

            return jsonify(deleted=True, remaining_quantity=0), 200

        # Nur die Anzahl verringern
        new_quantity = current_quantity - amount_to_remove

        supabase.table("pokemon_deck_cards").update(
            {"quantity": new_quantity}
        ).eq("id", card_id).execute()

        return jsonify(deleted=False, remaining_quantity=new_quantity), 200

    except Exception as error:
        print("Fehler beim Löschen der Karte:", error)

        return jsonify(
            message="Karte konnte nicht gelöscht werden."
        ), 500