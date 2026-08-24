import os
from supabase import create_client
from google import genai
from google.genai import types

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key)

gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))


def hybrid_search_mtg(query_text: str, match_count: int = 5) -> list[dict]:
    """
    Takes a user question, embeds it into a 1536-dimensional vector,
    and calls the Supabase Hybrid Search RPC.
    """
    try:
        embedding_response = gemini_client.models.embed_content(
            model="gemini-embedding-001",
            contents=query_text,
            config=types.EmbedContentConfig(output_dimensionality=1536)
        )

        # Extract the float array
        query_embedding = embedding_response.embeddings[0].values

        response = supabase.rpc(
            "hybrid_search_mtg_nodes",
            {
                "query_text": query_text,
                "query_embedding": query_embedding,
                "match_count": match_count,
                "full_text_weight": 1.0,
                "semantic_weight": 1.0,
                "rrf_k": 50
            }
        ).execute()

        # Return the fused results
        return response.data

    except Exception as e:
        print(f"Hybrid search failed: {e}")
        return []