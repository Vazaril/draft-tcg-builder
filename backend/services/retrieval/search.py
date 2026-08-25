import os
import psycopg2
import psycopg2.extras
from llama_index.embeddings.ollama import OllamaEmbedding


def hybrid_search_mtg(query_text: str, match_count: int = 5) -> list[dict]:
    """
    Takes a user question, embeds it locally using Ollama (qwen3-embedding),
    truncates it to 1536 dimensions, and calls the local Postgres Hybrid Search RPC.
    """
    try:
        embedder = OllamaEmbedding(
            model_name="qwen3-embedding",
            base_url=os.environ.get("OLLAMA_BASE_URL")
        )

        raw_embedding = embedder.get_text_embedding(query_text)

        query_embedding = raw_embedding[:1536]

        vector_str = f"[{','.join(map(str, query_embedding))}]"

        db_url = os.environ.get("DB_URL")
        conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
        cursor = conn.cursor()

        sql_query = """
                    SELECT * \
                    FROM public.hybrid_search_mtg_nodes(
                            query_text := %s,
                            query_embedding := %s::vector,
                            match_count := %s,
                            full_text_weight := 1.0,
                            semantic_weight := 1.0,
                            rrf_k := 50 \
                         ); \
                    """

        cursor.execute(sql_query, (query_text, vector_str, match_count))
        results = cursor.fetchall()

        cursor.close()
        conn.close()

        return [dict(row) for row in results]

    except Exception as e:
        print(f"Hybrid search failed: {e}")
        return []