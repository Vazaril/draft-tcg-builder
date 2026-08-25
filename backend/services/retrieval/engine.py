import json
import os
from google import genai
from google.genai import types
from .search import hybrid_search_mtg

gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = os.environ.get("GEMINI_MODEL")

def generate_mtg_answer(message: str, history: list = None) -> dict:
    if history is None:
        history = []

    search_results = hybrid_search_mtg(query_text=message, match_count=5)

    context_texts = []
    context_used = []

    for res in search_results:
        metadata = res.get("metadata", {})
        node_type = metadata.get("type", "unknown")

        try:
            node_content = json.loads(metadata.get("_node_content", "{}"))
            actual_text = node_content.get("text", "")
        except Exception:
            actual_text = ""

        if node_type == "card":
            name = metadata.get("name", "Unknown Card")
            cmc = metadata.get("cmc", "N/A")
            keywords = ", ".join(metadata.get("keywords", []))

            block = (
                f"--- CARD: {name} (CMC: {cmc}) ---\n"
                f"Keywords: {keywords}\n"
                f"Details: {actual_text}"
            )
            context_texts.append(block)
            context_used.append({"id": res.get("id"), "type": "card", "name": name})

        elif node_type == "ruling":
            card_name = metadata.get("card_name", "Unknown Card")
            date = metadata.get("published_at", "Unknown Date")

            # Used the date variable in the header for clear judge citation
            block = f"--- RULING: {card_name} (Date: {date}) ---\n{actual_text}"
            context_texts.append(block)
            context_used.append({"id": res.get("id"), "type": "ruling", "name": card_name})

    context_block = "\n\n".join(context_texts)

    contents = []

    for entry in history:
        role = "model" if entry.get("role") == "model" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=entry.get("content", ""))]
            )
        )

    current_prompt = f"CONTEXT:\n{context_block}\n\nUSER QUESTION:\n{message}"
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=current_prompt)]
        )
    )

    system_instruction = (
        "You are an expert Magic: The Gathering Judge. "
        "Answer the user's question clearly and accurately using the conversation history and provided context. "
        "Quote specific rules or card text where appropriate. "
        "If the context does not contain enough information to answer definitively, state what is missing."
    )

    response = gemini_client.models.generate_content(
        model=gemini_model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2
        )
    )

    return {
        "answer": response.text,
        "context_used": context_used
    }