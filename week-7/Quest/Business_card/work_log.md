# work_log — Personal Business Card

**작업일**: 2026-05-10
**경로**: `week-7/Quest/Business_card/`

## 목적
PRD(prd.md) 기반 개인 명함 디자인.
레퍼런스: https://northpole.design/project/polestar (Polestar 미니멀 톤).

## 입력 정보
- 이름: 오승훈 / OH SEUNG HOON
- 태그라인: AI를 활용하려고 노력하는 (직함 없음)
- 연락처: 010-8565-7487
- 이메일: osh384@gmail.com
- 컬러: 흑·백·그레이만
- 폰트: 고딕 계열 한·영 모두 가독성 우선
- 뒷면 QR 자리 확보 (가상 QR 허용)

## 산출물

| 파일 | 설명 |
| --- | --- |
| `business_card_front_ai.png` | **GPT-image-1** 생성 — 종이 위 명함 목업, 앞면 |
| `business_card_back_ai.png`  | **GPT-image-1** 생성 — 종이 위 명함 목업, 뒷면 |
| `business_card_front.png`    | **HTML/CSS** 정확본 (1063×591 = 90×50mm@300dpi), 앞면 |
| `business_card_back.png`     | **HTML/CSS** 정확본, 뒷면 (실제 QR 포함) |
| `card_front.html`, `card_back.html` | 인쇄/수정용 HTML 소스 |
| `qr_placeholder.png`         | 가상 포트폴리오 URL용 QR (로컬 생성) |

## 디자인 결정
- **그리드**: 양쪽 80px 마진, 위아래 56–64px 마진. 시선이 양쪽 끝에 닿지 않게 여백 강조 (Polestar 룰).
- **앞면**: 좌측 상단에 `▪ PORTFOLIO` 라벨 + 카드 정중앙 좌측에 `오승훈` 76–88px Bold + 그 아래 `OH SEUNG HOON` 18px tracked. 좌측 하단에 태그라인. 우측은 비움(시각적 호흡).
- **뒷면**: 좌측 절반 = 연락 정보 (`PHONE` / `EMAIL` 라벨 + 값 28px Medium). 우측 절반 = QR + `PORTFOLIO` 라벨. 그리드(grid-template-columns: 1fr 320px)로 정렬.
- **타이포**: 영문 **Inter** + 한글 **Noto Sans KR** (Google Fonts). 둘 다 모던 산세리프, 한·영 메트릭이 잘 어울림. 인쇄 시 **Pretendard**로 교체 권장.
- **컬러 팔레트**: `--ink #111111`, `--ink-2 #2b2b2b`, `--grey #6e6e73`, `--grey-2 #a1a1a6`, `--rule #d2d2d7`, `--paper #ffffff`. 흑백+5단계 그레이만으로 위계 표현.
- **강조 1포인트**: 이름 한글이 가장 큰 크기·가장 진한 잉크. 그 외 모든 요소는 보조 위계.

## 작업 흐름

### A. GPT-image-2 시도 → gpt-image-1로 폴백
- `gpt-image-2` 호출 시 `403 organization not verified` 응답 → 동일 성능군의 `gpt-image-1`로 진행. 사이즈 1536×1024.

### B. HTML/CSS 정확본
- 1063×591(90×50mm@300dpi)로 카드 컨테이너 고정.
- Chrome DevTools MCP는 데스크톱 윈도우 최대화 상태에서 영역이 어긋남 → **Headless Chrome CLI**로 변경:
  ```
  Google\ Chrome --headless=new --window-size=1063,591 --screenshot=...
  ```
- QR은 처음 CDN(`qrcode@1.5.3`)을 썼지만 헤드리스에서 외부 스크립트 미로딩 → Python `segno`로 로컬 PNG 생성 후 `<img>` 참조.

## 다음 단계
- 인쇄: 1063×591 PNG는 그대로 1mm = 11.81px(300dpi) 비율. 실제 인쇄소에 보내기 전에 **CMYK 변환**과 **bleed 1mm**(1083×611) 적용 필요.
- 폰트를 **Pretendard**로 교체하면 한글 무게감이 더 좋아짐.
- 뒷면 QR은 실제 포트폴리오 URL이 정해지면 `qr_placeholder.png` 재생성으로 끝(Python 한 줄).

## v2 — 레이아웃 재작업 (Polestar 케이스 스타일)

### 변경 사항
1. 영문 표기 **`OH SEUNG HOON` → `OH SEUNG HUN`** 전체 교체
2. 레이아웃 전면 변경: **상단 ~60% 다크 히어로 이미지 + 하단 작은 텍스트 + 하단 라인 + 이름** (northpole.design Polestar 케이스 구조 그대로)
3. 한글 이름 크기 88px → **22px**로 축소(사용자 요청 "크지 않게")
4. 우상단 브랜드 마크 `OSH°` 추가(NORTHPOLE° 미러)

### 새 산출물
- `hero_front.png` — GPT-image-1 생성 다크 추상(Polestar 차체 곡선 느낌)
- `hero_back.png`  — GPT-image-1 생성 다크 추상(콘크리트 그레이징 라이트)
- `card_front.html`, `card_back.html` — 새 레이아웃 HTML
- `business_card_front.png`, `business_card_back.png` — 정확본 1063×591
- `business_card_front_ai.png`, `business_card_back_ai.png` — AI 목업 v2 (참고용)

### 알려진 한계
- **AI 목업 뒷면**에서 이메일이 `osh334@gmail.com`으로 잘못 렌더(GPT 이미지 모델의 숫자 8↔3 혼동). **HTML/CSS 정확본을 인쇄용 마스터로 사용** 권장.
- AI 목업 앞면도 히어로 패널이 의도보다 작게 잡힘 — 분위기 참고용.

### 핵심 디자인 결정
- 명함 패딩: 양쪽 40px, 상하 36px (90×50mm에 적정)
- 히어로 높이: 350px(약 59%)로 Polestar 케이스 비율 모방
- 텍스트 위계: 태그라인 14px → 이름 22px → 라벨 10–11px tracked
- 컬러: ink #111, grey #6e6e73, rule #d9d9dd, paper #fff (5단계 그레이만)

## v3 — 디자이너 검수 후 전면 재설계 (확정본)

v2(다크 히어로) 디자이너 검수에서 거절(Polestar 미러링이 본인 정체성과 안 맞음). reference/ 폴더 7장(KLAMBI / ARIELLA / AFANA / JAYTIC VALE) 제공받아 single-react-dev 에이전트로 4종 변주 비교 페이지를 빌드.

### 산출물
- `preview.html` — React + Tailwind CDN, 4종 변주(KLAMBI minimal / Black back / AFANA half-image / Editorial dash)를 한 화면에서 비교
- 로컬 서버: http://localhost:8765/preview.html (python http.server)

### 사용자 선택
**Variation 2 — Black Back** 확정. 화이트 앞 + 검정 뒤. 단, 화이트면을 다음과 같이 수정:
- 우측 정렬 → **카드 정중앙(수직+수평)** 정렬
- 전화번호 `010-8565-7487` → **`+82-10-8565-7487`** (국제 표기)
- 검정 뒷면(`AI · TRYING · LEARNING`)은 변경 없음

### 최종 인쇄 마스터
- `card_front.html` / `card_back.html` — V2 단일 카드 1063×591 직접 렌더용 HTML (preview.html에서 분리 추출)
- `business_card_front.png` (1063×591) — 화이트 앞면 정확본
- `business_card_back.png` (1063×591) — 검정 뒷면 정확본

### 구식 파일 (참고용 보관)
- `business_card_front_ai.png`, `business_card_back_ai.png` — v1 GPT-image-1 목업 (이메일 OCR 오류 있음)
- `hero_front.png`, `hero_back.png` — v2 Polestar 다크 히어로(거절됨)

### 핵심 디자인 결정 (v3)
- 한글 이름 34px Bold, 영문 22px tracked 0.18em (preview.html의 17/11px를 1063×591로 1.97x 스케일업)
- 가운데 정렬 + 짧은 헤어라인(55px)으로 KLAMBI 스타일 미니멀 강조
- 검정 뒷면은 고정 라벨 1줄(`AI · TRYING · LEARNING`)만으로 여백 강조, 상단 작은 헤어라인(47px, 50% 흰색)으로 비대칭 균형
- "PERSONAL"/"2026·KR" 등 가짜 메타데이터 전부 제거

## v4 — V2 포맷 베리에이션 (가로/세로/정사각형)

### 추가 포맷
- **세로형 50×90mm** (591×1063px @ 300dpi)
- **정사각형 50×50mm** (591×591px @ 300dpi)

### 디자인 조정
- **세로형 / 정사각형 공통**: 상·하단에 짧은 회색 dash 1쌍 추가(KLAMBI 스타일 시그니처). 가로형보다 폭이 좁아 영문/태그라인 18→14–18px로 다운스케일.
- **세로형 텍스트 위계**: 한글 이름 34px Bold, 영문 18px tracked 0.22em, 본문 18px (가로형보다 트래킹 살짝 좁힘)
- **정사각형 텍스트 위계**: 한글 이름 30px, 그 외 14px (높이 591에 맞춰 컴팩트하게)
- **검정 뒷면 라벨 크기**: 가로 22px / 세로 16px / 정사각 14px — 카드 폭에 맞춤
- 모든 포맷에서 가운데 정렬, +82-10-8565-7487, osh384@gmail.com 동일

### 추가 산출물
- `card_front_vertical.html`, `card_back_vertical.html`
- `card_front_square.html`, `card_back_square.html`
- `business_card_front_vertical.png` (591×1063)
- `business_card_back_vertical.png` (591×1063)
- `business_card_front_square.png` (591×591)
- `business_card_back_square.png` (591×591)

### 사이즈별 활용 권장
| 포맷 | 사이즈 | 추천 용도 |
| --- | --- | --- |
| 가로형 | 90×50mm | 전통적 명함 (지갑·명함첩 호환) |
| 세로형 | 50×90mm | 디자이너·크리에이티브 직군, 핸드아웃 |
| 정사각형 | 50×50mm | 패키지 태그, SNS 프로필, 미니 카드 |
