from flask import Flask, request
from flask_restx import Api, Resource, fields
from asa_utils import (
    get_asa_connection, add_user, delete_user, add_users, delete_users
)
from functools import wraps
from pathlib import Path
from dotenv import load_dotenv
import os


def require_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = Flask(__name__)
api = Api(app, title="ASA User API", description="Simple batch API for ASA")

ns = api.namespace("users", description="User operations")

# 固定 ASA 凭据
ASA_HOST = require_env("ASA_HOST")
ASA_USER = require_env("ASA_USER")
ASA_PASS = require_env("ASA_PASS")

# 简单 token 认证
API_TOKEN = require_env("ASA_API_TOKEN")

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"message": "Missing or invalid Authorization header"}, 401
        token = auth_header.split(" ")[1]
        if token != API_TOKEN:
            return {"message": "Invalid token"}, 403
        return f(*args, **kwargs)
    return decorated

# 单用户模型
user_model = api.model("User", {
    "username": fields.String(required=True),
    "password": fields.String(required=True),
})

# 批量模型
batch_user_model = api.model("BatchUsers", {
    "users": fields.List(fields.Nested(user_model), required=True)
})

@ns.route("/single-add")
class SingleAdd(Resource):
    @ns.expect(user_model)
    @require_auth
    def post(self):
        data = request.json
        try:
            conn = get_asa_connection(ASA_HOST, ASA_USER, ASA_PASS)
            success = add_user(conn, data["username"], data["password"])
            if success:
                return {"message": f"User {data['username']} added."}
            else:
                return {"message": f"User {data['username']} is blacklisted."}, 403
        except Exception as e:
            return {"error": str(e)}, 500

@ns.route("/batch-add")
class BatchAdd(Resource):
    @ns.expect(batch_user_model)
    @require_auth
    def post(self):
        data = request.json
        try:
            conn = get_asa_connection(ASA_HOST, ASA_USER, ASA_PASS)
            users = data["users"]
            add_users(conn, users)
            return {"message": f"{len(users)} users processed."}
        except Exception as e:
            return {"error": str(e)}, 500

@ns.route("/batch-delete")
class BatchDelete(Resource):
    @ns.expect(api.model("BatchDelete", {
        "usernames": fields.List(fields.String, required=True)
    }))
    @require_auth
    def delete(self):
        data = request.json
        try:
            conn = get_asa_connection(ASA_HOST, ASA_USER, ASA_PASS)
            delete_users(conn, data["usernames"])
            return {"message": f"{len(data['usernames'])} usernames processed."}
        except Exception as e:
            return {"error": str(e)}, 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
