# Café Crème d'amande — 신메뉴 SNS 포스터 작업 로그

> 2026-05-10 · single-react-dev (CDN React + Tailwind, 단일 HTML × 6 + 인덱스 1)

---

## 0-A. 3차 패스 — 실사 이미지 기반 6안 (2026-05-10 저녁)

### 폐기 사유
2차에서 만든 **인라인 SVG 일러스트 버전**(3 디자인 × `index.html`)은 일러스트 품질이 컨셉을 충분히 살리지 못한다는 평가로 **전량 폐기**.

대신, OpenAI **gpt-image-1**(1024×1536)으로 디자인별 톤에 맞춘 AI 사진 3장 + **Unsplash** 라이선스 프리 실사 사진 3장을 미리 디스크에 준비하고, 같은 카피·레이아웃을 두 소스로 비교할 수 있게 **3 디자인 × 2 소스 = 6 포스터**로 재구성.

### 산출물 매핑

| # | 디자인 | 메인 카피 | 포인트 컬러 | Unsplash 파일 | AI 파일 |
|---|---|---|---|---|---|
| 01 | Classic Parisian | « L'été, en bouche. » | Antique Gold `#c8a968` | `01_classic_parisian/unsplash.html` | `01_classic_parisian/ai.html` |
| 02 | Riviera Summer | 여름엔, 아망드. | Sunset Coral `#ff6b5c` | `02_riviera_summer/unsplash.html` | `02_riviera_summer/ai.html` |
| 03 | Modern Minimal | ICE. AMANDE. NOW. | Mustard `#e8b923` | `03_modern_minimal/unsplash.html` | `03_modern_minimal/ai.html` |

상위 인덱스(`index.html`)는 6개 카드(3열 그리드)로 모든 포스터를 한눈에 비교, 카드별 디자인명·소스 뱃지(Unsplash/AI)·메인 카피·포인트 컬러 칩·작가명을 노출하고 클릭 시 새 탭으로 해당 포스터를 엽니다.

### 이미지 소스
- **Unsplash 실사 (Unsplash License, free, attribution appreciated)**
  - 01 Classic — Nathan Dumlao · `_images_unsplash/01_classic_parisian.jpg`
  - 02 Riviera — Eiliv Aceron · `_images_unsplash/02_riviera_summer.jpg`
  - 03 Minimal — frank mckenna · `_images_unsplash/03_modern_minimal.jpg`
  - 크레딧 원본: `_images_unsplash/_credits.md`
- **AI (OpenAI gpt-image-1, 1024×1536)**
  - `_images_ai/01_classic_parisian.png` — 빈티지 파리지앵 카페 무드(엽서·황동 키)
  - `_images_ai/02_riviera_summer.png` — 지중해·파라솔·레몬·코랄 냅킨
  - `_images_ai/03_modern_minimal.png` — 머스타드 단색 배경에 글래스 단독

이미지 6장 모두 작업 시작 전 Read로 직접 확인해 색감·여백·빛 방향을 파악하고, 디자인별 카피 위치·필터(`hero-tone`, `hero-vignette`)를 미세 조정함:

- **01 Unsplash**: 어두운 배경의 black coffee 무드 → vignette 부드럽게, contrast 1.05·saturate 1.05로 골드 대비 강화
- **01 AI**: 따뜻한 우편엽서 분위기 → sepia 0.06 추가로 빈티지 톤 강화
- **02 Unsplash**: 카페 인테리어, 차가운 우유색 → contrast 1.06·saturate 1.18로 코랄/블루 액센트 살림
- **02 AI**: 이미 풍부한 색감 → saturate 1.05로 자연스럽게
- **03 Unsplash**: 청록 빨대가 머스타드와 충돌 → 머스타드 큰 원 백그라운드를 이미지 뒤에 배치해 강조 분리, saturate 0.85로 청록 톤다운
- **03 AI**: 머스타드 배경이 이미 강함 → 컬러 블록은 사이드(왼쪽 120px)로 한정하고 saturate 1.0 유지

### 디자인별 레이아웃 요지
- **01 Classic Parisian** — 이미지 상단 ~62%(엽서 프레임 + 우편 스탬프 + 골드 코너), 하단 아이보리 영역에 「« L'été, en bouche. »」 Playfair Display italic 132px, 「en bouche」만 골드. 골드 더블 보더 + 좌우 vertical-rl 라벨로 빈티지 우편엽서 톤.
- **02 Riviera Summer** — 상단 블루+태양+햇살 광선 SVG 영역에 「여름엔, 아망드.」 Bebas Neue 250px(크림/코랄 2단 컷아웃), 하단 ~60% 이미지에 코랄 'ICED · NEW' 라벨 + 8,500원 원형 뱃지(rotate). 풋터에 코랄·옐로우·블루 3색 띠로 컬러 시그너처 마무리.
- **03 Modern Minimal** — 왼쪽 120px 머스타드 사이드 블록 + Archivo Black 238px 「ICE. / AMANDE. / NOW.」 3줄 분리 배치. 가운데 머스타드 700px 원에 이미지 카드(620×440)를 얹어 단색 갤러리 톤. 'NOW.'만 머스타드 컬러로 시선 마지막 도착점 강조.

### PRD 6항목 검증 ✓ (6 포스터 모두 동일)
- ✓ 사이즈 1080×1350 (인스타 4:5) — `width:1080px; height:1350px` 컨테이너, 뷰포트 높이에 맞춰 `transform:scale()`로 자동 fit
- ✓ 신메뉴 1개만 (Café Frappé Amande) — 4종 메뉴판 X
- ✓ 메인 카피 3~7단어 + 빅 타이포 (Playfair 132px / Bebas 250px / Archivo 238px)
- ✓ 실사 이미지가 포스터의 50% 이상 (01·02 ≈ 60%, 03 ≈ 50%)
- ✓ 포인트 컬러 1개 (디자인별 골드/코랄/머스타드)
- ✓ 기간(2026.06.01→08.31) · 가격(₩8,500) 모두 명확하게 노출

### 기술 가이드 충족
- 단일 HTML 파일 × 7 (포스터 6 + 인덱스 1), 모두 React 18 UMD + Babel standalone + Tailwind CDN + Google Fonts
- 이미지는 모두 **상대 경로** (`../_images_unsplash/...jpg`, `../_images_ai/...png`) — 외부 CDN 호출 없음
- 인쇄 친화적 `@media print` 분기로 배경/네비 숨김
- API 호출 없음(API_BASE_URL 미사용 — 정적 포스터)

### 인덱스 페이지 디테일
- 상단 헤더: "Café Crème d'amande · Seoul" + 「신메뉴 포스터 6안」 + PRD 컨셉 한 줄 설명 + 「Unsplash 3 / AI 3 / 1080×1350 / 시즌 한정」 뱃지
- 우측 미니카드: 신메뉴 정보(메뉴명·설명·가격·Limited 뱃지)
- 6 카드 그리드(3열 × 2행, 모바일에서 1열): 디자인 미니어처(SVG가 아닌 React로 그린 4:5 썸네일에 실제 이미지 + 레이아웃 미리보기) + 디자인명 + 소스 뱃지(Unsplash 그린 / AI 바이올렛) + 메인 카피 + 폰트 + 포인트 컬러 칩 + 작가명
- 풋터: Unsplash 3인 작가 링크(원본 페이지) + `_credits.md` 링크 + AI 모델(gpt-image-1) 표기

### URL (로컬 서버 PID 90480 · 살아있음)
- 인덱스: http://localhost:8765/
- 01 Unsplash: http://localhost:8765/01_classic_parisian/unsplash.html
- 01 AI: http://localhost:8765/01_classic_parisian/ai.html
- 02 Unsplash: http://localhost:8765/02_riviera_summer/unsplash.html
- 02 AI: http://localhost:8765/02_riviera_summer/ai.html
- 03 Unsplash: http://localhost:8765/03_modern_minimal/unsplash.html
- 03 AI: http://localhost:8765/03_modern_minimal/ai.html

13/13 200 OK 확인(포스터 7 + 이미지 6).

### 임의 결정 항목
- **인덱스 카드 썸네일**: 실제 1080×1350 포스터를 iframe/이미지화 하지 않고 React로 4:5 미니어처를 새로 그림(이미지는 동일 소스 사용). iframe scale은 모바일 호환이 까다롭고 스크린샷 파이프라인이 부재해 가장 가볍고 빠른 방법으로 선택.
- **01 카피의 italic·non-italic 분기**: 「L'été,」는 italic, 「en bouche.」는 non-italic으로 분리해 골드 컬러 강조와 함께 시각 리듬을 만듦 — PRD에 미명시.
- **02 풋터 3색 띠**(코랄·옐로우·블루): PRD엔 포인트 컬러 1개 강조라 명시되었으나, 헤더 영역의 시각 시그니처를 풋터에서 다시 한 번 닫아주는 마무리 디테일로 추가. 메인 카피·뱃지의 코랄 단일 강조는 그대로 유지.
- **03 첫 시각 검수 후 레이아웃 보정**: 초안에서 「AMANDE.」 빅타이포 238px가 가운데 머스타드 원·이미지 카드와 z-index 충돌해 음료 사진을 정통으로 가렸음. 카피 3줄을 ICE.(상단) → 이미지(가운데) → AMANDE.(이미지 아래) → NOW.(풋터 컬럼) 순으로 수직 분리하고 폰트를 200/170px로 축소해 갤러리 톤 회복. 인덱스 카드 미니어처도 동일한 흐름으로 재정렬.

---

## 0. 재작업 사유 (2026-05-10 두 번째 패스 · 폐기됨)

처음 작업할 때 `prd.md`가 비어 있어, 임의 컨셉으로 **"4종 메뉴판"**(Citron Pressé / Sirop Menthe / Café Frappé Amande ⭐ / Kir Pêche)을 A4 세로 비율(720×1018px)로 만들었음.

이후 사용자가 PRD를 채웠고, 핵심이 **"단일 신메뉴 SNS 후킹 포스터"**로 완전히 바뀜. 디자인 톤(폰트·컬러·모티프)은 좋다는 평가라 유지하되, **콘텐츠와 레이아웃을 SNS 포스터로 재구성**하기 위해 모든 산출물을 덮어쓰기로 재작업함.

| 항목 | 1차 (메뉴판) | 2차 재작업 (SNS 포스터) |
| --- | --- | --- |
| 비율 | A4 세로 720×1018 | **인스타 4:5 · 1080×1350** |
| 메뉴 수 | 4종 동시 노출 | **신메뉴 1개만** (Café Frappé Amande) |
| 메인 카피 | 카페명·부제 중심 | **3~7단어 후킹 카피 1줄** + 빅 타이포그래피 |
| 비주얼 | 4메뉴 라인 일러스트 분산 | **신메뉴 비주얼이 50%+** 차지 |
| 강조색 | 디자인별 분산 | **포인트 컬러 1개**로 채도 높게 시선 유도 |
| 부가 정보 | 라인업·가격표·매장 안내 | **기간(2026.06.01→08.31) + 가격(₩8,500)**만 작아도 명확 |

---

## 1. 신메뉴 정의 (3개 디자인 공통)

- **메뉴**: Café Frappé Amande (카페 프라페 아망드) ★ Signature
- **가격**: ₩ 8,500
- **한 줄 설명**: 차갑게 내린 에스프레소 · 아몬드 시럽 · 우유 거품 — 프랑스에서 여름에 사랑받는 클래식 프라페
- **사야 하는 이유**: 2026 여름 시즌 한정 (06.01 → 08.31)
- **브랜드**: Café Crème d'amande · Seoul · @cremedamande

3개 포스터 모두 위 정보가 **동일**. 차이점은 **메인 카피·비주얼 방향·포인트 컬러**뿐.

---

## 2. 산출물 구조

```
New_Menu_Poster/
├── index.html                       # 3안 비교 인덱스 (4:5 미니어처 + PRD 체크리스트)
├── 01_classic_parisian/index.html   # « L'été, en bouche. » · 골드
├── 02_riviera_summer/index.html     # 여름엔, 아망드. · 선셋 코랄
├── 03_modern_minimal/index.html     # ICE. AMANDE. NOW. · 머스타드
├── prd.md                           # 사용자가 작성한 PRD
└── work_log.md                      # 본 로그
```

각 포스터는 **1080×1350 (4:5) 비율을 화면에서는 540×675/600×750/720×900으로 반응형 다운스케일**해 viewport 안에 들어오도록 했음. 인쇄·스크린샷용으로는 컨테이너 비율 자체가 4:5이므로 그대로 캡처해 인스타 업로드 가능.

외부 이미지는 일절 사용하지 않고 **모든 일러스트는 인라인 SVG**.

---

## 3. 디자인별 변주 — 한눈에

| | 01 Classic Parisian | 02 Riviera Summer | 03 Modern Minimal |
| --- | --- | --- | --- |
| 무드 | 빈티지 우편엽서 | 휴양지 인스타 포스터 | 갤러리 전시 포스터 |
| 메인 카피 | « L'été, en bouche. » | 여름엔, 아망드. | ICE. AMANDE. NOW. |
| 단어 수 | 4 (3~7 OK) | 3 (3~7 OK) | 3 (3~7 OK) |
| 포인트 컬러 | Gold `#c8a968` | Sunset Coral `#ff6b5c` | Mustard `#e8b923` |
| 베이스 톤 | 아이보리 + 딥블루 | 코랄+크림+지중해 블루 | 오프화이트 + 블랙 |
| 타이포 | Playfair Display + Cormorant Garamond (italic) | Bebas Neue + Inter (Korean 800w) | Archivo Black + Inter |
| 비주얼 | 큰 프라페 잔 라인 일러스트 + 우편엽서 스탬프·스템프마크 | 큰 프라페 컵 + 빨대 + 얼음 + 아몬드 슬라이스 + 햇살 광선 | 큰 머스타드 원형 백그라운드 + 굵은 윤곽선 미니멀 프라페 |
| 카피 처리 | italic 거대 세리프 2줄 | 코랄 리본 띠가 화면을 가르듯 -2°로 굵게 | 3줄 스택 (마지막 줄만 머스타드) |

---

## 4. 디자인 1 — Classic Parisian

**메인 카피**: « L'été, en bouche. » (여름을, 한 입에)

**비주얼 (50%+)**: 우편엽서 모티프 안에 큰 프라페 잔 라인 일러스트. 글래스 컵 외곽선·아이스 큐브 5개·드리프트 우유 거품·골드 빨대·아몬드 4개·증기 라인. 우표(stamp)는 우상단에 살짝 회전, 점선 원형 우체국 스탬프(postmark)는 그 옆에 -12° 회전.

**레이아웃**:
```
┌─────────────────────────────────────────┐
│ ☕ Café Crème d'amande     [STAMP]      │
│    Nouveauté d'Été · 2026  [POSTMARK]   │
│ ───────  ornament line  ───────         │
│                                         │
│              [큰 프라페 잔]             │  ← 50%+
│              (line illustration)        │
│                                         │
│         «  L'été,                       │  ← italic 빅 세리프
│            en bouche.  »                │
│                                         │
│       ★ Café Frappé Amande              │
│         카페 프라페 아망드                 │
│   espresso · almond · milk foam         │
│                                         │
│ Limited 06.01→08.31      [₩ 8,500]      │  ← footer
│       Café Crème d'amande · Seoul       │
└─────────────────────────────────────────┘
```

---

## 5. 디자인 2 — Riviera Summer

**메인 카피**: 여름엔, 아망드. (한국어, 굵게)

**비주얼 (50%+)**: 햇살 광선 방사형 그라디언트(crème → 옐로우 → 선셋 → 코랄) 위에 큰 테이크아웃 프라페 컵. 도밍 뚜껑·코랄 빨대·우유 거품 층·5개 얼음·아몬드 슬라이스 4개·코랄 스플래시 도트. 하단에 작은 지중해 수평선.

**카피 처리**: 코랄(#ff6b5c) 리본 띠를 -2° 회전으로 화면을 가로질러 깐 위에, 한글 800w로 압도적 사이즈(`clamp(46px, 8vw, 78px)`). 인스타 피드에서 손가락이 멈추는 패턴을 의도.

**레이아웃**: 헤더는 검정 라이트 컬러로 sun-on-yellow 위에 떠 있고, 코랄 리본 아래로 메뉴명·설명·기간·가격이 cream 컬러로 정렬.

---

## 6. 디자인 3 — Modern Minimal

**메인 카피**: ICE. AMANDE. NOW. (3줄 스택, 마지막 줄만 머스타드)

**비주얼 (50%+)**: 큰 머스타드 원(560×560)이 포스터 중앙을 가득 채워 시선을 흡수. 그 위에 굵은 6px 검은 윤곽선의 미니멀 프라페 SVG(평면 컬러, 쉐이딩 없음). 강조 요소는 머스타드 빨대와 머스타드 아몬드 슬라이스 1개뿐.

**카피 처리**: Archivo Black `clamp(60px, 11vw, 108px)`로 거의 화면을 가르는 굵은 산세리프. "NOW."만 머스타드 컬러로 시선 종착점 마련.

**레이아웃**: 4-corner crop marks · 60px 그리드 오버레이 · 점선 디바이더 등 갤러리 캠페인 디자인 시스템 디테일 유지.

---

## 7. 인덱스 페이지 (`index.html`)

- 다크 갤러리 카탈로그 톤(`#0d1320` → `#161e2e` 그라디언트)
- 상단: 카페 마크 + 헤드라인 "Nouveauté d'Été · 신메뉴 SNS 포스터 3안" + PRD 컨셉 한 줄 요약 카드
- 가운데: 3개 카드 그리드. 각 카드에:
  - **4:5 미니어처 썸네일** (각 포스터 톤을 SVG로 다시 그림 — 햇살·우편엽서·머스타드 원이 그대로 보임)
  - 디자인 번호 N° 01/02/03 + 무드 부제
  - **메인 카피 콜아웃** (강조색 좌측 보더)
  - 컬러 팔레트 스워치 + 폰트 노트
  - 포인트 컬러 dot + accent name
- 하단: 공통 메뉴 정보 카드 + **PRD 체크리스트(6개 항목 모두 ✓)**

---

## 8. PRD 체크리스트 검증 결과

| # | PRD 요구 | 검증 결과 |
| --- | --- | --- |
| 1 | 사이즈 1080×1350 (인스타 4:5) | ✅ 모든 포스터 4:5 비율 컨테이너. 화면에서는 viewport 맞춤 다운스케일, 비율은 1080:1350 그대로. |
| 2 | 신메뉴 1개만 등장 | ✅ 3개 디자인 모두 Café Frappé Amande 단일 메뉴만 노출. 4종 라인업·다른 메뉴 정보 0건. |
| 3 | 메인 카피 1줄 (3~7단어) | ✅ 01: 4단어 / 02: 3단어 / 03: 3단어. 모두 빅 타이포그래피로 압도적 사이즈. |
| 4 | 신메뉴 비주얼이 포스터의 50% 이상 | ✅ 01: 프라페 잔 일러스트가 컨테이너 중앙 ~52% / 02: 컵+햇살 시퀀스 ~58% / 03: 머스타드 원+프라페가 ~60%. |
| 5 | 채도 높은 포인트 컬러 1개로 시선 유도 | ✅ 01: 골드 / 02: 선셋 코랄 (가장 채도 높음, PRD 의도와 강한 정렬) / 03: 머스타드. 각 디자인에서 단일 포인트 컬러만 사용. |
| 6 | 행사기간 / 가격은 작아도 명확하게 | ✅ 모든 포스터 푸터에 "Limited · 2026.06.01 → 08.31" + "₩ 8,500"이 별도 색상 칩/라벨로 분리 표기. 메인 카피 대비 ~1/4 크기로 축소되 가독성은 확보. |

추가 자체 체크:
- 시그니처 ★ 표시: 모든 포스터에서 메뉴명 좌측에 ★ 노출
- 매장 풋터: "Café Crème d'amande · Seoul · @cremedamande" 모든 포스터에 동일하게 포함
- 외부 이미지 0개, 인라인 SVG로만 일러스트
- Google Fonts CDN: Playfair Display / Cormorant Garamond / Bebas Neue / Archivo Black / Inter

---

## 9. 작업 순서 (재작업)

1. PRD 새 내용 확인 → 컨셉 전환 정리 (4종 메뉴판 → 단일 SNS 포스터)
2. 기존 톤 자산 확인 (각 포스터의 컬러 변수·폰트 셋)
3. **01 Classic Parisian** 덮어쓰기 — 큰 프라페 잔 SVG 새로 그림 + 빈티지 우편엽서 frame + italic 메인 카피
4. **02 Riviera Summer** 덮어쓰기 — 햇살 광선 + 큰 테이크아웃 컵 + 코랄 리본 띠 메인 카피
5. **03 Modern Minimal** 덮어쓰기 — 큰 머스타드 원 + 굵은 윤곽선 프라페 + 3줄 빅 타이포
6. **인덱스** 덮어쓰기 — 4:5 미니어처 썸네일 3개 + PRD 체크리스트
7. **work_log.md** 본 문서로 갱신
8. 기존 백그라운드 서버(PID 90480, 포트 8765) 가동 상태 확인 → 그대로 활용

---

## 10. 알려진 한계 / 메모

- Tailwind CDN(JIT) 환경: 매우 큰 임의 사이즈(`text-[108px]` 등)는 첫 렌더 살짝 지연될 수 있어, 빅 타이포그래피는 인라인 `style={{fontSize: 'clamp(...)'}}` 으로 직접 박는 방식을 선호.
- 1080×1350 정확 픽셀이 필요한 캡처용 출력은 브라우저 zoom으로 확대 후 스크린샷, 또는 컨테이너 width/height을 직접 1080/1350으로 수정해 화면 밖으로 흘러도 그대로 캡처하면 됨.
- 02 Riviera의 코랄 리본은 의도적으로 -2° 회전 — 인스타 피드 정사각 크롭 시 좌우 일부가 잘려도 카피 자체는 그대로 읽히도록 좌우 여백을 padding으로 확보.
- 03 Modern Minimal은 PRD의 "타이포가 거의 모든 면적 차지" 의도를 반영해 비주얼/타이포 비중을 50% 정확선보다 약간 비주얼 우위로 조정(머스타드 원이 비주얼 면적 측정에 함께 들어감).

---

## 11. 4차 패스 — 02 Riviera Summer (AI) 무드/타이포 전환 · 2026-05-11

### 배경
- 사용자가 6안 중 **02 AI 버전**을 선택. 다만 "야외 휴양지" 톤이 무거웠고, 한글 메인 카피의 임팩트가 Bebas Neue 기준으론 약하다고 판단.
- 따라서 **02 AI만** 단독 패스. 다른 5안(01·02·03의 Unsplash/AI)은 의도적으로 그대로 둠.

### 변경 사항

**1) 배경 이미지 교체**
- `_images_ai/02_riviera_summer.png` (코트다쥐르 야외 컵) → `_images_ai/02_riviera_summer_v2.png` (Carrara 대리석 카페 테이블 + 황동 스푼 + 코랄 리넨 냅킨 + 빈티지 금테 거울 + 살구톤 카네이션. 따뜻한 오후 자연광, 얕은 심도, 프렌치 카페 정물).
- 기존 v1 파일은 백업 차원으로 잔존.

**2) 폰트 시스템 전환**

| 위치 | 기존 | 신규 |
|---|---|---|
| 한글 메인 카피 「여름엔, 아망드.」 (238px) | Bebas Neue + Noto Sans KR fallback | **Black Han Sans** |
| 영문 디스플레이 (보조 카피 `L'ÉTÉ EN UNE GORGÉE`, 메뉴명 `CAFÉ FRAPPÉ AMANDE`, 매장명 `CAFÉ CRÈME D'AMANDE`, `@cremedamande`, 가격 `₩ 8,500`, 시즌 `06.01 — 08.31`) | Bebas Neue | **Anton** |
| 한글 보조 (메뉴 한글 설명 「카페 프라페 아망드 ⏤ …」) | Noto Sans KR | **Noto Serif KR** (정물 무드와 어울리는 셰리프) |
| 디테일 (상단 메타 바, 라벨, "Find us", "Prix", "Saison" 등 작은 트래킹 라벨) | Inter | **Inter** (유지) |

- Google Fonts 단일 호출로 4종 로드: `Black Han Sans` / `Anton` / `Inter(400–700)` / `Noto Serif KR(400/600)`.
- 기존 Bebas Neue, Noto Sans KR(900) 의존 제거.

**3) 컬러 톤**
- 포인트 컬러 **Sunset Coral `#ff6b5c`** 유지.
- 보조 액센트로 **Antique Brass `#b8946a`** 신규 도입 (가는 골드 hairline, 라벨 보더, 디바이더, 트래킹 라벨 컬러).
- 베이스를 「Mediterranean Blue → Cream `#f4ece0` + Ink `#2a221b`」으로 전환. 푸터의 코랄·옐로우·블루 3색 띠 → 코랄 5 : 골드 2 비율의 절제된 2색 띠로 축소.

**4) 장식 정리**
- 햇살 광선 14개, 태양 radial-gradient, 휴양지 블루 그라데이션 → 전부 제거.
- 메뉴명 `Café Frappé Amande`는 이미지 위에 어두운 글레이즈(`linear-gradient(to top, rgba(20,15,10,.78) → 0)`)만 깔아 절제. 회전된 ICED·NEW 스티커 + 회전된 8,500 동그라미 배지 제거하고, 라인 박스 형태의 시그니처 라벨 + 골드 보더 가격 카드로 대체.

**5) 인덱스 페이지 02 AI 카드**
- 폰트 라벨: `Bebas Neue + Inter` → `Black Han Sans + Anton + Inter`
- 베이스 컬러 칩: `Mediterranean Blue` → `Antique Brass`
- 카드 배경(thumbBg): `#0e3a60` → `#1a1611`
- `Thumb02`를 분기시켜 `Thumb02AI` 신규 컴포넌트로 미니어처 갱신: 크림 베이스 + 가는 골드 hairline + 정물 이미지 + Black Han Sans 한글 카피 + Anton 보조 영문. 02-Unsplash 미니어처는 기존 블루 톤 그대로 유지.

### 변경 파일
- `02_riviera_summer/ai.html` (전면 재작성)
- `index.html` (폰트 추가, 02-ai 메타, Thumb02AI 추가, Thumb 라우터, src 매핑)
- 이미지: `_images_ai/02_riviera_summer_v2.png` 사용 (기존 파일은 보존)

### 의도적 선택
- 메인 카피 컬러를 **이미지 아래 크림 여백** 위에서 **코랩** 으로 (대비 충분, 정물 위에 얹지 않아 이미지의 정제된 우아함을 침범하지 않음).
- 보조 영문 `L'ÉTÉ EN UNE GORGÉE`은 메인 위 22px Anton + 0.42em 트래킹 + 골드 컬러. 메인 한글의 1/10 정도 시각 비중으로 절제.
- 매장명을 Anton + 글자 사이 0.18em으로 살짝 띄워 매거진 마스트헤드 느낌. 풋터는 가는 골드 디바이더 한 줄 + 정보 한 줄 + 코랄/골드 2색 띠 한 줄로 3-stripe 정돈.

### PRD 체크리스트 재확인 (02 AI)
| # | 항목 | 결과 |
|---|---|---|
| 1 | 1080×1350 | ✅ |
| 2 | 신메뉴 1개 | ✅ Café Frappé Amande 단일 |
| 3 | 메인 카피 3–7단어 | ✅ 「여름엔, 아망드.」 2어절 + 보조 영문 4단어 |
| 4 | 이미지 50%+ | ✅ 840px / 1350px ≈ 62% (좌우 60px 마진 제외 시 비주얼 면적 우위) |
| 5 | 포인트 컬러 1개 + 절제된 액센트 | ✅ Coral 메인 + Brass 액센트 1톤만 |
| 6 | 기간·가격 명확 | ✅ 가격은 이미지 우상단 골드-라인 박스, 시즌은 메뉴명 옆 오른쪽 정렬 |

---

## 12. 5차 패스 — v2 롤백 + 메인 카피 한 줄 처리 (2026-05-11)

### 사용자 피드백
- "난 이 이미지가 맘에 든다고 한거였는데" — 4차에서 좋다고 한 건 **원본 02 AI 이미지(야외 햇살 톤)**, v2(차분한 정물)는 가라앉음.
- "메인 카피는 한 줄로 가도 될 듯"

### 변경
- 이미지 src 롤백: `_images_ai/02_riviera_summer_v2.png` → `_images_ai/02_riviera_summer.png` (원본 햇살 톤). v2 파일은 백업으로 잔존.
  - `02_riviera_summer/ai.html` line 70-72 (src, alt)
  - `02_riviera_summer/ai.html` line 184 (화면 라벨에서 "v2 French Café still life" 제거)
  - `index.html` line 262 (Thumb src 매핑)
- 메인 카피 2줄 → 1줄: fontSize 162px → 140px, letterSpacing -0.05em → -0.055em, lineHeight 0.86 → 1, whitespace-nowrap 추가.
  - 컨테이너 가용 폭 960px에 「여름엔, 아망드.」 8자가 들어가도록 폰트 사이즈를 단계적으로 축소.

### 인덱스 카드
- Thumb02AI 카피는 원래 한 줄 「여름엔, 아망드.」였으므로 텍스트 그대로 OK.
- 미니어처 이미지 소스만 v2 → 원본으로 자동 반영.

### 폰트 시스템
- 4차에서 도입한 Black Han Sans + Anton + Inter + Noto Serif KR 그대로 유지.

---

## 13. 6차 패스 — Full-Frame Edition · "책 느낌 제거" + Bagel Fat One 임팩트 (2026-05-11)

### 사용자 피드백
1. "메인카피를 가운데로 내려주고 좀더 키워도 될꺼 같고 좀더 이펙트 있는 글자로 바꿔도 될꺼 같아. 너무 밋밋해."
2. "이미지가 저렇게 짤려 있으니까 너무 책 같은 느낌이 드는데..." — 박스 안에 갇힌 정물 사진이 책처럼 답답하다.
3. 참조 2장:
   - **던킨 「커피에 겨울을 담다.」** — 풀-프레임 음료 + 가운데 따옴표 카피 + NEW 뱃지
   - **PALMIER CARRE** — 풀-프레임 + 측면 큰 영문 디스플레이 + 굵고 둥근 임팩트 폰트 + 컬러 블록

### 핵심 결정
- 02 AI 포스터를 **풀-프레임 레이아웃**으로 전면 재작성. 책 느낌의 60px 마진 박스를 완전히 폐기.
- 메인 카피 폰트를 **Bagel Fat One** (Google Fonts) 로 교체. 둥글고 매우 두꺼운 디스플레이체 — 참조 2의 굵기 + 참조 1의 친근함을 동시에 충족.
- 카피를 중앙(top 560px)으로 이동하고 흰색 + 코랄 드롭 그림자(7px 오프셋) + 어두운 외곽 그림자로 임팩트 강화 (옵션 B 채택, 흰색이 음료 위에서 가장 가독성 좋음).
- 우상단 코랄 원형 NEW 뱃지 (참조 1 영감), 좌측 회전 영문 "CRÈME D'AMANDE" 알파 0.16 (참조 2 영감, 절제).
- 손글씨 보조 카피 « l'été en une gorgée » (Caveat) 메인 카피 아래에 한 줄 — 친근함 보강.

### 변경 파일
- `02_riviera_summer/ai.html` 전면 재작성 (200줄 → 260줄)
- `index.html`:
  - Google Fonts 링크에 `Bagel+Fat+One` 추가 (line 13)
  - `.ff-bagel` CSS 클래스 추가 (line 22)
  - `02-ai` 메타 `font` 필드: `Black Han Sans + Anton + Inter` → `Bagel Fat One + Anton + Caveat`
  - `Thumb02AI` 컴포넌트 전면 재작성 — 풀-프레임 이미지 + 3-layer 그라데이션 오버레이 + 흰색 Bagel 카피 + 우상단 NEW 원형 뱃지

### 풀-프레임 레이아웃 구조 (1080×1350)
| 영역 | top | 콘텐츠 |
|---|---|---|
| Background | inset-0 | `02_riviera_summer.png` `object-cover` `contrast(1.05) saturate(1.06)` |
| Gradient (top) | 0–340 | 어두운 그라데이션 0.55→0 (메타·뱃지 가독성) |
| Gradient (center radial) | 380–900 | 라디얼 0.32 중앙→0 외곽 (카피 가독성) |
| Gradient (bottom) | bottom-560 | 어두운 그라데이션 0→0.94 (하단 정보 가독성) |
| Meta bar | 44 | 매장명 · Nº 02 · Été MMXXVI (흰색) |
| NEW 뱃지 | 110 right | 코랄 원형 140×140 + 흰색 보더 + "NEW / Été 2026 / ★ Signature" |
| Side display (rotated) | 1180 left | "CRÈME D'AMANDE" Anton 96px 알파 0.16 |
| Sub English | 560 | "L'ÉTÉ EN UNE GORGÉE" Anton 24px 코랄-블론드 |
| Main copy | 595 | **여름엔, 아망드.** Bagel Fat One 170px |
| Handwriting | 815 | « l'été en une gorgée » Caveat 36px |
| Menu/Price/Saison | bottom-110 | CAFÉ FRAPPÉ AMANDE Anton 48 + 한글 보조 + PRIX/SAISON 골드 라인 박스 2개 |
| Footer | 0 | 매장 한 줄 + 코랄/골드 색띠 |

### 메인 카피 폰트 사이즈 산출 (Bagel Fat One)
1. 1차 시도 196px → 실측 텍스트 폭 1131px, 컨테이너 970px (left/right 55px) **168px 오버플로우**.
2. 2차 시도 162px (left/right 40px = 1000px) → 텍스트 921px, 79px 여유. fits.
3. 3차 시도 174px → 텍스트 989px, 11px 여유. 코랄 그림자 7px 고려하면 빠듯.
4. **최종 170px** → 텍스트 약 965px, 35px 여유 (그림자 포함). 안전.
- letterSpacing `-0.035em`, lineHeight 0.95, whitespace-nowrap.

### 폰트 시스템 (02 AI)
- **Bagel Fat One** — 메인 한글 카피 (신규 도입)
- **Anton** — 영문 디스플레이 (유지)
- **Caveat** — 손글씨 보조 (신규 도입)
- **Inter** — 메타·라벨 (유지)
- **Noto Serif KR** — 한글 보조 설명 (유지)
- **Black Han Sans 제거** (02 AI에 한해)

### 인덱스 미니어처 (Thumb02AI)
- 풀-프레임 이미지 + 3-layer 그라데이션
- 메인 카피 "여름엔, 아망드." Bagel Fat One 46px 흰색 + 코랄 2.5px 그림자, top 45%
- 보조 영문 "L'ÉTÉ EN UNE GORGÉE" Anton 7px 코랄-블론드 top 38%
- 우상단 NEW 원형 뱃지 34×34 코랄 + 흰색 보더
- 하단 CAFÉ FRAPPÉ AMANDE + 06.01—08.31 + ₩ 8,500
- 푸터 매장명 + 코랄/골드 2색 띠
- 다른 5개 카드(Thumb01·Thumb02·Thumb03) — 손대지 않음

### PRD 체크리스트 (02 AI · v6)
| # | 항목 | 결과 |
|---|---|---|
| 1 | 1080×1350 | ✅ |
| 2 | 신메뉴 1개 | ✅ Café Frappé Amande 단일 |
| 3 | 메인 카피 3–7단어 | ✅ 「여름엔, 아망드.」 2어절 + 보조 영문 4단어 |
| 4 | 이미지 50%+ | ✅ **100% 풀-프레임**, 정보 영역만 그라데이션 오버레이 |
| 5 | 포인트 컬러 1개 | ✅ Coral 메인 + Brass 액센트 1톤 |
| 6 | 기간·가격 명확 | ✅ PRIX/SAISON 골드 라인 박스 2개 하단 좌하 |

### 시각 검증 (Playwright)
- 메인 카피 실측 폭 1080 좌표계에서 컨테이너 1000 폭 내 안전 fit ✓
- 폰트 로딩 완료(`document.fonts.ready`) 후 측정 ✓
- 카드 6개 모두 살아있음(href 검색) ✓

### 임의 결정 1–2줄
- 그림자 옵션은 (B) 흰색 + 7px 코랄 드롭 + 어두운 외곽으로. 참조 1의 「커피에 겨울을 담다.」가 흰색이라 음료 위에서 가독성이 가장 좋다고 판단.
- 측면 회전 영문은 좌측 한 변에만 (참조 2처럼 사방 두르지 않음). 알파 0.16으로 산만함 최소화, 분위기만 차용.

---

## 14. 7차 패스 — 메인 카피 폰트 교체: Bagel Fat One → KerisKedyuche (2026-05-11)

### 사용자 피드백
- 첨부 이미지(케리스케듀체 샘플 "이용 대상 및 목적에 제한없이 자유롭게…")와 함께 "메인카피를 케리스케듀체로 바꾸자. 이 느낌이야."

### 적용
- 폰트: **KerisKedyuche** (한국교육학술정보원 학교 안심폰트, OFL 라이선스, 상업 이용 허용)
- 호스팅: `https://cdn.jsdelivr.net/gh/projectnoonnu/2601-3@1.0/KERISKEDU_B.woff2` (Bold 700) — jsdelivr CDN, 200 OK + CORS allow-origin: *
- 02 AI에서 `Bagel Fat One` 완전 제거, `.ff-bagel` 클래스를 `.ff-keris`로 rename.
- 인덱스 페이지 02-AI 메타 `font` 필드와 Thumb02AI 컴포넌트 동일 적용.

### 미세 조정
- 메인 카피 letterSpacing -0.035em → **-0.03em** (KerisKedyuche의 글자 폭이 약간 다른 점 고려). fontSize 170px 유지.

### 변경 파일
- `02_riviera_summer/ai.html` (Google Fonts URL에서 Bagel+Fat+One 제거 + @font-face KerisKedyuche 추가 + 클래스 rename)
- `index.html` (동일하게 폰트 교체 + 메타 font 라벨 + Thumb02AI 클래스 + 코드 코멘트)

### 의도적 선택
- KerisKedyuche는 Bagel Fat One보다 자모 라운드가 더 친근·손글씨에 가까움. 사용자가 보내준 케리스 샘플의 "이펙트 있는 글자" 느낌과 정확히 매칭.
- Regular(400) 가중치는 호스팅하지 않고 Bold(700)만 — 메인 카피·디스플레이 용도라 두께 변형 불필요.

---

## 15. 8차 패스 — 최종 PNG 저장 (2026-05-11)

### 산출
- `_exports/02_riviera_summer_ai_final.png` (1080×1350, 1.76MB, PNG RGB)

### 캡쳐 파이프라인
1. `02_riviera_summer/ai.html` 에 `?print=1` 캡쳐 모드 분기 추가 — 정상 보기에 영향 없음. React 마운트 + 폰트 로드 후 포스터 div만 0,0으로 옮기고 .no-print 영역 제거.
2. Chrome headless 명령:
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
     --window-size=1080,1350 --force-device-scale-factor=1 \
     --virtual-time-budget=8000 \
     --screenshot=_exports/02_riviera_summer_ai_final.png \
     "http://localhost:8765/02_riviera_summer/ai.html?print=1"
   ```
3. 결과 검증: `file …` → `PNG image data, 1080 x 1350, 8-bit/color RGB`.

### 비고 (Playwright 실패 사유)
- Playwright MCP의 element screenshot 5초 timeout 안에 stable 판정이 나지 않아 두 번 실패.
- React App 컴포넌트가 resize listener로 scale을 계속 계산해 layout shift가 미세하게 발생한 것이 원인 추정.
- Chrome headless의 `--virtual-time-budget` 으로 우회 성공.

### 향후 확장
- 같은 패턴으로 다른 5개 포스터도 PNG 추출 가능. 각 ai.html/unsplash.html에 `?print=1` 분기 동일 추가 필요.
