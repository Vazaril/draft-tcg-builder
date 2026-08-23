# backend/services/ingestion/loader.py
from supabase import Client


def fetch_cards_in_batches(supabase: Client, batch_size=200):
    """Yields batches of cards that have not been embedded yet."""
    while True:
        response = (supabase.table("mtg_cards")
                    .select("id, oracle_id, name, type_line, mana_cost, oracle_text, legalities")
                    .eq("is_embedded", False)
                    .limit(batch_size)
                    .execute())

        if not response.data:
            break
        yield response.data


def fetch_rulings_in_batches(supabase: Client, batch_size=200):
    """Yields batches of rulings that have not been embedded yet."""
    while True:
        response = (supabase.table("mtg_rulings")
                    .select("id, oracle_id, comment, published_at")
                    .eq("is_embedded", False)
                    .limit(batch_size)
                    .execute())

        if not response.data:
            break
        yield response.data


def mark_cards_as_embedded(supabase: Client, card_ids: list[str]):
    """Marks processed cards as embedded so they are skipped next time."""
    if not card_ids:
        return
    supabase.table("mtg_cards").update({"is_embedded": True}).in_("id", card_ids).execute()


def mark_rulings_as_embedded(supabase: Client, ruling_ids: list[str]):
    """Marks processed rulings as embedded so they are skipped next time."""
    if not ruling_ids:
        return
    supabase.table("mtg_rulings").update({"is_embedded": True}).in_("id", ruling_ids).execute()