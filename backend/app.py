from flask import Flask, jsonify

from gemini_client import generate_text
from routes.chat import chat_bp
from routes.decks import decks_bp
from routes.admin import admin_bp


app = Flask(__name__)
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
