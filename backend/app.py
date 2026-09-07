import os

from flask import Flask, jsonify
from flask_cors import CORS

from gemini_client import generate_text
from routes.chat import chat_bp
from routes.decks import decks_bp
from routes.admin import admin_bp


app = Flask(__name__)

# Frontend (Next.js) calls this API directly from the browser with a
# Supabase Authorization header, so it needs CORS - comma-separated list,
# defaults to the local Next dev server.
allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
CORS(app, resources={r"/*": {"origins": allowed_origins}})

app.register_blueprint(chat_bp)
app.register_blueprint(decks_bp)
app.register_blueprint(admin_bp)


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.get("/joke")
def joke():
    try:
        answer = generate_text("Erzähl mir einen Witz.")
    except Exception as exc:
        return jsonify(error=str(exc)), 502

    return jsonify(answer=answer)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
