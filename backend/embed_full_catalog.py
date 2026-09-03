"""
Full-catalog embed run: embeds ALL distinct cards (~27.5k, deduped by
oracle_id) and ALL rulings (~78.4k) via the local TEI service
(Qwen/Qwen3-Embedding-0.6B, 1024 dims), writes SQL INSERT statements for
vecs.mtg_nodes to two .sql files, and marks each row as embedded in Supabase
as it goes.

Reads mtg_cards / mtg_rulings directly (NOT the internal.*_for_ingestion
views), the same way embed_cards_to_sql.py's 500-card test batch did,
because every row in Supabase already has is_embedded=true (leftover from
whatever produced the existing full_mtg_vector_db.zip dump), so the views -
which filter on that flag - return nothing. The is_embedded write-back here
is therefore mostly a no-op re-affirmation against current data, but keeps
this run consistent with the original pipeline's semantics for any future
re-embedding of freshly-added, not-yet-embedded cards/rulings.

Node/metadata shape matches the existing dump (verified against a sample
row - see embed_cards_to_sql.py), built via node_to_metadata_dict(). Two
fields could not be reproduced exactly and default to []: "phases" and
"mechanics" on ruling nodes appear to have been computed by some tagging
step inside the original (now-empty) ingestion view; nothing in the current
codebase reads them, so this is a low-risk simplification, not a silent
guess at something load-bearing.

Runs standalone - independent of any chat session. Meant to run for hours
unattended, so it is resumable: progress is checkpointed to
db_setup/.embed_progress_{cards,rulings}.json after every embedded batch,
and --resume picks up exactly where a previous run left off (or crashed).

Throughput note: the TEI CPU/candle backend for this model caps out at a
batch size of 4 per request (confirmed in its own startup logs: "Backend
does not support a batch size > 4"), so --embed-batch-size defaults to 4.
--workers keeps multiple such batches in flight concurrently. Expect
roughly 3-4x the ~1 card/s single-request rate from the 500-card test, i.e.
several hours for the full ~106k rows on CPU - reasonable for an overnight
run, but if it's still going in the morning, just let it keep running or
Ctrl+C and resume later with --resume.

Prerequisites:
- The `embedder` service from docker-compose.yaml running (TEI on :8082)
- backend/.env has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set

Run from backend/ with the repo's venv active and .env already sourced into the shell:
    python embed_full_catalog.py --target both --resume
"""
import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.getcwd())

import httpx
from supabase import create_client
from llama_index.core import Document
from llama_index.core.schema import IndexNode
from llama_index.core.vector_stores.utils import node_to_metadata_dict

from services.ingestion.loader import mark_rulings_as_embedded

PAGE_SIZE = 500
MARK_EMBEDDED_EVERY = 200
MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"
DB_SETUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_setup")


def parse_args():
    parser = argparse.ArgumentParser(description="Embed the full card+ruling catalog and export as SQL INSERTs")
    parser.add_argument("--target", choices=["cards", "rulings", "both"], default="both")
    parser.add_argument("--out-dir", default=DB_SETUP_DIR)
    parser.add_argument("--workers", type=int, default=2, help="Concurrent embedding batches in flight")
    parser.add_argument("--embed-batch-size", type=int, default=4, help="Texts per TEI /embed request (backend caps at 4)")
    parser.add_argument("--resume", action="store_true", help="Continue from the last checkpoint instead of starting over")
    parser.add_argument("--no-mark-embedded", action="store_true", help="Skip writing is_embedded back to Supabase")
    parser.add_argument("--limit", type=int, default=None, help="Stop after N distinct rows per target (smoke-testing)")
    return parser.parse_args()


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


_http_client = httpx.Client(timeout=120.0)


def embed_batch(texts, base_url, max_retries=8):
    """POSTs to TEI's /embed with retry+backoff. TEI returns 429 when its
    internal queue is full under concurrent load - not a fatal error, just
    back off and try again, since this runs unattended for hours."""
    delay = 2.0
    for attempt in range(max_retries + 1):
        try:
            resp = _http_client.post(f"{base_url}/embed", json={"inputs": texts})
            if resp.status_code == 429 or resp.status_code >= 500:
                raise httpx.HTTPStatusError("retryable", request=resp.request, response=resp)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPStatusError, httpx.TransportError) as e:
            if attempt == max_retries:
                raise
            print(f"    (embed request failed: {e!r}, retrying in {delay:.0f}s)")
            time.sleep(delay)
            delay = min(delay * 2, 30.0)


def mark_cards_as_embedded_by_oracle_id(supabase, oracle_ids):
    """Marks ALL printings sharing each oracle_id, since embedding is deduped
    by oracle_id (unlike loader.mark_cards_as_embedded, which marks by the
    per-printing mtg_cards.id and expects one row per embedded id)."""
    supabase.table("mtg_cards").update({"is_embedded": True}).in_("oracle_id", oracle_ids).execute()


def load_checkpoint(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f).get("last_key")
    return None


def save_checkpoint(path, last_key, done_count):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"last_key": last_key, "done_count": done_count}, f)


def build_card_node(row):
    keywords = row.get("keywords") or []
    colors = row.get("colors") or []
    legalities = row.get("legalities") or {}
    cmc = row.get("cmc")
    if cmc is None:
        cmc = 0

    text = (
        f"{row['name']}\n{row.get('type_line') or ''}\n{row.get('oracle_text') or ''}\n"
        f"Keywords: {', '.join(keywords)}"
    )
    metadata = {
        "cmc": cmc,
        "name": row["name"],
        "type": "card",
        "colors": colors,
        "phases": [],
        "keywords": keywords,
        "mechanics": [],
        "oracle_id": row["oracle_id"],
        "legalities": legalities,
    }
    return Document(text=text, id_=str(row["oracle_id"]), metadata=metadata, excluded_llm_metadata_keys=["legalities"])


def build_ruling_node(row, card_name):
    published_at = row.get("published_at") or "Unknown Date"
    text = f"Official Ruling for {card_name} ({published_at}): {row.get('comment') or ''}"
    metadata = {
        "type": "ruling",
        "phases": [],
        "card_name": card_name,
        "mechanics": [],
        "oracle_id": row["oracle_id"],
        "published_at": published_at,
    }
    node = IndexNode(id_=str(row["id"]), index_id=str(row["oracle_id"]), metadata=metadata)
    node.set_content(text)
    return node


def iter_card_chunks(supabase, resume_after_oracle_id, chunk_size, limit=None):
    """Yields (nodes_chunk, last_oracle_id_in_chunk). Dedupes by oracle_id
    (multiple mtg_cards rows/printings can share one); resumable via a
    strictly-greater-than oracle_id cursor."""
    pending = []
    seen = set()
    cursor = resume_after_oracle_id
    total = 0

    while limit is None or total < limit:
        query = supabase.table("mtg_cards").select("*").order("oracle_id").limit(PAGE_SIZE)
        if cursor:
            query = query.gt("oracle_id", cursor)
        rows = query.execute().data
        if not rows:
            break

        for row in rows:
            oid = row["oracle_id"]
            cursor = oid
            if oid in seen:
                continue
            seen.add(oid)
            pending.append(build_card_node(row))
            total += 1
            if len(pending) >= chunk_size:
                yield pending, cursor
                pending = []
            if limit is not None and total >= limit:
                break

    if pending:
        yield pending, cursor


def iter_ruling_chunks(supabase, name_by_oracle_id, resume_after_id, chunk_size, limit=None):
    pending = []
    cursor = resume_after_id
    total = 0

    while limit is None or total < limit:
        query = supabase.table("mtg_rulings").select("*").order("id").limit(PAGE_SIZE)
        if cursor:
            query = query.gt("id", cursor)
        rows = query.execute().data
        if not rows:
            break

        for row in rows:
            cursor = row["id"]
            card_name = name_by_oracle_id.get(row["oracle_id"], "Unknown Card")
            pending.append(build_ruling_node(row, card_name))
            total += 1
            if len(pending) >= chunk_size:
                yield pending, cursor
                pending = []
            if limit is not None and total >= limit:
                break

    if pending:
        yield pending, cursor


def fetch_name_by_oracle_id(supabase):
    print("--- Building oracle_id -> card name lookup for rulings ---")
    mapping = {}
    cursor = None
    while True:
        query = supabase.table("mtg_cards").select("oracle_id, name").order("oracle_id").limit(PAGE_SIZE)
        if cursor:
            query = query.gt("oracle_id", cursor)
        rows = query.execute().data
        if not rows:
            break
        for row in rows:
            mapping[row["oracle_id"]] = row["name"]
            cursor = row["oracle_id"]
    print(f"Loaded {len(mapping)} card names")
    return mapping


def run(target_name, chunk_iter, total_hint, embedder_base_url, out_path, checkpoint_path,
        workers, mark_embedded, mark_fn):
    print(f"\n=== {target_name}: writing to {out_path} ===")

    mode = "a" if os.path.exists(out_path) else "w"
    f = open(out_path, mode, encoding="utf-8")
    if mode == "w":
        f.write(f"-- Full catalog export ({target_name}), generated by embed_full_catalog.py\n\n")

    done = 0
    start = time.time()
    mark_buffer = []

    def embed_chunk(chunk):
        texts = [n.text for n in chunk]
        vectors = embed_batch(texts, embedder_base_url)
        return list(zip(chunk, vectors))

    with ThreadPoolExecutor(max_workers=workers) as pool:
        chunks_with_cursor = list(chunk_iter)  # small metadata (node objects only), cheap to hold in memory
        chunk_lists = [c[0] for c in chunks_with_cursor]
        cursors = [c[1] for c in chunks_with_cursor]

        for i, results in enumerate(pool.map(embed_chunk, chunk_lists)):
            for node, vec in results:
                metadata = node_to_metadata_dict(node, remove_text=False)
                vector_str = "[" + ",".join(map(str, vec)) + "]"
                metadata_json = json.dumps(metadata, ensure_ascii=False)
                f.write(
                    "INSERT INTO vecs.mtg_nodes (id, vec, metadata) VALUES "
                    f"('{sql_escape(node.id_)}', '{vector_str}'::vector, '{sql_escape(metadata_json)}'::jsonb) "
                    "ON CONFLICT (id) DO UPDATE SET vec = EXCLUDED.vec, metadata = EXCLUDED.metadata;\n"
                )
                mark_buffer.append(node.id_ if target_name == "rulings" else node.metadata["oracle_id"])
                done += 1

            f.flush()
            os.fsync(f.fileno())
            save_checkpoint(checkpoint_path, cursors[i], done)

            if mark_embedded and len(mark_buffer) >= MARK_EMBEDDED_EVERY:
                mark_fn(mark_buffer)
                mark_buffer = []

            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta_s = (total_hint - done) / rate if rate > 0 and total_hint else 0
            print(
                f"  [{target_name}] {done}{'/' + str(total_hint) if total_hint else ''} "
                f"({elapsed:.0f}s elapsed, {rate:.2f}/s, ETA {eta_s/3600:.1f}h)"
            )

    if mark_embedded and mark_buffer:
        mark_fn(mark_buffer)

    f.close()
    print(f"=== {target_name} done: {done} rows written to {out_path} ===")


def main():
    args = parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    embedder_base_url = os.environ.get("EMBEDDER_BASE_URL") or "http://localhost:8082"
    mark_embedded = not args.no_mark_embedded

    if args.target in ("cards", "both"):
        checkpoint_path = os.path.join(args.out_dir, ".embed_progress_cards.json")
        resume_after = load_checkpoint(checkpoint_path) if args.resume else None
        out_path = os.path.join(args.out_dir, "full_catalog_cards.sql")
        run(
            "cards",
            iter_card_chunks(supabase, resume_after, args.embed_batch_size, args.limit),
            args.limit or 27500,
            embedder_base_url,
            out_path,
            checkpoint_path,
            args.workers,
            mark_embedded,
            lambda oracle_ids: mark_cards_as_embedded_by_oracle_id(supabase, oracle_ids),
        )

    if args.target in ("rulings", "both"):
        name_by_oracle_id = fetch_name_by_oracle_id(supabase)
        checkpoint_path = os.path.join(args.out_dir, ".embed_progress_rulings.json")
        resume_after = load_checkpoint(checkpoint_path) if args.resume else None
        out_path = os.path.join(args.out_dir, "full_catalog_rulings.sql")
        run(
            "rulings",
            iter_ruling_chunks(supabase, name_by_oracle_id, resume_after, args.embed_batch_size, args.limit),
            args.limit or 78419,
            embedder_base_url,
            out_path,
            checkpoint_path,
            args.workers,
            mark_embedded,
            lambda ids: mark_rulings_as_embedded(supabase, ids),
        )


if __name__ == "__main__":
    main()
