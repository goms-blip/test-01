# 🌍 행복을 찾아 떠나는 여행 — 작업 진행 로그

> **목표**: PRD에 따라 AI Context(.md) + Supabase DB를 결합한 초개인화 여행 추천 에이전트를 구현하고, 시스템 프롬프트(=컨텍스트) 유무에 따른 답변 차이를 비교 시연한다.

작업 시작/완료: **2026-04-30**
프로젝트 루트: `week-5/quest/나를아는AI에이전트/`

---

## 1. PRD 핵심 정리

| 항목 | 결정 |
|---|---|
| 프로젝트명 | 행복을 찾아 떠나는 여행 |
| 핵심 가치 | "데이터(DB)는 행동을 말하고, 컨텍스트(Context)는 정체성을 정의한다." |
| 데이터 컬럼 | `id`, `created_at`, `category`, `content`, `value(행복지수)` (+ 보조: `location`, `trip_id`) |
| 비교 시연 | Before(컨텍스트 OFF) → 일반론 / After(컨텍스트 ON) → 초개인화 |
| 대표 시나리오 | "여지껏 다녀온 여행지중에 가장 좋았던 곳은?" → "홋카이도 (눈·겨울)" |

### 페르소나 (요약)
- 30대 후반, 서울 거주, IT PM
- **좋아함**: 눈, 겨울, 일본, 료칸 온천, 라멘, 조용한 동네
- **싫어함**: 더운 동남아, 인파 많은 관광지, 우기
- **독특한 제약 (PRD 팁 반영)**:
  - 비행시간 6시간 초과 여행은 가지 않는다 (장거리 비행 멀미)
  - 같은 도시는 3년 안에 다시 가지 않는 것을 원칙으로 한다 (단, 홋카이도 예외)

---

## 2. 파일 구조 (최종)

```
week-5/quest/나를아는AI에이전트/
├── prd.md                # 🎯 (제공됨)
├── context.md            # 🧭 AI Context — 사용자 정체성 (시스템 프롬프트)
├── schema.sql            # 🗄️ Supabase 테이블 + 분석 뷰 3개
├── seed.sql              # 🌱 9 trips × 65 records
├── data.js               # 📦 오프라인 시드 (seed.sql과 1:1)
├── agent.js              # 🤖 Intent 라우터 + Before/After 분기
├── index.html            # 💬 채팅 UI + 컨텍스트 토글 + 비교 모드
├── README.md             # 📖 프로젝트 개요
├── SETUP.md              # ⚙️ Supabase + LLM 연결 가이드
├── WORKLOG.md            # 📝 ← 이 문서
└── screenshot/           # 🖼️ 검증 스크린샷
    ├── 00-initial.png
    ├── 01-prd-best-place.png
    └── 02-southeast-asia-constraint.png
```

---

## 3. 단계별 진행

- [x] **STEP 0** — PRD 분석 / 페르소나·데이터 모델 설계
- [x] **STEP 1** — `context.md` 작성 (사용자 정체성)
- [x] **STEP 2** — `schema.sql` / `seed.sql` 작성 (Supabase 호환)
- [x] **STEP 3** — `data.js` 작성 (오프라인 동일 데이터)
- [x] **STEP 4** — `agent.js` 작성 (intent 라우터 + Before/After)
- [x] **STEP 5** — `index.html` 작성 (컨텍스트 토글 UI)
- [x] **STEP 6** — `README.md` / `SETUP.md` 작성
- [x] **STEP 7** — 로컬 서버 `python3 -m http.server 5173` + Chrome DevTools 검증

---

## 4. 의사결정 로그

### D-01. 데이터 컬럼 — `location`, `trip_id` 추가
**문제**: PRD §3은 `id, created_at, category, content, value` 5개만 명시. 그러나 "어느 여행에서 어떤 활동을 했는지"를 그룹핑하지 않으면 *같은 도시 3년 룰*, *방문 횟수*, *여행지별 평균 행복지수* 같은 분석을 할 수 없음.
**결정**: 보조 컬럼 2개 추가 (`location`, `trip_id`). PRD에 어긋나지 않으며, "기록 단위" 정의는 자유. README/WORKLOG에 명시.

### D-02. 행복지수(value)의 단위 — 0.0 ~ 10.0 (소수점 1자리)
**근거**: 정수 1~5는 변별력 부족, 1~100은 과한 정밀도. **9.5 vs 9.7 같은 미세한 차이**가 "노천탕 vs 스키" 같은 실제 선호 분기에서 의미를 갖도록 설계.

### D-03. Before/After 응답을 *동시에* 반환
**문제**: agent를 호출할 때마다 mode를 바꿔 두 번 호출하는 방식 vs 한 번 호출에 두 답변을 모두 반환하는 방식.
**결정**: `ask()`가 항상 `{ before, after }` 두 객체를 반환. UI 레이어에서 토글 상태에 따라 한쪽/양쪽을 렌더링. 비교 모드를 *기본 ON*으로 두어 PRD §4-3 "비교 시연 모드" 의도를 즉시 보여줌.

### D-04. After 답변에 항상 *근거 인용*을 포함
**근거**: PRD 팁 — "당신은 어제 ~를 했기 때문에 오늘 ~를 제안합니다"와 같이 DB 데이터를 구체적으로 언급하도록 유도. 모든 After 응답에 다음 중 하나 이상이 들어가도록 설계:
- 구체 row 인용 (날짜·내용·점수)
- SQL 쿼리 (접힘 details)
- 데이터 테이블
- 차트
- 컨텍스트 §섹션 번호 인용

### D-05. "동남아 추천해줘"에 *거절*도 가능
**근거**: 기존 챗봇 UX는 사용자 요청을 거절하지 않음. 그러나 컨텍스트의 §3-1 "더운 동남아 회피"와 DB의 다낭 평균 5.1점(최하위)이 명확하면 *거절 + 대안 제시*가 진짜 도움이 되는 답변. 이게 "정체성을 정의한다"의 가장 강력한 증거.

### D-06. 데모는 오프라인 + 실제는 Supabase 분리
**근거**: PRD가 Supabase를 명시하지만, 시연용 기본 환경은 *바로 동작*해야 함. `data.js`(오프라인) + `schema.sql`/`seed.sql`(실DB)을 둘 다 제공. SETUP.md에 LLM 연결 예시까지 포함해 확장 경로 명확화.

---

## 5. 검증 결과 (Chrome DevTools)

로컬 서버: `python3 -m http.server 5173` (백그라운드 유지)
URL: **http://localhost:5173/**

### 시나리오 검증 (4개)

| # | 질문 | Before 키워드 | After 키워드 | 결과 |
|---|---|---|---|---|
| 1 | 여지껏 다녀온 여행지 중에 가장 좋았던 곳은? *(PRD 대표)* | "동남아·따뜻한 휴양지 일반적으로…" | **"홋카이도 압도적 1위, 평균 9.4/10"** + 9.5+ 순간 5개 인용 | ✅ |
| 2 | 동남아 추천해줘 *(제약 검증)* | 태국·베트남·발리·필리핀 추천 | **"추천드리지 않습니다"** + 다낭 평균 5.1 + 컨텍스트 §3-1 인용 + 대안 | ✅ |
| 3 | 이번 겨울에 어디 갈까? | "겨울 = 따뜻한 곳으로 피난" | **"답이 정해져 있어요. 홋카이도. 평균 9.4"** + 3가지 시나리오 | ✅ |
| 4 | 교토 다시 가도 될까? *(재방문 룰)* | "좋은 여행지예요" | **"⛔ 17개월밖에 안 됐어요, §3-3 룰 위반"** | ✅ |

모든 답변에 SQL/advice 포함 확인.
콘솔 에러: favicon 404 1건만 (무해).

### 스크린샷
- `screenshot/00-initial.png` — 초기 채팅 화면
- `screenshot/01-prd-best-place.png` — PRD 대표 시나리오 좌우 비교
- `screenshot/02-southeast-asia-constraint.png` — 제약 검증 시나리오

---

## 6. PRD 충족 매트릭스

| PRD 항목 | 구현 | 비고 |
|---|---|---|
| §1 핵심 가치 | ✅ | 모든 화면 하단 advice-box에 "데이터=행동, 컨텍스트=정체성" 명시 |
| §2 사용자 페르소나 | ✅ | `context.md` — 기본정보·관심사·제약·루틴 |
| §3 데이터 구조 | ✅ | `schema.sql` — id/created_at/category/content/value (+ location, trip_id 보조) |
| §4-1 맥락 기반 분석 | ✅ | `agent.js` 모든 intent에서 DB 집계 + 컨텍스트 대조 |
| §4-2 맞춤형 추천 엔진 | ✅ | "다음 여행 어디?" intent에서 4가지 제약 + 평균 8.5+ 필터 + 미경험 후보 |
| §4-3 비교 시연 모드 | ✅ | 좌우 분할 UI (Before/After) + 토글 |
| §5 시나리오 | ✅ | 첫 추천 질문 버튼이 PRD 정확한 문장 |
| §6 기술 스택 | ✅ | Supabase 호환 SQL + LLM(Claude/OpenAI) 연결 가이드 SETUP.md |
| 💡 팁 — 독특한 제약 1~2개 | ✅ | "비행 6h 초과 X" + "같은 도시 3년 내 재방문 X (홋카이도 예외)" |
| 💡 팁 — DB row 구체 인용 | ✅ | After 응답이 *반드시* 날짜·내용·점수 또는 SQL 인용 |

---

## 7. 다음 단계 (확장 아이디어)

- [ ] 실제 Supabase 프로젝트에 schema/seed 적용 후 `agent.js` 의 `ROWS()`를 fetch로 교체
- [ ] OpenAI/Claude 연결 — `context.md` 전체를 system message로 직접 주입 (캐싱 활용)
- [ ] "방금 다녀온 여행 기록하기" 폼 → DB INSERT
- [ ] `pgvector`로 content 임베딩 → "비슷한 활동" 추천
- [ ] 컨텍스트(.md)를 LLM이 요약/갱신하는 self-updating 패턴

---

## 8. 리디자인 — Week-4 미니멀 톤 적용 (2026-05-01)

**동기**: 사용자가 "4주차에 했던 과제처럼 디자인을 바꿔달라"고 요청.
**참고**: `week-4/Quest/quest_all/assets/css/common.css` — 흑백 + Pretendard + 직각(radius 0) + 큰 타이포 + border 기반 카드.

### 변경 요약 (index.html만 교체, agent.js / data.js 그대로)

| 영역 | Before (다크 챗봇) | After (Week-4 미니멀) |
|---|---|---|
| 컬러 | 다크 패널, 오렌지/그린 액센트 | 흰 배경 + 검정 ink, 라인 베이스 |
| 폰트 | system-ui | **Pretendard** (Week-4와 동일) |
| Radius | 8~14px | **0** (직각 미학) |
| 레이아웃 | 사이드바 + 채팅 | **Hero + Stats Bar + Console + How it works + Footer** 풀랜딩 |
| Before/After | 좌우 같은 다크 톤 + 경계만 다름 | **Before = 흰 카드 / After = 검정 인버트 카드** (대비 강화) |
| Hero | 없음 | "나를 아는 AI는 일반론을 말하지 않는다" + Q01 미리보기 비주얼 |
| 추천 질문 | 사이드바 칩 | **그리드 셀** (라벨 + 질문 두 줄) |
| Composer | 둥근 input + gradient 버튼 | 직각 박스 + 검정 Ask 버튼 (hover 인버트) |

### 핵심 디자인 결정
- **Before · After 시각 대비**를 컬러 자체로 표현 — 흰/검정 인버트가 4주차의 `card hover` 패턴(검정 → 흰 reverse)을 그대로 차용한 것이라 시리즈 일관성 + 메시지 임팩트 동시 달성.
- Hero 우측 비주얼은 4주차 `quest_all`의 hero-visual 패턴을 **PRD §5 시나리오 미리보기**로 재활용 (Before/After 두 줄을 즉시 노출).
- "How it works" 3-step 카드의 마지막 step만 검정 배경 — Personalized Answer가 결국 도달점이라는 시각적 강조.

### 검증 (Chrome DevTools)
- ✅ Hero 정상 렌더 (`screenshot/redesign-01-hero.png`)
- ✅ PRD 시나리오 클릭 → Before(흰)/After(검정) 비교 카드 정상 (`screenshot/redesign-02-compare-card.png`)
- ✅ 추천 질문 6개 모두 `data-q` 매칭 OK
- ✅ 컨텍스트 토글, Compare 토글 양방향 동작
- ✅ 콘솔 에러: favicon 404 1건만 (무해)

---

## 9. 실행 방법

```bash
cd week-5/quest/나를아는AI에이전트
python3 -m http.server 5173
# → http://localhost:5173/
```

핵심 인터랙션: **좌측 상단 컨텍스트 토글**을 끄면 같은 질문에 일반론 답변이 나오고, 켜면 *나만의 데이터 기반* 답변이 나오는 차이를 한눈에 확인할 수 있습니다.
