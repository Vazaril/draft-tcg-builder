import os
from typing import cast, Any

from supabase import create_client
from llama_index.core.ingestion import IngestionPipeline
from llama_index.embeddings.text_embeddings_inference import TextEmbeddingsInference
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.core.schema import TransformComponent

from .loader import fetch_cards_in_batches, fetch_rulings_in_batches, mark_cards_as_embedded, mark_rulings_as_embedded
from .chunker import generate_card_nodes, generate_ruling_nodes

def run_ingestion():
    supabase_url = os.environ.get("SUPABASE_URL")
    db_url = os.environ.get("DB_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    vector_store = PGVectorStore.from_params(
        connection_string=db_url,
        table_name="mtg_nodes",
        schema_name="vecs",
        embed_dim=1024
    )

    embedder = TextEmbeddingsInference(
        model_name="Qwen/Qwen3-Embedding-0.6B",
        base_url=os.environ.get("EMBEDDER_BASE_URL") or "http://localhost:8082",
    )

    pipeline_transforms: list[TransformComponent] = [
        cast(TransformComponent, cast(Any, embedder)),
    ]

    pipeline = IngestionPipeline(
        transformations=pipeline_transforms,
        vector_store=vector_store
    )

    print("Starting Card Ingestion...")
    for card_batch in fetch_cards_in_batches(supabase, batch_size=25):
        card_nodes = generate_card_nodes(card_batch)
        pipeline.run(documents=card_nodes)

        card_ids = [str(c.get("id")) for c in card_batch]
        mark_cards_as_embedded(supabase, card_ids)
        print(f"Ingested and marked {len(card_nodes)} cards...")

    print("Starting Ruling Ingestion...")
    for ruling_batch in fetch_rulings_in_batches(supabase, batch_size=50):
        ruling_nodes = generate_ruling_nodes(ruling_batch)
        pipeline.run(documents=ruling_nodes)

        ruling_ids = [str(r.get("id")) for r in ruling_batch]
        mark_rulings_as_embedded(supabase, ruling_ids)
        print(f"Ingested and marked {len(ruling_nodes)} rulings...")

    print("Ingestion Complete!")