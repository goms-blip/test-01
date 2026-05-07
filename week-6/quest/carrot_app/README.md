# 🥕 Carrot Market Clone (carrot_app)

PRD: [`prd.md`](./prd.md) — 작업 로그: [`work_log.md`](./work_log.md)

당근마켓의 핵심 흐름(회원가입 → 동네 설정 → 상품 등록 → 검색/필터 → 상세 → 1:1 채팅 → 마이페이지)을 단일 Express 서버 + React(CDN) SPA로 구현했습니다.

## 빠른 실행
```bash
npm install
npm start
```
브라우저에서 <http://localhost:3030> 접속.

## 데모 계정 (시드)
| 이메일 | 비번 | 동네 |
| --- | --- | --- |
| alice@test.com | 1234 | 강남구 역삼동 |
| bob@test.com   | 1234 | 강남구 역삼동 |
| carol@test.com | 1234 | 서초구 반포동 |

## 주요 화면
- `#/`         홈 (검색·카테고리 칩)
- `#/login` `#/signup`
- `#/post`    상품 등록 (이미지 최대 3장)
- `#/product/:id` 상세 (이미지 슬라이드 / 관심 / 채팅하기)
- `#/chats` `#/chat/:id` 1:1 채팅 (2초 polling)
- `#/me`      마이페이지 (내 상품 / 관심 / 채팅, 동네 변경)

## API (요약)
| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/auth/signup` `/login` `/logout` | 인증 |
| GET | `/api/auth/me` | 본인 정보 |
| PATCH | `/api/auth/region` | 동네 변경 |
| GET | `/api/products?q=&category=` | 목록·검색·필터 |
| POST | `/api/products` | 등록 (auth) |
| PATCH/DELETE | `/api/products/:id` | 본인만 (RLS) |
| POST | `/api/products/:id/favorite` | 관심 토글 |
| POST | `/api/upload` | 이미지 업로드 (multer) |
| POST/GET | `/api/chat/rooms` | 채팅방 |
| GET/POST | `/api/chat/rooms/:id/messages` | 메시지 (since 기반 polling) |
