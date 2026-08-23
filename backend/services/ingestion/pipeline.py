import os
from typing import cast, Any

from google.genai.types import EmbedContentConfig
from supabase import create_client
from llama_index.core.ingestion import IngestionPipeline
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index.core.schema import TransformComponent

from .loader import fetch_cards_in_batches, fetch_rulings_in_batches, mark_cards_as_embedded, mark_rulings_as_embedded
from .cleaner import MTGTextCleaner
from .chunker import generate_card_nodes, generate_ruling_nodes
from .enricher import MTGSemanticExtractor


def run_ingestion():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_db_url = os.environ.get("SUPABASE_DB_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    vector_store = SupabaseVectorStore(
        postgres_connection_string=supabase_db_url,
        collection_name="mtg_nodes"
    )

    cleaner: TransformComponent = MTGTextCleaner()
    enricher: TransformComponent = cast(Any, MTGSemanticExtractor())
    embedder: TransformComponent = cast(Any, GoogleGenAIEmbedding(model_name="models/gemini-embedding-001", api_key=os.environ.get("GEMINI_API_KEY"), embedding_config=EmbedContentConfig(output_dimensionality=1536)))

    pipeline_transforms: list[TransformComponent] = [cleaner, enricher, embedder]

    # Build the Pipeline
    pipeline = IngestionPipeline(
        transformations=pipeline_transforms,
        vector_store=vector_store
    )

    print("Starting Card Ingestion...")
    for card_batch in fetch_cards_in_batches(supabase, batch_size=2):
        card_nodes = generate_card_nodes(card_batch)
        pipeline.run(documents=card_nodes)

        card_ids = [str(c.get("id")) for c in card_batch]
        mark_cards_as_embedded(supabase, card_ids)
        print(f"Ingested and marked {len(card_nodes)} cards...")

        break

    print("Starting Ruling Ingestion...")
    for ruling_batch in fetch_rulings_in_batches(supabase, batch_size=2):
        ruling_nodes = generate_ruling_nodes(ruling_batch)
        pipeline.run(documents=ruling_nodes)

        ruling_ids = [str(r.get("id")) for r in ruling_batch]
        mark_rulings_as_embedded(supabase, ruling_ids)
        print(f"Ingested and marked {len(ruling_nodes)} rulings...")

        break

    print("Ingestion Complete!")