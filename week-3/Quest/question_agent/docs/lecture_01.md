# 1강: API 라우팅 기초

## 학습 목표
- REST API의 개념과 HTTP 메서드 이해
- Express.js를 활용한 기본 라우팅 구현
- 요청(Request)과 응답(Response) 객체 활용

## 주요 개념

### REST API란?
REST(Representational State Transfer)는 웹 서비스 설계의 아키텍처 스타일이다.
리소스를 URI로 표현하고, HTTP 메서드로 CRUD 작업을 수행한다.

### HTTP 메서드
| 메서드 | 역할 | 예시 |
|--------|------|------|
| GET | 조회 | `GET /users` |
| POST | 생성 | `POST /users` |
| PUT | 전체 수정 | `PUT /users/1` |
| PATCH | 부분 수정 | `PATCH /users/1` |
| DELETE | 삭제 | `DELETE /users/1` |

### Express.js 라우팅
Express에서 라우트는 `app.METHOD(PATH, HANDLER)` 형태로 정의한다.

```javascript
const express = require('express');
const app = express();

// GET 요청 처리
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// POST 요청 처리
app.post('/api/users', (req, res) => {
  const newUser = req.body;
  res.status(201).json(newUser);
});
```

### 미들웨어(Middleware)
요청과 응답 사이에서 실행되는 함수. `express.json()`은 JSON 본문을 파싱하는 빌트인 미들웨어이다.

```javascript
app.use(express.json()); // JSON 파싱 미들웨어
app.use(express.static('public')); // 정적 파일 서빙
```

## 핵심 정리
1. REST API는 리소스 중심 설계
2. HTTP 메서드로 행위를 구분
3. Express의 `app.get()`, `app.post()` 등으로 라우트 정의
4. 미들웨어로 공통 기능(파싱, 인증, 로깅) 처리
