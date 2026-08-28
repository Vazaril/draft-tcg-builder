import json
import os
import re
from typing import Any, Generator

from google import genai
from google.genai import types
from .search import hybrid_search_mtg, exact_search_mtg

gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = os.environ.get("GEMINI_MODEL")

def rewrite_search_query(message: str, history: list) -> str:
    """
    Looks at the conversation history and rewrites the user's message
    into a standalone search query.
    """
    transcript = ""

    if history:
        for entry in history[-4:]:
            role = "Judge" if entry.get("role") == "model" else "Player"
            transcript += f"{role}: {entry.get('content')}\n"

    transcript += f"Player: {message}\n"

    system_instruction = (
        "You are a search query rewriting assistant. Your job is to look at a conversation "
        "between a Magic: The Gathering player and a Judge. "
        "Rewrite the Player's final message into a single, comprehensive search query that contains "
        "all the necessary card names and keywords being discussed. "
        "CRITICAL: If you identify any specific Magic: The Gathering entities in the conversation, "
        "wrap them strictly as follows:"
        "- Wrap card names in [[card:Card Name]] (e.g., [[card:Darksteel Colossus]])."
        "- Wrap rule numbers in [[rule:Rule Number]] (e.g., [[rule:702.12b]])."
        "- Wrap MTG keywords in [[kw:Keyword]] (e.g., [[kw:Indestructible]])."
        "Do not answer the question. Only output the rewritten search query."
    )

    try:
        chat_session = gemini_client.chats.create(
            model=gemini_model,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.0
            )
        )

        response = chat_session.send_message(transcript)
        return response.text.strip()

    except Exception as e:
        print(f"Query rewrite failed, falling back to original message: {e}")
        return message

def generate_mtg_answer(message: str, history: list = None) -> Generator[str, Any, None]:
    if history is None:
        history = []

    searchable_query = rewrite_search_query(message, history)
    print(f"Original: {message} | Rewritten: {searchable_query}")

    typed_card_matches = re.findall(r'\[\[card:(.*?)\]\]', message + " " + searchable_query, re.IGNORECASE)

    untyped_matches = re.findall(r'\[\[(?!card:|rule:|kw:)(.*?)\]\]', message + " " + searchable_query, re.IGNORECASE)

    exact_names = list(set([name.strip() for name in typed_card_matches + untyped_matches if name.strip()]))

    exact_results = exact_search_mtg(exact_names) if exact_names else []
    hybrid_results = hybrid_search_mtg(query_text=searchable_query, match_count=5)

    seen_ids = set()
    combined_results = []

    for res in exact_results + hybrid_results:
        if res["id"] not in seen_ids:
            seen_ids.add(res["id"])
            combined_results.append(res)

    context_texts = []
    context_used = []

    for res in combined_results:
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

            block = f"--- RULING: {card_name} (Date: {date}) ---\n{actual_text}"
            context_texts.append(block)
            context_used.append({"id": res.get("id"), "type": "ruling", "name": card_name})

    context_block = "\n\n".join(context_texts)

    gemini_history = []
    for entry in history:
        role = "model" if entry.get("role") == "model" else "user"
        gemini_history.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=entry.get("content", ""))]
            )
        )

    current_prompt = f"CONTEXT:\n{context_block}\n\nUSER QUESTION:\n{message}"

    system_instruction = (
        "You are an expert Magic: The Gathering Judge. "
        "Answer clearly and accurately using the provided context. "
        "Format citations strictly as follows:\n"
        "- Wrap card names in [[card:Card Name]] (e.g., [[card:Darksteel Colossus]]).\n"
        "- Wrap rule numbers in [[rule:Rule Number]] (e.g., [[rule:702.12b]]).\n"
        "- Wrap MTG keywords in [[kw:Keyword]] (e.g., [[kw:Indestructible]]).\n"
        "If the context does not contain enough information, state what is missing."
    )

    chat_session = gemini_client.chats.create(
        model=gemini_model,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2
        ),
        history=gemini_history
    )

    response_stream = chat_session.send_message_stream(current_prompt)

    def generate():
        yield f"data: {json.dumps({'type': 'citations', 'context_used': context_used})}\n\n"

        for chunk in response_stream:
            if chunk.text:
                yield f"data: {json.dumps({'type': 'text', 'content': chunk.text})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return generate()