# Café Crème d'amande — Modern Parisian Editorial 버전

작업일: 2026-05-15
경로: `week-7/Quest/Cafe_Menu/prd_modern_parisian/`
기준 PRD: `week-7/Quest/Cafe_Menu/prd.md`

## 목표
기존 `prd_creme_damande/`(보르도·골드·아이보리, 에칭 빈티지 톤)와는 별개로,
**Modern Parisian Editorial** 톤의 두 번째 메뉴판을 한 장 더 제작.
이미지 자산은 PRD 지정대로 **gpt-image-2**로 생성.

## 디자인 결정
- **컬러 팔레트 (3색)**
  - `#F4EFE8` Off-white (페이퍼 베이스)
  - `#1A2A4F` Nuit Bleue / 딥 블루 (제목·강조)
  - `#B68A5E` Rose Gold (라인·시그니처 강조)
- **폰트 (2개)**
  - 제목용: **Cormorant Garamond** (Italic/Light)
  - 본문용: **Inter** (300/500)
- **레이아웃**: 1080 × 1350 px 단일 캔버스. 매거진 에디토리얼 그리드(좌 시그니처 사진 + 우 카테고리 2단).
- **시그니처**: Crème d'amande Latte — ₩ 8,500 (좌측 큰 사진 카드 + 딥블루 가격, "LA SIGNATURE" 라벨)
- **카테고리 3개**: I. CAFÉS / II. BOISSONS / III. PÂTISSERIES
- **가격**: 모두 오른쪽 정렬, 점선 leader

## 진행 상태
- [x] 폴더 생성 + work_log 초안
- [x] gpt-image-2 호출 가능 여부 프로브 — HTTP 200 (조직 인증 완료)
- [x] 시그니처 이미지 생성 (gpt-image-2, 1024×1024, 1.77 MB, 40s)
- [x] 카테고리 이미지 3장 생성 (cat_cafes / cat_boissons / cat_patisseries)
- [x] index.html 작성
- [x] preview.png 캡처
- [x] 로컬 서버 기동 + 접속 URL 안내

## 이미지 생성 결과 (gpt-image-2)
- 모델: `gpt-image-2` (1순위 호출 성공, 폴백 없음)
- API 키: `week-7/Quest/New_Menu_Poster/.env` 의 `OPENAI_API_KEY` 사용. 평문 로그·메모리 미저장.
- 스크립트: `.gen_images.py` (저장됨, 키 노출 없음)
- 생성 자산
  | 파일 | 용도 | 크기 | 소요 |
  |---|---|---|---|
  | `images/signature_latte.png` | 시그니처 히어로 카드 | 1024² 1.77 MB | 40s |
  | `images/cat_cafes.png` | (보존 자산) 향후 카페 카테고리용 | 1024² 1.39 MB | 71s |
  | `images/cat_boissons.png` | (보존 자산) 향후 음료 카테고리용 | 1024² 1.38 MB | 21s |
  | `images/cat_patisseries.png` | 파티스리 섹션 좌측 썸네일 | 1024² 1.46 MB | 63s |
- 공통 프롬프트 키워드: modern Parisian editorial, soft window light, marble/linen, strict 3-color palette (#F4EFE8 / #1A2A4F / #B68A5E), NO text/logo.

## 메뉴 구성
- 카테고리 **3개**: I. Cafés / II. Boissons / III. Pâtisseries
- 총 **16개** 메뉴 (시그니처 1 + Cafés 5 + Boissons 4 + Pâtisseries 6)
- 시그니처: **Crème d'amande Latte — ₩ 8,500** (별도 카드 + 큰 사진 + "LA SIGNATURE" 라벨)
- 가격: 전부 `Cormorant Garamond` Medium, **오른쪽 정렬**, 점선 leader

## PRD 항목별 충족 체크
- [x] 카페명 `Café Crème d'amande` — 헤더 92px Cormorant Garamond Italic
- [x] 프랑스풍 고급 카페 분위기 — 에디토리얼 매거진 톤, 프랑스어 카테고리/메뉴명
- [x] 메뉴판 1장 — 1080×1350 단일 페이지
- [x] 컬러 팔레트 3색 이내 — Off-white / Deep Blue / Rose Gold (정확히 3색)
- [x] 폰트 2개 이내 — Cormorant Garamond + Inter
- [x] 카테고리 3개 이상 — Cafés / Boissons / Pâtisseries
- [x] 메뉴 8개 이상 — 16개
- [x] 가격 포함 — 전 메뉴 ₩
- [x] 시그니처 1개 + 시각 강조 — 큰 사진 카드 + 라벨 + 큰 가격
- [x] 가격 오른쪽 정렬 — `text-align: right`
- [x] 1080×1350 px — `.menu` 고정 사이즈
- [x] 이미지 생성: GPT-image-2 — 정확히 명시 모델 사용

## 미리보기
- 로컬 서버: `python3 -m http.server 8765` (백그라운드 실행 중)
- 접속 URL: <http://localhost:8765/prd_modern_parisian/>
- 캡처: `prd_modern_parisian/preview.png`

## 2026-05-15 · 줄바꿈 버그 핫픽스
- 증상: Cafés / Boissons 섹션에서 가격이 메뉴명 아래 줄로 떨어짐.
- 원인: `.item`의 `grid-template-columns: 1fr auto` (2컬럼) + 자식 3개(name·leader·price) → price가 다음 행으로 wrap.
- 수정: `grid-template-columns: auto 1fr auto` (3컬럼)으로 변경. leader가 가운데 1fr을 점선으로 채움.
- 보조: 아이템 줄간격 12px → 16px, Pâtisseries row-gap 14px로 여백 보강.
- preview.png 재캡처 완료.

## 2026-05-15 · Pâtisseries 썸네일 오버플로우 수정 + 시그니처 v2
1. **썸네일 축소**
   - 증상: Pâtisseries 좌측 썸네일이 footer 영역까지 침범, 주소 텍스트와 겹침.
   - 수정: `.patisseries-row` `grid-template-columns: 200px 1fr` → `160px 1fr`. `.thumb` 명시적 `width:160px; height:160px`로 1:1 고정. margin-top 30 → 18.
   - 결과: footer와 안전 간격 확보, 주소 한 줄 가독성 회복.
2. **시그니처 v2 생성**
   - 동일 모델 `gpt-image-2`, 1024×1024, 1.30 MB, 69s.
   - v1: 위에서 비스듬한 컷 + 아몬드 블로섬 가지(정적·광고형)
   - v2: 눈높이 측면 컷 + 증기 + 크림 피처(보케) + 마블 카운터(현장형)
   - 비교 페이지: `compare.html` (<http://localhost:8765/prd_modern_parisian/compare.html>)
   - 메뉴판 적용본은 사용자가 v1·v2 중 결정 후 교체 예정 (현재 적용: v1)
3. **시그니처 최종 채택 — v2**
   - 사용자 결정: "v2가 더 안정감이 있다" → 메뉴판 시그니처 컷 v2 채택.
   - `index.html` 357번줄 `signature_latte.png` → `signature_latte_v2.png` 한 줄 교체.
   - preview.png 재캡처 완료.

