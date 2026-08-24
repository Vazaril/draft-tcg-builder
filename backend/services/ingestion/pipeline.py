import os
from typing import cast, Any, Sequence

from supabase import create_client
from llama_index.core.ingestion import IngestionPipeline
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index.core.schema import TransformComponent, BaseNode

from .loader import fetch_cards_in_batches, fetch_rulings_in_batches, mark_cards_as_embedded, mark_rulings_as_embedded
from .chunker import generate_card_nodes, generate_ruling_nodes

class VectorTruncator(TransformComponent):
    """Truncates MRL embeddings down to 1536 dimensions for Supabase pgvector."""
    dimension: int = 1536

    def __call__(self, nodes: Sequence[BaseNode], **kwargs: Any) -> Sequence[BaseNode]:
        for node in nodes:
            if node.embedding:
                node.embedding = node.embedding[:self.dimension]
        return nodes

def run_ingestion():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_db_url = os.environ.get("SUPABASE_DB_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, supabase_key)

    vector_store = SupabaseVectorStore(
        postgres_connection_string=supabase_db_url,
        collection_name="mtg_nodes"
    )

    embedder = OllamaEmbedding(
        model_name="qwen3-embedding",
        base_url=os.environ.get("OLLAMA_BASE_URL")
    )

    pipeline_transforms: list[TransformComponent] = [
        cast(TransformComponent, cast(Any, embedder)),
        VectorTruncator(dimension=1536)
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