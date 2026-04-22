# Money Balance · 머니 밸런스 — 작업 로그 (Balance Game)

> PRD: [`prd.md`](./prd.md)
> 기준 버전: 1.0 (실시간 밸런스 게임)
> 작업일: 2026-04-21
> 프로젝트 코드명: **MONEY BALANCE / 머니 밸런스** — "당신이라면, 어느 쪽?"

---

## 1. 목표 정리 (PRD 요약)

- Supabase(PostgreSQL) 기반의 **실시간 밸런스 게임 투표 앱**
- 카테고리: `직장/연봉 · 재테크/소비 · 일상/음식 · 연애/관계 · 기타`
- 핵심 기능
  - (1) 질문 등록 (선택지 A/B + 카테고리)
  - (2) 클릭 한 번으로 투표 → 즉시 퍼센티지/표수 표시
  - (3) 실시간성: 4초 폴링으로 다른 사람 투표 반영
  - (4) 카테고리 필터 + 최신순/인기순 랭킹
  - (5) 중복 투표 방지: LocalStorage
- 프론트 레퍼런스: Yakult SM-15 (에디토리얼 매거진 무드, 크림톤 배경, 굵은 타이포)
  - 원본 URL은 403 Forbidden 이라 WebFetch 실패 → 해당 매거진의 시각 코드(부드러운 크림, 또렷한 검정 라인, 굵은 헤드라인)를 참고해 유사 무드로 구성

---

## 2. 기술 스택 & 파일 구성

```
week-4/Quest/balance_Game/
├── prd.md              # 원본 요구사항
├── WORKLOG.md          # 이 파일 (작업 내역)
├── server.js           # Express 5 + pg (Supabase)
├── index.html          # React 18 CDN + Tailwind + Babel standalone
├── package.json        # deps: express, pg, dotenv
├── vercel.json         # dual-mode (static + serverless)
├── .env.example        # 환경변수 템플릿
└── .gitignore          # node_modules / .env / .vercel / .DS_Store
```

| 영역 | 기술 | 비고 |
| :--- | :--- | :--- |
| Frontend | React 18 (UMD), Tailwind CDN, Babel standalone | 단일 `index.html` |
| Backend | Express 5, pg 8 | `server.js` |
| DB | Supabase PostgreSQL (pooler, port 6543) | `mb_questions` / `mb_votes` |
| Local port | `4328` | 4327 Anonymous Board 다음 번호 |
| Deploy | Vercel (dual-mode: 로컬 `node server.js` + 서버리스 export) | `vercel.json` |

### 2-1. PRD 스택과의 차이 & 이유

PRD는 Next.js + React Query + Supabase Realtime을 제시하지만, 본 Quest 레포의 선행 프로젝트(`Anonymous_board`, `Refrigerator_recipe`)가 모두 **Express 5 + pg + React CDN** 패턴으로 통일되어 있어, 일관성과 로컬 기동 단순성을 위해 같은 패턴을 따랐습니다.

- **Supabase Realtime → 4초 폴링**
  - 서버 측에서 Supabase Postgres에 `pg` 직접 연결(pooler)로 쿼리 → Realtime 채널을 쓰려면 `@supabase/supabase-js` 클라이언트를 프론트에 태우고 RLS/Realtime 설정을 별도로 세팅해야 함
  - 본 레포 기존 패턴에서는 서버 API를 경유하므로, 프론트에서 **가시성 이벤트 기반 4초 폴링**으로 “즉시 반영” 요건을 충족 (탭이 background일 때는 폴링 중단)
  - 낙관적 업데이트로 본인 투표는 0ms 반응
- **React Query → useEffect + fetch 경량화**
  - 단일 HTML 파일에서 돌아야 하므로 빌드리스 패턴에 맞게 바닐라 훅으로 구현

---

## 3. 데이터베이스 설계

### 3-1. 테이블

```sql
CREATE TABLE public.mb_questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_a   TEXT NOT NULL,
  option_b   TEXT NOT NULL,
  category   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.mb_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.mb_questions(id) ON DELETE CASCADE,
  choice      CHAR(1) NOT NULL CHECK (choice IN ('A','B')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mb_questions_created_idx ON public.mb_questions (created_at DESC);
CREATE INDEX mb_votes_question_idx    ON public.mb_votes (question_id);
```

- PRD의 `questions / votes` 테이블명은 이미 공용 DB에 다른 프로젝트가 쓸 여지가 있어 **`mb_` 접두사**로 네임스페이스를 분리
- `ON DELETE CASCADE`로 질문 삭제 시 투표 동시 삭제
- `CHECK (choice IN ('A','B'))` 로 DB 레벨 무결성 확보
- 테이블/확장(`pgcrypto`)은 서버 부팅 후 첫 API 호출에서 `initDB()` 일회성 실행

### 3-2. 집계 쿼리

프론트가 표수를 한 번의 호출로 받을 수 있게, 모든 조회에서 `LEFT JOIN mb_votes + SUM(CASE ...)` 집계 컬럼 포함:

```sql
SELECT q.id, q.option_a, q.option_b, q.category, q.created_at,
       SUM(CASE WHEN v.choice='A' THEN 1 ELSE 0 END) AS votes_a,
       SUM(CASE WHEN v.choice='B' THEN 1 ELSE 0 END) AS votes_b,
       COUNT(v.id)                                    AS total_votes
FROM public.mb_questions q
LEFT JOIN public.mb_votes v ON v.question_id = q.id
GROUP BY q.id
ORDER BY <정렬 기준>
LIMIT 200;
```

정렬 기준:
- `sort=recent` → `q.created_at DESC` (기본)
- `sort=popular` → `total_votes DESC, q.created_at DESC`

---

## 4. API 설계

| Method | Path | 설명 |
| :--- | :--- | :--- |
| GET | `/api/questions?sort=recent\|popular&category=` | 목록 (집계 포함) |
| GET | `/api/questions/:id` | 단건 (집계 포함) |
| POST | `/api/questions` | 질문 생성 |
| POST | `/api/questions/:id/vote` | 투표 (A 또는 B) |
| DELETE | `/api/questions/:id` | 질문 삭제 (투표도 CASCADE 삭제) |

- 응답 포맷 통일: `{ success: boolean, data?: ..., message?: ... }`
- 검증 규칙
  - `option_a`, `option_b`: 필수, 1~160자
  - `category`: 화이트리스트 (`CATEGORIES` 상수 매칭)
  - `choice`: 대문자 변환 후 `A|B`만 허용
  - `id`: UUID 정규식 선검증

---

## 5. UI / 디자인 결정

### 5-1. 무드
Yakult SM-15 매거진 톤을 참고한 에디토리얼 디자인:
- 크림 페이지 `#fbf5e6`, 잉크 `#181511`, 헤어라인 `#e8dfc8`
- **굵은 Pretendard 900 헤드라인** + 본문 Pretendard 400/500
- 1.5px 검정 테두리 + 점선 이중 외곽선(`stamp` 클래스) 으로 ‘우표/카드’ 질감
- 그림자 X, 평면 레이아웃

### 5-2. 컬러 코드
| 역할 | 컬러 | 쓰임새 |
| :--- | :--- | :--- |
| A 사이드 | `#ff5c3a` (vermilion) | A 리본, 바 채움, 퍼센트 강조 |
| B 사이드 | `#2f6bff` (royal blue) | B 리본, 바 채움, 퍼센트 강조 |
| Accent | `#7de2b9` (mint) | 주요 CTA 버튼 (`질문 올리기`) |
| Warm highlight | `#fff9d9` | 선택된 타일 배경 |

A vs B 색상을 서로 보색 계열로 두어 결과 그래프가 바로 읽히도록 설계.

### 5-3. 인터랙션
- 투표 전: 카드 hover 시 살짝 위로 뜨고(translateY -2px), 배경이 크림으로 변함
- 투표 순간: 선택한 리본이 0.32s `pop` 애니메이션, 바가 0.6s cubic-bezier로 채워짐
- 투표 후: 두 타일 모두에 퍼센트/표수 표시, 리드(Lead) 배지가 우세쪽에 붙음
- 우측 상단 `● LIVE` 펄스 애니메이션으로 실시간 상태 강조

### 5-4. 중복 투표 방지
- 브라우저별 `localStorage['mb_voted']` 에 `{questionId: 'A'|'B'}` 저장
- 서버는 무제한 허용 → 프론트에서 막음 (PRD가 “로컬 스토리지 또는 IP” 중 선택이라고 명시)
- 제약 인지: 다른 브라우저/시크릿창에서 재투표 가능 (PRD 범위 허용)

---

## 6. 실시간 반영 전략

1. 첫 마운트에서 `/api/questions` 1회 조회
2. `setInterval(4000)` 로 **가시성 체크 후** 재조회
   - `document.visibilityState === 'visible'` 일 때만 호출
   - 탭 숨김 시 무음 → 불필요한 Supabase 풀 커넥션 소모 방지
3. 본인 투표는 **낙관적 업데이트**로 즉시 UI 반영 후 서버 응답으로 정정
4. 실패 시 `setItems` 롤백 + LocalStorage 엔트리 제거

폴링 주기 4초 결정 근거:
- 평균 투표 간격을 수 초 단위로 가정
- 1초는 과도, 10초는 “실시간” 체감 저하
- Supabase 무료 티어에서도 부담스럽지 않은 빈도

---

## 7. 스모크 테스트 기록

로컬에서 `PORT=4328 node server.js` 기동 후:

| 시나리오 | 기대 | 결과 |
| :--- | :--- | :--- |
| GET 빈 목록 | `{"data":[]}` | ✅ |
| POST 질문 생성 | `201 + 집계 0` | ✅ |
| POST 투표 A | `votes_a=1, total=1` | ✅ |
| POST 투표 B ×2 | `votes_b=2, total=3` | ✅ |
| GET 인기순 | 방금 표수 반영된 항목 반환 | ✅ |
| GET 카테고리 필터 | 해당 카테고리만 반환 | ✅ |
| POST 잘못된 카테고리 | `400 "카테고리를 선택해주세요"` | ✅ |
| POST 빈 선택지 | `400 "두 선택지를 모두 입력해주세요"` | ✅ |
| POST 투표 choice=C | `400 "choice는 A 또는 B"` | ✅ |
| POST 투표 invalid UUID | `400 "잘못된 id"` | ✅ |
| DELETE 질문 | `200 {success:true}`, 이후 목록 빔 | ✅ |
| GET / | `200` (index.html 28KB) | ✅ |
| GET /some/deep/route (SPA fallback) | `200` (index.html) | ✅ |

---

## 8. 로컬 실행 방법

```bash
cd week-4/Quest/balance_Game
npm install
PORT=4328 node server.js
# → http://localhost:4328
```

환경변수를 분리하고 싶다면:

```bash
cp .env.example .env
# .env 안에 DATABASE_URL, PORT 수정
node server.js
```

---

## 9. 남은 과제 (nice-to-have)

- [ ] Supabase Realtime 채널로 교체 (현재 4초 폴링 → `WebSocket` 구독)
- [ ] IP 해시 기반 중복 투표 방지 보강 (현재 LocalStorage only)
- [ ] 공유용 퍼머링크 (`/q/:id`) + OG 이미지 자동 생성
- [ ] 관리 화면에서 부적절 질문 신고/숨김
- [ ] 모바일용 스와이프 투표 제스처

---

## 10. 변경 이력

| 날짜 | 버전 | 내용 |
| :--- | :--- | :--- |
| 2026-04-21 | 1.0 | 초기 구현 — 질문 CRUD, A/B 투표, 카테고리 필터, 인기/최신 정렬, 4초 폴링, LocalStorage 중복방지, Yakult 무드 에디토리얼 UI |
