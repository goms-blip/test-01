# WORKLOG — quest_all

## 2026-04-23

### 목표
`week-4/Quest` 폴더에 흩어진 6개의 미니 프로젝트를 **하나의 사이트**처럼 묶고,
모바일에서도 데스크톱과 동일한 경험을 주도록 통합한다. 프론트 디자인은
흑·백 미니멀 톤을 사용한다.

### 1. 사전 분석
- 통합 대상 6개 폴더 파악
  - `Anonymous_board` — Express + Postgres / posts CRUD + 공감
  - `Refrigerator_recipe` — Express + Postgres + OpenAI / 재료·레시피 + AI 제안
  - `Refrigerator_recipe_app` — Express + Postgres + OpenAI / 재료(직렬키) + 테마 기반 AI 생성 + 즐겨찾기
  - `Refrigerator_skill` — Claude Skill (DB 없음, JSON 파일들)
  - `balance_Game` — Express + Postgres / 질문·투표
  - `salary_comparision` — Express + Postgres / 연봉·지출 통계
- 각 프로젝트의 `prd.md`, `server.js`를 모두 읽고 데이터 모델 / 엔드포인트 / 검증 규칙을 정리.
- 충돌 가능성 확인: 모든 테이블명이 서로 달라 동일 DB에서 공존 가능. 추가 마이그레이션 불필요.

### 2. 아키텍처 결정
세 가지 선택지를 검토:

| 안 | 장점 | 단점 |
|---|------|------|
| (A) SPA 단일 페이지 + hash 라우팅 | URL 단순, 전환 빠름 | index.html이 거대해짐, 미니멀 스타일과 어울리지 않음 |
| (B) 다중 HTML 페이지 + 단일 server.js | 페이지별 분리·관리 쉬움, 서버는 1개 | 페이지마다 헤더/푸터 중복 — JS로 inject |
| (C) Next.js 같은 풀스택 프레임워크 | 모던 | 다른 Quest 프로젝트들과 결이 다르고 학습/구성 비용↑ |

→ **(B) 안 선택**. 이전 Quest 프로젝트들과 동일한 "정적 HTML + Express" 패턴을 유지해 일관성 확보.
헤더·푸터는 `assets/js/common.js`에서 동적 주입(=DRY)한다.

### 3. 통합 스키마
- `posts` (게시판)
- `mb_questions`, `mb_votes` (밸런스)
- `salary_stats` (연봉)
- `ingredients`, `recipes` (냉장고 — UUID + expiry)
- `ingredients_app`, `recipes_app` (AI 레시피 — serial + favorite)

→ 5개 서비스 = 7개 테이블. `initDB()` 한 번에 전부 IF NOT EXISTS 로 생성. Skill은 DB 없이 파일시스템에서 읽음.

### 4. 디자인 토큰
- Primary `#000`, Surface `#fff`, Soft `#f5f5f5`, Muted `#666`, Line `#e5e5e5`
- Radius `0` (라운드 거의 사용 안함)
- 큰 헤딩(타이포 스케일 `clamp(40, 7vw, 88)px`)
- 카드: 흰 배경 / 회색 외곽선 / 호버 시 검정 외곽선 + 4px 위 이동
- 햄버거 메뉴 ≤ 900px

### 5. 구현 순서
1. `server.js` — 5개 백엔드를 prefix로 분리해 통합 (`/api/board`, `/api/balance`, ...)
2. `package.json`, `vercel.json`, `.env.example`, `.gitignore`
3. `assets/css/common.css` — 디자인 토큰 + 공통 컴포넌트(버튼, 카드, 폼, 칩, 토스트)
4. `assets/js/common.js` — 헤더/푸터 inject + `Quest.api()`/`Quest.toast()`/포맷 유틸
5. `index.html` — 히어로 + 통계 바 + 6개 서비스 카드 + CTA + 푸터
6. 6개 서비스 페이지 (`pages/*.html`)
7. README / ARCHITECTURE / WORKLOG 문서화
8. `npm install` 후 스모크 테스트

### 6. 진행 노트
- `refrigerator.html`이 `/api/refri/recipes/suggest`를 호출하지만 처음 server.js 작성 시 `refri-ai/generate`만 추가했음 → suggest 엔드포인트 추가 패치.
- 모든 `like`, `vote` 중복 방지는 LocalStorage 기반(클라이언트 측). 서버에서는 단순 +1 / insert 만 처리.
- `Quest.api()`가 `data` 필드만 반환하도록 통일 → 모든 페이지에서 동일한 호출 패턴.
- Express 5의 SPA fallback 라우트는 `app.get('/{*splat}', ...)` 문법 사용 (다른 Quest 프로젝트들과 동일).

### 7. 검증
- `npm install` ✅
- `npm start` → 서버 부팅 OK, `GET /api/health` → `{ ok: true }`
- 메인 페이지 → 6개 카드 모두 정상 노출
- 각 서비스 페이지: 메타 로드 → 카테고리 칩 렌더 → 리스트 비어있음 메시지 → 등록/공감/투표 정상 동작 (수동 확인)
- 모바일 뷰포트(375px) — 햄버거 메뉴, 카드 1단, 사이드바가 본문 아래로 스택되는 것 확인

### 8. 알려진 제한
- 중복 투표/공감 방지가 LocalStorage 기반이라 시크릿 모드에서는 우회 가능 (원본 프로젝트들과 동일한 한계).
- `OPENAI_API_KEY`가 없으면 AI 엔드포인트 두 개(`/api/refri/recipes/suggest`, `/api/refri-ai/generate`)는 503을 반환.
- Vercel 배포 시 Skill 페이지의 `../Refrigerator_skill/ingredients` 경로는 빌드에 포함되지 않을 수 있어 빈 목록을 보일 수 있음. 로컬에서는 정상.

### 9. 외부 브랜드 언급 일괄 제거
초기 설계 노트에 디자인 참고 사이트 이름이 21건(7개 파일) 남아 있었음 → 전부 일반 표현(“미니멀 디자인”, “모던한 디자인 언어”, “모노 톤” 등)으로 치환.
- 대상 파일: `index.html`, `assets/css/common.css`, `assets/js/common.js`, `package.json`, `README.md`, `WORKLOG.md`, `ARCHITECTURE.md`
- 푸터의 `Inspired by …` 문구 → `Minimal · Mobile-first`
- README 하단의 “디자인 영감” 줄은 삭제, 폰트 크레딧(Pretendard)만 유지

### 10. 카드 썸네일 이미지화 (Fal API)
기존 카드가 흑백 톤에 이모지만 떠 있어 밋밋했음 → 각 카드의 tone 컬러와 맞춘 미니멀 플랫 일러스트로 교체.
- 모델: `fal-ai/flux/schnell` (4 step inference, `landscape_4_3`)
- 병렬 생성 스크립트(`/tmp/gen_cards.js`) 작성 → 6장을 ~2초에 동시 생성·다운로드
- 저장 위치: `assets/img/cards/{board,balance,salary,refrigerator,refri-ai,skill}.jpg` (25KB~88KB)
- 마크업: 각 카드 `.card-thumb` 의 이모지를 `<img loading="lazy">` 로 교체
- CSS: `.card-thumb img { object-fit: cover }` + hover 시 1.03배 스케일 인 효과

### 11. 상단 nav 버튼 제거 + 히어로 비주얼 리디자인
피드백: 헤더의 "시작하기" 버튼이 불필요, 히어로 우측 검정 비주얼이 4:5 세로라 답답함.
- `assets/js/common.js` 의 `.nav-actions` div 자체 삭제 (로고 · 메뉴 · 햄버거만 남김)
- 히어로 비주얼 개편:
  - `aspect-ratio: 4/5 → 1/1` (정사각)
  - 중앙 빈 공간 → **6개 서비스 미니 그리드(3×2)** 로 채움. 각 셀은 실제 서비스 링크 + hover 효과
  - 상단 `Total Services 06EA` 왼쪽 정렬 + 우측 `Live` 라벨로 좌우 균형
  - Tech Stack 한 줄로 압축 (`Express 5 · Postgres · OpenAI · Vanilla JS`)
  - 우상·좌하 라디얼 글로우 강도 ↑ 로 단조로움 해소

### 12. 전체 체크 (개별본 5 + 통합본 1 + Skill 1)
6개 프로젝트를 각자 포트로 동시 부팅 → 정적/읽기/쓰기/일관성까지 확인.
- 정적 + 읽기 API: **43/44 PASS** (FAIL 1건은 내 쪽 테스트 설계 오류, 서버 결함 아님)
- 쓰기 CRUD 라이프사이클 (통합본): **14/14 PASS**
  - Board(POST/like/DELETE), Balance(POST/vote/DELETE), Salary(POST), Refrigerator(POST/DELETE), Refri-AI(POST ing/recipe → PATCH fav → DELETE)
- 개별본↔통합본 DB 일관성: **4/4 PASS**
  - `Anonymous_board:4327` 에 POST → `quest_all:4330` 에서 즉시 조회 → 반대 방향 DELETE → 양쪽 모두 사라짐
- 테스트 후 개별 서버 5개 종료, `quest_all:4330` 만 유지

### 13. 다음 작업 (선택)
- `screenshot/` 폴더 추가 — 다른 Quest 프로젝트(`Anonymous_board/screenshot`, `balance_Game/screenshot` …)와 동일 패턴
- git commit 정리 후 Vercel 배포 (`DATABASE_URL`, `OPENAI_API_KEY` 환경변수 필요)
- 다크 테마
- 각 서비스에 검색·페이지네이션 보강
