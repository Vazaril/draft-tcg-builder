from flask import Flask, jsonify

from routes.auth import auth_bp
from routes.decks import decks_bp

app = Flask(__name__)
app.register_blueprint(auth_bp)
app.register_blueprint(decks_bp)


@app.get("/health")
def health():
    return jsonify(status="ok")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
