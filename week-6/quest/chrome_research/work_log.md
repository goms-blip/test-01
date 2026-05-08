# work_log.md — chrome_research 작업 과정 기록

| 항목 | 값 |
|---|---|
| 작업 일자 | 2026-05-05 |
| 작업자 | Claude Code (Opus 4.7, 1M context) |
| 입력 | `week-6/quest/personal_project/` (MISSION.md, dev.md 등) + `week-6/quest/chrome_research/prd.md` (빈 템플릿) |
| 출력 | `chrome_research/research.md`, `chrome_research/prd.md` (채움), `chrome_research/work_log.md` (이 문서), `chrome_research/screenshots/*.png` (4장) |

## 1. 요청 해석

> "week-6/quest/personal_project를 바탕으로 week-6/quest/chrome_research에 있는 prd.md 문서를 실행해줘. 이 폴더에 research.md 파일을 만들어주고 작업 과정을 md 파일로 만들어줘."

해석:
- prd.md는 placeholder가 가득한 PRD **템플릿**이고, 그중 §3이 "**research.md 요약**"으로 명시되어 있다 → research.md를 먼저 만들고 그 결과로 prd.md를 채워야 한다.
- 폴더 이름이 `chrome_research`이므로 **Chrome으로 실제 경쟁사 사이트를 방문해 리서치하는 것**이 맞다 → Chrome DevTools MCP 사용.
- 작업 과정 기록 → 별도 work_log.md.

## 2. 입력 자료 검토

읽은 파일:
- `personal_project/MISSION.md` — "초보자를 위한 베이킹 재료 사전" 미션. 페르소나 민지(27세, 회사원). 차별화 4종(비교 모드, 3초 검색, 초보자 실수 항목, 시각 통일감). 경쟁 분석 섹션에 6개 대안군 명시(레시피 포털·유튜브·블로그/카페·제분소·해외 사전·LLM).
- `personal_project/dev.md` — Next.js + Supabase 결정·30개 재료 스키마 등 기술 사항. 본 작업의 PRD 해석에 직접 영향 없음(기술 결정은 PRD 외부에 있음).
- `chrome_research/prd.md` — 6개 섹션 템플릿. §3 비교표가 핵심 채움 대상.

## 3. 경쟁사 3사 선정 (PRD §3 = 4열 비교표 구조에 맞춤)

MISSION의 6개 대안군 → PRD 표가 요구하는 3개 슬롯(국내/해외/인접)으로 압축:

| PRD 슬롯 | 선정 | 이유 |
|---|---|---|
| 경쟁사 A (국내) | 만개의레시피 | 트래픽 1위(269,326개 레시피·월 916만 방문자), 한국 사용자가 "박력분 뭐지?" 처음 마주치는 곳 |
| 경쟁사 B (해외) | King Arthur Baking | 베이킹 도메인 표준, 본 앱이 만들 "재료 사전" 글로벌 레퍼런스 |
| 경쟁사 C (인접) | Naver 블로그/카페 + LLM 직접 질문 | MISSION이 LLM을 "가장 큰 경쟁자"로 명시, 사용자가 답을 얻는 마지막 마일 |

베이킹 유튜브와 제분소 사이트는 PRD 비교표가 요구하는 4열 구조와 정성/정량 분석에 적합하지 않아 별도 분석 대신 시간 비교 지표·언급으로만 반영.

## 4. 실제 리서치 절차 (Chrome DevTools MCP)

### 4.1. 만개의레시피 (경쟁사 A)

| 단계 | 도구 | 결과 |
|---|---|---|
| `https://www.10000recipe.com/recipe/list.html?q=박력분` 방문 | `mcp__chrome-devtools__new_page` | 페이지 로드 성공 |
| 풀페이지 스크린샷 | `mcp__chrome-devtools__take_screenshot` (fullPage:true) | `screenshots/01_10000recipe_search_bakryeokbun.png` 저장 |
| 페이지 a11y 스냅샷 | `mcp__chrome-devtools__take_snapshot` | **결정적 발견**: "박력분"으로 검색 시 결과가 13건이며 모두 *박력분을 사용한 레시피*. 박력분이 무엇인지 설명하는 페이지는 0건. 광고 iframe 다수(Google Ads, Quantcast). |

핵심 발견: 검색 파라미터가 "재료를 사용한 레시피"로만 폴백. 재료 사전 기능 구조적으로 부재.

### 4.2. King Arthur Baking (경쟁사 B)

| 단계 | 도구 | 결과 |
|---|---|---|
| `https://www.kingarthurbaking.com/learn/ingredient-weight-chart` 방문 | navigate | 정상. 무게 환산표만 있음 |
| `https://www.kingarthurbaking.com/learn/guides/cake-flour` (재료 단독 사전 페이지 추정) | navigate | **404 Not Found** — 단일 재료 단독 사전 페이지 부재 확인 |
| 풀페이지 스크린샷 | take_screenshot | `screenshots/02_kingarthur_ingredients.png`, `screenshots/03_kingarthur_guides_index.png` |
| `/learn/guides` 인덱스 구조 추출 | WebFetch (구조화 질의) | 가이드 단위가 **재료가 아닌 토픽** (Scone Baking, Sourdough Baking, Bundt Cake 등). 재료 정보는 e-commerce 카테고리(Flours, Sugars & Decorations 등)와 가이드 본문에 분산. 한국어 미지원 확인. AI 챗봇 "Ask Merlin" 출시 메뉴 발견. |

핵심 발견: 글로벌 베이킹 표준조차 "재료 1개 = 1페이지 정형 사전" 포맷이 없다. 게다가 영어 전용·미국 마트 컨텍스트.

### 4.3. Naver 블로그/카페 + LLM (경쟁사 C)

| 단계 | 도구 | 결과 |
|---|---|---|
| `https://search.naver.com/search.naver?query=박력분+중력분+강력분+차이` 방문 | navigate | 페이지 로드 성공 |
| 풀페이지 스크린샷 | take_screenshot | `screenshots/04_naver_search_flour_diff.png` |
| a11y 스냅샷 | take_snapshot | **75,698 자**로 한 번에 컨텍스트에 못 담음 → 임시 파일로 저장됨. `grep`으로 슬롯 분석 (Bash 사용)<br>**결정적 발견**: 1페이지 상위 슬롯 1~5가 광고(`ader.naver.com` powerlink: G마켓·진보람몰·에누리). 슬롯 6 이후가 실제 블로그(orbit_zip, sybaker4949 등). 답을 보려면 광고 4~5건 통과 필요. |

LLM(ChatGPT/Claude) 직접 질문 부분은 사이트 캡처가 비로그인 상태에서 제한되어, MISSION.md가 명시한 위협 + 일반화된 LLM 행태(답변 일관성 부재·할루시네이션·한국 마트 정보 부정확·비교 화면 부재)를 정성 분석으로 다뤘다. 이 한계는 research.md §3-2 서두에 명시했다.

### 4.4. 도구 선택 근거

- **Chrome DevTools MCP** (벼락치기로 텍스트만 보지 않고 실제 화면을 봄) — 광고 위치, 본문 흐름, 404 여부 같은 "PRD에 인용 가능한 사실"을 직접 확인하기 위함.
- **WebFetch** — King Arthur의 사이트 구조 같은 거시 정보를 한 번에 요약 받기 위해.
- **Bash + grep** — Naver 스냅샷이 컨텍스트 한계를 초과했을 때 키워드 기반으로 슬롯 분석.

## 5. 의사결정 (research.md → prd.md 매핑)

| 결정 | 근거 |
|---|---|
| 슬로건 채택: "한국 초보자가 3초 안에 답을 얻는 베이킹 재료 사전 — 9개 항목·비교 모드 내장" | research.md §5 #1 — 3개 후보 중 3사의 약점을 가장 정면으로 압축 |
| 페르소나는 MISSION의 민지를 그대로 사용 | 본 리서치가 민지의 행동(검색→광고→블로그→포기)을 사실로 확인. 새 페르소나 만들 이유 없음 |
| 차별화 3대(9항목 정형·비교 모드·한국 마트) | research.md §4 통합 비교표에서 3사 모두 ❌ 또는 △로 확인된 슬롯 |
| 응답 속도 3초 KPI 유지 | research.md §3-1.2, §3-2.1에서 블로그·LLM 30초~3분 확인 → 정면 비교 가치 있음 |
| 광고 0·결제 0 (완전 무료) | research.md §5 #5 — 3사 수익 모델(광고/e-comm/검색광고)과 차별화하려면 v1은 광고 0이 일관됨 |

## 6. 생성된 파일 (최종 산출물 목록)

```
week-6/quest/chrome_research/
├── prd.md                         # ← 채워진 PRD
├── research.md                    # ← 경쟁사 3사 상세 리서치
├── work_log.md                    # ← 이 문서
└── screenshots/
    ├── 01_10000recipe_search_bakryeokbun.png   # 만개의레시피 "박력분" 검색 결과
    ├── 02_kingarthur_ingredients.png           # King Arthur ingredient-weight-chart / 404 페이지
    ├── 03_kingarthur_guides_index.png          # King Arthur 가이드 인덱스
    └── 04_naver_search_flour_diff.png          # Naver "박력분 중력분 강력분 차이" 검색
```

## 7. 한계 및 후속 권고

- **LLM 사이트 직접 캡처 미수행** — ChatGPT·Claude·Naver Cue는 로그인·정책상 비로그인 캡처 제한. 정성 분석으로 대체했고 research.md §3-2 서두에 명시. 추가 검증이 필요하면 사용자가 본인 계정으로 동일 질의를 1회 수행해 답변 구조 일관성을 직접 확인하는 것이 가장 빠르다.
- **Sally's Baking Addiction 등 추가 해외 사전 미방문** — King Arthur가 해외 표준이라 1개로 압축. v1.5 해외 확장 검토 시 보강.
- **수치 KPI(3초·270칸·30%)** — research.md에서 LLM 30초~3분이라는 비교 기준은 업계 일반화이지 본 앱 자체 측정값은 아니다. v1 출시 시점에 페르소나 시나리오 실측으로 갱신 필요(MISSION.md 데모데이 체크리스트에 이미 포함됨).
