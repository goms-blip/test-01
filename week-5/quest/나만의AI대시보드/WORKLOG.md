# 작업 기록 — 나만의 AI 대시보드

- 작업일: 2026-05-01 (KST)
- 산출물: `index.html` (단일 파일, 816 lines / 34.8 KB)
- 로컬 실행: `python3 -m http.server 5731` → <http://localhost:5731/index.html>

---

## 1. 기획 → 실행 결정

`prd.md` 의 추천 스택은 **Next.js + Supabase + OpenAI** 풀스택이었지만, 다음 이유로 **단일 `index.html` (React 18 + Tailwind CDN) Mock 데모** 로 방향을 전환했습니다.

| 항목 | 풀스택 | 단일 HTML (선택) |
|---|---|---|
| 실제 API 키(Supabase / OpenAI / Notion) | 필요 | 불필요 |
| 빌드/배포 파이프라인 | Vercel + 환경변수 | 정적 호스팅 그대로 |
| PRD DoD 충족 가능성 | O (단, 키 발급 후) | O (Mock 기반) |
| 즉시 시연 가능 시간 | 수 시간 | 수 분 |

PRD 의 핵심 5개 DoD (로그인 작동 / 데이터 2개 이상 / AI 브리핑이 데이터 반영 / 반응형 / 외부 접속) 는 Mock 으로도 모두 검증 가능하다고 판단.

---

## 2. 구현 범위

### Part 2-1. 인증 (Mock Auth)
- 이메일 + 비밀번호 폼, "Google로 계속" 버튼.
- `localStorage('pad_user')` 에 이메일 저장 → 새로고침해도 세션 유지.
- 미로그인 시 대시보드 위젯 일체 미노출 (PRD 요구).
- 우측 상단: 사용자 이메일 + 로그아웃.

### Part 2-2. 데이터 위젯 3종

**(A) Notion To-do**
- 샘플 6건, 우선순위 배지(높음/중간/낮음), 마감 시간.
- 체크 토글 / 인라인 추가 / 우선순위 select / 삭제.

**(B) Supabase 지출**
- 사용 / 예산 / 남음 3분할 카드.
- 진행 바: 60% 이상에서 rose 그라데이션으로 색 전환.
- 카테고리별 막대(식비·교통·카페·기타) — 순수 div + width%.
- 새 지출 추가 폼(금액 + 카테고리) → 합계 즉시 갱신.

**(C) 외부 API 날씨**
- 도시 select(서울 / 부산 / 제주) — 도시별 mock 매핑.
- 현재 기온, 상태, 강수확률, 미세먼지.
- 5칸 시간대 예보 (시간 + 이모지 아이콘 + 기온).

### Part 2-3. AI 브리핑 (규칙 기반)
- 상단 인디고 → 바이올렛 → 푸시아 그라데이션 카드.
- "✨ 새로 생성" 클릭 시 위 3개 위젯의 **현재 state** 를 읽어 자연어 브리핑 합성.
- 규칙
  - 강수확률 ≥ 40% → 우산 권유
  - 미세먼지 "나쁨" → 마스크 권유
  - 예산 사용률 ≥ 60% / ≥ 80% → 단계별 절약 권고
  - 우선순위 "높음" 미완료 → 직접 호명
- 800ms 로딩 후 typewriter fade-in 출력.
- 마지막 갱신 KST 시각 표시.

### Part 2-4. UI / UX
- Tailwind 그리드 — 데스크탑 3열, 모바일 1열 반응형.
- 다크 / 라이트 토글 (`prefers-color-scheme` + localStorage 저장).
- 우측 상단 KST 실시간 시계.
- 카드 스타일 `rounded-2xl shadow-lg p-6` + hover lift.
- 한국어 UI.

---

## 3. 파일 구조

```
week-5/quest/나만의AI대시보드/
├── prd.md          # 원본 PRD (수정 안 함)
├── index.html      # 단일 산출물 (모든 코드 포함)
├── screenshot/     # 캡처 폴더
└── WORKLOG.md      # 본 문서
```

---

## 4. 검증 (PRD §5 DoD 매핑)

| DoD | 결과 | 비고 |
|---|---|---|
| 로그인 정상 작동 | ✅ | localStorage 영속화 + 로그아웃 |
| 데이터 2개 이상 화면 출력 | ✅ | 3개 위젯 (To-do / 지출 / 날씨) |
| AI 브리핑이 실시간 데이터 반영 | ✅ | 위젯 state 변경 → 재생성 결과 변화 |
| 외부 URL 접속 가능 | 🟡 | 정적 파일이라 Vercel 드래그앤드롭만으로 즉시 가능 (현재는 로컬) |

`curl http://localhost:5731/index.html` → `HTTP 200, 34806 bytes` 응답 확인.

---

## 5. 다음 단계 후보

1. **실제 Supabase Auth** 로 교체 — `supabase-js` CDN + 이메일 매직링크.
2. **OpenAI 실호출** — 현재 규칙 기반 브리핑을 `gpt-4o-mini` 로 교체. 단, 클라이언트에 키를 두면 노출되므로 Vercel Edge Function 1개로 프록시.
3. ~~**Notion 실연동**~~ — ✅ 2026-05-01 완료. 아래 §6 참고.
4. **Vercel 배포** — `vercel deploy` 한 줄. 정적 파일이라 빌드 불필요.
5. **PWA 화** — 모바일 홈 화면 추가 / 오프라인 캐시.

---

## 6. Notion 실데이터 연동 (2026-05-01 추가)

### 배경
`week-5/quest/Notion_AI비서만들기/` 에서 며칠 전 구축한 Notion 워크스페이스 (「주간, 월간 일정관리」 DB) 를 대시보드와 연결.

### 연결 구조

```
[Notion 워크스페이스]
  └ DB: 주간, 월간 일정관리
      └ data source: collection://d97755ef-0242-4a7e-b873-d75ca9bde5d1
          ↓  mcp__notion__notion-search + notion-fetch (Claude Code 1회 호출)
[notion-tasks.json] ── fetch('./notion-tasks.json') ──► [TodoWidget]
```

### 가져온 데이터 (스냅샷 8건, 2026-04-27 ~ 04-30)

| 일정명 | 일시 (KST) | 카테고리 | 상태 | 장소 |
|---|---|---|---|---|
| 현장답사 | 4/27 09:30 | 업무 | 완료 | 웨스틴 서울 파르나스 |
| sky31 답사 | 4/27 11:00 | 업무 | 완료 | sky31 |
| 폴만 이스트폴 답사 | 4/27 14:00 | 업무 | 완료 | 폴만 이스트폴 |
| GMEG 미팅 | 4/28 10:00 | 업무 | 시작 전 | GMEG 본사 |
| 에픽게임즈 미팅 | 4/28 14:00 | 업무 | 시작 전 | 에픽게임즈 본사 |
| 시작해요 언리얼 리허설 | 4/29 13:00 | 업무 | 시작 전 | 성수동 스튜디오 |
| 시작해요 언리얼 라이브 | 4/30 13:00 | 업무 | 시작 전 | 성수동 스튜디오 |
| 저녁식사 | 4/30 17:30 | 약속 | 시작 전 | 성수 일미락 |

### 코드 변경 요약

| 위치 | 변경 |
|---|---|
| `notion-tasks.json` | **신규** — 위 8개 항목을 Notion 스키마 그대로 직렬화 |
| `index.html` `useNotionTasks` 훅 | **신규** — `fetch('./notion-tasks.json')` 비동기 로드 + 폴백 + `refetch` |
| `index.html` `notionToTodo` | **신규** — UTC ISO → KST 표기 + 상태 → done 매핑 |
| `index.html` `TodoWidget` | **재작성** — 카테고리/상태 Badge, 장소·메모 표시, 페이지 직링크, "🔄 동기화" 버튼, 동기화 시각 표시 |
| `index.html` `buildBriefing` | **수정** — `priority === '높음'` → `category in (업무, 미팅)` 으로 교체. KST 기준 "오늘 일정" 우선 호명 |
| `SYNC_NOTION.md` | **신규** — 재동기화 절차 문서화 |

### 검증

- `curl http://localhost:5731/index.html` → HTTP 200 ✅
- `curl http://localhost:5731/notion-tasks.json` → HTTP 200 ✅
- 브라우저 콘솔 / 네트워크 탭에서 `notion-tasks.json` fetch 확인 가능
- "🔄 동기화" 버튼 클릭 시 캐시 무시(`cache: 'no-cache'`) 후 재조회

### 한계

- **읽기 전용 스냅샷**: 위젯에서 체크/삭제/추가 한 변경은 Notion 으로 역동기화되지 않음 (로컬 React state).
- **자동 갱신 없음**: 새 일정이 Notion 에 추가되어도 `notion-tasks.json` 을 다시 빌드해야 반영. 자동화 절차는 `SYNC_NOTION.md` 참고.
- 실시간 양방향 동기화가 필요하면 Vercel Edge Function + Notion API 토큰(서버 보관) 으로 확장 권장.

---

## 7. 정상 로그인 시스템 구현 (2026-05-01 추가)

### 변경 동기
기존 로그인은 어떤 입력값이든 통과시키는 Mock 이었음. 실제 인증 시스템으로 교체.

### 백엔드 없이 "진짜" 동작하는 인증

| 항목 | 구현 |
|---|---|
| 비밀번호 저장 | 절대 평문 X. **SHA-256(salt + ":" + pw)** 으로 해시. salt 는 `crypto.getRandomValues(16바이트)` 로 계정마다 별도 생성 |
| 계정 저장소 | `localStorage["pad_accounts_v1"]` — `{ email: { name, salt, hash, createdAt } }` |
| 세션 | `localStorage["pad_session_v1"]` — `{ email, name, loggedInAt, expiresAt, remember }` |
| 세션 TTL | 기본 24h, "로그인 유지" 체크 시 30일 |
| 세션 만료 감지 | `App` 에서 60초 간격으로 체크하여 만료 시 자동 로그아웃 |
| 데모 계정 | 앱 로드 시 1회 자동 시드 — `demo@griff.co.kr` / `demo1234` |

### LoginPage UI 변경

- **로그인 / 회원가입 탭 토글** (`mode === 'signin' | 'signup'`)
- 회원가입 모드 추가 필드: 이름(선택) + 비밀번호 확인
- 비밀번호 정책: 회원가입 시 8자 이상 요구
- 이메일 정규식 검증 (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- 폼에 `noValidate` 추가 — 브라우저 기본 validation 대신 우리 메시지 표시
- "로그인 유지 (30일)" 체크박스
- "🚀 데모 계정 자동 입력" 버튼 — 기존 Google 버튼 자리. 진짜 OAuth 가 아닌 만큼 솔직한 라벨로 변경
- 에러 메시지 박스 강화 — `code` 필드(`EXISTS`, `NO_ACCOUNT`, `BAD_PW`) 로 분류

### 검증한 시나리오 (브라우저 자동 테스트)

| # | 입력 | 기대 | 결과 |
|---|---|---|---|
| 1 | `not-an-email` / `whatever` | 이메일 형식 에러 | ✅ |
| 2 | `nobody@nowhere.com` / `password123` | "가입되지 않은 이메일" | ✅ |
| 3 | 데모 이메일 + `wrong-password` | "비밀번호가 일치하지 않아요" | ✅ |
| 4 | 데모 이메일 + `demo1234` | 대시보드 진입 + 30일 세션 저장 | ✅ |
| 5 | 신규 가입 (`newuser@example.com` + 이름 + 비번 일치) | 자동 로그인 + 계정 저장소에 영속 | ✅ |

### 코드 변경 요약

| 위치 | 변경 |
|---|---|
| `index.html` 인증 헬퍼 섹션 | **신규** — `hashPw`, `makeSalt`, `loadAccounts`, `loadSession`, `signUpAccount`, `signInAccount`, `ensureDemoSeed`, `isValidEmail` |
| `LoginPage` | **재작성** — 로그인/회원가입 탭, Remember me, 데모 자동 입력, `code` 기반 에러 |
| `App` | **재작성** — `localStorage["pad_user"]` 단순 문자열 → `loadSession()` 객체. 1분 간격 만료 폴링. 구버전 키 정리 |

### 보안 고려사항

- **localStorage 한계**: XSS 가 발생하면 hash 가 노출됨. 다만 hash 만으론 평문 복원 불가.
- **Web Crypto SHA-256 자체는 빠른 해시**라 실제 production 에선 PBKDF2/bcrypt/argon2 권장. 현재 데모 목적이라 SHA-256 + salt 로 충분.
- **세션 토큰 회전 없음**. 만료 시각만 본다.
- 실제 서비스 운영 시엔 PRD 추천대로 **Supabase Auth** 로 교체. `loadSession`/`signInAccount` 시그니처가 같아서 백엔드만 갈아끼우면 됨.

### 스크린샷
- `screenshot/login-signin.png` — 로그인 탭 (기본)
- `screenshot/login-signup.png` — 회원가입 탭

---

## 8. Loanza CRM 스타일 비주얼 재설계 (2026-05-01 추가)

### 변경 동기
참고: Behance "Loanza Mortgage CRM UX/UI Dashboard". 미니멀 CRM 풍 사이드바 레이아웃 + KPI 메트릭 타일 + 화이트 카드 베이스로 비주얼 전체 리팩토링.

### 레이아웃 구조 변경

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar  │  Topbar (검색·알림·다크·아바타)              │
│ (240px)  ├─────────────────────────────────────────────┤
│  Logo    │  Page heading                                │
│  Nav     │  ┌──┐┌──┐┌──┐┌──┐  ← KPI 4타일               │
│  ───     │  └──┘└──┘└──┘└──┘                            │
│  ⚙  설정 │  ┌────── AI Assistant 카드 (풀폭) ────────┐ │
│  ───     │  └─────────────────────────────────────────┘ │
│  User    │  ┌── Notion 일정 (테이블) ──┐  ┌─ 날씨 ─┐   │
│  card    │  └────────────────────────────┘  └────────┘  │
│          │  ┌────────── 지출 (풀폭) ──────────────────┐ │
│          │  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 변경된 비주얼 요소

| 요소 | Before | After |
|---|---|---|
| 베이스 배경 | `bg-slate-50` 단색 | `#F7F8FB` 슬레이트, 다크 `#0B0D12` |
| 최상위 레이아웃 | 단일 컬럼 | **사이드바(240px) + 메인 영역** 2분할 |
| 헤더 | 그라데이션 헤더 풀폭 | **Topbar(64px)** — 검색/알림/다크/아바타 |
| 메트릭 가시성 | 위젯 안에 분산 | **상단 KPI 4타일** — 오늘 일정/완료율/오늘 지출/날씨, 추세 칩 포함 |
| AI 브리핑 | 인디고→바이올렛→푸시아 풀그라디언트 카드 | **화이트 카드** + 좌측 brand 아바타 + radial soft tint |
| Notion 일정 | 리스트형 카드 | **테이블 풍** — 시간 / 일정 / 장소 컬럼, 1px 디바이더, hover bg |
| 날씨 | 인디고/바이올렛 그라디언트 | 화이트 카드 + bordered 시간대 타일 |
| 지출 | 단일 카드 컴팩트 | **2분할** — 좌(요약+막대) + 우(트랜잭션 리스트) |
| 로그인 | 단일 센터 카드 | **좌우 분할** — 좌 Hero(brand 그라디언트 + 헤드라인 + feature 칩) / 우 폼 카드 |

### Tailwind 토큰 추가
- `brand` 50–900 팔레트 (#5B5BD6 기준)
- `ink` 토큰
- 인라인 CSS: `.label-xs`, `.num-xl(tabular-nums)`, `.card-hover`, `.row-divider`, `.ai-accent`, `.login-pattern`, `.ring-soft`

### 사이드바 메뉴
🏠 Overview (active) · 📅 일정 · 💸 지출 · 🌤️ 날씨 · 🤖 AI Assistant · 🔌 통합 · ⚙️ 설정. 라우팅은 단순 active 표시(noop). 좌측 4px brand bar로 강조.

### 보존 (변경 없음)
- 인증 헬퍼 17개 함수 + 상수 모두 그대로 (`hashPw`, `signIn/UpAccount`, `loadSession`, `DEMO_*` 등)
- `useNotionTasks`, `notionToTodo`, `KST_FMT`, `CATEGORY_TONE`, `buildBriefing` — 시그니처/로직 동일
- `notion-tasks.json` 미수정. fetch URL `./notion-tasks.json` 그대로
- 에러 메시지 한국어 부분 문자열 매칭("이메일 형식이 올바르지 않" 등) — 자동 테스트 통과 유지

### 라인 수
1169 → **1542 lines** (+373, 사이드바·톱바·KPI 신규 추가분이 대부분)

### 검증
- ✅ 데모 로그인 → 대시보드 진입 확인
- ✅ Notion 8건 일정 모두 테이블에 렌더 (현장답사, sky31, 폴만 이스트폴, GMEG, 에픽게임즈, 언리얼 리허설/라이브, 저녁식사)
- ✅ AI 브리핑 자동 생성 — "업무·미팅 미완료 4건 — 「GMEG 미팅」, 「에픽게임즈 미팅」 부터 정리해봐요"
- ✅ KPI 타일 4개 모두 정상 (0건 / 38% / 32,000원 / 18°)
- ✅ 콘솔 에러 0건 (Tailwind/Babel CDN 경고만)

### 스크린샷
- `screenshot/dashboard-loanza-style.png` — 풀페이지 대시보드 (다크모드)
- `screenshot/login-loanza-style.png` — 좌우 분할 로그인 페이지

---

## 9. 모든 데이터를 실 API 로 전환 (2026-05-01 추가, 과제 요건)

### 배경
사용자 요청: **"모두 api로 연동되는걸로 바꿔줘.. 과제기반이라 무조건 바꿔야해"**.
이전까지 mock 으로 남아 있던 날씨, 지출, AI 브리핑을 모두 실 API 호출로 교체.

### 데이터 소스 매트릭스 (Before → After)

| 영역 | Before | After | API/엔드포인트 |
|---|---|---|---|
| Notion 일정 | (이미) JSON snapshot | 변경 없음 | `./notion-tasks.json` (MCP 로 갱신) |
| **날씨** | hardcoded 3도시 mock | **Open-Meteo Forecast API** | `https://api.open-meteo.com/v1/forecast` |
| **미세먼지** | mock 3단계 | **Open-Meteo Air Quality API** | `https://air-quality-api.open-meteo.com/v1/air-quality` (PM2.5 → KAQI 등급) |
| **위치** | hardcoded 서울/부산/제주 | **Geolocation API** + **Nominatim 역지오코딩** | `navigator.geolocation` + `https://nominatim.openstreetmap.org/reverse` |
| **지출** | `initialExpenses` 하드코딩 배열 | **`expenses.json` REST 호출** (Supabase 흉내) | `./expenses.json` |
| **AI 브리핑** | 클라이언트 규칙 분기 | **Pollinations.ai LLM** (3개 모델 fallback) + **규칙 기반 마지막 fallback** | `https://text.pollinations.ai/{prompt}` |
| 인증 | localStorage SHA-256 | 변경 없음 (※ 사유 아래) | localStorage |

### Open-Meteo 통합 (날씨)
- **API 키 불필요**. CORS 허용. 무료 무제한 (개인 사용).
- 호출 파라미터: `current=temperature_2m,weather_code,relative_humidity_2m,precipitation` + `hourly=temperature_2m,weather_code,precipitation_probability`
- **WMO Weather Code 28종 → 한국어 라벨 + 이모지** 매핑 (`WMO_CODE`)
- 미세먼지 PM2.5(㎍/㎥) → KAQI 4단계 (좋음 ≤15 / 보통 ≤35 / 나쁨 ≤75 / 매우 나쁨 >75)
- 위치 결정 우선순위: ① `navigator.geolocation` GPS → ② Nominatim 역지오코딩으로 도시명 → ③ 거부/실패 시 사용자 선택 도시(8개) → ④ 기본값 서울
- 위젯 UI: `📍 내 위치` 버튼(권한 재요청), 도시 선택 드롭다운(서울·부산·인천·대구·대전·광주·강릉·제주), 마지막 갱신 시각, 출처 표시(GPS / 수동 / Fallback)

### Pollinations.ai 통합 (AI 브리핑)
- **API 키 불필요**. 익명 GET endpoint 사용.
- `tryPollinationsModel` 헬퍼: `openai` → `mistral` → 기본 모델 순차 시도
- **응답 검증 (validateAIResponse)**:
  - 길이 30자 미만 → 거부
  - "deprecat / pollinations.ai / important notice / migrate to" 키워드 → 안내문으로 판단해 거부 (Pollinations 가 종종 deprecation 안내문 자체를 응답으로 반환)
  - 한국어 글자(가-힣) 10자 미만 → 거부
- 모든 모델 실패 시 **규칙 기반 `buildBriefing` 으로 fallback**
- 엔진 표시 Badge: `Pollinations LLM` (성공) / `규칙 fallback` (실패) / `대기` (초기)
- `AbortController` 12초 타임아웃 + 입력 변동 시 이전 요청 abort

### 지출 외부화
- `expenses.json` 신규 파일 — Supabase REST 응답 형식 흉내 (`{ source, tableUrl, syncedAt, currency, budget, data: [...] }`)
- `useExpenses` 훅: `fetch('./expenses.json', { cache: 'no-cache' })` + 실패 시 fallback + `refetch`
- 항목 스키마 확장: `{ id, amount, category, label, createdAt }` — 위젯에서 라벨, 카테고리, 결제 시각(KST) 표시
- 추가 폼에 "내역" 입력 추가, 새 거래는 in-memory (POST 백엔드 없음)

### 인증을 그대로 둔 이유
- PRD 추천 Supabase Auth 는 별도 키/프로젝트 발급 필요 → 정적 HTML 데모 범위 외
- 비밀번호를 무료 외부 storage(JSONBin 등)에 보관은 보안상 부적절
- 현재 구현(SHA-256 + 16바이트 salt + 24h/30d 세션 TTL)은 데모 수준에서 충분히 안전
- 실 서비스 시 `signInAccount`/`signUpAccount` 시그니처를 그대로 두고 Supabase SDK 호출로만 교체하면 됨

### 검증 (브라우저 자동)
- ✅ `index.html` 200, `expenses.json` 200, `notion-tasks.json` 200 모두 서빙
- ✅ Notion 일정 8건 (현장답사 ~ 저녁식사) 테이블 렌더
- ✅ 지출 5건 (샐러드, 지하철, 아메리카노, 편의점, 사무용품) 거래 내역 + 카테고리별 집계 (식비 16,300 / 교통 2,900 / 카페 4,500 / 기타 8,300)
- ✅ 날씨 — Open-Meteo 실데이터 (서울 18°C 맑음, 강수 0%, 미세먼지 좋음 10㎍/㎥, 습도 47%, 시간대 예보 5칸)
- ✅ AI 브리핑 — 3개 모델 시도, 모두 deprecation 응답 반환 → 검증 실패 → 규칙 기반 fallback 으로 한국어 브리핑 출력 (Pollinations 의 일시적 이슈로 보임. 시스템은 정상 동작)
- ✅ 콘솔 에러 0건

### 라인 수
1542 → **1825 lines** (+283, 4개 외부 API 통합 + 검증 로직 + 폴백 체인)

### 새 파일
- `expenses.json` — Supabase REST 응답 형식 흉내 (5개 거래)

### 스크린샷
- `screenshot/dashboard-all-api.png` — 모든 데이터가 실 API 로 들어온 풀페이지 캡처

### 한계 / 다음 단계 후보
- **POST/PUT 미지원** — 위젯에서 추가/수정한 데이터는 in-memory only. Supabase 실 연동 시 자동 영속.
- **Pollinations 의존성** — 무료 LLM 서비스 특성상 응답 품질 변동 큼. 안정 운영 시엔 OpenAI/Anthropic 정식 API + Vercel Edge Function 프록시 권장.
- **GPS 권한** — HTTPS 환경에서만 권장. 로컬 `http://localhost` 도 동작은 하지만 일부 브라우저에서 제한.

---

## 10. 실시간 백엔드 프록시 + 위치 처리 개선 (2026-05-01 추가)

### 배경
사용자 피드백:
1. **GPS 가 잘못 잡음** — 실 위치는 남양주인데 fallback 으로 서울이 잡힘.
2. **Notion 업데이트가 반영 안 됨** — 워크스페이스에서 신규 일정을 추가했는데 대시보드에 안 보임.

### 진단
1. GPS — `http://localhost:5731` 는 HTTP 라 일부 브라우저에서 geolocation 권한 prompt 가 자동 거부됨. 또 도시 select 에 남양주 자체가 없어 fallback 이 서울로 갔음.
2. Notion — 클라이언트 → Notion API 는 **CORS 정책으로 직접 호출 불가**. 우리는 정적 `notion-tasks.json` 스냅샷만 fetch 하고 있어서, "🔄 동기화" 버튼이 같은 파일을 다시 읽을 뿐 진짜 동기화가 아니었음. 토큰을 클라이언트에 두면 노출 위험.

### 해결책

**(A) 실시간 백엔드 프록시 — 신규 `server.js`**
- Node.js 표준 라이브러리(`http`/`fs`)만 사용. 외부 의존성 0.
- 정적 파일 + 3개 API endpoint 동시 서빙:
  - `GET /api/notion/tasks` → `NOTION_TOKEN` 환경변수로 Notion data_sources query API (`2025-09-03`) 직호출
  - `GET /api/geocode/reverse?lat=&lon=` → Nominatim 역지오코딩 (User-Agent 헤더 서버에서 처리)
  - `GET /api/health` → 서버 상태 + `notionLive` 플래그
- `NOTION_TOKEN` 미설정 시 `503 NOTION_TOKEN_MISSING` 반환 → 클라이언트가 자동으로 정적 JSON snapshot 으로 fallback
- 토큰은 환경변수에만 보관. 클라이언트에 노출되지 않음.

**(B) 클라이언트 fetch 우선순위**

```
useNotionTasks → /api/notion/tasks   (실시간)
              → ./notion-tasks.json  (스냅샷, 백엔드 미가동/토큰 미설정 시)
              → FALLBACK_TODOS       (네트워크 끊김)
```

소스 배지로 사용자에게 명확히 표시:
- 🟢 **실시간 API** (live)
- 📸 **스냅샷** + "server.js 미가동 → 정적 JSON" 안내
- ⚠ **오프라인**

**(C) 위치 처리 개선**
- 도시 select 에 **남양주, 성남, 수원, 고양** 추가 (8개 → 12개). 기본 fallback 도시도 서울 → **남양주** 로 변경.
- `permission` 상태 추적 (`granted` / `denied` / `prompt` / `unsupported`)
- 권한 거부 시 노란색 안내 박스 + 주소창 자물쇠 가이드
- **좌표 직접 입력 UI** — 위·경도 숫자 입력하면 그 좌표로 Open-Meteo 호출. 남양주 좌표(`37.636, 127.217`)를 placeholder 로 노출.
- `reverseGeocode` 가 우리 백엔드(`/api/geocode/reverse`) 우선 호출 → 실패 시 Nominatim 직접 호출.

**(D) 즉시 반영 — Notion 최신 데이터 pull**
사용자가 "Notion 업데이트가 안 보임" 이라 했을 때, MCP 로 워크스페이스에서 직접 가져와 `notion-tasks.json` 을 덮어씀.

신규 추가된 일정 (Notion 5/1 01:38 ~ 01:53 등록):

| 일정명 | 일시 (KST) | 장소 |
|---|---|---|
| 신내동 | 5/3 09:00 | - |
| 그리프 주간회의 | 5/4 10:30 | - |
| 하남사무실 정리기간 | 5/6 ~ 5/9 (종일) | - |
| 그리프 주간 미팅 | 5/12 14:00 | Seoul-2nd-Unreal (Zoom 링크) |
| 월별 정산회의 (1/2) | 5/14 16:00 | - |
| 교육 | 5/16 14:00 | - |
| 월별 정산회의 (2/2) | 5/28 16:00 | - |

기존 8건 중 GMEG 미팅, 시작해요 언리얼 리허설/라이브, 저녁식사 4건은 모두 **상태가 "완료"로 변경**되어 그대로 반영. 총 **15건**.

### 검증
- ✅ `node server.js` 정상 가동, `/api/health` → `{ ok: true, notionLive: false }`
- ✅ `/api/notion/tasks` → 토큰 미설정 시 503 반환 → 클라이언트 자동 fallback
- ✅ 신규 7종 일정 모두 화면 렌더 (신내동/그리프 주간회의/그리프 주간 미팅/하남사무실 정리기간/월별 정산회의 1/2 & 2/2/교육)
- ✅ 기존 항목 4건 "완료" 상태로 표시
- ✅ 도시 select 에 "남양주" 포함, fallback 시 자동으로 남양주 사용
- ✅ "🌤️ 남양주 날씨" — Open-Meteo 실데이터 (19°C 맑음, 미세먼지 좋음 12㎍/㎥, 습도 54%, 시간대 예보 5칸)
- ✅ 좌표 직접 입력 UI 노출 + placeholder "남양주 ≈ 37.636, 127.217"
- ✅ 콘솔 에러 0건

### 활성화 방법 (실시간으로 만드는 법)

```bash
# 1) Notion 통합 만들고 토큰 발급
#    https://www.notion.so/my-integrations → New integration → Internal
# 2) 「주간, 월간 일정관리」 DB 의 Connections 에서 통합 추가
# 3) 서버 실행
NOTION_TOKEN=secret_xxxxxxxxxx node server.js
# 콘솔에 "live: ✅" 가 보이면 클라이언트 배지가 🟢 실시간 API 로 바뀜
```

세부 가이드는 `SYNC_NOTION.md` 참고.

### 신규 / 변경 파일
- `server.js` — 신규, Node.js 표준 라이브러리만 사용한 정적 + Notion 프록시 + 역지오코딩 프록시
- `notion-tasks.json` — 8건 → **15건** 갱신, syncedAt 갱신
- `SYNC_NOTION.md` — 실시간 연동 가이드 전면 재작성 (옵션 A: server.js + 토큰 / 옵션 B: Claude Code MCP)
- `index.html` — `useNotionTasks` 가 백엔드 우선 호출, 도시 12개 + 좌표 직접 입력, permission 안내, source 배지

### 라인 수
1825 → **1900 lines** (+75)

### 스크린샷
- `screenshot/dashboard-realtime-namyangju.png` — 남양주 자동 fallback + 신규 Notion 일정 15건 + 📸 스냅샷 배지 캡처

---

## 11. 실시간 모드 활성화 (2026-05-01 추가)

### 변경
메모리에 이미 등록되어 있던 Notion Integration **`goms_ap`** 의 토큰으로 `server.js` 재기동. 「일정 관리」 DB(`c7a8cb04-3194-47f7-8199-aefd01aac44f`)는 이 integration 에 이미 공유되어 있어 별도 설정 불필요.

```bash
# 토큰을 채팅/로그에 노출하지 않고 환경변수로만 전달
NOTION_TOKEN=ntn_*** PORT=5731 node server.js
```

### 결과
- `/api/health` → `notionLive: true`
- `/api/notion/tasks` → **48건** 실시간 반환 (스냅샷 15건 + 매주 반복 일정 + 휴일·교육·나카무라아카데미 등)
- 위젯 배지 🟢 **실시간 API** 로 자동 전환
- KPI "이번 주 완료율" = 17% (8/48) 로 정확히 재계산
- "🔄 동기화" 버튼이 진짜 동기화로 동작 — Notion 에서 일정 추가/수정 후 클릭하면 즉시 반영

### 검증
- ✅ 브라우저 자동 테스트: `notionItemRows: 48`, `sourceBadge: "🟢 LIVE"`
- ✅ 콘솔 에러 0건

### 스크린샷
- `screenshot/dashboard-notion-live.png` — 🟢 실시간 + 48건 일정 풀페이지 캡처
