# 작업 로그 — 초보자를 위한 베이킹 재료 사전 (app/)

## 이번 라운드 (프론트 디자인/UI v1)

- **담당 에이전트**: single-react-developer
- **결과물**: `app/index.html` 단일 파일 (CDN React 18 + ReactDOM + Babel Standalone + Tailwind CSS + Pretendard/Noto Sans KR)
- **목표**: PRD/MISSION에 명시된 핵심 기능 4개를 모두 화면으로 보여주는 **프론트엔드 디자인** 완성. 백엔드 연동은 다음 라운드에서 single-server-specialist가 진행.

## 만든 화면 / 기능 체크리스트

- [x] 해시 기반 SPA 라우터 (`#/`, `#/category/:slug`, `#/ingredient/:slug`, `#/compare?ids=a,b,c`, `#/search?q=...`)
- [x] 따뜻한 톤 팔레트 (`cream / butter / caramel / cocoa / cinnamon`) + Pretendard/Noto Sans KR 폰트
- [x] **홈 (`#/`)**
  - 히어로(태그라인 + “3초 안에 답을 받는 베이킹 재료 사전” 카피)
  - 메인 검색바 (라이브 결과 5개 + 전체 결과 페이지 진입)
  - 5개 카테고리 카드 (가루류 🌾 / 팽창제 🫧 / 당류 🍯 / 유제품·지방 🧈 / 기타 🥚)
  - 비교 프리셋 카드 5개 (박력분 vs 중력분 vs 강력분 / 베이킹소다 vs 베이킹파우더 등)
  - 인기 재료 8개 썸네일
- [x] **카테고리 (`#/category/:slug`)**: 카테고리 설명 + 재료 그리드 (썸네일 + 한글명/영문/한 줄 정체)
- [x] **재료 상세 (`#/ingredient/:slug`)**: 9개 정보 항목 정형 레이아웃
  1. 이름(한글/영문/한자) 2. 한 줄 정체 3. 사진 4. 역할 5. 비슷한 재료와의 차이
  6. 초보자 실수(시나몬 톤 강조) 7. 대체 가능 여부+비율 8. 보관법 9. 한국 구매처
  - 상단 “비교에 추가/담김 토글” 버튼 (localStorage 영속 트레이)
- [x] **비교 (`#/compare?ids=...`)**: 9개 항목 × 2~3개 재료 표
  - 좌측 항목 라벨 sticky, 상단 재료 헤더 sticky
  - 모바일에서 재료 열이 가로 스와이프(scroll-snap)로 비교
  - “비교에서 빼기” / 빈 비교 시 안내 + 홈으로
- [x] **검색 결과 (`#/search?q=...`)**: 검색어 하이라이트(`<mark>`), 카테고리별 그룹, 빈 결과 안내
- [x] **비교 트레이(floating)**: 오른쪽 아래 떠 있는 카드. 0~3개 재료, 최소 2개 담아야 비교 가능. localStorage 영속.
- [x] 디자인 시스템 컴포넌트(Button/Card/Badge/IngredientImage)로 재사용
- [x] Unsplash 이미지 fetch 실패 시 이모지 fallback (`onError`)
- [x] 모바일 우선 반응형 (360px 폭 기준 깨짐 없음), `max-w-screen-lg mx-auto` 가운데 정렬
- [x] Mock 데이터: 카테고리 5개, 재료 14개(가루 4 / 팽창제 3 / 당류 2 / 유제품·지방 2 / 기타 3), 비교 프리셋 5개

## 파일 구조 메모

- 단일 파일: `app/index.html` (별도 빌드 없음)
- Mock 데이터는 파일 상단 `CATEGORIES`, `INGREDIENTS`, `COMPARE_PRESETS` 배열에 모여 있음 → 추후 `fetch('/api/...')`로 1:1 치환 용이
- 상단에 `API_BASE_URL = '/api'`를 미리 선언 + 교체 위치 주석 표시

## 다음 라운드 — single-server-specialist에게 넘길 것

### 제안 API 엔드포인트 (현재 mock 데이터 스키마와 1:1 매칭)

| 메서드 | 경로 | 응답 | 비고 |
|---|---|---|---|
| GET | `/api/categories` | `Category[]` (`{slug, name, emoji, desc}`) | 5개 고정값으로 시작 가능 |
| GET | `/api/ingredients` | `Ingredient[]` 전체 | 홈/검색 인덱스용. 30개 미만이므로 1회 fetch 후 클라이언트 검색도 OK |
| GET | `/api/ingredients/:slug` | `Ingredient` (9개 정보 항목 전체) | dev.md의 ingredients 테이블 스키마와 동일 |
| GET | `/api/categories/:slug/ingredients` | `Ingredient[]` (해당 카테고리) | Supabase `eq('category', slug)` |
| GET | `/api/search?q=...` | `Ingredient[]` (부분 일치 상위 12개) | Supabase `ilike` 또는 trigram |
| GET | `/api/compare?ids=a,b,c` | `Ingredient[]` (2~3개) | `in.(...)` 쿼리 한 번. 없으면 클라이언트가 `/ingredients/:slug` 병렬 호출로 대체 가능 |

### Ingredient 타입 (서버 응답 그대로 사용 가능)

```ts
type Ingredient = {
  slug: string;                  // URL용
  name_ko: string;               // 항목 1
  name_en: string;               // 항목 1
  name_zh: string | null;        // 항목 1
  category: 'flour'|'leavening'|'sugar'|'dairy_fat'|'etc';
  summary: string;               // 항목 2
  emoji?: string;                // fallback용
  image_url: string;             // 항목 3 (Supabase Storage public URL 권장)
  role: string;                  // 항목 4
  similar_ingredients: string;   // 항목 5
  common_mistakes: string;       // 항목 6
  substitutes: string;           // 항목 7
  storage: string;               // 항목 8
  where_to_buy: string;          // 항목 9
};
```

### 프론트가 서버 붙을 때 손볼 곳 (총 1~2군데)

- `index.html`의 mock `INGREDIENTS`/`CATEGORIES` 정의를 `useFetch('/api/...')` 결과로 교체
- `searchIngredients(q)`는 그대로 두고, 서버 검색이 우수하다면 `/api/search?q=` 호출로 갈아끼우기

## 로컬에서 열어보는 법

작업 폴더에서 정적 서버 하나만 띄우면 끝.

```bash
cd /Users/sh_oh/Downloads/test-01/week-7/Quest/personal_project/app
npx serve .          # 또는 python3 -m http.server 5173
# 그 다음 브라우저에서 http://localhost:3000 (npx serve 기본) 접속
```

- 사용 가능한 라우트: `#/`, `#/category/flour`, `#/ingredient/cake-flour`, `#/compare?ids=cake-flour,all-purpose-flour,bread-flour`, `#/search?q=박력분`

## 의도적으로 v1에서 제외 (Anti-Scope)

- 로그인/회원/즐겨찾기/북마크 UI 없음
- 결제/유료 기능 없음
- 레시피·도구·커뮤니티/댓글 노출 없음
- 다국어 UI 없음 (재료명 영문/한자 병기만 데이터에 포함)

---

## 라운드 2 — 홈 화면(`#/`) 전면 재디자인 (2026-05-11)

- **담당 에이전트**: single-react-developer
- **스코프**: 홈 화면만 집중. 다른 라우트(카테고리/상세/비교/검색)와 mock 데이터, 해시 라우터, 비교 트레이는 손대지 않음 — 회귀 0건 유지.
- **목표**: 인스타/핀터레스트에서 시리즈로 보일 만한 시각 통일감, 비교 모드를 차별화 최우선으로 강조, 카테고리·인기 재료를 큐레이션처럼 보이게.

### 변경한 섹션 (Before → After 요약)

| # | 섹션 | Before | After |
|---|---|---|---|
| ① | Hero | 단순 그래디언트 + h1 `text-3xl~5xl` + 작은 검색바 | 그래디언트 + SVG turbulence 그레인 텍스처, `text-4xl~6xl` 큰 카피 + caramel 하이라이트 언더라인, 3초 약속 칩 3개(⏱/📊/🛒), 큰 검색바(`py-3 sm:py-4`, shadow-lift), 예시 검색어 칩 3개, 라이브 드롭다운 +섬네일 이미지 포함 |
| ② | 비교 모드 | 일반 그리드 한 섹션, 작은 이모지 + 재료 뱃지 | "한 화면에서 비교하세요" 큰 헤더 + eyebrow 라벨. 새 `ComparePresetCard` — 재료 이미지 3장 겹쳐 쌓고 hover 시 좌·우로 회전·이동. 카드마다 `박력분 vs 중력분 vs 강력분` vs-타이포. 모바일은 가로 스냅 스크롤(`snap-x mandatory`). 하단 "직접 골라 비교하기" CTA. |
| ③ | 카테고리 | 동일 색의 흰 카드 5개 | 카테고리별 톤 매핑(`CATEGORY_TONES`: flour/leavening/sugar/dairy_fat/etc 각각 미세하게 다른 따뜻한 그래디언트 + dot 컬러). 이모지 hover 시 -4px 튀어오르며 -6deg 회전. 좌측 컬러 dot + 재료 개수, 우측 `›`. |
| ④ | 인기 재료 | 8개 단순 썸네일 + summary | "초보가 가장 자주 막히는 재료 TOP 6". 슬러그별 큐레이션 카피(`POPULAR_CURATION`) — `#1 가장 헷갈림` 같은 태그 + "이런 분께" 한 줄 hook을 따옴표 인용 형태로. 이미지 좌상단에 흰 캡슐 태그. |
| ⑤ | 가치 제안 (신규) | 없음 | 새 섹션 "Why / 왜 이 사전인가". 4개 카드 (⏱ 3초 답 / 🔍 한국 마트 구매처 / 📊 비교 모드 / ⚠️ 초보자 실수 경고). 아이콘 배지 `pulse-soft` 미세 펄스 애니메이션. 위·아래에 가로 구분선. |
| ⑥ | Closing CTA (신규) | 없음 | 푸터 직전 "이제 막힐 일 없어요." 카드. "🔍 검색으로 시작"(맨 위로 smooth scroll) + "⚖️ 비교부터 보기"(/compare) 두 액션. |

### 새로 추가한 컴포넌트 / 상수

- `ComparePresetCard({ preset })` — 비교 프리셋 전용 카드. 재료 이미지 스택(2~3장 absolute 위치) + hover 시 분산 효과 + vs 타이포 + "비교 화면 열기 →" affordance.
- `CATEGORY_TONES` — 카테고리별 색조(ring/grad/dot) 매핑 객체.
- `POPULAR_CURATION` — 슬러그별 큐레이션 카피(태그+hook) 맵.
- `VALUE_PROPS` — 4가지 가치 제안 배열.
- `<style>` 보강: `.hero-warm`(그래디언트+SVG noise), `.eyebrow`(섹션 라벨 + 그래디언트 dash), `.preset-card .stack` hover transform, `.cat-card .cat-emoji` lift, `.snap-x-scroll`, `.focus-ring`, `.pulse-soft` 키프레임.

### 회귀 방지 확인

- 해시 라우터 / 비교 트레이(localStorage `baking-dict.compare-tray.v1`) / Header 검색 드롭다운 / 카테고리·상세·비교·검색 라우트 — 코드 변경 없음.
- `INGREDIENTS`, `CATEGORIES`, `COMPARE_PRESETS`, `DETAIL_FIELDS` mock 데이터 손대지 않음.
- 폰트(Pretendard / Noto Sans KR), CDN 구성, Tailwind config 토큰(cream/butter/caramel/cocoa/cinnamon) 유지.
- `IngredientImage` onError 폴백, 라이브 검색 `searchIngredients(q)` 동작 그대로 사용.

### 접근성 / 반응형

- 모든 카드 링크에 `.focus-ring`(주황 3px 외곽 보임) 적용.
- 카테고리·비교 프리셋·인기 재료 모두 모바일 2열 또는 가로 스냅, 데스크탑 3~5열.
- 색대비: 본문 `text-cocoa/75` 이상, 강조 `text-cinnamon`/`text-roast` — WCAG AA 충족 톤.
- 검색 드롭다운 키보드 접근 가능(`<button>`로 항목 구성), 외부 클릭 시 닫힘.

### 권장 viewport 스크린샷

- **데스크탑**: 1440 × 900 (히어로 풀폭 그래디언트 + 비교 프리셋 3열 + 카테고리 5열)
- **태블릿**: 820 × 1180 (비교 프리셋 2열, 카테고리 3열, 인기 재료 3열)
- **모바일**: 390 × 844 (비교 프리셋 가로 스냅, 카테고리 2열, 인기 재료 2열)

### 로컬 서버 — 살아 있음

```bash
# 베이킹 사전 전용 정적 서버 (백그라운드)
cd /Users/sh_oh/Downloads/test-01/week-7/Quest/personal_project/app
python3 -m http.server 4173 --bind 127.0.0.1   # 이미 실행 중
```

- 접속 URL: **http://127.0.0.1:4173/index.html**
- 라우트 그대로 사용 가능: `#/`, `#/category/flour`, `#/ingredient/cake-flour`, `#/compare?ids=cake-flour,all-purpose-flour,bread-flour`, `#/search?q=박력분`
- 코드 수정 후 새로고침만으로 반영 (Babel standalone in-browser 컴파일).

---

## 라운드 3 — 홈 화면(`#/`) 매거진/에디토리얼 재디자인 (2026-05-11)

- **담당 에이전트**: single-react-developer
- **스코프**: 홈 화면만 처음부터 다시 디자인. 다른 라우트(카테고리/상세/비교/검색), mock 데이터, 해시 라우터, 비교 트레이는 손대지 않음.
- **트리거**: 라운드 2 결과물이 "엉망"이라는 평. 그래디언트·그레인·과한 칩, 카테고리별 무지개 톤, 가치 제안 4-card, 작은 이모지/썸네일 욱여넣기가 사전 톤을 무너뜨리고 랜딩 페이지처럼 보였음.

### 채택한 디자인 원칙 (Cereal / Kinfolk / Apartamento / Aesop 결)

- **흑백+크림 + 단일 액센트** — `paper #F8F4ED`, `ink #1A1714`, `ink-soft #5E544A`, `rule #E4DCCF`, `accent #B85A28`(시나몬). 카테고리별 컬러 차등 제거.
- **세리프 디스플레이 + 산세리프 본문** — Google Fonts에서 Cormorant Garamond 추가. `.font-display`로 영문 디스플레이 헤딩(이탤릭 강조 포함). 한글 헤딩은 Pretendard 900(`.font-head`) + tracking `-0.02em` 유지.
- **얇은 룰 라인** — `border-rule` 1px 가로 룰로 섹션 구분. 카드 그림자 거의 없음(`shadow-none` 기본).
- **여백** — 데스크탑 좌우 패딩 `px-6 sm:px-10 lg:px-16`, 컨테이너 `max-w-screen-xl`, 섹션 사이 `py-14 sm:py-20`.
- **사진이 주인공** — 14장 모두 흰 배경·따뜻한 톤의 미니멀 스튜디오 사진. 컨테이너 배경은 `#EFE7D7`(paper보다 살짝 진함)로 깔아 흰 가루 사진의 경계를 분명히 함.

### 홈 섹션 구성 (Before → After)

| # | 섹션 | After (라운드 3) |
|---|---|---|
| ① | Masthead | 상단 1px 룰 + tracking 넓은 라벨 라인 — 좌측 `Baking Ingredients Dictionary — Issue 01`, 우측 `14 / 30 Entries`. |
| ② | Hero (Cover) | 좌(7col): 큰 Cormorant 디스플레이 `Cake Flour, *Powdered Sugar*, Cream of Tartar.` + 한글 카피 "레시피에서 막히던 그 이름들, 이제 한 권의 사전으로." + 서브 카피 + 작은 액센트 룰 + `An Editorial Index, in Korean` 라벨. 우(5col): 박력분 사진 1장 `aspect-[4/5]` 크게 + 캡션 `001 — Cake Flour / 박력분`. 모바일은 사진 위·카피 아래. |
| ③ | Search | 룰 라인 위 단독 섹션. `Search · 검색` 라벨 + 한 줄 underline 검색바 (border-b만, focus 시 ink로 진해짐). 라이브 드롭다운(매거진 톤으로 다시 짬: kicker 라벨 + 사진 + 큰 한글 + 이탤릭 영문). 칩·이모지 없음. |
| ④ | The Catalog | 카테고리 5개를 매거진 목차 row로. `01 — 가루류 / 한 문장 / 04 in series →` 12-col 그리드 형태. hover 시 row 배경 `rgba(26,23,20,.03)` + 화살표 우측으로 6px 이동. |
| ⑤ | Side by Side | 비교 프리셋 3개 (전부 5개 노출 X — 잡지 features처럼). 큰 헤더 `Two or three ingredients, *spread across one page.*`. 각 feature는 가로로 사진 2~3장이 `flex-1`로 같은 폭, 사이에 1px `vs-rule`. 카드 hover 시 vs-rule이 accent 색으로 변함. 사진 아래 12-col grid로 `Feat. 01` 번호 + `박력분 *vs* 중력분 *vs* 강력분` 디스플레이 + 서브카피 + `Read the comparison →` CTA. |
| ⑥ | The Lineup | 사진 6장 그리드(데스크탑 3열, 모바일 2열). 카드: `aspect-[4/5]` 사진 + 작은 라벨 `01 · FLOUR` + 큰 한글 재료명(hover 시 accent로) + 이탤릭 영문 + summary 2줄 max. hover 시 사진만 `scale(1.04)` 줌. |
| ⑦ | Colophon | 푸터 자리. 좌: Cormorant `Baking Ingredients Dictionary` + 한글 라벨. 우: `v1 — 14 of 30 ingredients · 2026`. |

### 제거한 라운드 2 흔적

- `.hero-warm` 그래디언트 + SVG turbulence 노이즈 ❌
- `.eyebrow` (대시 + 그래디언트 점 라벨) — `.kicker`(대문자 + tracking 0.22em)로 대체
- `CATEGORY_TONES`(카테고리별 무지개 톤) ❌ → 카테고리 row 단일 톤
- `POPULAR_CURATION` 큐레이션 태그/hook ❌ → 라인업은 사진 + 이름 + summary만
- `VALUE_PROPS` "왜 이 사전인가" 4카드 ❌ — 섹션 자체 삭제
- Closing CTA 카드 ❌ — 매거진 콘솔은 푸터(Colophon)로 마무리
- `ComparePresetCard` 재료 스택 회전 효과 ❌ — features 형식으로 재구성
- `.cat-card` 이모지 lift, `.pulse-soft` 펄스 애니메이션 ❌
- 히어로 칩(⏱/📊/🛒) 3개, 예시 검색어 칩 3개 ❌

### 새로 추가한 컴포넌트 / 토큰

- **Tailwind config**: `paper / ink / ink-soft / rule / accent` 토큰 추가. `font-display`(Cormorant Garamond) 패밀리 추가. 기존 토큰(cream/butter/caramel/cocoa/cinnamon/crumb/roast)은 다른 페이지 호환 위해 유지.
- **CSS**: `.kicker`(매거진 라벨), `.rule-t`/`.rule-b`(1px 룰), `.photo-zoom`(hover scale 1.04, transition .6s), `.index-row`(hover bg + arrow translateX 6px), `.editorial-compare`(vs-rule 색 변화 + cta-arrow 이동), `.font-display` 클래스. `.eyebrow`, `.hero-warm`, `.preset-card`, `.cat-card`, `.pulse-soft`는 전부 삭제.
- **상수**: `CATEGORY_INDEX`(num + 한 문장 subtitle), `CATEGORY_LABEL`(영문 라벨 — FLOUR / LEAVENING / SUGAR / DAIRY & FAT / FINISHING), `LINEUP_SLUGS`(라인업 6개 슬러그).
- **컴포넌트**: `EditorialPhoto({ ingredient, ratio })` — `<img>` + 실패 시 paper 배경 + 작은 영문 카테고리 라벨만 보이는 fallback. 컨테이너 배경 `#EFE7D7`로 흰 사진과 paper 배경 사이 경계 확보.

### 회귀 방지 확인 (브라우저 검증 완료)

- 4개 라우트 모두 React 에러 없이 로드: `#/category/flour`, `#/ingredient/cake-flour`, `#/compare?ids=cake-flour,all-purpose-flour,bread-flour`, `#/search?q=박력분`
- 비교 트레이 floating, Header 검색 드롭다운, `IngredientImage` 이모지 fallback 모두 그대로
- `INGREDIENTS / CATEGORIES / COMPARE_PRESETS / DETAIL_FIELDS` mock 데이터 0건 수정
- 콘솔 에러: favicon.ico 404만 있음(무해)

### 권장 viewport

- **데스크탑**: 1280 × 900 (히어로 7+5 grid, 카탈로그 12-col row, features 3개 세로 스택, 라인업 3열)
- **모바일**: 390 × 844 (사진 위 카피 아래로 리오더, 카탈로그 row 그대로 스택, features 3개 세로 스택, 라인업 2열)

### 결과 캡처

- `/Users/sh_oh/Downloads/test-01/home-v3-final-v2.jpeg` (데스크탑 1280, fullPage)
- `/Users/sh_oh/Downloads/test-01/home-v3-mobile.jpeg` (모바일 390, fullPage)

---

## 라운드 4 (gpt-image 버전 따로 만들기) — `index_gpt.html`

기존 fal FLUX 버전(`index.html`)은 보존, gpt-image로 뽑은 새 이미지 14장으로 별도 파일 생성.

### 변경 사항

- **이미지 생성기**: `app/scripts/generate-images-openai.mjs` 추가 (OpenAI `/v1/images/generations`). 사용자 요청 `gpt-image-2`는 조직 인증 필요(403) → `gpt-image-1`로 폴백. 조직 인증 후 `OPENAI_IMAGE_MODEL=gpt-image-2 FORCE=1 node scripts/generate-images-openai.mjs`로 재생성 가능.
- **새 이미지 디렉토리**: `app/images_gpt/{slug}.png` 14개 (1024×1024, quality=medium).
- **새 HTML 파일**: `app/index_gpt.html` — `index.html` 복제 + 이미지 경로 `./images_gpt/{slug}.png` 일괄 교체.
- **로고**: 글로벌 헤더의 🥐 이모지 → `./images/logo.png` (사용자 제공 PNG, 4000×4000, 8-bit RGBA).
- **타이틀 폰트**: 헤더/푸터의 브랜드 문구 "초보자를 위한 베이킹 재료사전"에 `font-pyeojin` 적용. **Black Han Sans** (넓고 굵은 "펴진" 결의 고딕)을 Google Fonts CDN으로 로드.
- **Tailwind config**: `fontFamily.pyeojin = ['"Black Han Sans"', 'Pretendard', 'Noto Sans KR', 'system-ui', 'sans-serif']` 추가.

### 보안

- 사용자가 채팅으로 준 `OPENAI_API_KEY`는 `app/.env.local`에 즉시 추가, 권한 600 유지, `.gitignore`로 커밋 차단 확인.
- 채팅/메모리에 평문 재출력 금지(메모리 규칙).

### 미해결 / 후속

- gpt-image-2 조직 인증 완료 시 모델만 바꿔 재생성하면 동일 파이프라인.
- "펴진고딕"이 정확한 폰트명이 아니어서 시각적 결(넓고 굵음)로 Black Han Sans 적용. 다른 후보(Jalnan, Bagel Fat One, Do Hyeon)로 즉시 교체 가능.

---

## 라운드 5 (index_gpt.html 디자인 전면 재작성) — 매거진 → 친근 베이커리 브랜드

라운드 4에서 `index_gpt.html`은 이미지·로고·폰트만 swap되고 디자인 자체는 `index.html`(fal 매거진 톤)과 동일했음. 사용자가 **디자인까지 다른 두 번째 버전**을 원했기에, 이번 라운드에서 `index_gpt.html` **한 파일만** 전면 재작성. `index.html`은 보존(두 파일 옆에서 비교).

### 디자인 원칙 (index.html 매거진 톤과 정반대로)

| 항목 | index.html (매거진) | **index_gpt.html (이번 라운드)** |
|---|---|---|
| 무드 | 에디토리얼, 미니멀, 흑백+크림 | 친근한 베이커리 브랜드, 따뜻하고 활기찬 |
| 컬러 | paper/ink/rule + 단일 accent | `bake.50~900` 단일 팔레트, 오렌지 액센트 풍부 |
| 헤딩 | Cormorant Garamond (영문 세리프) | **Black Han Sans** 한글 폭넓게 (모든 큰 헤딩) |
| 모서리 | 직각, 1px 룰 라인 | rounded-2xl/3xl, soft·lift·pop shadow |
| 레이아웃 | 12-col 매거진 그리드 + 가로 룰 | 큰 카드 + 가로 스크롤 캐러셀(scroll-snap) |
| 카테고리 | "01 — 가루류" 매거진 인덱스 row | 컬러풀 큰 카드 그리드 + 큰 이모지 + hover lift |
| 비교 섹션 | "Side by Side" 세로 features 스택 | "헷갈리는 재료, 한 컷에 정리" 가로 스크롤 캐러셀 |
| 검색바 | 한 줄 underline, sans-serif | 큰 알약(rounded-full), 오렌지 액센트, 그림자 |
| 라벨 | "001 — Cake Flour" / "PHOTO PLATE" | "📸 오늘의 재료" / "🌾 카테고리" / "⚖️ 비교" 친근 한글 |
| 사진 처리 | 4:5 정직각 큰 사진 | rounded-2xl/3xl 둥근 사진, 카드 안 사진 |

### 변경된 섹션 리스트

1. **Tailwind config** — `paper/ink/rule/accent/cream/butter/caramel/cocoa/cinnamon/crumb/roast` **전부 삭제**, `bake.50~900` 단일 팔레트로 통일. `font-display`(Cormorant) 토큰만 남기되 호출은 0, Cormorant Garamond CDN 로드도 제거. `boxShadow.pop`(오렌지 글로우) 추가, `bg-hero-blob`(radial gradient blur) 추가.
2. **글로벌 헤더** — sticky `bake-50/85` 반투명 + backdrop-blur + `bake-200` 하단 라인. 검색바를 **rounded-full** 큰 알약으로 교체, focus 시 `bake-500` ring-4. placeholder도 "박력분, 베이킹소다, 슈가파우더..."로 친근.
3. **푸터** — `rounded-t-3xl` `bake-100` bg, 로고 + 워드마크 + 한 줄 미션 + 메타.
4. **히어로** — 좌측 큰 한글 카피(`font-pyeojin text-7xl`) "베이킹, 재료에서 막히지 마세요." + 보조 카피 + 오렌지 CTA pill 2개. 우측: 박력분 큰 사진(`rounded-3xl` + shadow-lift) + 좌상단 "📸 오늘의 재료" 칩 + 좌하단 흰 카드(이름·정체). 배경은 `bg-hero-blob`(오렌지·캐러멜 블롭).
5. **3가지 약속 띠** — 3-card row, `bake-100` rounded-2xl, 큰 이모지(⏱️/📊/🛒) + 굵은 한글 카피.
6. **카테고리 5개 카드** — 큰 카드 그리드(3-col, 모바일 2-col), `rounded-3xl` + `border-2 bake-200` + hover lift. 좌측 text-6xl 이모지 + 우측 텍스트(카테고리명 font-pyeojin / 한 줄 카피 / "n개 재료" 오렌지 칩 / → 화살표 슬라이드).
7. **비교 섹션** — `bake-100/60` 띠 배경. 가로 스크롤 캐러셀(scroll-snap-x mandatory), 5개 프리셋 모두 노출. 각 카드 `rounded-3xl` w-340px, 상단에 사진 2~3장 균등 + 사이에 오렌지 "vs" 칩(rounded-full 28px).
8. **인기 재료 6개** — `rounded-2xl` 카드 그리드 3-col(모바일 2-col). aspect-square 사진 + 한글명(font-pyeojin) + 영문(bake-500) + 정체 line-clamp-2 + 카테고리 칩. hover 시 사진 scale.
9. **카테고리 페이지** — 큰 헤더 카드(`bake-100` `rounded-3xl` + text-8xl 이모지 + font-pyeojin) + 4-col 재료 카드 그리드(square 사진).
10. **재료 상세** — 상단 히어로 카드(`rounded-3xl` + lg:grid-cols-2 사진/텍스트) + 큰 헤딩(text-6xl font-pyeojin) + 큰 pill CTA. 6개 정보 카드 `rounded-2xl` 2-col, 초보자 실수만 `bake-100 bg + bake-300 border`로 강조.
11. **비교 페이지** — 상단 친근 카피("재료 N개 나란히 보기") + Chip("⚖️ 비교 모드"). 표 컨테이너 `rounded-3xl` + `shadow-soft`. 헤더 row `bake-50` sticky, 라벨 컬럼 `bake-100` sticky-left. 줄무늬 `bake-50/60`. 사진 셀은 `rounded-xl bake-100`.
12. **검색 결과** — 큰 헤딩(font-pyeojin) + 따뜻한 검색바 재사용. 카테고리별 그룹 `rounded-3xl bake-100/70` 안에 재료 카드 리스트. 빈 결과: `rounded-3xl bake-100` + 🤔 + 카테고리 추천 칩 3개.
13. **이미지 fallback** — 매거진 톤("FLOUR" kicker 라벨)에서 친근 톤(`bake-100 bg + 큰 이모지 + 한글명 굵게`)으로 변경.

### 회귀 보호 (절대 깨면 안 되는 것)

- 해시 라우터 5개 경로 (`#/`, `#/category/:slug`, `#/ingredient/:slug`, `#/compare?ids=`, `#/search?q=`) — 동일
- 검색 라이브 드롭다운(라우터 path 변경 시 닫힘, 바깥 클릭 닫힘) — 동일
- 비교 트레이 Context + localStorage `baking-dict.compare-tray.v1` 영속 — 동일
- mock 데이터 14개 INGREDIENTS / 5 CATEGORIES / 5 COMPARE_PRESETS 그대로 사용
- `API_BASE_URL = '/api'` 자리(다음 라운드 서버 연결용) 유지
- 이미지 onError fallback 동작 보존(톤만 교체)
- 모바일 가로 스와이프(scroll-snap)로 비교 표 동작 유지

### 제거된 매거진 흔적

- `font-display`(Cormorant) 호출 전부 — 모든 큰 헤딩은 `font-pyeojin` (Black Han Sans)
- Cormorant Garamond CDN 로드 제거 → 폰트 로드 시간 단축
- 매거진 라벨 ("ISSUE 01", "PHOTO PLATE", "001 —", "FEAT. 01", "kicker" 등) 전부 친근 한글 + 이모지로 교체
- `paper/ink/rule/accent/cream/butter/caramel/cocoa/cinnamon/crumb/roast` 컬러 토큰 삭제, `bake.*` 만 사용
- 1px 룰(`border-rule`)로 섹션 구분하는 패턴 → 카드 + 여백 + 둥근 모서리 패턴
- 매거진 12-col 그리드(인덱스 row) → 카드 그리드 + 가로 스크롤 캐러셀

### 검증

- 로컬 서버 살아있음: `http://127.0.0.1:4173/index_gpt.html` (HTTP 200 확인). 죽었으면 `cd app && python3 -m http.server 4173 --bind 127.0.0.1`로 재시동.
- 데스크탑 1280×900 / 모바일 390×844 양쪽 반응형 클래스(`sm: lg:`) 검증 — 히어로/카테고리/비교/인기 모든 섹션이 sm 이하에서 grid-cols-1·2로 자연스럽게 접힘.
- `index.html`은 절대 건드리지 않음 — 두 파일 옆에서 비교 가능.

### 라운드 4와의 핵심 차이

라운드 4는 자산만 swap(`./images/{slug}.jpg` → `./images_gpt/{slug}.png`, 🥐 → `logo.png`, 헤더 폰트만 Black Han Sans)했지만 디자인 본체(매거진 톤·세리프 헤딩·1px 룰·12-col 그리드)는 그대로였음. 라운드 5는 **디자인 자체를 갈아엎음** — 같은 데이터·같은 라우터·같은 이미지 위에 완전히 다른 톤의 UI를 입힘.



---

## 2026-05-12 — Supabase DB 초기 세팅

### 목표
PRD/MISSION/dev.md 기준으로 ingredients 테이블 + Storage 버킷 + RLS를 한 번에 셋업.

### 결과 — 완료
- 마이그레이션 파일: `app/supabase/migrations/0001_init.sql`
- 적용 방법: `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql`
- DB 접속: Supabase Session pooler(5432) 사용 — transaction pooler(6543)는 DDL에 부적합

### 변경/결정
- **카테고리 6개로 확장**: dev.md의 5개(flour/leavening/sugar/dairy_fat/etc) → 프론트(`index_studio.html`) 기준 **+ `spirit`(술·리큐어)**. enum `public.ingredient_category` 정의.
- **`emoji` 컬럼 추가**: 프론트 카테고리/카드에 이모지를 쓰고 있어 dev.md 14컬럼 스키마에 emoji 하나 더해 15컬럼.
- **확장은 `extensions` 스키마**: `pg_trgm`, `pgcrypto` — Supabase 기본 위치 준수.
- **RLS 정책**: ingredients = `SELECT` only (anon, authenticated). INSERT/UPDATE/DELETE 정책 없음 → service_role만 통과 (시드/관리 작업 전용).
- **Storage 버킷**: `ingredient-images` public read. 업로드는 service_role.
- **인덱스**: `name_ko`/`name_en`에 trigram GIN, `category`에 btree.
- **트리거**: `updated_at` 자동 갱신용 BEFORE UPDATE 트리거.

### 보안 후처리
- 사용자가 채팅에 평문 노출했던 DB password를 회전. 새 password + anon/service_role 키 + DB URL을 `app/.env.local`에 저장. 채팅에는 다시 노출하지 않음.
- 채팅에 잘못 붙여넣어진 anon key 앞 `.` 1글자 제거.

### 검증 (스모크 테스트 통과)
- `\dt`, `\d public.ingredients`, `pg_policies` 쿼리 — 테이블/인덱스/정책/트리거/enum 6개 모두 정상.
- PostgREST anon SELECT: `HTTP 200 []` — 스키마 캐시 정상 (Data API 토글 ON 상태 확인).
- PostgREST anon INSERT: `HTTP 401 / RLS violation` — 쓰기 차단 정상 작동.

### 다음 단계
1. 재료 시드 — `app/index_studio.html`의 INGREDIENTS mock 배열을 SQL INSERT(또는 `supabase-js` 스크립트)로 변환해 57건 일괄 import (service_role 사용).
2. 이미지 — `app/images_gpt2/*.png`를 `ingredient-images` 버킷에 업로드 후 `image_url`을 Storage public URL로 치환.
3. 프론트 연동 — `index_studio.html`의 mock `INGREDIENTS`를 Supabase 클라이언트 fetch로 교체.

---

## 2026-05-12 (이어서) — 시드 + 이미지 + 프론트 연동

### 목표
mock 배열을 Supabase로 옮기고 프론트가 DB에서 fetch하게. 관리자 모듈 확장 가능한 구조로.

### 결과 — 완료

**1) 재료 57건 DB 시드**
- `app/scripts/extract-ingredients.mjs` — index_studio.html의 INGREDIENTS 배열을 `data/ingredients.json`으로 추출 (vm으로 JS literal 평가). `image_url`은 일부러 제외 — upload-images.mjs가 책임.
- `app/data/ingredients.json` — 57건, 카테고리 분포 12/5/9/10/14/7 (flour/leavening/sugar/dairy_fat/etc/spirit).
- `app/scripts/seed-ingredients.mjs` — `data/ingredients.json` → REST 업서트(`on_conflict=slug`, `Prefer: resolution=merge-duplicates`). service_role 사용. 멱등.
- 마이그레이션 0002 — `sort_order int` 컬럼 추가. 큐레이션 순서 보존(10/20/30… stride로 admin 모듈에서 사이 삽입 여유). 인덱스도 추가.

**2) 이미지 57장 Storage 업로드**
- `app/scripts/upload-images.mjs` — `images_gpt2/{slug}.png` → bucket `ingredient-images/ingredients/{slug}.png` 업로드, 그 다음 `image_url`을 Storage public URL로 PATCH. 멱등.
- `--slug=<slug>` 옵션으로 단일 재료만 처리 가능 — 관리자 모듈에서 개별 이미지 교체용으로 재사용.
- 57/57 업로드 성공, 모든 `image_url` https Storage URL로 갱신 확인.

**3) 프론트(index_studio.html) Supabase 연동**
- supabase-js UMD CDN + `lib/supabase-client.js` 추가.
- `lib/supabase-client.js` — anon key 인라인 (RLS가 보호). `window.bakingDictApi.fetchIngredients()` 공개. 관리자 모듈도 같은 헬퍼명 그대로 재사용 가능.
- 거대 mock 배열(57KB) 삭제 → `const INGREDIENTS = [];` 빈 배열.
- 부팅 IIFE — fetch 후 `INGREDIENTS.push(...rows)`로 같은 참조 채움 → 기존 `.filter/.find/.map` 호출 그대로 동작. fetch 실패 시 #root에 에러 표시.
- 로딩 인디케이터 — `#root`에 "재료 데이터 불러오는 중…" 텍스트가 마운트 전까지 표시.

### lib 구조 (관리자 모듈 확장 고려)

```
app/
  lib/
    supabase-client.js          # 브라우저 anon 클라이언트 (read)
  scripts/
    lib/
      env.mjs                   # .env.local 파서
      supabase-rest.mjs         # upsertRows/updateRow/uploadObject/publicUrl (service_role)
    extract-ingredients.mjs     # HTML → JSON (legacy / 마이그레이션 1회)
    seed-ingredients.mjs        # JSON → DB upsert (재실행 가능)
    upload-images.mjs           # 로컬 PNG → Storage + image_url 갱신
  data/
    ingredients.json            # source-of-truth 시드
  supabase/migrations/
    0001_init.sql               # 테이블·인덱스·RLS·Storage 버킷
    0002_sort_order.sql         # sort_order 컬럼
```

관리자 모듈 만들 때:
- **읽기**: `window.bakingDictApi.fetchIngredients()` 등 그대로 확장.
- **쓰기**: 브라우저에서 직접 X. service_role 키는 서버에만. Node API 라우트나 Vercel Functions에서 `scripts/lib/supabase-rest.mjs` 그대로 import 해 사용.
- 단일 재료 이미지 교체는 `upload-images.mjs --slug=<slug>` 패턴을 admin UI 액션으로 옮기면 됨.

### 검증
- anon REST: `GET /rest/v1/ingredients?order=sort_order.asc` → 57건, 정렬 정상, image_url 전부 https.
- anon INSERT: HTTP 401 RLS violation (변함없음).
- 로컬 dev 서버(8080): index_studio.html, lib/supabase-client.js 둘 다 200.
- supabase-js UMD CDN: 200, ~197KB.

### 알려진 후속
- UI 카피 "6 categories, 60 ingredients" 두 군데 — 실제는 57. 데이터가 60에 도달하거나 카피 수정 필요(데이터 vs UI 분리).
- `scripts/extract-ingredients.mjs`는 1회용 — 이제 mock 배열이 비어 있어 빈 배열만 추출되므로 일부러 실패하게 둠. 추후 admin 모듈로 들어가면 deprecate.

---

## 2026-05-13 — Vercel 배포 대응 리팩토링

### 산출물
- `api/_lib/{env,http,supabase,auth}.mjs` — Vercel function + 로컬 dev 공용
- `api/auth/{login,logout,me}.mjs` — 인증 엔드포인트 3개
- `api/ingredients/index.mjs` (GET/POST), `[slug].mjs` (PATCH/DELETE), `[slug]/image.mjs` (PUT)
- `admin/server.mjs` — 동일 핸들러 import해 127.0.0.1:8787에서 라우팅하는 로컬 dev shim
- `vercel.json` — cleanUrls + /admin rewrite + 캐시 헤더 + function maxDuration=30
- `.vercelignore` — `_legacy/`, `images*/`, `scripts/`, `data/`, `supabase/`, `admin/server.mjs` 제외
- `package.json` — `type: module`, Node ≥20

### 인증 모델 변경
이전: in-memory `Map<token, expiresAt>` (서버 재시작 시 모두 만료, serverless cold start 호환 불가)
이후: **stateless HMAC 쿠키** `<exp>.<rnd>.<hmac(SESSION_SECRET, exp.rnd)>`. 서버에 저장 X, Vercel cold start 사이에서도 유효.

### 파일 이름 정리
- `index_studio.html` → `index.html` (Vercel 기본 진입)
- 구버전 `index.html`, `index_gpt.html` → `_legacy/` (배포 제외)

### 하드코딩 URL → hostname-aware
- 공개 사이트 "관리자" 링크 / 관리자의 "공개사이트 미리보기" / 로그인 페이지 푸터 — 셋 다 `location.hostname` 검사:
  - localhost/127.0.0.1 → `http://localhost:8080/` 또는 `http://127.0.0.1:8787/`
  - 그 외 → `/` 또는 `/admin/`

### 검증 (로컬 shim)
- 미인증 GET / → 302 to /admin/login.html
- 미인증 GET /api/ingredients → 401
- 잘못된 비번 → 401
- 올바른 비번 → 200 + HttpOnly Set-Cookie (HMAC 서명)
- 인증 후 list 57건, PATCH 토글, POST upsert, DELETE 전부 200
- 로그아웃 → 쿠키 무효화 → 이후 401

### Vercel 배포 시 사용자가 해야 할 것
1. Vercel Project → Root Directory: `week-7/Quest/personal_project/app`
2. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (브라우저 노출 금지 — function에서만)
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET` (32바이트 hex, `openssl rand -hex 32`)
3. Deploy. `/`= 공개 사이트, `/admin/`= 콘솔, `/api/*`= functions.

### 알려진 한계
- 이미지 업로드 4.5MB Hobby plan 한도 (현재 PNG 1~2MB, 충분).
- 세션 7일 TTL. revoke 기능 없음(메모리 저장 X라). 필요해지면 jti 블랙리스트 추가.

---

## 2026-05-15 · 보안 마감 점검 후 처리 (final hardening)

발표(2026-05-16) 직전 보안·견고성 검토. 발견 이슈 9건 중 7건 코드 패치, 1건은 마이그레이션 추가, 1건(rate limit)은 외부 KV 필요해서 후속 작업으로 미룸.

### 패치 내역

1. **ADMIN_PASSWORD fail-closed in production** — `api/_lib/auth.mjs`
   - 기존: `process.env.ADMIN_PASSWORD || 'admin1234'` → 운영에서 env 누락 시 기본 비번으로 로그인 가능
   - 변경: `isProd()`면 throw, 로컬 dev만 기본값 유지

2. **Open Redirect 차단** — `admin/login.html`
   - 기존: `?next=https://evil.com` → 로그인 후 외부 사이트로 이동
   - 변경: `safeNext()` 도입. `/`로 시작하되 `//`·`/\` 차단

3. **Slug 경로 traversal 방지** — `api/_lib/http.mjs`, `api/ingredients/index.mjs`
   - `isValidSlug` 화이트리스트 `^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$` 추가
   - `getSlug()`가 invalid면 null 반환 → 핸들러는 400 응답
   - upsert POST body의 slug도 동일 검증

4. **이미지 업로드 MIME 화이트리스트 + 사이즈 한도** — `api/ingredients/[slug]/image.mjs`
   - 기존: `^image\//` (SVG도 통과 → 스크립트 임베드 위험)
   - 변경: `jpeg/png/webp/avif`만 허용, 4MB 한도 명시
   - 콘솔 UI hint도 `PNG·JPG·WEBP·AVIF / 최대 4MB`로 정정

5. **XSS 표면 제거** — `index.html`
   - 부트스트랩 실패 시 `innerHTML`+에러메시지 → `textContent`+DOM 노드 빌드

6. **보안 헤더 강화** — `vercel.json`
   - 전체: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`
   - `/admin/*`·`/api/*`: `X-Frame-Options: DENY` 추가

7. **숨김 재료 RLS 차단** — `supabase/migrations/0005_rls_hide_invisible.sql`
   - 공개 정책을 `using (is_visible = true)`로 좁힘
   - anon 키로 직접 쿼리해도 숨김 행은 안 보임. 관리자 API는 service_role bypass라 그대로.

### 검증

- `isValidSlug` 단위 테스트 13/13 통과 (cake-flour ✓, ../foo ✗, CAPS ✗, foo/bar ✗, 등)
- 인증 상태에서 실제 API 호출:
  - `PATCH /api/ingredients/..%2Ffoo` → 400 (slug invalid)
  - `PUT .../image` with `image/svg+xml` → 415 "only jpeg/png/webp/avif allowed"
  - `POST /api/ingredients` body slug `"BAD SLUG"` → 400 "invalid slug"

### 후속 작업 (미반영)

- **로그인 rate limit**: serverless cold start로 in-memory 카운터는 의미가 적음. Vercel KV / Upstash Redis 도입 필요. 발표 후 처리.
- **CSP 헤더**: Tailwind CDN + Babel standalone 사용 중이라 nonce/strict-dynamic 설정이 복잡. 빌드 파이프라인 도입 시 함께 처리.

### 운영 체크리스트

- [ ] Vercel Production env에 `0005_rls_hide_invisible.sql` 마이그레이션 적용 후 배포
- [ ] `ADMIN_PASSWORD`·`SESSION_SECRET`이 Production env에 실제로 채워져 있는지 확인 (fail-closed 적용됨)
- [ ] 배포 후 `/admin/login?next=https://example.com`이 `/admin/`로 리다이렉트되는지 수동 확인
