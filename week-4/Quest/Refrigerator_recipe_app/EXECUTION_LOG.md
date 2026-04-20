# Refri-AI-App — 실행 로그

> PRD: [`prd.md`](./prd.md) · 기준 버전: 1.0 (AI 기반 냉장고 파먹기)
> 기준 구현: `week-4/Quest/Refrigerator_recipe` (파일 구성 패턴, Supabase 연결, dotenv, Vercel dual-mode)
> 작업일: 2026-04-20

## 사용자 결정 사항 (AskUserQuestion으로 확인됨)
- **재료 DB**: 새 테이블 `public.ingredients_app` 생성 — 앞 앱과 완전 분리
- **AI 모델**: OpenAI `gpt-4o-mini` (JSON 모드)
- **배포**: 새 Vercel 프로젝트 (이름 `refri-ai-app`)

## 스택 · 파일 구성
```
week-4/Quest/Refrigerator_recipe_app/
├── prd.md                 # 요구사항
├── EXECUTION_LOG.md       # 이 파일
├── server.js              # Express 5 + pg + openai
├── index.html             # React 18 SPA (CDN)
├── package.json
├── vercel.json
├── .env                   # OPENAI_API_KEY (gitignore)
└── node_modules/, package-lock.json (gitignore)
```

## DB 스키마 (Supabase PostgreSQL)

### `public.ingredients_app`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | SERIAL PK | |
| name | TEXT NOT NULL | 재료명 |
| quantity | TEXT | 수량 (선택, 예: "2개", "한 컵") |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### `public.recipes_app`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` 기본값 |
| title | TEXT NOT NULL | 요리명 |
| content | TEXT | 조리법 (번호 매긴 개행 텍스트) |
| ingredients_used | TEXT[] | 사용된 재료 배열 |
| difficulty | TEXT | `쉬움` / `보통` / `어려움` |
| cooking_time | INT | 분 단위 |
| category | TEXT | 테마 (`간단` / `다이어트` / `야식` / `술안주` / `기타`) |
| is_favorite | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

`CREATE EXTENSION IF NOT EXISTS pgcrypto;` + `CREATE TABLE IF NOT EXISTS ...` 로 lazy init.

## API 설계
응답 형식: `{ success, data, message? }`

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/ingredients?q=` | 재료 목록 |
| POST | `/api/ingredients` | `{ name, quantity? }` 등록 |
| DELETE | `/api/ingredients/:id` | 재료 삭제 |
| POST | `/api/recipes/generate` | `{ theme? }` → AI가 레시피 생성 (저장 X) |
| GET | `/api/recipes?q=&difficulty=&max_cooking_time=&is_favorite=&category=` | 저장된 레시피 목록 (필터) |
| POST | `/api/recipes` | AI 결과를 `recipes_app`에 저장 |
| GET | `/api/recipes/:id` | 상세 |
| PATCH | `/api/recipes/:id` | 필드 부분 업데이트 (특히 `is_favorite` 토글) |
| DELETE | `/api/recipes/:id` | 삭제 |

## AI 프롬프트 전략
- system: 1인분 기준, 냉장고 재료 활용, JSON만 반환. `difficulty`는 `쉬움/보통/어려움` 중 하나, `cooking_time`은 정수(분), `category`는 선택된 테마 반영.
- user: 재료 리스트 + 선택된 테마(없으면 `any`)
- `response_format: { type: 'json_object' }`로 안정적 파싱.

## UI 주요 포인트
1. 상단 탭: **🥬 재료** / **🤖 AI 생성** / **📚 보관함**
2. **재료 탭**: 이름 + 수량 입력, 검색, 삭제. 태그형 리스트.
3. **AI 생성 탭**: 테마 라디오(간단/다이어트/야식/술안주/아무거나) → "레시피 생성" → 결과 카드(요리명, 난이도 뱃지, 조리시간 ⏱, 재료, 조리법) → "저장" / "다시 생성" / "닫기"
4. **보관함 탭**: 필터(난이도/최대 조리시간/즐겨찾기만/카테고리) + 검색, 카드 그리드, 하트 토글, 상세 모달, 삭제.
5. 난이도 컬러: 쉬움=초록, 보통=노랑, 어려움=빨강.

## 작업 방침
- 사용자가 `single-server-specialist` 에이전트 사용을 지시했으나, 이전 세션에서 해당 에이전트가 Write/Edit 권한 거부로 실패한 이력이 있음. 이번에도 메인 스레드가 에이전트 가이드라인(dual-mode export, lazy `initDB()` + flag, `.trim()` on env, Express 5 `/{*splat}`, `vercel.json` 표준 템플릿)을 그대로 따르며 직접 구현.
- 포트: **4326** (sibling 시리즈 연속, Refrigerator_recipe=4325 다음).
- `OPENAI_API_KEY`는 앞 앱 `.env`에서 복사 재사용 (같은 키, 로컬 개발용).

## 진행 내역
- [x] EXECUTION_LOG 초안 작성
- [x] `server.js` 작성 — initDB에서 `ingredients_app` + `recipes_app` 생성 (`pgcrypto` 확장), CRUD + AI generate 엔드포인트 (9개)
- [x] `package.json` (`dotenv`, `express ^5`, `openai`, `pg`), `vercel.json`
- [x] `index.html` 작성 — 3탭 UI(재료/AI생성/보관함), 난이도·테마 뱃지, 필터, 즐겨찾기 토글, 모달 상세
- [x] `.env` 복사 (앞 앱 `Refrigerator_recipe/.env`의 OPENAI_API_KEY 그대로 재사용)
- [x] `npm install` (4개 의존성 OK)
- [x] 로컬 스모크 테스트 — 아래 표 참조
- [x] Vercel 배포 (`refri-ai-app`) + `DATABASE_URL` + `OPENAI_API_KEY` 환경변수 (Prod/Dev)
- [x] 프로덕션 AI 엔드포인트 동작 확인

## 스모크 테스트 결과 (2026-04-20, 로컬 4326)

| # | 케이스 | 결과 |
|---|---|---|
| 1 | `GET /api/ingredients` (초기) | ✅ `{success:true, data:[]}` |
| 2 | `POST /api/ingredients` × 5 (양파/계란/김치/밥/대파) | ✅ 모두 201 |
| 3 | `POST /api/recipes/generate {"theme":"야식"}` | ✅ title="김치 계란 볶음밥", difficulty="쉬움", cooking_time=15, category="야식" |
| 4 | `POST /api/recipes` (생성된 걸 저장) | ✅ 201, UUID 반환 |
| 5 | `PATCH /api/recipes/:id {"is_favorite":true}` | ✅ 200, is_favorite=true |
| 6 | `GET /api/recipes?is_favorite=true` | ✅ 1건 |
| 7 | `GET /api/recipes?difficulty=쉬움` | ✅ 1건 |
| 8 | `POST /api/recipes` (invalid difficulty) | ✅ 400, enum 메시지 |
| 9 | `DELETE /api/ingredients/:id` | ✅ 200, 삭제된 row 반환 |

## Vercel 배포 (2026-04-20)
- 새 프로젝트 **`refri-ai-app`** (팀 `384s-projects`, 기존 `refri-manager`와 별개)
- Production URL (공식 alias): **https://refri-ai-app.vercel.app**
- 환경변수: `DATABASE_URL` (Supabase), `OPENAI_API_KEY` — Production/Development 모두 설정
- 재배포 후 스모크: `GET /api/ingredients` 200, `POST /api/recipes/generate {"theme":"다이어트"}` → "김치 계란 볶음밥 / 쉬움 / 15분" 정상 반환
- 참고: 팀 스코프 신규 프로젝트는 기본적으로 Vercel Authentication이 켜져 있어 `<deployment>-<hash>-384s-projects.vercel.app` 형태의 URL은 401. 공식 alias인 `refri-ai-app.vercel.app`는 공개로 동작.

## 메모
- 앞 앱 `Refrigerator_recipe`와 DB 테이블을 완전히 분리(`ingredients_app`, `recipes_app`)했기 때문에 각자 독립 동작.
- `OPENAI_API_KEY`는 두 앱이 같은 키를 공유 (로컬 개발 편의상). 프로덕션에서는 각 Vercel 프로젝트에 별도로 설정됨.
- 향후 "재료 연동"(레시피 저장 시 재료 차감) 도전 과제는 확장 포인트로 남김.

## UI 리디자인 (2026-04-20) — ultradept.co.kr 레퍼런스
**레퍼런스 분석**: 흰 배경 + 검은 텍스트 모노크롬, Pretendard 류 산세리프, 극단적 타이포 대비, 플랫 디자인(섀도우 거의 없음), 직각 모서리, 넉넉한 여백, 에디토리얼/갤러리 무드.

**변경 사항**:
- Tailwind CDN 위에 Pretendard Variable(CDN) + CSS 변수 토큰 시스템(`--ink`, `--line`, `--accent`) 도입
- 배경: 파스텔 그라디언트 → 순수 화이트 `#FFFFFF`, 가끔 `#F5F5F3` 보조
- 컬러 액센트: 로즈 → `#FF3B00`(호버/하이라이트에만 제한 사용), 난이도는 작은 컬러 블록(🟢🟡🔴)으로 절제
- 타이포: 점보 디스플레이 헤딩(`text-5xl`~`text-[11rem]`, `letter-spacing: -0.035em`, `line-height: 0.92`)
- 모서리: `rounded-2xl` → 전부 직각(`rounded-none`)
- 섀도우: `shadow-md`/`shadow-lg` → 전부 제거, 얇은 선(`1px hairline`)으로 구분
- **Hero**: "YOU ARE WHAT YOU COOK." 슬로건 + 에디션 번호 + 하단 black marquee strip
- **탭**: 핑크 pill → 상단 고정 nav의 underline tab (ALL CAPS)
- **재료 탭**: `SECTION 01` 에디토리얼 헤더 + 그리드 폼 + chip 리스트(테두리만)
- **생성 탭**: 4/8 컬럼 레이아웃, 왼쪽 메타(난이도 마크/시간/카테고리/소스), 오른쪽 큰 제목 + 재료 칩 + 조리법
- **보관함**: 카드 그리드 → 풀폭 **에디토리얼 테이블**(No./Title/Time/Difficulty/Fav). 숫자는 monospace, ●○로 즐겨찾기 표기
- **모달**: 라운드/섀도우 제거, 직각 + 헤더에 `CLOSE ×` 텍스트
- **Marquee**: CSS keyframe으로 CTA 아래 검은 스트립에서 메타 정보 흐르기
- **Noise**: 유틸 클래스 `.noise`로 선택적 SVG 노이즈 오버레이 가능하게 준비
- Footer: 3-column 레이아웃 (브랜드/스택/철학)

**반영**:
- 로컬 4326: ✅ HTTP 200, 40KB
- 프로덕션 https://refri-ai-app.vercel.app: ✅ HTTP 200, 40KB, 주요 카피("REFRI—AI", "YOU ARE WHAT") 정상 렌더
- 서버 로직은 변경 없음 — 프론트엔드만 풀 리디자인
