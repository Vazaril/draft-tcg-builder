from flask import Blueprint, jsonify

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
def register():
    return jsonify(message="not implemented"), 501


@auth_bp.post("/login")
def login():
    return jsonify(message="not implemented"), 501
