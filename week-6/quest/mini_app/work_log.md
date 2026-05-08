# work_log.md — mini_app 작업 과정 기록

| 항목 | 값 |
|---|---|
| 작업 일자 | 2026-05-05 |
| 입력 | `week-6/quest/mini_app/prd.md` (유료 콘텐츠 잠금 해제 미니앱 PRD) |
| 산출물 | `server.js`, `seed.js`, `package.json`, `public/index.html`, `public/client.js`, `work_log.md` |
| 실행 | `npm install && node server.js` → http://localhost:3000 |

## 1. PRD 해석

핵심 4기능 + 보안 1조항 + 추가 1기능으로 압축:
1. **콘텐츠 브라우징** — 목록 + 가격 + preview(앞 3줄 공개)
2. **결제** — 토스페이먼츠 위젯, 서버 승인, purchases 매핑
3. **접근 제어** — 서버에서 본문 필터링 (개발자 도구로 못 뚫게)
4. **내 라이브러리** — 구매 이력 + 재열람
5. **§7 보안 핵심** — 미구매자 응답에 body 데이터 자체 미포함
6. **§8 추가** — 인기 베스트 3

## 2. 의사결정

| 결정 | 근거 |
|---|---|
| **Node.js + Express + 단일 React SPA** (CDN: React 18, Tailwind, TossPayments v2) | PRD §7 "API 응답 자체를 권한에 따라 다르게 설계" → 서버 필요. 빌드 도구 없는 단일 HTML로 미니앱 가벼움 유지 |
| **인메모리 DB** (서버 재시작 시 초기화) | 미니앱 데모 범위. 실제 DB(Supabase 등)는 v2에서 |
| **localStorage 익명 user_id** (`u_xxxxxx`) | PRD에 인증 요구 없음. user_id 매핑만 필요 → 가장 가벼운 식별. 운영용 아님은 work_log에 명시 |
| **TossPayments 위젯 v2 + 공식 데모 키** | 토스 공개 문서 키. 운영 시 환경변수로 분리 필요 (server.js 주석에 명시) |
| **success URL = 해시 라우트** (`#/payment/success?...`) | SPA 단일 HTML이므로 토스가 리다이렉트해도 라우터가 파싱해 서버 confirm 호출 |
| **시드 콘텐츠 6개** (베이킹 도메인) | 같은 주의 personal_project(베이킹 사전)와 톤 통일. 결제 전환 데모 풍부 |

## 3. 보안 설계 (PRD §7 충족 방식)

| 위협 | 방어 |
|---|---|
| 클라이언트가 body를 받아 `display:none` 같은 화면 숨김만 우회 | 서버가 미구매자 응답에 **body 키 자체를 빼고** 보냄 (`server.js` `GET /api/contents/:id`). 클라이언트 DevTools에서 body 자체가 없다는 걸 직접 확인 가능 |
| 클라이언트가 amount를 위조해 confirm 호출 | `POST /api/payments/confirm`에서 서버가 보유한 `contents[i].price`와 대조. 불일치 시 400 `amount_mismatch` 반환. **검증 완료**: `curl … amount=100 → {"error":"amount_mismatch"}` |
| orderId 위변조·중복 결제 | `POST /api/payments/intent`에서 서버가 orderId 발급. 같은 (user, content) 조합이 이미 purchases에 있으면 409 `already_purchased` |
| 토스 승인 우회 (paymentKey 가짜로 confirm 호출) | 서버가 토스 `/v1/payments/confirm`에 직접 Basic Auth로 호출. 응답이 200이 아니면 거절 |
| 클라이언트 키 노출 | TossPayments 클라이언트 키는 공개해도 안전한 값. 시크릿 키는 server.js에서만 사용, 클라이언트로 전송 0 |

## 4. 절차

1. `package.json` — Express만 의존성으로 추가
2. `seed.js` — 6개 콘텐츠. body의 첫 3줄을 `\n` 기준으로 잘라 preview 자동 생성
3. `server.js` — API 7종:
   - `GET /api/config` — 클라이언트 키 노출
   - `GET /api/contents` — 목록 (body 없음)
   - `GET /api/contents/:id?userId=` — 권한별 body 분기
   - `GET /api/popular` — purchases 카운트로 top 3
   - `GET /api/purchases?userId=` — 내 라이브러리
   - `POST /api/payments/intent` — orderId 서버 발급
   - `POST /api/payments/confirm` — 토스 호출 + amount 검증 + purchases push
4. `public/index.html` — Tailwind, React, Babel-standalone, TossPayments v2 CDN
5. `public/client.js` — 해시 라우터 + 5개 페이지(홈·상세·라이브러리·success·fail)
6. `npm install` → `node server.js` 백그라운드 실행
7. curl로 검증

## 5. 검증 결과

| 검증 항목 | 명령 | 결과 |
|---|---|---|
| HTML 서빙 | `curl http://localhost:3000/` | HTTP 200, 948 bytes ✅ |
| client.js 서빙 | `curl http://localhost:3000/client.js` | HTTP 200, 19,923 bytes ✅ |
| 클라이언트 키 노출 | `curl /api/config` | `{"tossClientKey":"test_gck_docs_…"}` ✅ |
| 목록에 body 없음 | `curl /api/contents` | 모든 항목에 `body` 키 부재 ✅ |
| **미구매자 body 차단** | `curl /api/contents/c1?userId=u_test_anon` | `{...,"locked":true}` — body 키 부재 ✅ (PRD §7 핵심) |
| **amount 위변조 차단** | `curl -X POST /api/payments/confirm -d '{"amount":100,"contentId":"c1",…}'` (c1=1900원) | `{"error":"amount_mismatch"}` ✅ |
| intent 정상 생성 | `curl -X POST /api/payments/intent -d '{"contentId":"c2","userId":"u_test"}'` | `{"orderId":"order_…","amount":990,…}` ✅ |
| 인기 베스트 3 | `curl /api/popular` | 3개 반환, 구매 0건일 때 `purchase_count:0` ✅ |

실제 결제 위젯 렌더링·카드 입력·승인 플로우는 사용자 브라우저에서 시각 확인 필요 (아래 §6).

## 6. 사용자가 브라우저에서 직접 확인할 것 — 데모 시나리오

서버는 백그라운드로 떠 있다 (포트 3000).

1. **http://localhost:3000/** 접속 → 콘텐츠 6개 목록·가격·preview 3줄 노출
2. 아무 카드 클릭 → 상세 페이지에서:
   - 미리보기 3줄은 또렷
   - 본문은 **블러 처리**된 자리표시자 + "🔒 결제 후 전체 본문이 열립니다" 오버레이
   - 그 아래 토스페이먼츠 결제 위젯이 자동 렌더
3. **결제하기** 버튼 → 토스 결제창 (테스트 카드 `4330-1234-1234-1234`, 임의 유효기간/CVC)
4. 결제 성공 시 `#/payment/success`로 리다이렉트 → 서버가 `/v1/payments/confirm` 호출 → 성공 메시지
5. **본문 읽으러 가기** → 같은 상세 페이지인데 이번엔 본문 전체가 열려 있음
6. 헤더 **내 라이브러리** → 구매한 콘텐츠 목록 + 결제 시각 + 금액
7. 홈으로 돌아오면 **🔥 인기 베스트 3** 섹션이 표시됨 (구매가 1건이라도 있을 때)
8. **이상 동작 검증**: 상세 페이지에서 DevTools → Network 탭 → `/api/contents/cN` 응답 JSON에 미구매 시 `body` 키가 **아예 없음**을 직접 확인 (PRD §7 보안 약속의 가시화)

## 7. 산출물 트리

```
week-6/quest/mini_app/
├── prd.md                 # (입력 — 변경 없음)
├── package.json
├── server.js              # Express + API 7종 + 토스 confirm
├── seed.js                # 콘텐츠 6개 시드
├── public/
│   ├── index.html         # SPA 셸 (CDN React/Tailwind/Toss v2)
│   └── client.js          # 해시 라우터 + 5개 페이지
├── work_log.md            # 이 문서
└── node_modules/          # express
```

## 8. 한계 및 후속 권고

- **인메모리 DB** — 서버 재시작 시 purchases 초기화. 운영 시 PostgreSQL/Supabase 마이그레이션 필요. 컬럼은 PRD §5 그대로(id, user_id, content_id, paid_at, amount).
- **인증 없음** — `localStorage` user_id는 누구나 자기 ID를 입력해 위장 가능. PRD에 인증 요구 없어 의도적 미니멀. 운영 시 OAuth/이메일 로그인 도입 후 user_id를 세션에서 추출.
- **TossPayments 키 하드코딩** — 데모 키이므로 위험 없으나, 운영 키 도입 시 환경변수(.env) + dotenv로 분리 필수. server.js 주석에 표시.
- **결제 실패 후 재시도 UX** — 현재는 fail 페이지에서 홈으로만 가능. 동일 상품 재결제 버튼 추가는 v2.
- **베스트 3 캐싱 없음** — 구매 횟수 계산을 매 요청 O(N) 스캔. N이 작아 OK이지만 DB 도입 시 SQL `GROUP BY` 한 번으로 교체.
- **시각 회귀 검증** — Chrome MCP 세션이 검증 도중 끊겨 실제 페이지 렌더링은 사용자 브라우저 확인 필요. API·정적 자산·보안 검증은 모두 통과.

---

## 9. 2026-05-07 추가 — 썸네일 + 본문 풍부화

**배경:** "앞에는 썸네일이 있고 내용이 좀 있어야 유료로 볼맛이 날꺼 같아"라는 피드백.
미리보기가 텍스트 3줄뿐이고 본문도 6줄 정도라 결제 결심을 자극하기엔 너무 빈약했음.

**변경:**

| 영역 | 전 | 후 |
|---|---|---|
| 썸네일 | 없음 | FAL `fal-ai/flux/schnell`로 콘텐츠별 1장 사전 생성 → `public/thumbnails/{id}.jpg` 정적 서빙 |
| 본문(body) | 콘텐츠당 6줄 | 25줄 내외, 5섹션 구조(도입/원리/단계/실수/응용/요약) |
| preview | 첫 3줄 | 첫 5줄 — 도입부 + 핵심 한 줄까지 노출되어 결제 결심 유도 |
| 잠금 본문 자리표시자 | 한 덩어리 ████ | 섹션 헤더 + 5단계 단계별 ████ — "약 25줄 · 5섹션 구조" 안내 배지 |
| 홈 카드 | 텍스트만 | 좌측 썸네일(48px) + 우측 텍스트(line-clamp-5) 가로 카드 |
| 베스트3 | 텍스트만 | 4:3 썸네일 + 카드 |
| 상세 | 제목만 | 16:9 히어로 썸네일 + 카드형 헤더 |
| 라이브러리 | 텍스트만 | 정사각 썸네일(112px) + 정보 |

**FAL 연동:**
- `scripts/gen-thumbnails.js` — 6개 콘텐츠별 프롬프트(에디토리얼 푸드 포토 톤) 정의, `fal.run/fal-ai/flux/schnell` 호출, 결과 URL을 다시 fetch해서 `public/thumbnails/{id}.jpg`로 저장. 멱등(이미 1KB 이상이면 스킵).
- 키 위치: `mini_app/.env`의 `FAL_API_KEY`. (week-3 `.env` 키 재사용; 마스킹 원칙에 따라 평문 노출 금지.)
- flux/schnell 4-step 추론 → 6장 ~30초. 모두 200~330KB JPG.

**보안 확인:**
- `safeContent`에 `thumbnail`만 추가, body는 여전히 미포함. 미구매 응답의 키 화이트리스트 유지.
- `purchases` 응답에도 `thumbnail` 추가 — body 노출은 여전히 `/api/contents/:id` + 구매 이력 조건일 때만.
- API 검증: `/api/contents` 6개 모두 `thumbnail: '/thumbnails/cN.jpg'` 포함, `preview` 5줄.
- 정적 검증: `/thumbnails/c1.jpg` HTTP 200.

**파일:**
- 수정: `seed.js`, `server.js`, `public/client.js`, `package.json`(없음 — 의존성 변동 없음)
- 추가: `scripts/gen-thumbnails.js`, `.env`, `public/thumbnails/c1~c6.jpg`

---

## 10. 2026-05-07 추가 — 로그인·마이페이지 + PRD 보강

**배경:** 기존 익명 `localStorage userId`(`u_xxxx`)로는 다른 기기·브라우저에서 구매 이력이 단절되는 한계.
PRD §4.2/§4.3/§4.4가 모두 `user_id` 매핑을 전제로 작성되어 있는데도 인증 구성이 빠져 있어, 처음부터 PRD 의도를 충족하지 못하는 상태였음. 사용자가 PRD 정독을 요청하여 정합성 점검 후 §4.0 신설·§4.4 보강·§5/§7 추가.

**PRD 변경:**
| 섹션 | 변경 |
|---|---|
| §1 프로젝트명 | `[앱 이름 입력...]` placeholder → "간단한 베이킹 지식 상점" |
| §4.0 사용자 계정 (신설) | 회원가입(이메일+비번)·로그인·로그아웃, 토큰 보관, 인증 기준(미인증 열람 가능 / 결제·라이브러리 인증 필수), 데모 계정 `demo@local/demo1234`, customerKey=userId 매핑 |
| §4.1 미리보기 | 5줄 시도 후 PRD 원안인 "앞 3줄"로 복귀 |
| §4.4 마이페이지 | 접근 제한·이메일 표시·썸네일/제목/일자/금액·재열람 명문화 |
| §5 데이터 모델 | `users(id, email, salt, password_hash, created_at)`, `sessions(token, user_id)` 추가; `contents`에 thumbnail, `purchases`에 toss_payment_key·toss_order_id 추가 |
| §7 보안 | 인증·결제 검증·승인 항목 명문화 (평문 비번 금지, body/query userId 무시하고 토큰의 req.userId만 사용) |

**서버 변경 (`server.js`):**
- `crypto` 도입. `users[]`/`sessions Map`/`userSeq` 인메모리.
- `hashPassword(scrypt, salt)` / `newToken(randomBytes 24B hex)` / `publicUser(u)` 헬퍼.
- 부트 시 데모 계정 `demo@local/demo1234` 자동 시드 — 인메모리이므로 재시작마다 자동 보장.
- 글로벌 미들웨어 — `Authorization: Bearer <token>` → `req.userId` 채움(미인증은 통과). `requireAuth` 가드.
- 라우트 추가: `POST /api/auth/signup·login·logout`, `GET /api/auth/me`. 데모 수준의 이메일 형식 검증(`/^[^\s@]+@[^\s@]+$/`)으로 `demo@local`까지 자연 허용.
- 기존 라우트 인증 통합:
  - `/api/contents/:id` — `req.userId`로만 구매 이력 조회. 미인증/미구매 모두 `locked=true` + body 키 자체 미포함.
  - `/api/purchases` — `requireAuth`.
  - `/api/payments/intent` — `requireAuth`. body의 userId 신뢰하지 않고 `customerKey = req.userId`.
  - `/api/payments/confirm` — `requireAuth`. body의 userId 무시.
- `purchases` 응답에 `thumbnail` 추가.

**클라이언트 변경 (`public/client.js`):**
- 익명 ID 발급 `getUserId()` 제거. `readAuth/writeAuth/useAuth` 훅 + `miniapp:auth-changed` 커스텀 이벤트 + `storage` 이벤트(다탭 동기화).
- `apiFetch(url, opts)` 헬퍼 — 토큰 자동 첨부. `api` 객체 전체에서 `?userId=` query/body field 제거.
- 라우트 추가: `#/login`, `#/signup` (둘 다 `AuthForm` 공유, `?next=` 쿼리로 redirect 복귀).
- `LoginPage` — 데모 계정 자동 입력 + 안내 배지.
- `Header` — 미로그인: "로그인" 버튼 / 로그인: 이메일 + 로그아웃 버튼.
- `DetailPage`:
  - 토스 위젯은 **로그인 + locked**일 때만 mount. customerKey는 토큰에서 받은 userId.
  - 미로그인 + locked → "결제하려면 로그인" 안내 + 로그인/회원가입 버튼(`?next=`로 상세로 돌아옴).
- `LibraryPage` (=`#/library`, "마이페이지"로 라벨 변경):
  - 미로그인 → 안내 + 로그인/회원가입 버튼.
  - 로그인 → 이메일·구매 수·각 항목(썸네일·제목·일자·금액·"본문 다시 보기 →") 표시.
  - "다른 기기·브라우저에서도 같은 계정으로 로그인하면 동일 라이브러리"를 UI에 명시.
- `PaymentSuccessPage` — confirm body에서 userId 제거(서버가 토큰에서 추출). 세션 만료 시 안내.
- 헤더 브랜드: `📝 지식 상점` → `🥐 베이킹 지식 상점`. 페이지 `<title>` 동기화.

**검증 (인메모리, curl 시나리오):**
| 시나리오 | 결과 |
|---|---|
| `GET /api/contents` preview 줄수 | 3줄 ✅ |
| `POST /auth/signup` (tester@local) | 200, token 발급, userId=`u_2` ✅ |
| `GET /api/purchases` 미인증 | 401 unauthorized ✅ |
| `GET /api/purchases` 인증 | 200 `[]` ✅ |
| `POST /api/payments/intent` 미인증 | 401 ✅ |
| `POST /api/payments/intent` 인증 | 200, `customerKey === req.userId`, amount는 서버 결정값(1900) ✅ |
| `GET /api/contents/c1` 미인증 | locked=true, body 키 부재 ✅ |
| `GET /api/contents/c1` 인증·미구매 | locked=true, body 키 부재 ✅ |
| `POST /auth/login` demo@local/demo1234 | 200, userId=`u_1` ✅ |
| `POST /auth/login` 잘못된 비번 | 401 invalid_credentials ✅ |

**결정 로그:**
- 인메모리 sessions/users 유지 (PRD §5 사이드 노트 "운영 시 Redis/JWT") — 미니앱 데모 범위.
- 비밀번호 해시는 외부 의존 없이 Node 내장 `crypto.scryptSync(password, salt, 64)` 사용.
- 결제 위젯 `customerKey`는 토스 정책상 동일 사용자 동일 키 요구 — 서버 발급 `u_n` 사용으로 안정.
- 미인증도 콘텐츠 둘러보기는 가능 (호기심 → 회원가입 전환을 막지 않음).

**파일:**
- 수정: `prd.md`, `server.js`, `seed.js`, `public/client.js`, `public/index.html`
- 추가: 없음

---

## 11. 2026-05-08 — Supabase Postgres 영속화 + Vercel 배포 준비

**배경:** Vercel 서버리스에선 인메모리·파일시스템(`/tmp` 외 read-only) 모두 무용 → 외부 DB 필수. 사용자 결정으로 새 Supabase 프로젝트 생성 대신 **기존 my-ecommerce 프로젝트를 재사용**하고 **테이블 prefix `miniapp_*`로 분리**. (메모리 원칙 "앱마다 분리"는 디폴트지만 사용자 명시 결정 우선. mini_app은 auth.users·Storage를 쓰지 않아 충돌 없음.)

**스택 변경:**
| 항목 | 전 | 후 |
|---|---|---|
| 사용자 저장 | 인메모리 `users[]` | Postgres `miniapp_users` |
| 세션 | 인메모리 `Map<token, userId>` | **JWT (stateless)** — 서버리스 적합 |
| 비밀번호 해시 | `crypto.scryptSync` | `bcryptjs` (my-ecommerce와 통일) |
| 구매 이력 | 인메모리 `purchases[]` | Postgres `miniapp_purchases` (UNIQUE(user_id, content_id)) |
| 데모 계정 시드 | 부트 시 메모리에 push | `db/apply.js`에서 ON CONFLICT DO NOTHING으로 upsert |
| 토큰 만료 | 무한 (메모리 살아있는 동안) | 30일 JWT |

**파일 추가:**
- `db/schema.sql` — `miniapp_users`, `miniapp_purchases` + 2 인덱스
- `db/apply.js` — schema 멱등 적용 + `demo@local/demo1234` upsert
- `api/index.js` — Vercel serverless entrypoint (`module.exports = require('../server.js')`)
- `vercel.json` — `buildCommand: npm run build:css`, `/api/:path* → /api/index` rewrite, public/은 자동 정적 서빙
- `.gitignore` — node_modules, .env, .vercel, *.log

**server.js 주요 변경:**
- `dotenv` 로드(`.env`), env 검증(`DATABASE_URL`, `JWT_SECRET` 부재 시 경고)
- `pg.Pool` 모듈 레벨 1회 생성 (서버리스 콜드스타트 간 재사용 시도)
- 미들웨어 — Bearer JWT 검증 → `req.user = { userId, email }`
- 모든 라우트 pg query로 변환 (signup/login/me, contents detail의 hasPurchased, popular의 GROUP BY, purchases 조회, intent의 중복 체크, confirm의 INSERT)
- `customerKeyOf(userId) = 'miniapp_u_' + id` — 토스 customerKey 정책에 안전한 ASCII
- `if (require.main === module) app.listen(...)` + `module.exports = app` — 로컬 listen / Vercel export 분기

**검증 (curl 시나리오, DB 백엔드):**
| 시나리오 | 결과 |
|---|---|
| `POST /api/auth/login` demo@local/demo1234 | 200, JWT, userId=1 ✅ |
| `POST /api/auth/signup` 새 이메일 | 200, JWT 발급 ✅ |
| `GET /api/auth/me` (JWT) | 200 ✅ |
| `POST /api/payments/intent` 미인증 | 401 ✅ |
| `POST /api/payments/intent` 인증 | 200, customerKey=`miniapp_u_1`, amount=서버결정값 ✅ |
| `GET /api/purchases` 인증 | 200 (DB는 빈 상태) ✅ |
| `GET /api/popular` | 200, 3건 ✅ |
| `GET /api/contents/c1` 미인증 | locked=true, body 키 부재 ✅ |
| `POST /api/auth/login` 잘못된 비번 | 401 invalid_credentials ✅ |

**환경변수 (`.env`):**
- `DATABASE_URL` — my-ecommerce에서 복사
- `JWT_SECRET` — `crypto.randomBytes(48)` 자동 생성
- `TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` — 데모 키 fallback이 코드에도 있어 옵션
- `FAL_API_KEY` — 썸네일 빌드는 끝났으므로 운영에선 불필요

**Vercel 배포 가이드:**
1. (CLI) `npm i -g vercel` → `cd week-6/quest/mini_app && vercel` (Root Directory를 자동 감지) 또는
2. (Dashboard) Import Git Repository → Root Directory를 `week-6/quest/mini_app`로 지정
3. 환경변수 4개 등록 (Production·Preview·Development): `DATABASE_URL`, `JWT_SECRET`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
4. Build Command는 vercel.json에 포함됨 (`npm run build:css`) → public/tailwind.css 생성
5. 첫 배포 후 `vercel --prod` 또는 main 브랜치 푸시

**주의:**
- `pg`는 SSL 필수 (Supabase) — `ssl: { rejectUnauthorized: false }`로 처리
- Vercel pooler가 권장 (Transaction pooler, port 6543) — 서버리스 콜드스타트에 적합
- 첫 배포 후 토스 결제 successUrl 동작 확인 — `location.origin`이 vercel URL로 자동 변경되므로 코드 수정 불필요

**파일:**
- 수정: `package.json`(scripts: `db:apply`, deps: pg/bcryptjs/jsonwebtoken/dotenv), `server.js`, `.env`(DATABASE_URL/JWT_SECRET/TOSS_* 추가)
- 추가: `db/schema.sql`, `db/apply.js`, `api/index.js`, `vercel.json`, `.gitignore`



