"""
Embeds MTG cards from Supabase (READ-ONLY - only .select(), never writes back to
Supabase / never touches is_embedded) using qwen3-embedding:0.6b via the local TEI
(text-embeddings-inference) container, and stores them in the local Postgres/pgvector
test table (vecs.mtg_nodes_qwen06b, 1024 dims - see schema_qwen06b_test.sql).

Two selection modes (mutually exclusive):
  --count N        Embed the first N cards, ordered by id.
  --ids-csv PATH    Embed only the cards whose ids are listed in this CSV file.
                     The CSV needs a header row with a column named "id", e.g.:
                         id
                         3b2f1a2e-...
                         9c7d4e10-...

Prerequisites:
- Local test Postgres running on localhost:15433 (schema_qwen06b_test.sql applied)
- The `embedder` service from docker-compose.yaml running (TEI, Qwen3-Embedding-0.6B)
- backend/.env has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set

Run from backend/ with the repo's venv active and .env already sourced into the shell:
    python embed_cards_local.py --count 2000
    python embed_cards_local.py --ids-csv my_card_ids.csv
"""
import argparse
import csv
import json
import os
import sys
import time

sys.path.insert(0, os.getcwd())

import psycopg2
from supabase import create_client
from llama_index.embeddings.text_embeddings_inference import TextEmbeddingsInference

PAGE_SIZE = 100
TEST_DB_URL = "postgresql://postgres:test@localhost:15433/mtg_vector_db_test"
MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"


def parse_args():
    parser = argparse.ArgumentParser(description="Embed MTG cards locally with qwen3-embedding:0.6b")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--count", type=int, help="Embed the first N cards, ordered by id")
    group.add_argument("--ids-csv", type=str, help="CSV file with an 'id' column listing which cards to embed")
    return parser.parse_args()


def read_ids_from_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if "id" not in (reader.fieldnames or []):
            raise ValueError(f"CSV must have a header row with an 'id' column, got: {reader.fieldnames}")
        return [row["id"].strip() for row in reader if row["id"].strip()]


def fetch_cards_by_count(supabase, total):
    all_rows = []
    offset = 0
    while len(all_rows) < total:
        page = min(PAGE_SIZE, total - len(all_rows))
        rows = (
            supabase.table("mtg_cards")
            .select("*")
            .order("id")
            .range(offset, offset + page - 1)
            .execute()
            .data
        )
        if not rows:
            break
        all_rows.extend(rows)
        offset += page
    return all_rows


def fetch_cards_by_ids(supabase, ids):
    all_rows = []
    for i in range(0, len(ids), PAGE_SIZE):
        chunk = ids[i:i + PAGE_SIZE]
        rows = supabase.table("mtg_cards").select("*").in_("id", chunk).execute().data
        all_rows.extend(rows)
    return all_rows


def build_text_and_metadata(row):
    text = (
        f"{row['name']}\n{row.get('type_line') or ''}\n{row.get('oracle_text') or ''}\n"
        f"Keywords: {', '.join(row.get('keywords') or [])}"
    )
    metadata = {
        "type": "card",
        "name": row["name"],
        "cmc": row.get("cmc"),
        "keywords": row.get("keywords") or [],
        "text": row.get("oracle_text") or "",
    }
    return text, metadata


def main():
    args = parse_args()
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    print("--- Fetching cards (read-only) ---")
    if args.ids_csv:
        ids = read_ids_from_csv(args.ids_csv)
        print(f"Read {len(ids)} ids from {args.ids_csv}")
        rows = fetch_cards_by_ids(supabase, ids)
    else:
        rows = fetch_cards_by_count(supabase, args.count)
    print(f"Fetched {len(rows)} cards (nothing written back to Supabase)")

    embedder = TextEmbeddingsInference(
        model_name=MODEL_NAME,
        base_url=os.environ.get("EMBEDDER_BASE_URL") or "http://localhost:8082",
    )

    conn = psycopg2.connect(TEST_DB_URL)
    cur = conn.cursor()

    print(f"\n--- Embedding {len(rows)} cards locally via TEI ---")
    start = time.time()

    for i, row in enumerate(rows, start=1):
        text, metadata = build_text_and_metadata(row)
        vec = embedder.get_text_embedding(text)
        vector_str = "[" + ",".join(map(str, vec)) + "]"

        cur.execute(
            "INSERT INTO vecs.mtg_nodes_qwen06b (id, vec, metadata) VALUES (%s, %s::vector, %s::jsonb) "
            "ON CONFLICT (id) DO UPDATE SET vec = EXCLUDED.vec, metadata = EXCLUDED.metadata",
            (row["id"], vector_str, json.dumps(metadata)),
        )

        if i % 25 == 0 or i == len(rows):
            conn.commit()
            elapsed = time.time() - start
            rate = i / elapsed
            print(f"  {i}/{len(rows)} embedded ({elapsed:.1f}s elapsed, {rate:.2f} cards/s)")

    conn.commit()
    total_time = time.time() - start
    print(f"\nDone. {len(rows)} cards embedded and stored in local test DB in {total_time:.1f}s.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
