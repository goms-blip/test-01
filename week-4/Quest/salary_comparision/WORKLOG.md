# 너 얼마 벌고 얼마나 써? — 작업 로그 (Salary Comparision)

> PRD: [`prd.md`](./prd.md)
> 기준 버전: 1.0 (익명 연봉/지출 비교 웹진)
> 작업일: 2026-04-22
> 프로젝트 코드명: **Salary Webzine** — "월급은 조용히, 지출은 솔직하게."

---

## 1. 목표 정리 (PRD 요약)

- Supabase(PostgreSQL) 기반 **익명 연봉/지출 비교** 웹 서비스
- 핵심 기능
  - (1) 월급·지출·직군·연차 + 카테고리별 지출을 **익명으로 입력**
  - (2) 응답자 전체·직군별·연차별 **평균/중앙값** 통계
  - (3) 내가 입력한 값의 **백분위(상위 N%)** 산출
  - (4) 카테고리 지출 비중을 **전체 평균 vs 내 비중** 으로 나란히 비교
  - (5) 월급 × 지출 **산점도**에서 내 위치 포인트 표시
  - (6) 직군/연차 **필터**로 비교 대상 좁히기
- 프론트: 웹진(editorial magazine) 형태. 세리프 헤드라인 + 형광 라임 악센트.

---

## 2. 기술 스택 & 파일 구성

```
week-4/Quest/salary_comparision/
├── prd.md              # 원본 요구사항
├── WORKLOG.md          # 이 파일 (작업 내역)
├── server.js           # Express 5 + pg (Supabase)
├── index.html          # React 18 CDN + Tailwind + Recharts + Babel standalone
├── package.json        # dependencies: express, pg, dotenv
├── vercel.json         # dual-mode (static + serverless)
├── .env.example        # 환경변수 템플릿
└── .gitignore          # node_modules / .env / .vercel / .DS_Store
```

| 영역 | 기술 | 비고 |
| :--- | :--- | :--- |
| Frontend | React 18 (UMD), Tailwind CDN, Babel standalone, **Recharts 2.12** | 단일 `index.html` |
| Backend | Express 5, pg 8 | `server.js` |
| DB | Supabase PostgreSQL (pooler, port 6543) | `salary_stats` 테이블 |
| Local port | `4329` | 4325 Refri-Manager, 4326 Refri-AI, 4327 Anonymous-Board, 4328 Money-Balance 다음 순번 |
| Deploy | Vercel dual-mode (로컬 `node server.js` + 서버리스 export) | |

---

## 3. 디자인 결정 — “웹진(Webzine)” 톤

### 3-1. 무드
PRD 레퍼런스(공공기관 웹진 모두디자인 샘플)가 가진 **편집 디자인** 톤을 따른다:
- 따뜻한 오프화이트 배경(`#faf8f3`) + 크림(`#fffaed`) 보조
- **세리프 초대형 헤드라인** (Noto Serif KR 900) + 본문 Pretendard Sans
- 얇은 1px 헤어라인 구획, 그림자 없음
- 편집적 "N° 001 / ISSUE / Colophon" 메타 장식과 티커바

### 3-2. 형광 악센트 (절제된 단일 컬러)
- **네온 라임 `#d4ff00`**
- 사용처:
  - 메인 헤드라인 "솔직하게" 하이라이트(형광펜)
  - 주 CTA "익명으로 제출하기 →" 배경
  - 핵심 카드 "월급 위치" 배경
  - 산점도 내 점(‘나’) — 형광 라임 + 검정 외곽선
  - Bar chart 지출 bar 한 세트

### 3-3. 카테고리 색 팔레트 (Pie)
| 카테고리 | 컬러 | 의도 |
| :--- | :--- | :--- |
| 식비 | `#111111` | 본문 잉크 |
| 주거비 | `#d4ff00` | 브랜드 악센트(가장 비중 큰 축) |
| 교통비 | `#6b7280` | 뉴트럴 그레이 |
| 구독료 | `#f59e0b` | 액센트 옐로 |
| 여가/문화 | `#22c55e` | 그린 |
| 기타 | `#a1a1aa` | 라이트 그레이 |

---

## 4. 데이터베이스 (Supabase)

### 4-1. 테이블 — `public.salary_stats`

| 컬럼 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | `gen_random_uuid()` (pgcrypto) | PK |
| `created_at` | TIMESTAMPTZ | `NOW()` | 생성 일시 |
| `monthly_income` | BIGINT | — | 월급(원) |
| `monthly_expenses` | BIGINT | — | 월 지출(원) |
| `job_category` | TEXT | — | 개발/디자인/기획/마케팅/영업/운영/HR/기타 |
| `experience_years` | INT | — | 연차 (0~60) |
| `category_expenses` | JSONB | `'{}'` | 식비/주거비/교통비/구독료/여가/기타 |

### 4-2. 자동 초기화 (멱등)
`server.js` 의 `initDB()` 가 첫 `/api/*` 요청에서 실행됨:
1. `CREATE EXTENSION IF NOT EXISTS pgcrypto`
2. `CREATE TABLE IF NOT EXISTS public.salary_stats (…)`
3. `CREATE INDEX IF NOT EXISTS salary_stats_created_at_idx ON salary_stats (created_at DESC)`
4. `CREATE INDEX IF NOT EXISTS salary_stats_job_idx        ON salary_stats (job_category)`
5. `CREATE INDEX IF NOT EXISTS salary_stats_exp_idx        ON salary_stats (experience_years)`

Supabase 콘솔에서 SQL을 직접 돌릴 필요 없음. 서버 첫 부팅 시 자동 세팅.

### 4-3. 연결 방식
- 우선: `process.env.DATABASE_URL` (pooler URL + SSL)
- Fallback: `server.js` 안에 Anonymous-Board와 동일한 pooler 호스트/계정 하드코딩(로컬 개발용)
- 프로덕션(Vercel)에서는 반드시 `DATABASE_URL` 환경변수로 세팅. `.env.example` 참고.

---

## 5. API 스펙

Base: `/api`

| Method | Path | Body / Query | 설명 |
| :--- | :--- | :--- | :--- |
| GET | `/api/meta` | — | 직군/지출 카테고리 메타 (프론트 렌더 용) |
| POST | `/api/salary` | `{ monthly_income, monthly_expenses, job_category, experience_years, category_expenses }` | 익명 입력 |
| GET | `/api/stats` | `?job=&experience=&income=&expenses=` | 전체 통계 + (옵션) 내 위치 백분위 |

공통 응답:
```json
{ "success": true,  "data": { ... } }
{ "success": false, "message": "<사유>" }
```

### 검증 규칙 (POST /api/salary)
- `monthly_income` : 정수, 0 ≤ x ≤ 10억. 실패 시 400.
- `monthly_expenses`: 정수, 0 ≤ x ≤ 10억. 실패 시 400.
- `job_category`  : 화이트리스트(8종) 외 값이면 400.
- `experience_years`: 0 ≤ x ≤ 60 정수.
- `category_expenses`: 허용된 키(`food/housing/transport/subscription/leisure/etc`)만 통과, 음수 및 비정수는 버림.

### `/api/stats` 응답 구조
```json
{
  "filter": { "job": "개발" | null, "experience": 3 | null },
  "overall": { "total": 123, "avg_income": ..., "avg_expenses": ..., "median_income": ..., "median_expenses": ... },
  "by_job":        [{ "job_category": "개발",  "n": N, "avg_income": ..., "avg_expenses": ... }, ...],
  "by_experience": [{ "experience_years": 3,  "n": N, "avg_income": ..., "avg_expenses": ... }, ...],
  "by_category":   { "food": ..., "housing": ..., "transport": ..., "subscription": ..., "leisure": ..., "etc": ... },
  "sample": [{ "monthly_income": ..., "monthly_expenses": ..., "job_category": ..., "experience_years": ... }],  // 최대 500
  "mine":   { "income": N, "expenses": N, "income_percentile_in_group": 72.5, "expenses_percentile_in_group": 48.1 } | null
}
```

### 백분위 산출 로직
필터 동일 그룹 안에서:
- 해당 값보다 낮은 표본 수를 `below`
- 해당 값과 같은 표본 수를 `equal`
- `rank = below + equal / 2` → `percentile = rank / total * 100`
- 상위 N% 표기는 `100 - percentile` 로 계산.

중앙값은 PostgreSQL의 `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY …)` 로 서버에서 계산.

---

## 6. UI 구성

### 6-1. Header (편집 표지)
- 좌측: 초대형 세리프 헤드라인 "월급은 조용히, 지출은 솔직하게."
  → '솔직하게'에 네온 라임 형광 하이라이트
- 우측: 4칸 메타 카드 (Stack / Method / Chart / Access)
- 상단 티커바: "ISSUE N° 001 · 익명 웹진 · TOTAL N STORIES"

### 6-2. Input Form (Input / 01)
- 필수: 월급·월지출(숫자) · 직군(chip) · 연차(number)
- 선택: 카테고리 6종 지출
- 실시간 경고: 카테고리 합계가 월 지출을 초과하면 빨간 인라인 메시지
- 제출 완료 시 내 값을 상태에 저장 → 자동으로 `/api/stats` 재조회 → MyResult/산점도에 반영

### 6-3. Filter 바
- 직군 chip(전체 + 8종) · 연차 select(전체 + 0~20년)
- 선택 변경 시 `/api/stats` 재조회. 내 백분위도 **선택 그룹 내부** 기준으로 재계산.

### 6-4. MyResult (Feature)
- 3장 대형 셀: **월급 위치(형광)** / **지출 위치** / **저축 여력**
- "상위 N%" + "평균 대비 +/− 얼마" 카피
- 입력 이후에만 노출.

### 6-5. Statistics 섹션
1. `Statistics / 01` — 전체 응답자 평균/중앙값 5장 스탯 카드
2. `Statistics / 02` — 직군별 평균 월급·지출 Bar Chart (검정 / 라임)
3. `Statistics / 03` — 연차별 평균 월급·지출 Bar Chart (검정 / 그레이)
4. `Statistics / 04` — 카테고리 지출 비중 Pie (좌: 평균 / 우: 나)
5. `Distribution` — 월급 × 지출 Scatter. 평균 점은 검정 투명도, 내 점은 **형광 라임 + 외곽선**.

### 6-6. Footer (Colophon)
- 편집 디자인 관례대로 Colophon 섹션. Stack 크레딧.

---

## 7. 실행 / 검증

### 7-1. 로컬 실행
```bash
cd week-4/Quest/salary_comparision
npm install
node server.js
# Salary-Comparision server running on http://localhost:4329
```

### 7-2. 스모크 테스트 (수행 완료 ✅)
| 케이스 | 기대 | 결과 |
| :--- | :--- | :--- |
| `GET /` | 200, `index.html` 서빙 | ✅ 200 |
| `GET /api/meta` | 200, 카테고리/직군 반환 | ✅ JSON 응답 확인 |
| `POST /api/salary` (개발/3년차/350만/210만) | 201, UUID 반환 | ✅ UUID 발급 |
| `POST /api/salary` (디자인/5년차/420만/250만) | 201 | ✅ |
| `POST /api/salary` (마케팅/1년차/280만/190만) | 201 | ✅ |
| `GET /api/stats?income=3500000&expenses=2100000` | `overall.total=3`, `by_job` 3행, `by_experience` 3행, `by_category` 평균, `mine` 백분위 | ✅ 전 구조 확인 |

### 7-3. 주의 — 포트 충돌 히스토리
초기에는 `4328`을 기본 포트로 잡았으나, 같은 주차의 `balance_Game` 서버가 4328을 사용하고 있어 (이미 백그라운드 기동 상태) 새 서버 부팅이 무음으로 실패함.
→ 기본 포트를 **`4329`** 로 변경. `.env.example` / WORKLOG 동기화.

### 7-4. 시드 데이터 메모
스모크 테스트에 쓴 3건(개발/디자인/마케팅)은 DB에 남아 있다. 필요 시 Supabase SQL 에디터에서
`DELETE FROM public.salary_stats WHERE created_at >= '2026-04-22';` 로 제거 가능.

---

## 8. 배포 (완료)

1. Vercel 프로젝트 생성: `salary-comparision` (384s-projects)
2. `vercel link --yes` → `vercel --prod --yes` (dual-mode)
3. **Production URL**
   - Alias: <https://salary-comparision.vercel.app>
   - Deployment: <https://salary-comparision-rb5wvncra-384s-projects.vercel.app>
4. 프로덕션 스모크 (2026-04-22)
   - `GET /api/meta` → 200 (카테고리/직군 정상)
   - `GET /api/stats` → 200 (overall/by_job/by_experience 정상)
   - `POST /api/salary` → 201 (기획/5년차/400만/280만 + 카테고리 3종)
5. **DATABASE_URL 이슈 메모** — Supabase 패스워드에 `,?/` 특수문자가 섞여 있어 URL 인코딩(`%2C%3F%2F`)으로 넣어도 pg 드라이버 측에서 connection string 파싱 실패가 발생 (`initDB error`). 현재는 `server.js:16-23` 하드코드 fallback Pool 설정(호스트/유저/패스워드 raw 값)으로 운영. 장기적으론 패스워드 회전 + Vercel env 재설정 권장.

---

## 9. 미션 체크리스트 (PRD 대응)

- [x] Supabase 프로젝트 및 `salary_stats` 테이블 설정 → `initDB()` 자동 생성
- [x] 익명 입력 UI 및 DB Insert API — `POST /api/salary`
- [x] 전체/직군/연차 평균 집계 — `GROUP BY job_category`, `GROUP BY experience_years`
- [x] 내 위치 백분위 산출 — `below + equal/2` / `total`
- [x] 카테고리별 지출 비중 시각화 (Pie 2장, 평균 vs 나)
- [x] 필터(직군/연차) — chip/select
- [x] 반응형 레이아웃 — Tailwind `md:` 브레이크포인트 기준 2~12단 그리드
- [x] 웹진 형태의 편집 디자인 — 세리프 헤드라인 + 티커 + Colophon + 형광 악센트
- [x] Vercel 배포 — <https://salary-comparision.vercel.app>
- [ ] GitHub 푸시 & 스크린샷 (다음 단계)

---

## 10. 후속 아이디어 (MVP 이후)

- **Supabase Realtime** 구독 → 새 글이 올라오면 통계/산점도 즉시 갱신
- **IQR / 사분위수 박스플롯** — 평균/중앙값 외 분포 형태도 전달
- **상위 10% 월급 수준 배지** — 네온 라임 "TOP 10%" 스탬프
- **CSV 익스포트** — 로그인 없이도 현재 필터 기준 집계 다운로드
- **연봉 대비 저축률 분포** — 2차 라인: (income - expenses) / income
- **부정 입력 억제** — rate limit + 비현실적 값(예: 월급 10억) 경고 팝업
