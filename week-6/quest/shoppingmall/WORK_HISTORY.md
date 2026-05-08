# shoppingmall — 커피향 가득한 5월의 풍경

작업 진행 과정을 시간 순으로 기록합니다.

---

## 1단계 · 프로젝트 셋업 (2026-04-30)

### 폴더 구조
```
week-5/quest/shoppingmall/
├── package.json        # express + npm scripts
├── server.js           # 정적 호스팅 + /env.js (4001 포트)
├── schema.sql          # products + cart 테이블, RLS, 시드 데이터
├── index.html          # React + Tailwind + Supabase JS (CDN)
├── .env / .env.example # SUPABASE_URL, ANON_KEY, PORT=4001
├── .gitignore
├── prd.md              # 요구사항 (기존)
└── WORK_HISTORY.md     # 이 파일
```

### 환경
- **Supabase 프로젝트**: `goms_projects` (ref `zfcb…`) — community_app과 공유
- **포트**: `4001` (community_app 4000과 분리)
- **디자인 무드**: community_app(MOVE/광장)의 Pretendard + 미니멀 무드 + Cormorant Garamond 디스플레이체
- **컬러 팔레트**: `page #fafaf7`, `ink #1a1a1a`, `accent #3a5a40` (5월 풀빛), `warm #d4a373` (커피색)

---

## 2단계 · DB 스키마 설계 (`schema.sql`)

PRD §4에 따라 두 테이블:

### products (Public Read)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid PK | gen_random_uuid() 기본 |
| name | text | NOT NULL |
| price | int4 | NOT NULL |
| image_url | text | nullable |
| description | text | nullable |
| created_at | timestamptz | now() 기본 |

- RLS: `products_select_all` — anon/authenticated 모두 SELECT 허용

### cart (RLS, 본인만)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid PK | gen_random_uuid() 기본 |
| user_id | uuid FK → auth.users(id) | on delete cascade |
| product_id | uuid FK → products(id) | on delete cascade |
| quantity | int4 | check > 0, 기본 1 |
| created_at | timestamptz | now() 기본 |

- 제약: `unique (user_id, product_id)` — 동일 상품 중복 추가 방지 (수량 증가로 처리)
- RLS 4종 모두 `auth.uid() = user_id`:
  - `cart_select_own` (SELECT)
  - `cart_insert_own` (INSERT)
  - `cart_update_own` (UPDATE)
  - `cart_delete_own` (DELETE)
- 인덱스: `cart_user_idx (user_id, created_at desc)`

### 시드 데이터
커피 컨셉 상품 8종 — id를 고정 UUID로 박아 `on conflict (id) do nothing` 으로 멱등 보장. 이미지는 Unsplash 공개 URL.

---

## 3단계 · 클라이언트 (`index.html`)

CDN 기반 React + Babel standalone, 단일 HTML 파일 구조 유지.

### Data 레이어
PRD CRUD를 추상화한 `Data` 객체:
- `listProducts()` — 모든 상품
- `listCart(userId)` — 본인 장바구니
- `addToCart(userId, productId)` — 있으면 수량 +1, 없으면 신규 (Supabase에선 `select … maybeSingle()` → upsert 분기, fallback에선 localStorage)
- `setQuantity(cartId, qty)` — 수량 변경 (qty < 1 이면 자동 삭제)
- `removeFromCart(cartId)` — 삭제

### Fallback 모드 (community_app과 동일 패턴)
- `isCacheError(e)` — PGRST002/503/네트워크 오류 감지
- 캐시 에러면 localStorage(`shop_cart_v1`)로 폴백
- 상품 목록도 503이면 in-memory 시드 사용
- `Data.mode` (`live` | `local`)을 화면 상단 노란 배너로 표시 + 「다시 시도」 버튼

### 화면 구성 (PRD §2 사용자 흐름)
- **Topbar**: 로고 / 날짜 / 로그인 상태 / 「Cart」 버튼 (수량 뱃지)
- **Hero**: "A May with 커피향 가득한 5월의 풍경" Cormorant Garamond + Pretendard 혼합
- **Products grid**: 4컬럼 카드 (`sm:2 / lg:4`), 4:5 비율 이미지 + 이름 + 설명 + 가격 + 「담기」 버튼
- **AuthDrawer**: 로그인/회원가입 탭 (우측에서 슬라이드)
- **CartDrawer**: 장바구니 (우측 슬라이드, 수량 +/-, 삭제, 합계, 결제 버튼)

### 사용자 흐름 매핑
1. **비로그인 사용자**: 상품 그리드 자유 열람 → 「담기」 클릭 → AuthDrawer 자동 오픈 + 토스트 「먼저 로그인해 주세요」
2. **회원가입/로그인**: 이메일·비번 (6자+), Supabase Auth `signUp`/`signInWithPassword`, 세션은 `onAuthStateChange`로 자동 동기화
3. **로그인 사용자**: 「담기」 즉시 cart에 INSERT → 토스트 안내, 우측 Topbar Cart 뱃지 +1, Cart 클릭 시 우측 드로어에서 수량 조절·삭제·합계 확인

---

## 4단계 · 보안

- ✅ ANON 키만 클라이언트 노출 (`/env.js`로 안전 주입)
- ✅ `service_role` 키는 사용하지 않음
- ✅ `cart` 4종 RLS — 본인 user_id 만 read/write
- ✅ `products`는 anon SELECT 허용 (Public Read)
- ✅ `unique (user_id, product_id)` 제약으로 동일 상품 중복 행 차단

---

## 5단계 · 디자인 리비전 (cafict.com 무드)

PRD에 명시된 `kurasu.kyoto`/`shop.cafict.com` 톤에 맞춰 재정비:

- 헤더 미니멀화 — 로고(좌) / SHOP·ABOUT·JOURNAL(중앙) / LOGIN·CART(우)
- Hero 섹션 제거 — 페이지 진입 즉시 그리드
- 카드 텍스트 단순화 — 이름 + 가격(가운데 정렬)만, 설명 제거
- 폰트 통일 — 한글 전체 Pretendard 고딕 (Noto Serif JP 등 세리프 제거)
- 컬러 — 흰색/검정만, 액센트 컬러 모두 제거
- 이미지 — 1:1 정사각형 (Unsplash `?w=800&h=800&fit=crop`)
- 푸터 — 한 줄로 축약

## 6단계 · Supabase 503 (PGRST002) 해결

새 프로젝트(`goms_projects`)의 PostgREST가 schema cache 빌드 실패로 503 반환. 로그 분석으로 원인 발견:
```
db-schemas=pg_pgrst_no_exposed_schemas
schema "pg_pgrst_no_exposed_schemas" does not exist
```
→ **API Settings의 Exposed schemas가 비어있음**이 원인. `Project Settings → API → Exposed schemas → public 추가 → Save`로 즉시 해결.

이후 검증:
- `GET /rest/v1/products` → 200, 시드 8행 정상
- `POST /rest/v1/cart` (비로그인) → 401 (RLS 정상 차단)

## 7단계 · Vercel 배포

Express(`server.js`) 그대로는 Vercel serverless에 안 올라가서 정적+function 구조로 변환.

### 변환
- **`api/env.js`** (Serverless Function) — `process.env` 에서 SUPABASE 변수 읽어 클라이언트에 주입
- **`vercel.json`** — `framework: null` 명시 + `/env.js → /api/env` rewrite
- **`.vercelignore`** — `server.js`, `schema.sql`, `WORK_HISTORY.md` 등 배포 제외
- **`package.json`** — `express`를 `devDependencies`로 이동 (Vercel framework 자동감지 회피)

### 환경변수
`vercel env add`로 Production/Development에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 등록. (`.env`에서 동일 값 push)

### 배포 결과
- Production: https://shoppingmall-pearl.vercel.app
- 검증: `/` 200, `/env.js` 200 (anon key 정상 주입), 모든 CDN 스크립트 로드

---

## 환경 / 실행

```bash
# 로컬
cd week-5/quest/shoppingmall
npm install
npm run dev          # http://localhost:4001

# 배포
vercel --prod        # 환경변수는 한 번 등록해두면 재사용됨
```

`.env`에 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 채우기.

---

## 환경 / 실행

```bash
cd week-5/quest/shoppingmall
npm install
npm run dev          # http://localhost:4001
```

`.env`에 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 채우기. (community_app의 `.env`를 그대로 복사해 사용 — 같은 `goms_projects` 프로젝트)
