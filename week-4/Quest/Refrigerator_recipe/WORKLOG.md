# Refri-Manager — 작업 로그

> PRD: [`prd.md`](./prd.md)
> 작업 시작: 2026-04-19

## 개요
PRD "냉장고 재료 & 레시피 관리 앱"을 단일 디렉터리 안에서 풀스택으로 구현합니다.
- Backend: Node.js (Express 5) + `pg` — Supabase PostgreSQL에 연결
- Frontend: 단일 `index.html` (React 18 + Tailwind CDN)
- Deploy target: Vercel (dual-mode: 로컬 `node server.js` + 서버리스 export)

## 스택 · 파일 구성
```
week-4/Quest/Refrigerator_recipe/
├── prd.md                 # 요구사항 문서
├── WORKLOG.md             # 이 파일 (작업 내역 누적 기록)
├── server.js              # Express + pg (API)
├── index.html             # React SPA
├── package.json
├── vercel.json
└── (node_modules/, package-lock.json — gitignore)
```

## DB 스키마
기존 Supabase 프로젝트(memos/todos와 같은 DB)에 두 개 테이블 추가:

### `ingredients`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` 기본값 |
| name | TEXT NOT NULL | 재료명 |
| category | TEXT | 육류/채소/유제품/곡물/조미료/기타 |
| expiry_date | DATE | 유통기한 (nullable) |
| created_at | TIMESTAMPTZ | `now()` |

### `recipes`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| title | TEXT NOT NULL | 요리명 |
| ingredients | TEXT[] | 필요 재료 배열 |
| steps | TEXT | 조리법 (멀티라인) |
| created_at | TIMESTAMPTZ | `now()` |

lazy `initDB()`에서 `CREATE TABLE IF NOT EXISTS`로 생성.

## API 설계
응답 형식: `{ success: boolean, data, message? }`

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/ingredients?q=` | 목록 조회 (name ILIKE) |
| POST | `/api/ingredients` | `{ name, category?, expiry_date? }` 등록 |
| DELETE | `/api/ingredients/:id` | 삭제 |
| GET | `/api/recipes?q=` | 목록 (title ILIKE) |
| POST | `/api/recipes` | `{ title, ingredients[], steps }` 저장 |
| GET | `/api/recipes/:id` | 상세 조회 |

PRD 본문에는 레시피 PATCH/DELETE가 명시되지 않았지만 실사용 편의를 위해 DELETE는 추가.

## UI 요구사항 (PRD 4장 기반)
- 탭 2개: 재료 / 레시피
- **재료 탭**
  - 상단 폼: 재료명 + 카테고리 드롭다운 + 유통기한 (date input)
  - 카테고리 필터, 검색창 (300ms debounce)
  - 카드/태그 그리드: 재료명, 카테고리 뱃지, D-day 표시 (유통기한 임박 시 색상 경고)
  - 각 카드에 삭제 버튼
- **레시피 탭**
  - 상단 폼: 제목 + 재료(엔터/콤마로 구분해 배열로 파싱) + 조리법 (textarea, markdown 허용)
  - 검색창
  - 카드 목록: 제목, 재료 미리보기, "자세히 보기" → 모달로 전체 steps 표시
  - 모달에서 삭제 가능

## 작업 방침
- `single-server-specialist` 에이전트 사용을 지시받았으나 이전 세션에서 에이전트가 Write/Edit 권한 차단으로 실패한 적이 있어, 이번에는 메인 스레드가 에이전트의 가이드라인(dual-mode, lazy initDB, `.trim()`, Express 5 `/{*splat}`, vercel.json)을 직접 따르는 방식으로 진행.
- 모든 진행 내역은 이 WORKLOG에 누적 기록.

---

## 진행 내역
- [x] `WORKLOG.md` 초안 작성
- [x] `server.js` 작성 — Express 5 + `pg`, lazy `initDB()`가 `pgcrypto` 확장 로드 후 `ingredients`/`recipes` 테이블을 `gen_random_uuid()` 기본값으로 생성
- [x] `package.json` (`express ^5`, `pg ^8`), `vercel.json` (표준 dual-build 템플릿)
- [x] `index.html` — React 18 SPA, 상단 탭(재료/레시피), 재료 카드 그리드 + D-day 배지 + 카테고리 필터, 레시피 카드 + 모달 상세 보기
- [x] `npm install` — 의존성 설치
- [x] 로컬 스모크 테스트 통과

## 스모크 테스트 결과 (2026-04-19)

| # | 케이스 | 결과 |
|---|---|---|
| 1 | `GET /api/ingredients` (초기 빈 배열) | ✅ `{success:true, data:[]}` |
| 2 | `POST /api/ingredients` 양파 (채소, 2026-04-25) | ✅ 201, UUID 반환 |
| 3 | `POST /api/ingredients` 삼겹살 (육류, 2026-04-21) | ✅ 201 |
| 4 | `GET /api/ingredients?category=채소` | ✅ 양파 1개 반환 |
| 5 | `POST /api/recipes` 김치볶음밥 (4재료, steps 포함) | ✅ 201, `ingredients: TEXT[]` 정상 |
| 6 | `GET /api/recipes/:id` 상세 | ✅ steps 개행 유지 |
| 7 | `GET /api/recipes?q=김치` 검색 | ✅ 제목/재료 배열 대상 ILIKE 동작 |
| 8 | 잘못된 카테고리 전송 | ✅ 400 + enum 메시지 |
| 9 | `DELETE /api/ingredients/:id` | ✅ 200, 삭제된 row 반환 |
| 10 | `GET /api/recipes/not-a-uuid` | ✅ 400 `Invalid id` |
| 11 | `GET /api/recipes/<존재하지 않는 UUID>` | ✅ 404 `Recipe not found` |

## 구현 메모
- **UUID**: `pgcrypto` 확장을 사용해 `gen_random_uuid()` 기본값으로 생성. Supabase에선 `pgcrypto`가 기본 활성화되어 있어서 `CREATE EXTENSION IF NOT EXISTS`만 한 번 보장하면 됨.
- **날짜 타임존 주의**: `DATE` 컬럼이 JSON으로 직렬화될 때 `pg`가 `TIMESTAMPTZ`처럼 변환해 `T15:00:00Z`(KST 자정)가 되므로, 프론트에서 `new Date(...).setHours(0,0,0,0)`로 로컬 자정 맞춘 뒤 D-day를 계산.
- **레시피 검색**: 제목 ILIKE + `unnest(ingredients)` ILIKE의 EXISTS 서브쿼리로, 재료 이름으로도 레시피가 검색되게 함.
- **재료 정렬**: 유통기한이 임박한 것부터 앞에 나오도록 `CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, created_at DESC` 순.
- **카테고리 enum**: 서버에서 `['육류', '채소', '유제품', '곡물', '조미료', '기타']` 6종으로 고정 검증. 프론트도 동일 목록 + 아이콘/배지 컬러.

## 에이전트 사용 메모
- 사용자가 `single-server-specialist` 에이전트 사용을 지시했으나, 이전 세션에서 해당 에이전트가 파일 Write/Edit 권한을 거부당해 빈손으로 돌아온 전례가 있음.
- 이번엔 메인 스레드가 에이전트의 가이드라인(dual-mode export, lazy `initDB()` + flag, `DATABASE_URL`에 `.trim()`, Express 5 `/{*splat}` SPA fallback, `vercel.json` 표준 템플릿)을 그대로 따르며 직접 구현.

## 실행 방법
```bash
cd week-4/Quest/Refrigerator_recipe
npm start              # http://localhost:4325
```
> 기본 포트는 **4325** (sibling 프로젝트와 겹치지 않도록: my-data=4321, todos-jason=4322, todos-sqlite=4323, todos-postgresql=4324 다음 번호). `PORT` 환경변수로 재정의 가능.
환경변수 `DATABASE_URL`이 설정돼 있으면 그걸 우선 사용하고, 없으면 Supabase 풀러 설정을 fallback으로 사용한다.

## Vercel 배포 (2026-04-19)
- 기존 `memo` 프로젝트와 **분리된 새 프로젝트**로 배포 (`vercel --name refri-manager --yes`)
- **Production URL**: https://refri-manager-bice.vercel.app
- 인스펙터: https://vercel.com/384s-projects/refri-manager/LHruMTKdeYQ6SLMsVpWGc5YuYGq4
- 환경변수: `DATABASE_URL` (Production ✅ / Development ✅) — Supabase pooler URL, 비밀번호는 URL-encoded
  - `vercel env add DATABASE_URL <env>` + stdin으로 값 주입
  - Preview는 Git 연동이 없어서 스킵
- env 반영을 위해 `vercel --prod --yes`로 재배포 → 배포 후 `/api/ingredients` curl 테스트 통과 (HTTP 200, 기존 DB rows 반환)

## 추가 기능 (2026-04-19)

### 1. 레시피 편집 (PATCH)
- **엔드포인트**: `PATCH /api/recipes/:id` — `{title?, ingredients?, steps?}` 부분 업데이트
- **검증**: title은 빈 문자열 거부, ingredients는 배열만 허용, 빈 body는 400
- **UI**: 상세 모달에 "✏️ 편집" 버튼 추가 → 인라인 폼(제목/재료/조리법)으로 전환 → 저장 시 변경된 필드만 PATCH
- **스모크 테스트**:
  - ✅ steps만 부분 업데이트 (200)
  - ✅ `ingredients: "not-array"` → 400 `must be an array of strings`
  - ✅ 빈 body `{}` → 400 `At least one of title, ingredients, or steps must be provided`

### 2. AI 추천 레시피
- **엔드포인트**: `POST /api/recipes/suggest` — body `{ days_within?: number }` (기본 7)
- **로직**:
  1. `expiry_date - CURRENT_DATE <= days_within`인 재료를 Supabase에서 조회
  2. 없으면 가장 최근/임박 순 최대 10개로 fallback (`used_fallback: true` 표시)
  3. 재료가 전무하면 400 반환
  4. OpenAI SDK (`gpt-4o-mini`, `response_format: json_object`)로 시스템 프롬프트 + 재료 리스트 전달
  5. JSON 파싱해 `{title, ingredients, steps, source_ingredients, used_fallback, days_within}` 반환
- **모델 선택**: `gpt-4o-mini` — 빠르고 저렴, JSON 모드 지원
- **프롬프트 규칙**: 1인분, 15분 이내, 자취생 난이도, 기본 양념 OK, 유통기한 임박 우선
- **UI**: 레시피 탭 상단에 그라디언트 배너 + "추천 받기" 버튼 → 모달에서 로딩/결과/재추천/저장
- **안전장치**: `OPENAI_API_KEY` 미설정 시 503 + 친절한 한글 메시지
- **dotenv**: 로컬 개발용 `dotenv`로 `.env` 자동 로드 (Vercel은 env var 자동 주입)

### 실제 호출 검증 (2026-04-19)
- 냉장고에 4개 재료(김치/라면/계란/삼겹살) 등록된 상태에서 `POST /api/recipes/suggest {"days_within":30}` 호출
- 응답: `{title: "김치 삼겹살 라면", ingredients: [...], steps: "1. 삼겹살을...\n..."}` — 4개 재료 모두 활용한 자취생용 조리 5단계 반환
- JSON 모드 덕분에 파싱 실패 없이 안정적으로 구조화 출력

### 키 설정 방법
- **로컬**: `week-4/Quest/Refrigerator_recipe/.env` 파일에 `OPENAI_API_KEY=sk-...` 한 줄 (루트 `.gitignore`가 제외)
- **Vercel**: `vercel env add OPENAI_API_KEY production --value sk-... --yes` 후 `vercel --prod --yes`로 재배포

## 프로덕션 반영 (2026-04-19)
- `OPENAI_API_KEY`를 Vercel Production/Development 환경변수에 추가 (Supabase `DATABASE_URL`과 동일 방식)
- `vercel --prod --yes`로 재배포 → https://refri-manager-bice.vercel.app
- 배포 직후 `/api/recipes/suggest` 호출: HTTP 200, "김치 계란 라면" 레시피 반환 — AI 엔드포인트가 프로덕션 DB + 키로 정상 동작
- `main` 브랜치에 커밋/푸시 (`02d3a0b..f0302f4`): server.js, index.html, package.json, WORKLOG.md, PRD, skill 파일들 포함
- `.env`, `.vercel/`는 gitignore 규칙으로 커밋 제외 확인

## 다음 단계 후보
- Git 연동해서 main push 시 자동 배포 (Vercel GitHub 통합)
- 레시피에 썸네일 이미지(혹은 AI 생성 이미지) 추가
- 여러 레시피를 한 번에 제안하는 옵션
