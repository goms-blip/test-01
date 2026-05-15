# Cafe Menu 20 Designs — Work Log

작업일: 2026-05-10
경로: `week-7/Quest/Cafe_Menu/`

## 목표
서로 다른 컨셉/레이아웃/타이포의 카페 메뉴판 20종을 단일 `index.html` 파일로 각각 제작.
모든 메뉴판은 한국 카페 컨텍스트(원화 가격, 한글 메뉴명 기반)에 맞춰 작성.

## 디자인 컨셉 일람

| # | 폴더 | 컨셉 | 핵심 키워드 |
|---|---|---|---|
| 01 | `01_minimal_white` | Minimal White | 흰 여백 · 가는 산세리프 · 점선 구분 |
| 02 | `02_vintage_brown` | Vintage Brown Kraft | 크라프트 종이 · 세리프 · 손글씨 가격 |
| 03 | `03_modern_dark` | Modern Dark Lounge | 검정 배경 · 골드 포인트 · 그리드 |
| 04 | `04_pastel_dream` | Pastel Dream | 라벤더·민트·피치 그라디언트 카드 |
| 05 | `05_handdrawn_sketch` | Hand-drawn Sketch | 노트 격자 · 손글씨 폰트 · 낙서 일러스트 |
| 06 | `06_japanese_kissaten` | Japanese Kissaten | 세로쓰기 · 인주 도장 · 베이지 화선지 |
| 07 | `07_korean_traditional` | 한국 전통 다실 | 한지 질감 · 세로배치 · 먹색 |
| 08 | `08_industrial_loft` | Industrial Loft | 콘크리트 · 노출 배관 느낌 · 스텐실 폰트 |
| 09 | `09_colorful_pop` | Colorful Pop Art | 원색 블록 · 굵은 폰트 · 만화풍 |
| 10 | `10_typography_focus` | Typography First | 거대한 가격 숫자 · 미니 설명 · 흑백 |
| 11 | `11_botanical_garden` | Botanical Garden | 식물 SVG · 세이지 그린 · 카드 레이아웃 |
| 12 | `12_newspaper_bw` | Newspaper B&W | 신문 칼럼 · 세리프 · 이중 줄 헤더 |
| 13 | `13_neon_cyber` | Neon Cyber | 네온 글로우 · 다크모드 · 모노스페이스 |
| 14 | `14_autumn_warm` | Autumn Warm | 단풍 · 따뜻한 베이지 · 시즈널 카피 |
| 15 | `15_italian_espresso` | Italian Espresso Bar | 빨강·초록·흰색 · 빈티지 포스터 |
| 16 | `16_french_bistro` | French Bistro | 흑판 메뉴 · 분필 손글씨 · 에펠탑 모티프 |
| 17 | `17_brunch_sunny` | Brunch Sunny | 옐로우·크림 · 아침 햇살 일러스트 |
| 18 | `18_dessert_boutique` | Dessert Boutique | 핑크 골드 · 케이크 카드 · 우아한 세리프 |
| 19 | `19_roastery_craft` | Roastery Craft | 원두 차트 · 산미·바디 게이지 · 갈색조 |
| 20 | `20_bakery_cottage` | Bakery Cottage | 따뜻한 베이지 · 빵 일러스트 · 손그림 테두리 |

## 진행 상태
- [x] 폴더 20개 생성
- [x] work_log.md 초안 작성
- [x] 01~20 index.html 작성 완료
- [x] 로컬 미리보기 서버 안내

## 공통 규약
- 단일 `index.html` 파일, 외부 파일 의존 없음
- Tailwind CDN 사용 (정적 메뉴판이므로 React 미사용 — 인쇄 친화적)
- 가격 범위: 4,500원 ~ 12,000원
- 카테고리 구성: 시그니처 · 커피 · 논커피 · 디저트(또는 디자인에 맞게 변형)
- 한글 메뉴명 기본, 컨셉에 따라 영문 병기
- 이미지는 SVG/이모지/그라디언트로 대체 (외부 이미지 의존 없음)

## 미리보기 방법
```bash
cd week-7/Quest/Cafe_Menu
python3 -m http.server 8765
# 브라우저에서 http://localhost:8765/01_minimal_white/
```

## 19, 20 추가 작업 메모 (2026-05-10 보완)
이전 세션 타임아웃으로 미완성이었던 마지막 두 디자인을 마저 작성했습니다.

- **19 `19_roastery_craft` — Specialty Roastery Craft**: 진지한 스페셜티 로스터리 무드. 크라프트 종이 질감 카드 + 코너 트림 마크 + 옛 인쇄소 스탬프, 싱글 오리진 4종(에티오피아/콜롬비아/케냐/파나마 게이샤)에 산지·로스팅 단계(○●)·산미·바디 게이지를 표기한 커핑 노트형 메뉴. 모노스페이스+세리프 조합, 가격은 ₩ 4,500–12,000원.
- **20 `20_bakery_cottage` — Bakery Cottage Café (오븐속 작은집)**: 따뜻하고 사랑스러운 동화책 베이커리 무드. 크림 배경 + 점선·물결 데코 + SVG 코티지 일러스트 + 빵/디저트 이모지, 가격은 손글씨 폰트의 노란 가격표 형태. 오늘의 빵·한 끼 메뉴·따뜻한 음료·달콤한 디저트 4섹션. BEST/NEW 배지와 손글씨 카피로 친근한 톤.

---

## PRD 정밀 매칭판 추가 (2026-05-10 추가 작업)

**폴더**: `prd_creme_damande/` — `prd.md`의 모든 항목을 1:1로 충족시키는 단일 메뉴판.
**접속**: <http://localhost:8765/prd_creme_damande/> · 캡처: `prd_creme_damande/preview.png`

### 디자인 결정
- **컬러 팔레트 (3색)**:
  - `#F5EFE3` Ivory (페이퍼 크림 베이스)
  - `#5C1B1B` Bordeaux (제목·가격 강조)
  - `#B8935E` Antique Gold (프레임·디바이더·강조선)
- **폰트 (2개)**:
  - 제목용: **Playfair Display** (Italic 컷 포함 — 카페명·카테고리·가격)
  - 본문용: **Cormorant Garamond** (한글 설명·태그라인)
  - 둘 다 Google Fonts, 클래식 프랑스 세리프 톤.
- **시그니처 메뉴**: **Crème d'amande Latte (크렘 다망드 라떼) — ₩ 8,500**
  - 카페명과 직결된 시그니처. 다른 메뉴(2단 리스트형)와 차별화하기 위해 **별도 카드(전체 폭, gold border, "SPÉCIALITÉ DE LA MAISON" 라벨)** 로 강조.
  - SVG 직접 일러스트(잔·라떼아트·아몬드·증기·반짝임)로 시각 무게 부여 — Fal AI/GPT-image 호출 환경 부재로 SVG 선택(의도된 톤 통제 가능).
  - 가격을 큰 Playfair 36px Bordeaux로, "Notre signature" 부제 첨가.
- **레이아웃**:
  - 1080×1350 px 단일 캔버스. 외곽 더블 골드 프레임 + 4코너 오너먼트 SVG.
  - 헤더: ÉTABLI EN MMXXIV · PARIS · SÉOUL → 카페명 → 태그라인 → 플뢰롱 디바이더 → LA CARTE.
  - 카테고리: I. CAFÉS / II. BOISSONS (2단) + III. PÂTISSERIES (전체 폭 2컬럼) — 총 **15개 메뉴 + 시그니처 1개 = 16개**, 카테고리 3개.
  - 가격: 모두 Playfair Display로 **오른쪽 정렬**, 점선 리더로 좌측 메뉴명과 연결.
  - 푸터: 주소(12, Rue de Séongsu, Séoul) · 시간(08:00–22:00) · 인스타(@creme.damande) 한 줄 + 작은 부카피.

### PRD 항목별 충족 체크
- [x] 카페명 `Café Crème d'amande` — 헤더에 70px Playfair로 정확 표기
- [x] 프랑스풍 고급 카페 분위기 — 보르도+골드+아이보리, 세리프, 플뢰롱·코너 오너먼트, 프랑스어 카테고리/메뉴명
- [x] 메뉴판 1장 — 1080×1350 단일 페이지, 푸터까지 한 화면 안에 수렴
- [x] 컬러 팔레트 3색 이내 — Ivory / Bordeaux / Gold (정확히 3색)
- [x] 폰트 2개 이내 — Playfair Display + Cormorant Garamond
- [x] 카테고리 3개 이상 — Cafés / Boissons / Pâtisseries
- [x] 메뉴 8개 이상 — 시그니처 포함 16개
- [x] 가격 포함 — 전 메뉴 ₩ 표기
- [x] 시그니처 1개 + 시각 강조 — Crème d'amande Latte, 별도 카드/SVG 일러스트/골드 라벨/큰 가격
- [x] 가격 오른쪽 정렬 — `text-align: right` + Playfair 통일
- [x] 1080×1350 px — `<main class="menu">` 고정 사이즈
- [x] 프랑스 레퍼런스 부합 — 비스트로/파티스리 카르트 톤(보르도·골드·이중 프레임·플뢰롱)

### 미충족/대체
- 이미지 생성(Fal/GPT-image) 미지원 환경이라 **SVG 일러스트로 대체** — 디자인 통제력은 더 우수.


## 2026-05-10 · 시그니처 일러스트 교체 (Nano Banana 2)

- 기존 SVG 일러스트 → Gemini 3 Pro Image Preview (Nano Banana 2)로 생성한 PNG로 교체
- 모델: `gemini-3-pro-image-preview` (1순위 호출 성공, 폴백 불필요)
- 프롬프트: 빈티지 프랑스 패티스리 일러스트, 라떼 잔 + 아몬드 블로섬 + 크림 저그 + 아몬드, 3색 팔레트 강제 (#F5EFE3 / #5C1B1B / #B8935E), 정사각 1:1, 텍스트 없음
- 산출물: `prd_creme_damande/signature_illustration_nanobanana.png` (~600KB, 1024×1024)
- HTML 변경: `<svg class="sig-art">` 블록 → `<img class="sig-art">`, CSS에 `object-fit: contain; mix-blend-mode: multiply;` 추가 (배경 ivory와 자연스럽게 합성)
- preview.png 재캡처 완료
- API 키는 환경변수로만 주입, 스크립트·메모리·로그에 평문 미저장

## 2026-05-10 · 일러스트 3사 비교 (Fal · OpenAI 추가)

- **B — Fal FLUX 1.1 Ultra**: 정교한 컬러 수채, 잔 중심 임팩트 강함. 잎 그린·블로섬 핑크 등장으로 3색 팔레트 이탈. → `signature_illustration_fal.png` (1.0MB)
- **C — OpenAI gpt-image-1**: 세피아 단일톤 빈티지 에칭. 3색 팔레트 가장 엄격 준수. 클래식 프랑스 레시피북 판화 무드. → `signature_illustration_openai.png` (2.4MB)
  - 메모: `gpt-image-2`는 조직 인증 필요(403)로 자동 폴백
- 비교 페이지: `prd_creme_damande/compare.html` (A·B·C 한 화면)
- 메뉴판 적용은 사용자 결정 후 진행 (현재 적용본은 A — Nano Banana 2)

## 2026-05-10 · 최종 채택 — OpenAI gpt-image-1 (C)

- 사용자 결정: A·B·C 중 **C** 채택. 3색 팔레트 가장 엄격, 빈티지 에칭 톤.
- 일러스트 요소 중 "아몬드 블라썸" 가지는 PRD에 명시되지 않은 추가분이었으나, 카페명(*Café Crème d'amande* — 아몬드)과 직결되는 모티프이고 사용자 검토 후 유지 결정.
- `index.html`: 시그니처 `<img>` src를 `signature_illustration_openai.png`로 교체.
- `preview.png` 재캡처 완료.
