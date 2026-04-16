"""
수업 실습 코드 - JWT 인증 구현 예제
"""
import jwt
import datetime
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)
SECRET_KEY = "my-secret-key-for-class-demo"

# --- 인메모리 사용자 DB ---
users = [
    {"id": 1, "username": "admin", "password": "admin123", "role": "admin"},
    {"id": 2, "username": "student", "password": "student123", "role": "user"},
]


def generate_token(user):
    """JWT 토큰 생성"""
    payload = {
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def token_required(f):
    """JWT 인증 미들웨어 (데코레이터)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"message": "토큰이 없습니다"}), 401
        try:
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = decoded
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "토큰이 만료되었습니다"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "유효하지 않은 토큰입니다"}), 401
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["POST"])
def login():
    """로그인 - JWT 토큰 발급"""
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = next(
        (u for u in users if u["username"] == username and u["password"] == password),
        None,
    )
    if not user:
        return jsonify({"message": "아이디 또는 비밀번호가 틀렸습니다"}), 401

    token = generate_token(user)
    return jsonify({"token": token, "user": {"id": user["id"], "username": user["username"]}})


@app.route("/protected", methods=["GET"])
@token_required
def protected_route():
    """인증이 필요한 보호 라우트"""
    return jsonify({
        "message": f"안녕하세요, {request.user['username']}님!",
        "role": request.user["role"],
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
