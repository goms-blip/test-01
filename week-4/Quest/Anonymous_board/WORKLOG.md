# MOVE · 무브 — 작업 로그 (Anonymous Board)

> PRD: [`prd.md`](./prd.md)
> 기준 버전: 1.0 (익명 고민/칭찬 게시판)
> 작업일: 2026-04-21
> 프로젝트 코드명: **MOVE / 무브** — "마음을 움직이는 익명의 한 줄"

---

## 1. 목표 정리 (PRD 요약)

- Supabase(PostgreSQL) + Server 기반의 **익명 게시판**
- 카테고리: `고민 / 칭찬 / 응원 / 기타`
- 핵심 기능
  - (1) 익명 글 작성
  - (2) 공감(+1) 버튼
  - (3) 최신순 / 공감순 정렬
  - (4) DB 즉시 반영
- 프론트: 깔끔·절제된 디자인. 형광색 허용.
  - 레퍼런스: https://lgartssponsorship.lg.co.kr/kr/ (화이트/차콜 + 세리프 헤드라인 + 정적인 에디토리얼 레이아웃)

---

## 2. 기술 스택 & 파일 구성

```
week-4/Quest/Anonymous_board/
├── prd.md              # 원본 요구사항
├── WORKLOG.md          # 이 파일 (작업 내역)
├── server.js           # Express 5 + pg (Supabase)
├── index.html          # React 18 CDN + Tailwind + Babel standalone
├── package.json        # dependencies: express, pg, dotenv
├── vercel.json         # dual-mode (static + serverless)
├── .env.example        # 환경변수 템플릿
└── .gitignore          # node_modules / .env / .vercel / .DS_Store
```

| 영역 | 기술 | 비고 |
| :--- | :--- | :--- |
| Frontend | React 18 (UMD), Tailwind CDN, Babel standalone | 단일 `index.html` |
| Backend | Express 5, pg 8 | `server.js` |
| DB | Supabase PostgreSQL (pooler, port 6543) | `posts` 테이블 |
| Local port | `4327` | 4325 Refri-Manager, 4326 Refri-AI-App 다음 |
| Deploy | Vercel (dual-mode: 로컬 `node server.js` + 서버리스 export) | |

---

## 3. 디자인 결정

### 3-1. 무드
LG Arts Sponsorship 레퍼런스에서 확인된 편집 디자인(editorial) 톤을 따른다:
- 따뜻한 오프화이트 배경 (`#fafaf7`), 차콜 잉크 (`#111`)
- **세리프 헤드라인** (Noto Serif KR) + 본문 Sans (Inter)
- 얇은 1px 헤어라인 테두리, 그림자 X
- 정돈된 2단 그리드, 큰 여백

### 3-2. 형광 악센트
PRD에서 허용한 형광색을 **딱 한 포인트**에만 사용:
- **네온 라임 `#d4ff00`**
- 쓰임새:
  - 주 CTA 버튼 "익명으로 게시하기" 배경
  - 공감 버튼 활성화 시 배경 (눌린 상태)
  - 메인 헤드라인 "움직이는" 단어의 **언더라이트(하이라이트)** — 형광펜으로 그은 듯한 느낌
- 과하게 쓰지 않아 절제(편집) 톤을 유지하면서도 생동감 확보.

### 3-3. 카테고리 색
카테고리는 작은 컬러 닷으로만 식별 — 배경 전체에 색을 칠하지 않음.
- 고민: `#6b7280` (뉴트럴 그레이)
- 칭찬: `#d4ff00` (네온, 브랜드 악센트와 일치)
- 응원: `#22c55e` (그린)
- 기타: `#a1a1aa`

---

## 4. 데이터베이스 (Supabase)

### 4-1. 테이블 — `public.posts`

| 컬럼 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | `gen_random_uuid()` (pgcrypto) | PK |
| `category` | TEXT | — | 고민/칭찬/응원/기타 |
| `content` | TEXT | — | 본문 (서버에서 2000자 제한) |
| `likes` | BIGINT | `0` | 공감 수 |
| `created_at` | TIMESTAMPTZ | `NOW()` | 생성 일시 |

### 4-2. 자동 초기화
`server.js` 의 `initDB()` 가 첫 `/api/*` 요청에서 실행됨:
1. `CREATE EXTENSION IF NOT EXISTS pgcrypto` — UUID 생성용
2. `CREATE TABLE IF NOT EXISTS public.posts (…)` — 테이블
3. `CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC)` — 최신순
4. `CREATE INDEX IF NOT EXISTS posts_likes_idx ON posts (likes DESC)` — 공감순

Supabase 콘솔에서 SQL을 직접 돌릴 필요 없음. 서버 첫 부팅 시 멱등하게 생성.

### 4-3. 연결 방식
- 우선: `process.env.DATABASE_URL` (pooler URL + SSL)
- Fallback: `server.js` 안에 Refri-Manager와 동일한 pooler 호스트/계정 하드코딩 (로컬 개발 편의용)
- 프로덕션(Vercel)에서는 **환경변수에 `DATABASE_URL` 세팅** 권장. `.env.example` 참고.

---

## 5. API 스펙

Base: `/api/posts`

| Method | Path | Body | 설명 |
| :--- | :--- | :--- | :--- |
| GET | `/api/posts?sort=recent\|likes&category=고민` | — | 목록 조회 (최대 200건) |
| POST | `/api/posts` | `{ category, content }` | 글 작성 |
| POST | `/api/posts/:id/like` | — | 공감 +1 |
| DELETE | `/api/posts/:id` | — | 삭제 |

공통 응답:
```json
{ "success": true,  "data": <row | row[]> }
{ "success": false, "message": "<사유>" }
```

### 검증 규칙
- `category` 는 화이트리스트(`고민/칭찬/응원/기타`) 외 값이면 `400`
- `content` 는 빈 문자열/공백만이면 `400`
- `content.length > 2000` 이면 `400` (서버) / UI에서도 초과 시 버튼 비활성 + 카운터 빨간색
- `:id` 는 UUID 형식이 아니면 `400`

### 정렬 규칙
- `sort=recent` → `ORDER BY created_at DESC`
- `sort=likes`  → `ORDER BY likes DESC, created_at DESC` (동률 시 최신 우선)

---

## 6. UI 구성

### 6-1. 헤더 블록
- 좌측: 세리프 초대형 헤드라인 "마음을 **움직이는** 익명의 한 줄"
- 우측: 4칸 메타 카드 (Stack / DB / Build / Access)
- 상단 티커바: MOVE 로고 · 날짜 스탬프

### 6-2. 작성(Composer) 블록
- 카테고리 chip(4개) → 선택 시 검정 배경 반전
- 본문 textarea (5줄, 리사이즈 가능)
- 하단바: `글자수 / 2,000` 카운터 + 형광 CTA "익명으로 게시하기 →"
- 유효성 실패 시 에러 인라인 표시

### 6-3. 게시판(Board)
- 툴바: **정렬(최신/공감)** chip · **카테고리 필터** chip(전체 + 4개) · 카테고리별 카운트 숫자
- 요약: 전체 건수 · 누적 공감 수
- 카드: 좌측 `N° 001`, 카테고리 닷 + 이름, 우측 `방금 전 / N분 전 / N시간 전 / N일 전 / yyyy.mm.dd`
- 본문은 `whitespace-pre-wrap` 으로 줄바꿈 보존
- 공감 버튼은 `♥` + 숫자 + "공감". 누르면 `likePop` 애니메이션 0.28s.
- 삭제는 카드 hover 시에만 노출 (PRD 범위 밖 편의 기능).

### 6-4. 공감 중복 방지 (UX)
- 서버는 클릭마다 +1 허용(익명이므로 개인 식별 불가).
- 브라우저 `localStorage.mv_liked_posts` 에 공감한 id 저장 → 같은 브라우저에서는 **1회만 가능**. 다른 기기/시크릿 모드에서는 다시 가능.
- 낙관적 업데이트: 클릭 즉시 카운트 +1 반영 → 서버 실패 시 롤백 + 에러 표시.

### 6-5. 빈 상태
- "아직 아무 이야기도 없어요" — 세리프 카피.
- 필터가 걸렸을 때는 필터 해제 안내 카피로 전환.

---

## 7. 실행 / 검증

### 7-1. 로컬 실행
```bash
cd week-4/Quest/Anonymous_board
npm install
node server.js
# Anonymous-Board server running on http://localhost:4327
```

### 7-2. 스모크 테스트 (수행 완료 ✅)
| 케이스 | 기대 | 결과 |
| :--- | :--- | :--- |
| `GET /` | 200, `index.html` 서빙 | ✅ 200 |
| `GET /api/posts` | 200, `{ success, data }` | ✅ 200 |
| `POST /api/posts` {칭찬, "시작이 반이다!"} | 201, UUID + likes=0 | ✅ UUID 발급 확인 |
| `POST /api/posts/:id/like` | likes=1 반환 | ✅ likes=1 |
| `GET /api/posts?sort=likes` | likes 내림차순 | ✅ 정렬 확인 |
| `DELETE /api/posts/:id` | 200, 빈 success | ✅ (테스트 데이터 정리) |

---

## 8. 배포 계획

1. Vercel 프로젝트 신규 생성 (`--name anonymous-board` 또는 UI)
2. 환경변수 설정: `DATABASE_URL` (Supabase pooler URL)
3. `vercel --prod --yes` → `refri-manager` 와 동일한 dual-mode 구성이 그대로 동작
4. 완료 후 이 문서에 Production URL 기록 예정 (아직 미배포)

---

## 9. 미션 체크리스트 (PRD 대응)

- [x] Supabase 프로젝트 및 `posts` 테이블 설정 → `initDB()` 자동 생성
- [x] 글 작성 UI 및 DB Insert API 구현 → `POST /api/posts`
- [x] 게시글 리스트 Fetch 및 정렬 기능 구현 → `GET /api/posts?sort=recent|likes`
- [x] 공감 버튼 → DB Update (`likes + 1`) → `POST /api/posts/:id/like`
- [ ] GitHub 저장소 업로드 및 스크린샷 준비 (다음 단계)

---

## 10. 후속 아이디어 (MVP 이후, 필요 시)

- **Supabase Realtime** 구독으로 다른 브라우저에서 작성한 글이 즉시 내 화면에 뜨도록
- **신고하기** 버튼 + 관리자 뷰
- **하루에 N회 제한** (IP/fingerprint 단위 — 프라이버시 고려 필요)
- **반응별 카운터** (응원/축하/위로 등 공감 분기)
- **페이지네이션** (현재 상한 200건)
