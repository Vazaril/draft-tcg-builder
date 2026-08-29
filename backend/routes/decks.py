import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from supabase import create_client


# ==========================================================
# Environment
# ==========================================================

env_path = Path(__file__).resolve().parents[2] / ".env.local"
load_dotenv(env_path)


# ==========================================================
# Supabase
# ==========================================================

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]


# ==========================================================
# Blueprint
# ==========================================================

decks_bp = Blueprint(
    "decks",
    __name__,
    url_prefix="/api/decks"
)


# ==========================================================
# Supabase Client
# ==========================================================

def get_supabase():
    """
    Supabase Client mit dem Token des eingeloggten Users erstellen.
    Dadurch greifen die RLS-Regeln des eingeloggten Users.
    """

    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.removeprefix("Bearer ").strip()

    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
    )

    supabase.postgrest.auth(token)

    return supabase


# ==========================================================
# Hilfsfunktion: Decktyp bestimmen
# ==========================================================

def _get_deck_type(supabase, deck_id):
    """
    Gibt 'pokemon', 'magic' oder None zurück.
    """

    pokemon_response = (
        supabase
        .table("decks")
        .select("id")
        .eq("id", deck_id)
        .limit(1)
        .execute()
    )

    if pokemon_response.data:
        return "pokemon"

    magic_response = (
        supabase
        .table("mtg_decks")
        .select("id")
        .eq("id", deck_id)
        .limit(1)
        .execute()
    )

    if magic_response.data:
        return "magic"

    return None


# ==========================================================
# Hilfsfunktion: Karte löschen / Menge reduzieren
# ==========================================================

def _delete_or_reduce_card(
        supabase,
        deck_id,
        card_id,
        amount=None,
        zone=None
):
    """
    Löscht eine Karte vollständig oder reduziert ihre Anzahl.

    Pokémon:
        card_id = pokemon_deck_cards.id

    Magic:
        card_id = mtg_deck_cards.card_id / mtg_cards.id
        zone kann optional angegeben werden.

    Gibt ein dict zurück und keine Flask Response.
    """

    deck_type = _get_deck_type(
        supabase,
        deck_id
    )

    if not deck_type:
        return {
            "card_id": card_id,
            "error": "Deck nicht gefunden.",
            "status": 404
        }

    # ======================================================
    # Pokémon
    # ======================================================

    if deck_type == "pokemon":
        card_response = (
            supabase
            .table("pokemon_deck_cards")
            .select("""
                id,
                quantity
            """)
            .eq("id", card_id)
            .eq("deck_id", deck_id)
            .limit(1)
            .execute()
        )

        rows = card_response.data or []

        if not rows:
            return {
                "card_id": card_id,
                "error": "Karte nicht gefunden.",
                "status": 404
            }

        card = rows[0]

        current_quantity = card["quantity"]

        amount_to_remove = (
            amount
            if amount is not None
            else current_quantity
        )

        if amount_to_remove <= 0:
            return {
                "card_id": card_id,
                "error": "amount muss größer als 0 sein.",
                "status": 400
            }

        # Komplette Karte löschen
        if amount_to_remove >= current_quantity:
            (
                supabase
                .table("pokemon_deck_cards")
                .delete()
                .eq("id", card_id)
                .eq("deck_id", deck_id)
                .execute()
            )

            return {
                "card_id": card_id,
                "game_type": "pokemon",
                "deleted": True,
                "remaining_quantity": 0
            }

        # Quantity reduzieren
        new_quantity = (
                current_quantity -
                amount_to_remove
        )

        (
            supabase
            .table("pokemon_deck_cards")
            .update({
                "quantity": new_quantity
            })
            .eq("id", card_id)
            .eq("deck_id", deck_id)
            .execute()
        )

        return {
            "card_id": card_id,
            "game_type": "pokemon",
            "deleted": False,
            "remaining_quantity": new_quantity
        }

    # ======================================================
    # Magic
    # ======================================================

    query = (
        supabase
        .table("mtg_deck_cards")
        .select("""
            card_id,
            quantity,
            zone
        """)
        .eq("deck_id", deck_id)
        .eq("card_id", card_id)
    )

    if zone:
        query = query.eq(
            "zone",
            zone
        )

    card_response = (
        query
        .limit(1)
        .execute()
    )

    rows = card_response.data or []

    if not rows:
        return {
            "card_id": card_id,
            "error": "Karte nicht gefunden.",
            "status": 404
        }

    card = rows[0]

    current_quantity = card["quantity"]
    card_zone = card["zone"]

    amount_to_remove = (
        amount
        if amount is not None
        else current_quantity
    )

    if amount_to_remove <= 0:
        return {
            "card_id": card_id,
            "error": "amount muss größer als 0 sein.",
            "status": 400
        }

    # Komplette Karte löschen
    if amount_to_remove >= current_quantity:
        (
            supabase
            .table("mtg_deck_cards")
            .delete()
            .eq("deck_id", deck_id)
            .eq("card_id", card_id)
            .eq("zone", card_zone)
            .execute()
        )

        return {
            "card_id": card_id,
            "game_type": "magic",
            "zone": card_zone,
            "deleted": True,
            "remaining_quantity": 0
        }

    # Quantity reduzieren
    new_quantity = (
            current_quantity -
            amount_to_remove
    )

    (
        supabase
        .table("mtg_deck_cards")
        .update({
            "quantity": new_quantity
        })
        .eq("deck_id", deck_id)
        .eq("card_id", card_id)
        .eq("zone", card_zone)
        .execute()
    )

    return {
        "card_id": card_id,
        "game_type": "magic",
        "zone": card_zone,
        "deleted": False,
        "remaining_quantity": new_quantity
    }


# ==========================================================
# GET /api/decks
# Alle Pokémon- und Magic-Decks
# ==========================================================

@decks_bp.get("")
def list_decks():
    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    try:
        # --------------------------------------------------
        # Pokémon Decks
        # --------------------------------------------------

        pokemon_response = (
            supabase
            .table("decks")
            .select("""
                *,
                games (
                    id,
                    name
                )
            """)
            .order(
                "updated_at",
                desc=True
            )
            .execute()
        )

        pokemon_decks = []

        for deck in pokemon_response.data or []:
            pokemon_decks.append({
                "id": deck["id"],
                "name": deck["name"],
                "description": deck.get("description"),
                "format": deck.get("format"),
                "tags": deck.get("tags") or [],
                "accent": deck.get("accent") or "primary",
                "game": (
                    deck["games"]["name"]
                    if deck.get("games")
                    else "Pokémon TCG"
                ),
                "game_type": "pokemon",
                "created_at": deck.get("created_at"),
                "updated_at": deck.get("updated_at"),
            })

        # --------------------------------------------------
        # Magic Decks
        # --------------------------------------------------

        magic_response = (
            supabase
            .table("mtg_decks")
            .select("*")
            .order(
                "updated_at",
                desc=True
            )
            .execute()
        )

        magic_decks = []

        for deck in magic_response.data or []:
            format_name = ""

            if deck.get("format_id"):
                format_response = (
                    supabase
                    .table("mtg_formats")
                    .select("name")
                    .eq(
                        "id",
                        deck["format_id"]
                    )
                    .limit(1)
                    .execute()
                )

                if format_response.data:
                    format_name = (
                        format_response
                        .data[0]["name"]
                    )

            magic_decks.append({
                "id": deck["id"],
                "name": deck["name"],
                "description": deck.get("description"),
                "format": format_name,
                "tags": [],
                "accent": "secondary",
                "game": "Magic: The Gathering",
                "game_type": "magic",
                "created_at": deck.get("created_at"),
                "updated_at": deck.get("updated_at"),
            })

        # --------------------------------------------------
        # Zusammenführen
        # --------------------------------------------------

        all_decks = (
                pokemon_decks +
                magic_decks
        )

        all_decks.sort(
            key=lambda deck:
            deck.get("updated_at") or "",
            reverse=True
        )

        return jsonify(
            all_decks
        ), 200

    except Exception as error:
        return jsonify(
            message="Decks konnten nicht geladen werden.",
            error=str(error)
        ), 500


# ==========================================================
# GET /api/decks/card-options
#
# Standard:
#   Pokémon
#
# Magic:
#   /api/decks/card-options?game_type=magic
# ==========================================================

@decks_bp.get("/card-options")
def get_card_options():
    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    game_type = request.args.get(
        "game_type",
        "pokemon"
    )

    try:
        # --------------------------------------------------
        # Magic Karten
        # --------------------------------------------------

        if game_type == "magic":
            response = (
                supabase
                .table("mtg_cards")
                .select("""
                    id,
                    name,
                    mana_cost,
                    type_line,
                    rarity,
                    image_uri
                """)
                .order("name")
                .execute()
            )

            return jsonify(
                response.data or []
            ), 200

        # --------------------------------------------------
        # Pokémon Karten
        # --------------------------------------------------

        response = (
            supabase
            .table("pokemon_cards")
            .select("""
                id,
                name,
                card_type,
                subtype,
                regulation_mark
            """)
            .order("name")
            .execute()
        )

        return jsonify(
            response.data or []
        ), 200

    except Exception as error:
        return jsonify(
            message="Karten konnten nicht geladen werden.",
            error=str(error)
        ), 500


# ==========================================================
# GET /api/decks/<deck_id>
# Einzeldeck mit Karten
# ==========================================================

@decks_bp.get("/<deck_id>")
def get_deck(deck_id):
    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    try:
        # ==================================================
        # Pokémon
        # ==================================================

        pokemon_response = (
            supabase
            .table("decks")
            .select("""
                *,
                games (
                    id,
                    name
                )
            """)
            .eq(
                "id",
                deck_id
            )
            .limit(1)
            .execute()
        )

        if pokemon_response.data:
            deck = pokemon_response.data[0]

            cards_response = (
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
                .eq(
                    "deck_id",
                    deck_id
                )
                .order("position")
                .execute()
            )

            return jsonify({
                "id": deck["id"],
                "name": deck["name"],
                "description": deck.get("description"),
                "format": deck.get("format"),
                "tags": deck.get("tags") or [],
                "accent": deck.get("accent") or "primary",

                "game": (
                    deck["games"]["name"]
                    if deck.get("games")
                    else "Pokémon TCG"
                ),

                "game_type": "pokemon",

                "created_at": deck.get("created_at"),
                "updated_at": deck.get("updated_at"),

                "cards": cards_response.data or [],
            }), 200

        # ==================================================
        # Magic
        # ==================================================

        magic_response = (
            supabase
            .table("mtg_decks")
            .select("*")
            .eq(
                "id",
                deck_id
            )
            .limit(1)
            .execute()
        )

        if magic_response.data:
            deck = magic_response.data[0]

            # ----------------------------------------------
            # Format
            # ----------------------------------------------

            format_name = ""

            if deck.get("format_id"):
                format_response = (
                    supabase
                    .table("mtg_formats")
                    .select("name")
                    .eq(
                        "id",
                        deck["format_id"]
                    )
                    .limit(1)
                    .execute()
                )

                if format_response.data:
                    format_name = (
                        format_response
                        .data[0]["name"]
                    )

            # ----------------------------------------------
            # Deck-Karten
            # ----------------------------------------------

            deck_cards_response = (
                supabase
                .table("mtg_deck_cards")
                .select("""
                    card_id,
                    quantity,
                    zone
                """)
                .eq(
                    "deck_id",
                    deck_id
                )
                .execute()
            )

            cards = []

            for entry in deck_cards_response.data or []:
                card_response = (
                    supabase
                    .table("mtg_cards")
                    .select("""
                        id,
                        name,
                        mana_cost,
                        cmc,
                        type_line,
                        oracle_text,
                        power,
                        toughness,
                        loyalty,
                        colors,
                        color_identity,
                        keywords,
                        image_uri,
                        set_code,
                        set_name,
                        rarity,
                        legalities
                    """)
                    .eq(
                        "id",
                        entry["card_id"]
                    )
                    .limit(1)
                    .execute()
                )

                card_rows = (
                        card_response.data or []
                )

                if not card_rows:
                    continue

                cards.append({
                    "card_id": entry["card_id"],
                    "quantity": entry["quantity"],
                    "zone": entry["zone"],
                    "mtg_cards": card_rows[0],
                })

            return jsonify({
                "id": deck["id"],
                "name": deck["name"],
                "description": deck.get("description"),

                "format": format_name,

                "tags": [],
                "accent": "secondary",

                "game": "Magic: The Gathering",
                "game_type": "magic",

                "created_at": deck.get("created_at"),
                "updated_at": deck.get("updated_at"),

                "cards": cards,
            }), 200

        return jsonify(
            message="Deck nicht gefunden."
        ), 404

    except Exception as error:
        return jsonify(
            message="Deck konnte nicht geladen werden.",
            error=str(error)
        ), 500


# ==========================================================
# POST /api/decks
# Noch nicht implementiert
# ==========================================================

@decks_bp.post("")
def create_deck():
    return jsonify(
        message="not implemented"
    ), 501


# ==========================================================
# POST /api/decks/<deck_id>/cards
# Karte hinzufügen
# ==========================================================

@decks_bp.post("/<deck_id>/cards")
def add_deck_card(deck_id):
    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    body = request.get_json(
        silent=True
    ) or {}

    card_id = body.get("card_id")
    quantity = body.get(
        "quantity",
        1
    )

    if not card_id:
        return jsonify(
            message="card_id fehlt."
        ), 400

    if (
            not isinstance(quantity, int)
            or quantity <= 0
    ):
        return jsonify(
            message=(
                "quantity muss eine ganze Zahl "
                "größer als 0 sein."
            )
        ), 400

    try:
        deck_type = _get_deck_type(
            supabase,
            deck_id
        )

        if not deck_type:
            return jsonify(
                message="Deck nicht gefunden."
            ), 404

        # ==================================================
        # Pokémon
        # ==================================================

        if deck_type == "pokemon":
            position = body.get("position")
            reasoning = body.get("reasoning")

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
                .eq(
                    "id",
                    card_id
                )
                .limit(1)
                .execute()
            )

            if not pokemon_card_response.data:
                return jsonify(
                    message="Pokémon-Karte nicht gefunden."
                ), 404

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
                .eq(
                    "deck_id",
                    deck_id
                )
                .eq(
                    "card_id",
                    card_id
                )
                .limit(1)
                .execute()
            )

            existing_rows = (
                    existing_response.data or []
            )

            # Karte existiert bereits
            if existing_rows:
                existing_card = (
                    existing_rows[0]
                )

                new_quantity = (
                        existing_card["quantity"]
                        + quantity
                )

                update_data = {
                    "quantity": new_quantity
                }

                if position is not None:
                    update_data["position"] = position

                if reasoning is not None:
                    update_data["reasoning"] = reasoning

                (
                    supabase
                    .table("pokemon_deck_cards")
                    .update(update_data)
                    .eq(
                        "id",
                        existing_card["id"]
                    )
                    .execute()
                )

                deck_card_id = (
                    existing_card["id"]
                )

                status = 200

            # Neue Karte
            else:
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

                inserted_rows = (
                        insert_response.data or []
                )

                if not inserted_rows:
                    return jsonify(
                        message=(
                            "Karte konnte nicht "
                            "hinzugefügt werden."
                        )
                    ), 500

                deck_card_id = (
                    inserted_rows[0]["id"]
                )

                status = 201

            # Ergebnis laden
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
                .eq(
                    "id",
                    deck_card_id
                )
                .limit(1)
                .execute()
            )

            if not card_response.data:
                return jsonify(
                    message=(
                        "Karte konnte nach dem "
                        "Speichern nicht geladen werden."
                    )
                ), 500

            return jsonify(
                card_response.data[0]
            ), status

        # ==================================================
        # Magic
        # ==================================================

        zone = body.get(
            "zone",
            "mainboard"
        )

        valid_zones = {
            "mainboard",
            "sideboard",
            "commander",
            "maybeboard"
        }

        if zone not in valid_zones:
            return jsonify(
                message="Ungültige zone."
            ), 400

        magic_card_response = (
            supabase
            .table("mtg_cards")
            .select("""
                id,
                name,
                mana_cost,
                type_line,
                rarity,
                image_uri
            """)
            .eq(
                "id",
                card_id
            )
            .limit(1)
            .execute()
        )

        if not magic_card_response.data:
            return jsonify(
                message="Magic-Karte nicht gefunden."
            ), 404

        existing_response = (
            supabase
            .table("mtg_deck_cards")
            .select("""
                card_id,
                quantity,
                zone
            """)
            .eq(
                "deck_id",
                deck_id
            )
            .eq(
                "card_id",
                card_id
            )
            .eq(
                "zone",
                zone
            )
            .limit(1)
            .execute()
        )

        existing_rows = (
                existing_response.data or []
        )

        if existing_rows:
            existing_card = (
                existing_rows[0]
            )

            new_quantity = (
                    existing_card["quantity"]
                    + quantity
            )

            (
                supabase
                .table("mtg_deck_cards")
                .update({
                    "quantity": new_quantity
                })
                .eq(
                    "deck_id",
                    deck_id
                )
                .eq(
                    "card_id",
                    card_id
                )
                .eq(
                    "zone",
                    zone
                )
                .execute()
            )

            status = 200

        else:
            (
                supabase
                .table("mtg_deck_cards")
                .insert({
                    "deck_id": deck_id,
                    "card_id": card_id,
                    "quantity": quantity,
                    "zone": zone
                })
                .execute()
            )

            new_quantity = quantity
            status = 201

        return jsonify({
            "card_id": card_id,
            "quantity": new_quantity,
            "zone": zone,
            "mtg_cards": magic_card_response.data[0]
        }), status

    except Exception as error:
        return jsonify(
            message="Karte konnte nicht hinzugefügt werden.",
            error=str(error)
        ), 500


# ==========================================================
# DELETE /api/decks/<deck_id>/cards/<deck_card_id>
# Einzelne Karte komplett oder teilweise löschen
# ==========================================================

@decks_bp.delete("/<deck_id>/cards/<deck_card_id>")
def delete_deck_card(
        deck_id,
        deck_card_id
):
    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    amount_raw = request.args.get(
        "amount"
    )

    zone = request.args.get(
        "zone"
    )

    amount = None

    if amount_raw is not None:
        try:
            amount = int(
                amount_raw
            )

        except ValueError:
            return jsonify(
                message="amount muss eine Zahl sein."
            ), 400

        if amount <= 0:
            return jsonify(
                message="amount muss größer als 0 sein."
            ), 400

    try:
        result = _delete_or_reduce_card(
            supabase,
            deck_id,
            deck_card_id,
            amount,
            zone
        )

        if "error" in result:
            return jsonify(
                message=result["error"]
            ), result["status"]

        message = (
            "Karte wurde vollständig entfernt."
            if result["deleted"]
            else "Kartenmenge wurde reduziert."
        )

        return jsonify(
            message=message,
            **result
        ), 200

    except Exception as error:
        return jsonify(
            message="Karte konnte nicht gelöscht werden.",
            error=str(error)
        ), 500


# ==========================================================
# POST /api/decks/<deck_id>/cards/bulk-delete
# Mehrere Karten löschen oder reduzieren
# ==========================================================

@decks_bp.post("/<deck_id>/cards/bulk-delete")
def bulk_delete_deck_cards(deck_id):
    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    body = request.get_json(
        silent=True
    ) or {}

    cards_to_delete = body.get(
        "cards"
    )

    if (
            not isinstance(cards_to_delete, list)
            or not cards_to_delete
    ):
        return jsonify(
            message="'cards' muss eine nicht-leere Liste sein."
        ), 400

    results = []

    for entry in cards_to_delete:
        if not isinstance(entry, dict):
            results.append({
                "card_id": None,
                "error": "Ungültiger Eintrag.",
                "status": 400
            })

            continue

        card_id = entry.get(
            "card_id"
        )

        amount = entry.get(
            "amount"
        )

        zone = entry.get(
            "zone"
        )

        if not card_id:
            results.append({
                "card_id": None,
                "error": "card_id fehlt.",
                "status": 400
            })

            continue

        if amount is not None:
            if (
                    not isinstance(amount, int)
                    or amount <= 0
            ):
                results.append({
                    "card_id": card_id,
                    "error": (
                        "amount muss eine ganze Zahl "
                        "größer als 0 sein."
                    ),
                    "status": 400
                })

                continue

        try:
            result = _delete_or_reduce_card(
                supabase,
                deck_id,
                card_id,
                amount,
                zone
            )

            results.append(
                result
            )

        except Exception:
            results.append({
                "card_id": card_id,
                "error": (
                    "Karte konnte nicht "
                    "gelöscht werden."
                ),
                "status": 500
            })

    has_errors = any(
        "error" in result
        for result in results
    )

    return jsonify(
        results=results
    ), 207 if has_errors else 200


# ==========================================================
# DELETE /api/decks/<deck_id>
# Komplettes Deck inklusive Karten löschen
# ==========================================================

@decks_bp.delete("/<deck_id>")
def delete_deck(deck_id):
    supabase = get_supabase()

    if not supabase:
        return jsonify(message="Unauthorized"), 401

    try:
        deck_type = _get_deck_type(
            supabase,
            deck_id
        )

        if not deck_type:
            return jsonify(
                message="Deck nicht gefunden."
            ), 404

        # ==================================================
        # Pokémon
        # ==================================================

        if deck_type == "pokemon":
            # Deckkarten
            (
                supabase
                .table("pokemon_deck_cards")
                .delete()
                .eq(
                    "deck_id",
                    deck_id
                )
                .execute()
            )

            # Pokémon-Deck-Zuordnung
            (
                supabase
                .table("pokemon_decks")
                .delete()
                .eq(
                    "deck_id",
                    deck_id
                )
                .execute()
            )

            # Tags
            (
                supabase
                .table("deck_tags")
                .delete()
                .eq(
                    "deck_id",
                    deck_id
                )
                .execute()
            )

            # Deck selbst
            (
                supabase
                .table("decks")
                .delete()
                .eq(
                    "id",
                    deck_id
                )
                .execute()
            )

            return jsonify(
                message="Deck wurde gelöscht.",
                deck_id=deck_id,
                game_type="pokemon"
            ), 200

        # ==================================================
        # Magic
        # ==================================================

        # Erst alle Deckkarten entfernen
        (
            supabase
            .table("mtg_deck_cards")
            .delete()
            .eq(
                "deck_id",
                deck_id
            )
            .execute()
        )

        # Danach Deck selbst entfernen
        (
            supabase
            .table("mtg_decks")
            .delete()
            .eq(
                "id",
                deck_id
            )
            .execute()
        )

        return jsonify(
            message="Deck wurde gelöscht.",
            deck_id=deck_id,
            game_type="magic"
        ), 200

    except Exception as error:
        return jsonify(
            message="Deck konnte nicht gelöscht werden.",
            error=str(error)
        ), 500