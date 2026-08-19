import os

from google import genai

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))


def generate_text(prompt: str, model: str = DEFAULT_MODEL) -> str:
    response = _client.models.generate_content(model=model, contents=prompt)
    return response.text
