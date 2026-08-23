import os
from flask import Blueprint, jsonify, request
from services.ingestion.pipeline import run_ingestion

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.post("/sync-vectors")
def sync_vectors():
    auth_header = request.headers.get("Authorization")
    expected_secret = os.environ.get("ADMIN_SECRET")

    if auth_header != f"Bearer {expected_secret}":
        return jsonify(error="Unauthorized"), 401

    try:
        run_ingestion()
        return jsonify(message="Ingestion pipeline completed successfully!"), 200
    except Exception as e:
        return jsonify(error=str(e)), 500