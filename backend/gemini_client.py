import os

from google import genai

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))


def generate_text(prompt: str, model: str = DEFAULT_MODEL) -> str:
    response = _client.models.generate_content(model=model, contents=prompt)
    return response.text


def send_chat_message(history: list[dict], message: str, model: str = DEFAULT_MODEL) -> str:
    contents = [
        {"role": entry["role"], "parts": [{"text": entry["content"]}]}
        for entry in history
    ]
    chat = _client.chats.create(model=model, history=contents)
    response = chat.send_message(message)
    return response.text
