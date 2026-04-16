"""
수업 실습 코드 - FastAPI 기반 REST API 서버 예제
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI(title="학습 API 서버")

# --- 인메모리 데이터 저장소 ---
users_db = []
next_id = 1


# --- Pydantic 모델 ---
class UserCreate(BaseModel):
    name: str
    email: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


# --- API 라우트 ---
@app.get("/")
def root():
    return {"message": "학습 API 서버에 오신 것을 환영합니다!"}


@app.get("/api/users")
def get_users():
    """전체 사용자 목록 조회"""
    return {"success": True, "data": users_db}


@app.get("/api/users/{user_id}")
def get_user(user_id: int):
    """특정 사용자 조회"""
    user = next((u for u in users_db if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    return {"success": True, "data": user}


@app.post("/api/users", status_code=201)
def create_user(user: UserCreate):
    """새 사용자 생성"""
    global next_id
    new_user = {"id": next_id, "name": user.name, "email": user.email}
    users_db.append(new_user)
    next_id += 1
    return {"success": True, "data": new_user}


@app.put("/api/users/{user_id}")
def update_user(user_id: int, user: UserUpdate):
    """사용자 정보 수정"""
    existing = next((u for u in users_db if u["id"] == user_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    if user.name:
        existing["name"] = user.name
    if user.email:
        existing["email"] = user.email
    return {"success": True, "data": existing}


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int):
    """사용자 삭제"""
    global users_db
    user = next((u for u in users_db if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    users_db = [u for u in users_db if u["id"] != user_id]
    return {"success": True, "message": "삭제 완료"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
