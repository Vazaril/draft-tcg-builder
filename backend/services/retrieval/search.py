import os
import json
import psycopg2
import psycopg2.extras
from llama_index.embeddings.ollama import OllamaEmbedding


def exact_search_mtg(card_names: list) -> list[dict]:
    """
    Looks up exact MTG cards and their rulings by name, bypassing vector search.
    """
    if not card_names:
        return []

    try:
        import psycopg2
        import psycopg2.extras

        db_url = os.environ.get("DB_URL")
        conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
        cursor = conn.cursor()

        names_lower = [name.lower() for name in card_names]

        placeholders = ', '.join(['%s'] * len(names_lower))

        # Search both card nodes ('name') and ruling nodes ('card_name')
        sql_query = f"""
            SELECT id, metadata 
            FROM vecs.mtg_nodes 
            WHERE lower(metadata->>'name') IN ({placeholders})
               OR lower(metadata->>'card_name') IN ({placeholders})
            LIMIT 20; 
        """

        cursor.execute(sql_query, names_lower + names_lower)
        results = cursor.fetchall()

        cursor.close()
        conn.close()

        return [dict(row) for row in results]

    except Exception as e:
        print(f"Exact search failed: {e}")
        return []

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


def filtered_hybrid_search_mtg(
        query_text: str,
        color_identity: list[str],
        format_name: str,
        match_count: int = 15
) -> list[dict]:
    if not query_text:
        return []

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

        colors_json = json.dumps(color_identity)

        sql_query = """
                    SELECT *
                    FROM public.filtered_hybrid_search_mtg_nodes(
                            query_text := %s,
                            query_embedding := %s::vector,
                            allowed_colors := %s::jsonb,
                            format_name := %s,
                            match_count := %s,
                            full_text_weight := 1.0,
                            semantic_weight := 1.0,
                            rrf_k := 50
                         ); \
                    """

        cursor.execute(sql_query, (query_text, vector_str, colors_json, format_name.lower(), match_count))
        results = cursor.fetchall()

        cursor.close()
        conn.close()

        return [dict(row) for row in results]

    except Exception as e:
        print(f"Filtered hybrid search failed: {e}")
        return []