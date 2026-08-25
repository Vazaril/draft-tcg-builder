from flask import Blueprint, jsonify, request
from services.retrieval.engine import generate_mtg_answer

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")

VALID_ROLES = {"user", "model"}


@chat_bp.post("")
def chat():
    data = request.get_json(silent=True) or {}

    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return jsonify(error="message is required"), 400

    history = data.get("history", [])
    if not isinstance(history, list):
        return jsonify(error="history must be a list"), 400

    for entry in history:
        if (
                not isinstance(entry, dict)
                or entry.get("role") not in VALID_ROLES
                or not isinstance(entry.get("content"), str)
        ):
            return jsonify(error="each history entry needs role (user/model) and content"), 400

    try:
        rag_result = generate_mtg_answer(message, history)

        reply_text = rag_result.get("answer", "I couldn't generate an answer.")
        context_used = rag_result.get("context_used", [])

    except Exception as exc:
        return jsonify(error=str(exc)), 502

    return jsonify(
        role="model",
        content=reply_text,
        context_used=context_used
    )