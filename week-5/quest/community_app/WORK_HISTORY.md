# 작업 히스토리 — community_app

> 일자: 2026-04-29 / 작업자: Claude (Opus 4.7) + seunghun.oh@griff.co.kr
> 모든 작업은 PRD([`prd.md`](./prd.md)) 기준으로 수행. 디자인 레퍼런스([godly.website / Gamma](https://godly.website/website/gamma-272))는 PRD §Part 3 의 명시적 요구라 모든 UI 결정에 반영함.

---

## 0. 요구사항 요약 (PRD)
- **Part 1 인증** — 회원가입(이메일/PW) · 로그인/로그아웃 · 프로필 표시
- **Part 2 게시글 CRUD** — 로그인 사용자만 작성 / 누구나 조회 / 작성자만 수정·삭제
- **Part 3 디자인** — Gamma 풍 캐릭터+이미지 조합, 고딕 계열 폰트
- **Part 4 목록** — 최신순 정렬, 제목·작성자·시간 메타데이터
- **DB** — `posts(id, created_at, title, content, user_id FK auth.users, author_email)`

---

## 1. 디자인 레퍼런스 분석
- godly.website 페이지 직접 fetch 는 403 (봇 차단) → WebSearch + 기존 지식으로 무드 정리
- 추출한 핵심 무드
  - **컬러** — 크림(#fff7ec) 베이스 / 코랄(#ff5f4a) · 그레이프(#7d5cff) · 스카이(#4cb1ff) 액센트
  - **타이포** — 굵은 고딕 디스플레이 + 산세리프 본문. 한글은 **Pretendard**, 디스플레이는 **Space Grotesk** 매핑
  - **그래픽** — 둥둥 떠다니는 블롭 캐릭터 / 별·하트 스티커 / 둥근 카드(28px) / 부드러운 그라디언트 배경
  - **레이아웃** — 큰 히어로 + 카드 그리드. 캐릭터를 텍스트 옆에 의도적으로 겹쳐 배치
- 결과물에 반영한 흔적
  - 히어로 우측 코랄 블롭 + 그레이프 작은 블롭 + 별·하트 (모두 inline SVG, float 애니메이션)
  - 게시글 카드 좌측 56×56 캐릭터 아바타 (작성자 이메일 해시 → 6색 팔레트 × 6 페이스 매핑)
  - 빈 상태/로그인 안내/푸터에도 캐릭터를 살짝 끼워넣음
  - 폰트 — 본문 Pretendard, 헤드라인은 `.display` 클래스로 Space Grotesk

## 2. DB 스키마 설계 ([`schema.sql`](./schema.sql))
- `pgcrypto` 확장으로 uuid 자동 생성
- `public.posts` 테이블 — PRD §3 의 컬럼 그대로 (`user_id` 는 `auth.users(id) ON DELETE CASCADE`)
- 인덱스 2개 — `created_at desc` (피드 정렬용), `user_id` (내 글 조회용)
- **RLS 정책 4개**
  | 정책 | 대상 | 조건 |
  | :--- | :--- | :--- |
  | `posts_select_all` | anon, authenticated | `using (true)` — 누구나 조회 |
  | `posts_insert_own` | authenticated | `with check (auth.uid() = user_id)` |
  | `posts_update_own` | authenticated | `using/with check (auth.uid() = user_id)` |
  | `posts_delete_own` | authenticated | `using (auth.uid() = user_id)` |
- 멱등성 위해 `drop policy if exists … ` 먼저 실행
- `posts_list` 뷰 — 120자 미리보기·content_length 포함 (목록 최적화 여지)

## 3. 서버 ([`server.js`](./server.js), [`package.json`](./package.json))
- Express 만 의존 (DB 호출은 클라이언트가 Supabase JS SDK 로 직접 → RLS 가 보호)
- 핵심 라우트 두 개
  - `/env.js` — `window.__ENV = { SUPABASE_URL, SUPABASE_ANON_KEY }` 주입
  - 그 외 — `index.html` 정적 서빙 (SPA fallback)
- 환경변수 비어있으면 fatal 대신 warn 으로 처리 → 클라이언트가 안내 카드 노출
- 포트 기본 4000 (4주차 가계부앱이 3000 점유 가능성 → 충돌 회피)

## 4. SPA 구현 ([`index.html`](./index.html))
React 컴포넌트 트리 (단일 파일):
```
<App>
 ├ <Header>          로고/로그인 상태/로그아웃
 ├ <Hero>            큰 디스플레이 타이포 + 떠있는 캐릭터
 ├ <WriteCard>       로그인 시 글쓰기, 비로그인 시 안내
 ├ <feed grid>       <PostCard> × N
 │  └ <PostCard>     캐릭터 아바타 + 본문 + (본인 글이면) 수정/삭제
 ├ <footer>
 └ <AuthModal>       탭 전환형 로그인/가입 모달 + 토스트
```
- **Auth 흐름**
  - `sb.auth.getSession()` 으로 부팅 시 세션 복원
  - `onAuthStateChange` 구독으로 로그인/로그아웃을 즉시 반영 (언마운트 시 unsubscribe)
  - 가입 시 `email confirmation` ON/OFF 둘 다 처리 — `data.session` 유무로 분기
- **CRUD 흐름**
  - Read — `from('posts').select(…).order('created_at', desc)` 한 번에 가져와 클라이언트 정렬 유지
  - Create — 로그인 사용자만 폼 노출, 본인 `user_id` 와 `author_email` 자동 포함
  - Update/Delete — `isMine = post.user_id === currentUser.id` 일 때만 버튼 노출. RLS 가 서버에서 한 번 더 차단
- **디자인 디테일**
  - inline SVG `<BlobChar>` (6색 팔레트 + 그라디언트 + 빛 반사 + 볼터치) — 외부 이미지 의존 없음
  - 히어로/푸터 캐릭터에 `float-1/2/3` keyframe 으로 자연스러운 부유감
  - 작성자 이메일 → 31진 해시 → 색·페이스 결정. 같은 사람은 항상 같은 캐릭터
  - 토스트는 portal 대신 가벼운 fixed 컴포넌트
- **Babel standalone** — 빌드 도구 없이 JSX 그대로. `@babel/standalone@7.25.6` 핀

## 5. 문서
- [`README.md`](./README.md) — 빠른 시작, 폴더 구조
- [`SETUP.md`](./SETUP.md) — Supabase 프로젝트/Auth/스키마/트러블슈팅
- [`WORK_HISTORY.md`](./WORK_HISTORY.md) ← 지금 이 파일

## 6. 보안 체크
- `SUPABASE_ANON_KEY` 는 RLS 로 보호되는 공개 키 → 클라이언트 노출 OK
- `SERVICE_ROLE` 키는 어디에도 없음 (검색해서 확인)
- `.env` 는 `.gitignore` 등록됨
- RLS 정책으로 다른 사람 글 UPDATE/DELETE 시도 시 0 rows 로 무력화 (브라우저 우회 불가)

## 7. 검증 체크리스트
- [x] `schema.sql` 멱등 실행 가능 (정책 drop → create)
- [x] `.env` 누락 시 친절한 안내 화면 노출
- [x] 로그아웃 상태에서도 피드 조회 가능
- [x] 로그인 후 글쓰기 → 즉시 피드 반영 (`onCreated` 콜백 → `fetchPosts`)
- [x] 다른 사용자 글 카드에는 수정/삭제 버튼 미노출
- [x] 본인 글 카드만 수정 → 저장 → 즉시 갱신
- [x] 작성자 이메일 해시로 캐릭터가 일관되게 매핑 (같은 사람 = 같은 색·페이스)
- [x] 모바일 폭(360px)에서 레이아웃 깨짐 없음 (헤더·히어로·카드 모두 stack)

## 8. 후속 아이디어 (미구현)
- 좋아요 / 댓글 (RLS 로 본인만 삭제 가능하게)
- 이미지 첨부 (Supabase Storage)
- 작성자 프로필 페이지 (닉네임/아바타 커스텀)
- 무한 스크롤 (`range()` 페이징)
- 실시간 갱신 — `sb.channel('posts').on('postgres_changes', …)`

## 9. 변경 로그
- **2026-04-29 17:30** — 초기 구축 완료 (schema, server, index.html, 문서 일괄 생성)
- **2026-04-29 17:50** — 비밀번호 정책 강화: 회원가입 시 **영문+숫자 10자 이상** 의무화. `AuthModal` 에 실시간 검증 체크리스트(10자/영문/숫자) 3행 추가, 미충족 시 제출 버튼 비활성화. 로그인은 기존 사용자 보호를 위해 정책 검사 미적용.
- **2026-04-29 17:55** — 디자인 1차 리워크: Gamma 풍 컬러풀 블롭 → Anthropic editorial 무드(크림 #faf9f5 + 클레이 #cc785c, Fraunces+Pretendard 페어링).
- **2026-04-29 17:55–18:10** — 디자인 도구(**Playwright MCP**)로 실제 화면을 반복 캡처하며 시각 품질 다듬기. (`?demo=1` 모드 추가 — Supabase 연결 없이도 인메모리 모의 데이터로 전체 화면 미리보기 가능)
  - 데스크톱(1280×900) / 모바일(390×844) 풀페이지 + 모달 + 호버 상태까지 스크린샷으로 검증
  - 헤드라인 — Fraunces 700, 클레이 강조어구에 페이퍼 형광펜 풍 배경 그라디언트(`em::after`)
  - 히어로 우측 — 큰 클레이 오브 + 부유 카드 2장(`note · 1` 인용, `live · 방금 새 글`) + 별/스파크 데코 → 단조롭던 우측이 콘텐츠 클러스터로 변신
  - 좌측 하단 ring-stat 2개(POSTS / RLS PROTECTED) — 콘텐츠가 적어도 빈 느낌 없도록
  - 게시글 카드 — 상단 클레이 그라디언트 액센트(호버/내 글 시 노출), 우상단 큰 따옴표 데코, 메타에 `meta-dot` 구분자, MINE 배지, 수정·삭제는 `:hover` 시 페이드인
  - 본문 줄바꿈 정리(어색한 wrap 수정), 모바일 단일 컬럼 적층 확인
- **검증 산출물** — `.playwright-mcp/community-iter-{02..07}.png` (저장소에 남김, 작업 비교용)
- **2026-04-29 18:10** — 사용자 피드백 "지금 디자인보다 supabase.com 무드가 낫겠다" → 전면 리디자인.
  - **레퍼런스 추출** — Playwright 로 supabase.com 직접 캡처(`supabase-ref-hero.png`, `supabase-ref-cards.png`) 후 computed styles 까지 뜯어내서 토큰 확정:
    - bg `#121212` · surface `#1a1a1a` / `#242424` · border `#2e2e2e` · text `#fafafa` / muted `#b4b4b4`
    - signature green `#3ecf8e` (+ glow `rgba(62,207,142,0.18)`)
    - 헤드라인 weight **400** (가볍게!), border-radius **6–8px** (필 X), 페밀리 Inter / JetBrains Mono / Pretendard(한글)
  - **시각 언어 교체**
    - 클레이 오브 → **WireSphere** (위/경도 와이어 + 펄싱 그린 노드 inline SVG)
    - 부유 노트 카드 → **terminal 풍 codeline** (`policy posts_insert_own with check (auth.uid() = user_id)`) + `live` chip-green
    - 헤드라인: 흰색 + **두 번째 줄만 그린** (supabase 호밍 패턴)
    - 상단 announcement chip: 초록 글로우 도트 + "Auth · Postgres RLS · 2026"
    - 새 섹션 `<Stack>` — Auth / Postgres / RLS / Realtime-ready 4-카드, 그린 라인 아이콘
    - 버튼 — `btn-green`(메인 CTA), `btn-dark`, `btn-ghost`, `btn-danger`. 모두 6px 라운드, 그린엔 hover glow.
    - 입력 — 다크 surface, `:focus` 시 그린 보더 + 그린 글로우 ring
    - 비밀번호 체크리스트 — `min(10) / a-z A-Z / 0-9` mono 라벨, 충족 시 그린 사각 도트
    - 게시글 카드 — 좌측 2px 그린 액센트 바(내 글이면 진하게, 호버 시 옅게), 호버 시 surface 한 단계 밝아짐
    - 토스트 — 다크 + 그린 글로우 도트, "insert ok · 1 row" 같은 SQL-likely 메시지
    - 헤더 — 좌측 supabase 풍 로고(번개 마크) + 우측 그린 CTA, 가운데 Feed/Compose/Stack 텍스트 네비
    - 배경 — 28px dot grid + 좌상/우하 그린 radial glow
  - **검증** — 데스크톱(1280) / 모바일(390) 풀페이지 + 인증 모달(가입 탭, 강비번 입력시 그린 활성화)
  - **검증 산출물** — `.playwright-mcp/community-supabase-{01..03}.png`
- **2026-04-29 21:50** — 사용자 피드백 "design.co.kr (Design+) 매거진 형식 카드로 바꿔달라" → 전면 리디자인.
  - **레퍼런스 추출** — Playwright 로 design.co.kr 직접 캡처(`designcokr-ref-01.png`, `02-grid.png`) → computed styles 분석:
    - bg `#ffffff` · text `#2b2b2b` · 매우 옅은 line `#e8e8e8`
    - 카드: border 0, radius 0, shadow 0 — 순수 이미지 + 텍스트 below
    - 비대칭 그리드: 큰 1장 (2/3 폭) + 작은 2장 (1/3, stacked) → 그 아래 5컬럼 그리드
    - 카테고리 칩: 옅은 회색 보더 + 작은 라운드 4px ("Project", "Branding", "Living"…)
    - 상단 노란색(#f5e23b) 마키 announcement
  - **시각 언어 교체** — supabase 다크 → **에디토리얼 매거진 화이트**
    - 로고 — Cormorant Garamond italic 으로 "광장+" (Design+ 워드마크 매핑)
    - 헤더 위 utility bar — 날짜 / 한 줄 카피 / 서울 18° / vol.04 (전형적 잡지 레이아웃)
    - 노란색 marquee announcement 바 (`@keyframes marq` 28s linear infinite)
    - **HeroGrid** — 큰 1장 (lg:col-span-2, 16:13 thumb) + 작은 2장 stacked
    - **FeedGrid** — `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` 5컬럼 매거진 그리드
    - **Cover 컴포넌트** — 게시글마다 8색 팔레트 × 5종 추상 도형(원/가로줄/사각격자/대각선/큰 따옴표) 조합으로 SVG 표지 자동 생성 → 이미지 없는 텍스트 글에도 매거진 느낌 부여. 라벨(NOTE/01)·번호(big italic)는 HTML 오버레이로 잘림 방지.
    - 카드 메타 — title (15.5px / 600 / 2-line clamp) + date 점-구분 (2026.04.29 mono) + 칩 3개 (author, Note, Mine if applicable)
    - 헤드라인 워드마크 — "Now Reading", "Latest Notes" 모두 italic Cormorant Garamond
    - 모달 — 흰 카드 + 검정 hairline border + radius 0 + offset shadow `12px 12px 0 rgba(43,43,43,0.06)` (오프셋 그림자로 잡지 인쇄 느낌)
    - 비밀번호 체크리스트 — `min(10) / a-z A-Z / 0-9` mono. 통과 시 도트가 검정+노랑 사각으로 변환 (banner yellow 액센트)
    - **Stack** 섹션 — 4컬럼 텍스트 (01 Authentication / 02 Postgres+RLS / 03 Compose / 04 Magazine Layout)
    - **WriteCard** — 좌측 라벨/타이틀/저자정보 + 우측 폼 2컬럼 에디토리얼 레이아웃
    - 모든 라운드 0, 모든 보더 hairline (`#e8e8e8` 또는 `#2b2b2b`)
  - **검증** — 데스크톱(1280) / 모바일(390) 풀페이지 + 인증 모달(강비번 모두 통과 상태)
  - **검증 산출물** — `.playwright-mcp/community-mag-{01..04}.png`, `designcokr-ref-{01,02}.png`

