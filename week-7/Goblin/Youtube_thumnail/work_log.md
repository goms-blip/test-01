# YouTube 썸네일 후보 추출 — 작업 로그

- 작업일: 2026-05-09
- 대상 영상: [밤 크림 가득한 말차 마들렌 만들기 | Matcha Marron Madeleine (Green Tea & Chestnut Madeleines)](https://www.youtube.com/watch?v=K6y1Oj4MGP8)
- 영상 길이: 9:52 (592.214s)
- 출력 위치: `week-7/Goblin/Youtube_thumnail/`

## 사용 도구

| 도구 | 버전 | 용도 |
|------|------|------|
| yt-dlp | 2026.3.17_1 (Homebrew) | YouTube 영상 다운로드 (1080p mp4 머지) |
| ffmpeg | /opt/homebrew/bin/ffmpeg | scene-detection 후보 추출 + 선별 프레임 고품질 캡처 |
| ffprobe | (ffmpeg 동봉) | duration, 해상도 검증 |
| python3 | /usr/bin/python3 | 후보 타임스탬프 균등 분포 선별 |

> 참고: 작업 시작 시점에 yt-dlp가 미설치라 `brew install yt-dlp`로 설치한 뒤 진행했습니다.

## 추출 전략

1. **다운로드**: `yt-dlp -f "bestvideo[height=1080][ext=mp4]+bestaudio[ext=m4a]/..." --merge-output-format mp4` 로 1080p mp4 확보 (`source.mp4`, 약 228MB).
2. **scene 후보 생성**: `ffmpeg -vf "select='gt(scene,0.4)',showinfo,scale=1280:-2"` 로 컷 전환 시점 98개 후보를 1280×720 jpg 임시 추출하면서 `pts_time` 로그도 같이 저장 (선별 단계의 분석용 — 최종 출력 해상도와는 무관).
3. **10개 균등 선별**: 영상 전체 구간 `[30s, 577s]`을 9등분한 10개 타깃 시점을 잡고, 각 타깃에 가장 가까운 scene 타임스탬프를 (중복 없이) 매칭.
4. **고품질 재캡처**: 선별된 10개 시점에 대해 `ffmpeg -ss <t> -i source.mp4 -frames:v 1 -vf scale=1920:1080 -q:v 2` 로 1920×1080 JPEG 단일 프레임 추출.
5. **임시 파일 정리**: 후보 캐시(`scene_candidates/`), 로그(`scene_log.txt`, `scene_times.txt`, `selected.txt`)는 검증 후 삭제. 원본 `source.mp4`는 재추출용으로 남겨둠.

> **2026-05-09 업데이트**: 사용자 요청에 따라 썸네일 해상도를 **1280×720 → 1920×1080**으로 재추출. 초기 다운로드가 720p였기 때문에 단순 업스케일 대신 1080p 원본을 다시 받아 동일한 10개 타임스탬프에서 재추출했습니다. `source.mp4`도 1080p 버전으로 교체.

## 선별된 10개 프레임

| # | 파일 | 시점 (m:ss) | 시점 (s) | 메모 |
|---|------|-------------|----------|------|
| 01 | `frame_01.jpg` | 0:38 | 38.800 | 재료 — 버터 큐브 (Matcha Madeleine Batter) |
| 02 | `frame_02.jpg` | 1:22 | 82.733 | 말차 가루 체에 치기 |
| 03 | `frame_03.jpg` | 2:28 | 148.733 | 반죽 휘퍼링 |
| 04 | `frame_04.jpg` | 3:24 | 204.700 | 반죽을 짤주머니로 패닝 |
| 05 | `frame_05.jpg` | 4:36 | 276.133 | 오븐에서 부풀어 오르는 마들렌 |
| 06 | `frame_06.jpg` | 5:30 | 330.567 | 구워진 마들렌 — 갈색 옆면 |
| 07 | `frame_07.jpg` | 6:25 | 385.500 | 밤 크림(마롱) 만들기 |
| 08 | `frame_08.jpg` | 7:24 | 444.267 | 마들렌 속 채우기 — 짤주머니 |
| 09 | `frame_09.jpg` | 8:22 | 502.633 | 말차 럼 글레이즈 마무리 |
| 10 | `frame_10.jpg` | 9:23 | 563.700 | 완성 컷 — 플레이팅 |

> 메모는 영상 자막/챕터 오버레이와 시각적 컨텍스트로 추정한 라벨입니다. 정확한 작업 단계와 1:1 매칭이 아닐 수 있어요.

## 산출물 디렉터리

```
week-7/Goblin/Youtube_thumnail/
├── frame_01.jpg ~ frame_10.jpg   # 1920×1080 JPEG 썸네일 후보 10개
├── source.mp4                    # 원본 영상 1080p (재추출/추가 보정용)
├── index.html                    # 썸네일 갤러리 뷰어 (CDN React + Tailwind)
└── work_log.md                   # 이 문서
```

## 뷰어 사용법

`index.html`은 빌드 도구 없는 단일 HTML(CDN React 18 + Tailwind)입니다.

- **바로 열기**: 파일을 브라우저로 열면 `frame_*.jpg`를 같은 폴더에서 상대 경로로 로드합니다.
- **로컬 서버 권장**: 일부 브라우저의 `file://` 캐시 이슈를 피하려면 폴더에서 `python3 -m http.server 8000` 실행 후 `http://localhost:8000/`.
- **기능**:
  - 4-컬럼 반응형 썸네일 그리드, hover 시 강조
  - 카드 클릭 → 큰 미리보기 모달 (← → 키로 이동, Esc로 닫기)
  - 각 프레임에 시점 배지 + "YouTube 해당 시점으로 열기" 링크 + 다운로드 버튼

## 최종 썸네일 생성 (2026-05-09)

PRD(`prd.md`) 보너스 미션 — A/B 테스트 + 다국어 카피 — 에 맞춰 4종 1920×1080 PNG 썸네일을 생성했습니다.

### 산출물

| 파일 | 버전 | 카피 언어 | 베이스 생성 방식 | 크기 |
|------|------|----------|----------------|------|
| `thumbnail_A_kr.png` | A | 한국어 | image-edit (frame_09 참조) | 1920×1080 |
| `thumbnail_A_en.png` | A | English | image-edit (frame_09 참조) | 1920×1080 |
| `thumbnail_B_kr.png` | B | 한국어 | text-to-image (스튜디오 컷) | 1920×1080 |
| `thumbnail_B_en.png` | B | English | text-to-image (스튜디오 컷) | 1920×1080 |

### 사용 도구 / 모델

| 도구 | 용도 |
|------|------|
| OpenAI Images API | 베이스 이미지 생성 (요청 모델: `gpt-image-2` → **403 fallback → `gpt-image-1`**) |
| ffmpeg (Lanczos) | 1536×1024 → 1920×1080 (16:9 crop + upscale) |
| Pillow 12.2 (PIL) | 텍스트 오버레이 합성 (한글/영문 카피, 강조 키워드 색상 분리) |
| Python venv | 격리 환경 (`.venv/`) |

> **모델 fallback**: 사용자가 요청한 `gpt-image-2`는 호출 시 `403 Your organization must be verified to use the model 'gpt-image-2'` 응답이 와서, 같은 계정에서 사용 가능한 `gpt-image-1`로 자동 전환했습니다. (`generate_thumbnails.py` 의 `with_fallback` 로직)

### 폰트 (PRD 권장)

| 폰트 | 용도 |
|------|------|
| `BlackHanSans-Regular.ttf` (Google Fonts OFL) | 한국어 메인 카피 — 두꺼운 헤드라인 |
| `Pretendard-Black.otf` (orioncactus/pretendard) | 한국어 서브 카피 / 메타 박스 / 영문 서브 카피 |
| `Anton-Regular.ttf` (Google Fonts OFL) | 영문 메인 카피 — Bebas류 컨덴스드 헤드라인 |

→ `fonts/` 폴더에 다운로드, 단발성 사용이라 별도 license bundle 없이 OFL 명시.

### 생성 파라미터

```jsonc
// 양쪽 공통
{ "size": "1536x1024", "quality": "high", "n": 1 }

// A: /v1/images/edits, multipart with image=@frame_09.jpg
//   prompt: "Re-imagine this photograph as a clean, high-end YouTube food thumbnail.
//            Keep the matcha-green madeleines on the white tray and the chestnut topping...
//            leave the LEFT THIRD as clean empty white space..."

// B: /v1/images/generations
//   prompt: "A premium overhead studio food photograph for a YouTube thumbnail:
//            six glossy matcha-green madeleines arranged on a clean white ceramic tray,
//            each topped with a piece of caramelized glossy chestnut..."
```

베이스 이미지는 버전당 **1번만** 생성하고, KR/EN 카피는 PIL로 따로 오버레이해서 API 비용을 절반으로 줄였습니다 (총 API 호출 2회).

### 합성 파이프라인

```
OpenAI 1536x1024 PNG  →  ffmpeg crop=1536:864 + scale=1920:1080  →  PIL overlay  →  thumbnail_*.png (1920x1080)
```

### 카피 (실제 사용한 텍스트)

**한국어판**
- 메인 (강조): **말차** × **밤** — 두 키워드만 발랄한 말차 그린(#65A360), 가운데 `×`는 짙은 그린-블랙
- 서브: **밤크림 가득**한 마들렌 — '밤크림 가득'만 진한 그린 강조
- 태그: Pink Lemons Home (그린 박스)
- 메타: 레시피 · 9분 52초 (그린 아웃라인 박스)

**English판**
- 메인 (강조): **MATCHA** × **MARRON** — 두 키워드만 강조 그린
- 서브: **Chestnut Cream** Madeleines — 'Chestnut Cream'만 진한 그린 강조
- 태그: Pink Lemons Home
- 메타: RECIPE · 9:52

PRD 룰 — "1~2개 키워드만 강조색" — 을 따라 메인 카피 두 단어와 서브 카피 한 구절에만 액센트 컬러를 입혔습니다.

### 텍스트 오버레이를 PIL로 분리한 이유

GPT 이미지 모델은 한글/CJK 글자 렌더링이 신뢰할 수 없어, "이미지에 텍스트가 박혀 나오는" 1단계 파이프라인은 즉시 포기. 베이스 이미지 프롬프트에서 `no text, no captions, no subtitles, no watermark`를 명시해 깨끗한 좌측 패널을 확보한 뒤, PIL로 정확한 폰트·자간·줄바꿈·색상 위계를 통제했습니다.

### A/B 비교 메모 (CTR 예측)

**예상 우위: B (text-to-image)**

이유
- B는 오버헤드 스튜디오 컷이라 **마들렌 6개가 전부 보이고** 옆에 말차 가루 그릇 + 대나무 차선까지 등장 — 영상의 '어떤 재료로 뭘 만드는지'가 한 컷에 다 들어옴.
- A는 frame_09의 클로즈업 각도를 이어받아 **마들렌 일부만 보이고**, 글레이즈 작업이 끝난 뒤의 컷이라 '결과물 컷'에 가까움. 작은 사이즈(300×170)로 줄였을 때 마들렌 형태/색감의 식별성은 B가 더 또렷함.
- 다만 A는 **원본 영상 색감 보존도가 높고** "실제로 영상에 나오는 장면"이라는 진정성이 있어, 채널 팔로워에게는 친숙한 클릭을 유도할 가능성도 있음.
- 영문판 비교: 영어권 시청자는 "MATCHA × MARRON" 키워드를 처음 보면 의미 추론 시간이 필요할 수 있어, 결과물이 또렷한 B가 카피 해독 부담을 더 잘 분담함.

권장 운영: B를 메인으로 걸고, A는 14일 후 A/B 로테이션해 실제 CTR을 측정하는 것이 안전한 선택지.

## 이슈 / 우회 사항

- **yt-dlp 미설치**: `brew install yt-dlp` 로 첫 시도에 해결 (deno + python@3.14 의존성 동반 설치).
- **scene-detection 후보 수**: 98개로 많아서 균등 분포 선별 로직(파이썬)으로 10개로 좁힘. 단순 균등 분할이 아니라, 각 균등 타깃에 가장 가까운 scene 컷을 고르는 방식이라 모든 프레임이 "컷 전환 직후 깨끗한 정지 화면"이라는 점을 보장합니다.
- **인트로/아웃로 회피**: 첫 30초·끝 15초는 후보에서 제외해 채널 인트로 카드/엔드 카드를 피했습니다.
- **해상도 재추출 (2026-05-09)**: 처음에 `bv*[height<=720]` 필터로 720p만 받아둬서 1080p 요청 시 단순 업스케일이 안 됨. 1080p 포맷(`137+140`)으로 다시 다운로드한 뒤 동일 10개 타임스탬프에서 재캡처. 모든 출력이 진짜 1920×1080 픽셀 데이터.

---

## 2026-05-09 ROUND 2 — AI 폐기 + 실프레임 합성 재설계

### 사용자 피드백 (그대로 인용)

> "AI 결과물이 인공적이고 텍스트가 작아서 안 보임. AI 이미지 생성 폐기하고 실제 프레임 위에 직접 합성. 텍스트는 진한 그린 박스 + 흰 글씨로 콘트라스트 강제."

### 새 결정 (모두 적용 완료)

| 항목 | 이전 (ROUND 1) | 변경 (ROUND 2) |
|------|---------------|----------------|
| 베이스 이미지 | OpenAI gpt-image-1 (1536×1024 → 1920×1080 업스케일) | **`frame_10.jpg`** 영상 실제 프레임 1920×1080 직접 사용 |
| 자연스러움 | "AI 사진" 매끈함 → 인공적 | 영상 원본 디테일 (접시 자국, 마들렌 표면 굴곡, 트레이 그림자) 그대로 보존 |
| 텍스트 콘트라스트 | 흰 배경 + 그린 카피 → 약함 | **진한 그린 반투명 박스(#1E5631 alpha 0.92) + 흰 글씨** 강제 |
| 메인 폰트 크기 | 64~88pt | **200pt** (KR/EN 동일) — 캔버스 폭의 약 절반 |
| `×` 강조 | 검은-그린 톤 | **라임(#9CC861)** 단일 글자만 색 분리해 위계 강조 |
| 산출물 종류 | 4종 (A/B × KR/EN) | **2종 (KR/EN)** — A/B 구분 폐기 |
| API 호출 | OpenAI 2회 | **0회** (PIL only) |

### 폐기 파일

- `thumbnail_A_kr.png` (삭제)
- `thumbnail_A_en.png` (삭제)
- `thumbnail_B_kr.png` (삭제)
- `thumbnail_B_en.png` (삭제)
- `generate_thumbnails.py` (삭제 — 새 `compose_thumbnails.py`로 통합)

폐기 사유: AI 베이스가 마들렌을 매끈하게 다시 그려서 영상의 진정성이 사라짐. 텍스트 사이즈도 300×170 축소 시 식별 불가.

### 새 산출물

| 파일 | 용도 | 크기 | 검증 |
|------|------|------|------|
| `thumbnail_kr.png` | 한국어 최종 | 1920×1080 | PIL re-open OK |
| `thumbnail_en.png` | 영문 최종 | 1920×1080 | PIL re-open OK |
| `thumbnail_kr_preview.png` | KR 300×170 가독성 검수용 | 300×170 | LANCZOS 다운스케일 |
| `thumbnail_en_preview.png` | EN 300×170 가독성 검수용 | 300×170 | LANCZOS 다운스케일 |
| `compose_thumbnails.py` | 합성 스크립트 (PIL only) | — | 단독 실행 가능 |

### 합성 파이프라인

```
frame_10.jpg (1920×1080)
  ├─ cover_watermark()             # 우상단 영상 워터마크 영역(1485,8 ~ 1915,165)을 흰 사각형으로 덮음
  ├─ compose_main()                # 좌상단 (60, 70~) 진한 그린 라운드 박스 + 메인 카피
  │     ├─ "말차 " / "MATCHA " (흰)
  │     ├─ "× "                  (라임 #9CC861 강조)
  │     └─ "밤" / "MARRON"        (흰)
  ├─ compose_sub()                 # 메인 박스 바로 아래 살짝 밝은 그린 박스 + 서브 카피
  └─ draw_top_right_label()        # 워터마크 자리에 "Pink Lemons Home" 라벨로 교체
       → thumbnail_*.png
```

### 사용 폰트 / 색상

| 요소 | 폰트 | 사이즈 | 색 |
|------|------|--------|---|
| KR 메인 | `BlackHanSans-Regular.ttf` | 200pt | `#FFFFFF` (`×`만 `#9CC861`) |
| KR 서브 | `Pretendard-Black.otf` | 78pt | `#FFFFFF` |
| EN 메인 | `Anton-Regular.ttf` | 200pt | `#FFFFFF` (`×`만 `#9CC861`) |
| EN 서브 | `Pretendard-Black.otf` | 64pt | `#FFFFFF` |
| 우상단 라벨 | `Pretendard-Black.otf` | 32pt | `#FFFFFF` on `#1E5631` |
| 메인 박스 | — | radius 12, padding 32×22 | `#1E5631` alpha 0.92 |
| 서브 박스 | — | radius 10, padding 26×14 | `#2E6E3C` alpha 0.90 |
| 미세 그림자 | — | offset (2~3, 2~3) | `rgba(0,0,0,0.31)` |

### 레이아웃 결정 (시행착오 1회)

**1차 시도 (실패)**: 메인 폰트 280pt, 박스 가로 ~1100px → KR은 좌측 접시 위 마들렌을 가리고, EN은 "MARRON"의 N이 캔버스 우측 밖으로 잘림.

**2차 (확정)**: 메인 200pt로 축소, 박스 가로를 캔버스 절반 이내(약 880~960px)로 제한. 메인+서브가 모두 y=70~440 안에 들어가 좌측 접시 위 마들렌(y=400~720)을 침범하지 않음. 우측 트레이는 그대로 노출.

### 300×170 다운스케일 가독성 자기검수

PIL로 LANCZOS 리샘플 후 두 미리보기 모두 시각 확인:
- KR 미리보기: "말차 × 밤" 메인 또렷, 서브 "밤크림 가득한 마들렌"도 글자별 식별 가능. 라임 `×` 색 분리도 살아있음.
- EN 미리보기: "MATCHA × MARRON" 또렷, 서브 "Chestnut Cream Madeleines" 식별 가능. Anton 컨덴스드 폰트 + 흰색 + 진한 그린 박스 조합이 작은 사이즈에서 매우 강함.
- 결론: **300×170 모바일 사이드바 사이즈에서도 메인/서브 모두 읽힘 → 합격**.

### index.html 갤러리 변경

- `FINAL_THUMBNAILS` 배열을 4 → 2개로 축소 (KR/EN만).
- 그리드: 4-컬럼 → 2-컬럼 (`md:grid-cols-2`).
- 헤더 배지 "최종 4 + 후보 10" → "최종 2 + 후보 10".
- 카드 톤 배지: A/B(emerald/amber) → 언어(KR=emerald, EN=sky)로 의미 변경.
- 섹션 설명: "OpenAI gpt-image-1 + PIL" → "frame_10.jpg 베이스 + PIL 텍스트 합성. AI 이미지 생성 폐기".

### 우회 / 안전장치

- 폰트 로딩 실패 시 macOS 시스템 폰트(`AppleSDGothicNeo.ttc` → `Arial Bold` → `Arial Unicode`)로 자동 폴백 — 사과 없이 결과 우선.
- API 호출 0회 → 비용 0, 외부 의존 0.
- 워터마크 가리기는 영상 배경이 거의 순백이라 단순 흰 사각형으로 충분 (뒷배경과 톤 차이 무시 가능).

---

## 2026-05-09 22:50 — 사용자 피드백 반영: frame_09 베이스 + 액션 이펙트 추가

### 사용자 피드백 (그대로 인용)

> "frame_10은 잘라먹은 컷이라 못 쓴다 / 단순 텍스트 박스만으론 부족, 이펙트 추가 필요"

### 새 결정

| 항목 | 이전 (frame_10) | 이번 (frame_09) |
|---|---|---|
| 베이스 | 완성 플레이팅 컷 | **글레이즈(미로와) 바르는 액션 컷 (8:22)** |
| 텍스트 박스 | 메인/서브 좌상단 | 동일 (좌상단~좌중단) |
| 이펙트 | 없음 | **노랑 콜아웃 스티커 + 곡선 화살표 + ✨ 반짝임** |
| 영상 흔적 처리 | 단순 흰사각형 | **자막바 그라디언트 + 워터마크 더 넓게 마스킹** |
| 콜아웃 카피 | — | KR `듬뿍!` / EN `GLAZED!` |

### 합성 파이프라인 (모듈화)

`compose_thumbnails.py`를 frame_09 기준으로 전면 재작성. 합성 순서가 중요:

1. `mask_subtitle_bar(canvas)` — y=880~1080, 상단 25%만 ease-out 페이드, 그 아래는 100% 흰색.
2. `mask_watermark(canvas)` — (1610, 35, 1900, 175) 흰색 사각형 (이전 잔상 사례 대비 더 넓게).
3. `draw_sparkles(canvas)` — 글레이즈 부위 주변 4-pointed star 5개 (흰색 + 노랑 글로우 블러).
4. `_render_main_with_accent(...)` — 좌상단 진한 그린 박스 + "말차 × 밤" / "MATCHA × MARRON".
5. `_render_sub(...)` — 메인 박스 아래 "밤크림 가득한 마들렌" / "Chestnut Cream Madeleines".
6. `draw_callout_sticker(...)` — `(1500, 540)` 중심, 직경 280, -10° 회전, 그림자 블러, 외곽선 6px.
7. `draw_curved_arrow(...)` — 콜아웃 좌측 가장자리 → `(470, 470)` 글레이즈 타겟. quadratic Bezier, 흰선 16px on 검정 외곽 28px, 화살촉 삼각형.
8. `draw_top_right_label(...)` — "Pink Lemons Home" 라벨 (워터마크 자리 덮어쓰기).

### 자막/워터마크 잔상 처리 (이전 사례 학습)

- 자막바: 단순 흰사각형 대신 **그라디언트** — 위쪽 25%는 ease-out 페이드, 그 아래는 100% 흰색. 자막 텍스트 라인(약 y=950~1010)이 풀-알파 영역에 들어가 **잔상 0**.
- 워터마크: 이전 frame_10 버전에서 라벨 아래로 옛 글씨 비쳤던 사례 학습 → 영역을 (1610,35,1900,175)로 **더 크게** 잡고 라벨은 그 안쪽 (1920-40 우측 끝, y=60+) 위에 새로 그림.

### 사용된 색상 / 폰트 / 좌표

- 메인 박스: `#1E5631` α=0.92, 라임 액센트 `#9CC861`, 흰 글씨 200pt (Black Han Sans / Anton).
- 서브 박스: `#2E6E3C` α=0.90, 흰 글씨 78pt (KR) / 64pt (EN, Pretendard Black).
- 콜아웃: 노랑 `#FFD93D`, 외곽선 검정 6px, 텍스트 진한 그린 `#1E5631` + 흰 외곽 2px (대비 최대), -10° 회전, 그림자 offset(8,12) blur 10.
- 화살표: 흰 16px on 검정 28px, 삼각 화살촉 52px, bow=-0.18 (위로 살짝 휨).
- 반짝임 좌표 (5개): (470,350), (760,380), (660,250), (430,600), (820,600).
- 글레이즈 타겟: (470, 470) — 브러시의 노랑/오렌지 끝부분.
- 콜아웃 중심: (1500, 540).

### 검수 결과

1. **PIL verify**: 두 이미지 모두 `(1920, 1080)` ✓.
2. **300×170 가독성**:
   - KR: "말차 × 밤" / "밤크림 가득한 마들렌" / 노랑 콜아웃 안 "듬뿍!" 모두 한 눈에 식별 가능.
   - EN: "MATCHA × MARRON" / "Chestnut Cream Madeleines" / "GLAZED!" 모두 식별 가능.
   - 화살표는 작은 크기에선 "흰 곡선" 정도로 인지되지만 콜아웃→마들렌 시선 유도 효과는 살아있음.
3. **자막/워터마크 잔상**: 두 영역 모두 잔상 0 (그라디언트 페이드 + 더 넓은 흰 마스킹).
4. **로컬 서버**: 작업 종료 후 백그라운드 서버 재시동 + URL 안내.

### 이전 frame_10 버전과의 임팩트 차이

- **액션 vs 정적**: 정적 플레이팅 → 글레이즈 바르는 동적 액션 컷. 호기심 클릭 동기 강해짐.
- **레이어 수**: 텍스트 2개 → 텍스트 2개 + 콜아웃 + 화살표 + 반짝임 5개. **시선 유도 경로 명확** (말차×밤 → 듬뿍! → 글레이즈 작업).
- **유튜브 클릭베이트 톤**: 단정한 정보형 → "**듬뿍!**" 노랑 스티커로 톤 한 단계 펑키. 30~40대 베이킹 유튜브 시청자 클릭률 ↑ 기대.

### 후속 변경

- `index.html` 섹션 설명 `frame_10.jpg` → `frame_09.jpg(글레이즈 액션 컷)` + 이펙트 설명 추가.
- `<img src>` 에 `?v=2` 쿼리스트링 (`THUMB_CACHE_BUST` 상수)으로 frame_10 캐시 잔상 제거.
- 카드 desc 텍스트도 콜아웃 카피 포함하도록 갱신.

---

## 2026-05-09 23:00 — ROUND 4: 자막바 크롭+업스케일 + 콜아웃 카피 톤 다운

### 사용자 피드백 (그대로 인용)

> 1. 하단 자막바를 흰 그라디언트로 마스킹한 결과가 어색. 마스킹 대신 **이미지를 더 키워서(crop+zoom)** 자막 영역 자체를 화면 밖으로 밀어내야 깔끔.
> 2. "듬뿍!" 콜아웃 카피가 영상 의도와 안 맞음. 영상은 "그레이즈를 듬뿍 바르는" 게 아니라 "**살짝 발라서 밤(チェ chestnut)이 돋보이게**" 만드는 게 핵심. → 마일드한 키워드로 교체.

### 새 결정

| 항목 | 이전 (ROUND 3) | 이번 (ROUND 4) |
|------|---------------|----------------|
| 자막바 처리 | 흰 그라디언트 마스킹 (y=880~1080, 위 25% ease-out 페이드) | **크롭+업스케일** — `(124, 0, 1796, 940)` 박스로 잘라 1672×940 → 1920×1080 lanczos |
| 좌우 처리 | 손대지 않음 | 좌우 124px씩 컷해서 마들렌이 화면을 더 채우는 타이트한 컷 |
| 좌상단 브러시 | 그대로 노출 | **유지 확정** — 액션감 핵심이라 `top=0`으로 잘라내지 않음 |
| KR 콜아웃 | `듬뿍!` (의도 불일치) | `윤기\n살짝` (4글자, 두 줄) — "살짝 발라 윤기" 의도 정확히 |
| EN 콜아웃 | `GLAZED!` | `GENTLE\nGLOSS` (2단어, 두 줄) |
| 콜아웃 직경 | 280 | **320** (radius 160) — 4글자/2단어 두 줄 수용 |
| 콜아웃 폰트 | 110pt(KR) / 78pt(EN) | 110pt(KR) / 80pt(EN) |
| 워터마크 | 단일 흰 사각형 (1610,35~1900,175) | 크롭 후 좌표계 재계산 — 흰 사각형 (1500, 30, 1920, 215) |
| 글레이즈 타겟 | (470, 470) | **(380, 560)** — 크롭+업스케일 후 좌표계 재계산 + 시각 보정 |
| 콜아웃 중심 | (1500, 540) | **(1560, 600)** — 라벨 박스 충돌 회피 + 우중단으로 재배치 |
| 반짝임 | 5개 (메인 박스 가림 위험) | **4개**, 좌표 전부 재계산 (520,420)/(200,740)/(640,720)/(820,460) |
| 메인 박스 패딩 | 32×22 | 28×20 (크롭으로 좌측 여유 줄어듦) |
| 캐시버스터 | `?v=2` | `?v=3` |

### 적용된 크롭 박스 (원본 frame_09 1920×1080 좌표)

```
crop_box = (left=124, top=0, right=1796, bottom=940)   # 1672 × 940 = 16:9
→ resize(LANCZOS) → (1920, 1080)
```

- **좌측 124px**: 브러시 손잡이(빨강/오렌지) 일부만 잘림. 핵심 노란 솔 + 손잡이 본체는 보존.
- **우측 124px**: 빈 트레이 영역 일부만 잘림. 정보 손실 0.
- **상단 0**: 손대지 않음. 좌상단 브러시 위쪽까지 완전 보존.
- **하단 140px**: 자막바("미로와를 발라 밤이 마르지 않고…")가 영역 밖으로 완전히 밀려남.
- **비율 검증**: 1672/940 = 1.7787, 16/9 = 1.7778 → 0.06% 오차 (허용 범위, lanczos 안전).

### 합성 파이프라인 (ROUND 4)

```python
crop_and_upscale(frame_09)          # 1920x1080 (자막바 OUT, 좌상단 브러시 IN)
  ├─ mask_watermark()               # 우상단 워터마크 잔재 흰 사각형 덮기
  ├─ draw_sparkles()                # 4개 (글레이즈/마들렌 표면 주변)
  ├─ render_main + render_sub       # 좌상단 그린 박스 (말차 × 밤 / MATCHA × MARRON)
  ├─ draw_callout_sticker()         # (1560, 600) 직경 320 노랑 원, 두 줄 텍스트
  ├─ draw_curved_arrow()            # 콜아웃 좌측 (1422, 590) → 글레이즈 (380, 560)
  └─ draw_top_right_label()         # "Pink Lemons Home" 그린 라벨
       → thumbnail_*.png (1920x1080)
```

### 콜아웃 텍스트 두 줄 처리 (구현 메모)

이전 콜아웃은 단일 줄(`듬뿍!`, `GLAZED!`) 가정으로 짜여 있어, "윤기 살짝"(공백 포함 5자)을 한 줄로 넣으면 글자가 가로로 늘어져 원 안에서 어색했음. `draw_callout_sticker()`에 `\n` 분리 → 줄별 measure → vertical center 로직 추가:

```python
lines = text.split("\n")
line_metrics = [draw.textbbox((0,0), ln, font=font) for ln in lines]
total_h = sum(line_heights) + line_gap * (len(lines)-1)
cur_y = ly - total_h // 2
for ln in lines: ... cur_y += line_h + line_gap
```

→ KR `윤기 / 살짝` 두 줄, EN `GENTLE / GLOSS` 두 줄. 두 줄 모두 원 중심에 수직 정렬, 이전 한 줄보다 콜아웃 임팩트 강해짐.

### 크롭 전후 비교 메모

**전 (마스킹)**: 자막 영역 위에 흰 그라디언트 띠가 보여서 "급하게 가린 느낌". 좌상단 브러시는 보존됐지만 화면 가장자리에 빈 트레이 여백이 많아 마들렌이 작게 보임.

**후 (크롭+줌)**: 자막 영역 자체가 화면 밖. 좌우도 같이 크롭해서 **마들렌이 화면을 가득 채우는 타이트한 컷**으로 바뀜. 좌상단 브러시는 그대로, 액션감은 오히려 더 강해짐 (배경 줄어들고 주체가 커지니).

### 검수 결과

1. **PIL verify**: KR/EN 모두 `(1920, 1080)` ✓ (재오픈 확인).
2. **자막 잔재**: 0%. 크롭 박스로 y=940 미만만 사용해 자막바(y=950~1010) 완전 제거.
3. **좌상단 브러시**: 살아있음 ✓ (오렌지 손잡이 + 노란 솔 모두 식별 가능).
4. **300×170 가독성**:
   - KR: "말차 × 밤" / "밤크림 가득한 마들렌" / "윤기 살짝" 두 줄 모두 또렷.
   - EN: "MATCHA × MARRON" / "Chestnut Cream Madeleines" / "GENTLE GLOSS" 두 줄 또렷.
5. **로컬 서버**: `:8765` 살아있음 (재시작 안 함, 기존 서버에 그대로 서빙).
   - `http://localhost:8765/thumbnail_kr.png?v=3` → 200 OK, 2.0MB
   - `http://localhost:8765/thumbnail_en.png?v=3` → 200 OK, 1.9MB
   - `http://localhost:8765/index.html` → 200 OK, 19KB

### 이전 ROUND 3 대비 임팩트 차이 (한 줄)

자막 띠가 사라지고 마들렌이 화면을 더 가득 채우면서 **타이트한 액션 컷 + 마일드한 카피**로 톤이 정돈되어, 이전 클릭베이트("듬뿍!") → "윤기 살짝"이라는 **레시피 핵심 인사이트**를 전달하는 정보형 썸네일로 격상.

### 변경 파일 절대경로

- `/Users/sh_oh/Downloads/test-01/week-7/Goblin/Youtube_thumnail/compose_thumbnails.py` — `crop_and_upscale()` 신규, 콜아웃 두 줄 처리, 좌표 재계산
- `/Users/sh_oh/Downloads/test-01/week-7/Goblin/Youtube_thumnail/thumbnail_kr.png` — 1920×1080, 약 2.0MB
- `/Users/sh_oh/Downloads/test-01/week-7/Goblin/Youtube_thumnail/thumbnail_en.png` — 1920×1080, 약 1.9MB
- `/Users/sh_oh/Downloads/test-01/week-7/Goblin/Youtube_thumnail/thumbnail_kr_preview.png` — 300×170
- `/Users/sh_oh/Downloads/test-01/week-7/Goblin/Youtube_thumnail/thumbnail_en_preview.png` — 300×170
- `/Users/sh_oh/Downloads/test-01/week-7/Goblin/Youtube_thumnail/index.html` — 캐시버스터 v=3 + 섹션 설명 갱신
