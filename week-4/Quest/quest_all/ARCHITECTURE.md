# ARCHITECTURE — quest_all

## 1. 한눈에 보기

```
                       ┌─────────────────────────────────┐
                       │        index.html (랜딩)         │
                       │  hero · stats · 6 cards · cta   │
                       └────────────────┬────────────────┘
                                        │
        ┌──────────────┬──────────────┬─┴──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼                ▼              ▼              ▼
   board.html    balance.html   salary.html    refrigerator.html  refri-ai.html  skill.html
        │              │              │                │              │              │
        └──────────────┴──────────────┴────┬───────────┴──────────────┴──────────────┘
                                           ▼
                                ┌─────────────────────────────┐
                                │          server.js          │
                                │   /api/board    (posts)     │
                                │   /api/balance  (questions) │
                                │   /api/salary   (stats)     │
                                │   /api/refri    (food)      │
                                │   /api/refri-ai (food + AI) │
                                │   /api/skill    (fs)        │
                                └──────────────┬──────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                 ┌───────────────┐    ┌────────────────┐   ┌────────────────┐
                 │ Supabase PG   │    │  OpenAI API    │   │  파일시스템     │
                 │  7 tables     │    │  (refri AI)    │   │  ingredients/  │
                 └───────────────┘    └────────────────┘   └────────────────┘
```

## 2. 디렉터리 책임

| 경로 | 책임 |
|------|------|
| `server.js`           | Express 앱. 5개 prefix 라우트 + DB 초기화 + AI 호출 + SPA fallback |
| `index.html`          | 진입점 / 마케팅 페이지 |
| `pages/*.html`        | 서비스별 화면. 자체적으로 메타 fetch → UI 렌더 → CRUD 호출 |
| `assets/css/common.css` | 디자인 토큰(:root) + 헤더/푸터/카드/폼/칩/토스트 컴포넌트 |
| `assets/js/common.js` | 헤더·푸터 inject, `Quest.api()`, `Quest.toast()`, 포맷 유틸, 서비스 라우트 테이블 |

## 3. 라우트 prefix 규칙

원본 프로젝트들의 엔드포인트가 모두 `/api/posts`, `/api/questions` 등 일반 명사를 썼기 때문에
그대로 합치면 충돌이 난다. 통합본에서는 **서비스 prefix**를 강제로 부여:

```
/api/board/...      ← Anonymous_board
/api/balance/...    ← balance_Game
/api/salary/...     ← salary_comparision
/api/refri/...      ← Refrigerator_recipe
/api/refri-ai/...   ← Refrigerator_recipe_app
/api/skill/...      ← Refrigerator_skill (read-only)
```

## 4. DB 초기화

`initDB()`는 첫 `/api/*` 요청 시 1회 실행. `IF NOT EXISTS` 로 모든 테이블·인덱스를 생성해
다른 Quest 프로젝트들이 이미 만든 테이블이 있어도 안전하게 멱등 동작.

스키마는 원본 프로젝트들의 스키마를 그대로 가져와 호환성을 보장한다.
즉 기존 데이터가 있던 Supabase에서 그대로 데이터가 보인다.

## 5. 디자인 시스템

### 5.1 토큰
| 이름 | 값 | 용도 |
|------|----|------|
| `--bg`         | `#fff` | 기본 배경 |
| `--bg-soft`    | `#f5f5f5` | 보조 섹션 배경 |
| `--ink`        | `#000` | 메인 텍스트, primary 버튼 |
| `--ink-muted`  | `#666` | 보조 텍스트, 라벨 |
| `--ink-faint`  | `#999` | 부가 정보 |
| `--line`       | `#e5e5e5` | 외곽선 |
| `--radius-*`   | `0` | 직각 미학 |
| `--font-sans`  | Pretendard | 한·영 모두 가독성 좋음 |

### 5.2 컴포넌트
- **버튼**: `.btn` (검정 솔리드), `.btn-outline`, `.btn-ghost`, 사이즈는 `-sm`/`-lg`/`-block`. 호버는 색 반전.
- **카드**: 4:3 썸네일 + body. 호버 시 `translateY(-3px)` + `border-color: black`.
- **칩**: 인라인 토글. `.chip.active` 가 검정 배경.
- **폼**: 14px 폰트, 1px 회색 보더, 포커스 시 검정 보더.
- **토스트**: 화면 하단 중앙 검정 박스, 2.4초 후 자동 소멸.

### 5.3 반응형
- `≤ 1024px` — 카드 그리드 3 → 2단
- `≤ 900px`  — 햄버거 메뉴 활성, 사이드바가 본문 아래로 스택
- `≤ 600px`  — 카드 1단, 옵션 1단, 통계 그리드 2단
- `≤ 480px`  — 푸터 1단, 통계 1단

## 6. 페이지 패턴

각 서비스 페이지는 동일한 구조:

```
<header data-quest-header></header>      ← JS가 주입
<section class="page-head">              ← 페이지 제목 + 설명
<section class="section">                ← 본문 (left col + sidebar)
<footer data-quest-footer></footer>      ← JS가 주입
<script>Quest.mount('서비스key');</script>
```

`Quest.mount(key)` 가 active 메뉴 처리까지 담당. 모든 fetch는 `Quest.api()` 통과 →
실패 시 자동으로 throw → 페이지 코드는 try/catch로 토스트만 띄우면 됨.

## 7. 보안·검증

서버는 모든 입력을 prefix별 화이트리스트(카테고리, 직군 등)로 1차 검증한다.
SQL 인젝션은 모든 쿼리가 매개변수화되어 있어 차단됨. XSS는 클라이언트가 `Quest.escapeHtml()`로
사용자 입력을 모두 escape한 뒤 innerHTML에 삽입한다.

LocalStorage 기반 중복 방지(공감/투표)는 사용자 경험 목적의 약한 가드.
다중 클라이언트 우회가 가능하다는 점은 원본 PRD와 동일한 한계로 그대로 둠.

## 8. 배포

- 로컬: `npm start` → 4330 포트
- Vercel: `vercel.json`이 `/(.*) → server.js` 라우팅. 정적 자산은 Express의 `express.static(__dirname)`으로 처리.
- `DATABASE_URL`, `OPENAI_API_KEY`는 Vercel 환경변수로 주입.

## 9. 의존성

- `express@5` — 라우터, SPA fallback 문법(`/{*splat}`)
- `pg@8` — Supabase Postgres pooler 연결
- `openai@4` — AI 호출 (없을 때 graceful degrade — 503 응답)
- `dotenv` — 로컬 `.env` 자동 로드
- 프론트는 의존성 0. Pretendard만 CDN.
