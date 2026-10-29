from flask import Flask, jsonify

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
