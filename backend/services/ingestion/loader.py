from supabase import Client

def fetch_cards_in_batches(supabase: Client, batch_size: int = 5):
    while True:
        response = (
            supabase.schema("internal")
            .table("v_cards_for_ingestion")
            .select("id, oracle_id, embedding_text, metadata")
            .limit(batch_size)
            .execute()
        )
        if not response.data:
            break
        yield response.data

def fetch_rulings_in_batches(supabase: Client, batch_size: int = 5):
    while True:
        response = (
            supabase.schema("internal")
            .table("v_rulings_for_ingestion")
            .select("id, oracle_id, embedding_text, metadata")
            .limit(batch_size)
            .execute()
        )
        if not response.data:
            break
        yield response.data

def mark_cards_as_embedded(supabase: Client, ids: list[str]):
    supabase.table("mtg_cards").update({"is_embedded": True}).in_("id", ids).execute()

def mark_rulings_as_embedded(supabase: Client, ids: list[str]):
    supabase.table("mtg_rulings").update({"is_embedded": True}).in_("id", ids).execute()