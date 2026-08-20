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


def _delete_or_reduce_card(supabase, deck_id, card_id, amount):
    """
    Löscht eine einzelne Karte komplett oder reduziert ihre Anzahl.
    Gemeinsam genutzt vom Einzel- und vom Bulk-Delete-Endpoint.

    Gibt ein dict zurück — KEINE Flask-Response! Bei Fehlern enthält das
    dict "error" (Text) und "status" (HTTP-Statuscode für den Fall, dass
    dieser Aufruf einzeln beantwortet wird).
    """

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
        return {"card_id": card_id, "error": "Karte nicht gefunden.", "status": 404}

    card = rows[0]

    current_quantity = card["quantity"]
    amount_to_remove = amount if amount is not None else current_quantity

    if amount_to_remove <= 0:
        return {"card_id": card_id, "error": "amount muss größer als 0 sein.", "status": 400}

    if amount_to_remove >= current_quantity:
        # Karte komplett entfernen
        supabase.table("pokemon_deck_cards").delete().eq("id", card_id).execute()

        return {"card_id": card_id, "deleted": True, "remaining_quantity": 0}

    # Nur die Anzahl verringern
    new_quantity = current_quantity - amount_to_remove

    supabase.table("pokemon_deck_cards").update(
        {"quantity": new_quantity}
    ).eq("id", card_id).execute()

    return {"card_id": card_id, "deleted": False, "remaining_quantity": new_quantity}


@decks_bp.delete("/<deck_id>/cards/<card_id>")
def delete_deck_card(deck_id, card_id):
    """
    Entfernt eine einzelne Karte aus dem Deck.

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

        result = _delete_or_reduce_card(supabase, deck_id, card_id, amount)

        if "error" in result:
            return jsonify(message=result["error"]), result["status"]

        return jsonify(deleted=result["deleted"], remaining_quantity=result["remaining_quantity"]), 200

    except Exception as error:
        print("Fehler beim Löschen der Karte:", error)

        return jsonify(
            message="Karte konnte nicht gelöscht werden."
        ), 500


@decks_bp.post("/<deck_id>/cards/bulk-delete")
def bulk_delete_deck_cards(deck_id):
    """
    Entfernt mehrere Karten gleichzeitig (oder reduziert ihre Anzahl) —
    ein Request statt N einzelner DELETE-Aufrufe.

    Body:
    {
      "cards": [
        { "card_id": "...", "amount": 2 },
        { "card_id": "..." }
      ]
    }

    Ohne "amount" pro Eintrag wird die jeweilige Karte komplett entfernt.
    Antwortet mit 200, wenn alles geklappt hat, sonst mit 207 (Multi-Status)
    und pro Karte einem eigenen Ergebnis/Fehler in "results".
    """

    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    body = request.get_json(silent=True) or {}
    cards_to_delete = body.get("cards")

    if not isinstance(cards_to_delete, list) or not cards_to_delete:
        return jsonify(message="'cards' muss eine nicht-leere Liste sein."), 400

    results = []

    for entry in cards_to_delete:
        card_id = entry.get("card_id") if isinstance(entry, dict) else None
        amount = entry.get("amount") if isinstance(entry, dict) else None

        if not card_id:
            results.append({"card_id": card_id, "error": "card_id fehlt.", "status": 400})
            continue

        try:
            results.append(_delete_or_reduce_card(supabase, deck_id, card_id, amount))
        except Exception as error:
            print(f"Fehler beim Löschen der Karte {card_id}:", error)
            results.append(
                {"card_id": card_id, "error": "Karte konnte nicht gelöscht werden.", "status": 500}
            )

    has_errors = any("error" in result for result in results)

    # "status" war nur intern für einzelne Fehler-Antworten relevant,
    # nicht Teil der öffentlichen Response.
    for result in results:
        result.pop("status", None)

    return jsonify(results=results), 207 if has_errors else 200

@decks_bp.post("/<deck_id>/cards")
def add_deck_card(deck_id):
    """
    Fügt eine Karte zum Deck hinzu.

    Body:
    {
        "card_id": "...",
        "quantity": 1,
        "position": 3,
        "reasoning": "..."
    }

    Falls die Karte bereits im Deck existiert,
    wird quantity erhöht.
    """

    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    body = request.get_json(silent=True) or {}

    card_id = body.get("card_id")
    quantity = body.get("quantity", 1)
    position = body.get("position")
    reasoning = body.get("reasoning")

    if not card_id:
        return jsonify(message="card_id fehlt."), 400

    if not isinstance(quantity, int) or quantity <= 0:
        return jsonify(
            message="quantity muss eine ganze Zahl größer als 0 sein."
        ), 400

    try:
        # Prüfen, ob Deck existiert
        deck_response = (
            supabase
            .table("decks")
            .select("id")
            .eq("id", deck_id)
            .limit(1)
            .execute()
        )

        deck_rows = deck_response.data or []

        if not deck_rows:
            return jsonify(message="Deck nicht gefunden."), 404

        # Prüfen, ob Karte existiert
        pokemon_card_response = (
            supabase
            .table("pokemon_cards")
            .select("""
                id,
                name,
                card_type,
                subtype,
                regulation_mark
            """)
            .eq("id", card_id)
            .limit(1)
            .execute()
        )

        pokemon_card_rows = pokemon_card_response.data or []

        if not pokemon_card_rows:
            return jsonify(message="Pokémon-Karte nicht gefunden."), 404

        # Prüfen, ob diese Karte bereits im Deck ist
        existing_response = (
            supabase
            .table("pokemon_deck_cards")
            .select("""
                id,
                card_id,
                quantity,
                position,
                reasoning
            """)
            .eq("deck_id", deck_id)
            .eq("card_id", card_id)
            .limit(1)
            .execute()
        )

        existing_rows = existing_response.data or []

        # Karte existiert schon -> quantity erhöhen
        if existing_rows:
            existing_card = existing_rows[0]

            new_quantity = existing_card["quantity"] + quantity

            update_data = {
                "quantity": new_quantity
            }

            # Optional neue Werte übernehmen
            if position is not None:
                update_data["position"] = position

            if reasoning is not None:
                update_data["reasoning"] = reasoning

            update_response = (
                supabase
                .table("pokemon_deck_cards")
                .update(update_data)
                .eq("id", existing_card["id"])
                .execute()
            )

            deck_card_id = existing_card["id"]

        else:
            # Karte ist noch nicht im Deck -> neu anlegen
            insert_response = (
                supabase
                .table("pokemon_deck_cards")
                .insert({
                    "deck_id": deck_id,
                    "card_id": card_id,
                    "quantity": quantity,
                    "position": position,
                    "reasoning": reasoning
                })
                .execute()
            )

            inserted_rows = insert_response.data or []

            if not inserted_rows:
                return jsonify(
                    message="Karte konnte nicht hinzugefügt werden."
                ), 500

            deck_card_id = inserted_rows[0]["id"]

        # Ergebnis inklusive pokemon_cards laden
        card_response = (
            supabase
            .table("pokemon_deck_cards")
            .select("""
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
            """)
            .eq("id", deck_card_id)
            .limit(1)
            .execute()
        )

        card_rows = card_response.data or []

        if not card_rows:
            return jsonify(
                message="Karte konnte nach dem Speichern nicht geladen werden."
            ), 500

        return jsonify(card_rows[0]), 200 if existing_rows else 201

    except Exception as error:
        print("Fehler beim Hinzufügen der Karte:", error)

        return jsonify(
            message="Karte konnte nicht hinzugefügt werden."
        ), 500