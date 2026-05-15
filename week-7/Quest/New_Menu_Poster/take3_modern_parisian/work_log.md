# New Menu Poster — Take 3 (Modern Parisian Summer Editorial)

작업일: 2026-05-15
경로: `week-7/Quest/New_Menu_Poster/take3_modern_parisian/`
기준 PRD: `week-7/Quest/New_Menu_Poster/prd.md`
연결: `week-7/Quest/Cafe_Menu/prd_modern_parisian/` (자매 톤)

## 목표
기존 `take2/` 3종(Beach Splash / Sunlit Terrace / Frosty Studio · cyan 액센트)과 별개로,
**Modern Parisian Summer Editorial** 톤의 여름 신메뉴 포스터 한 장 추가 제작.
이미지는 PRD 지정대로 **gpt-image-2**로 생성.

## 신메뉴 정의 (Part 1)
- **이름**: Café Frappé Amande (카페 프라페 아망드)
- **가격**: ₩ 8,500
- **한 줄 설명**: 시칠리아산 통아몬드 크림과 콜드브루의 시원한 만남
- **사야 하는 이유**: 시즌 한정 (06.01–08.31), 시그니처 라떼의 여름판

## 후킹 포인트 (Part 2)
- **메인 카피 (3단어)**: **« L'été, en amande. »**
- **보조 정보**: ₩ 8,500 · 06.01 – 08.31 · saison limitée

## 디자인 결정 (Part 3)
- **컬러 팔레트 (3색)**
  - `#F4EFE8` Ivory paper (베이스)
  - `#1A2A4F` Nuit Bleue / 딥 블루 (텍스트·고정 요소)
  - `#E26B4A` **Coral / Tangerine** — PRD "채도 높은 포인트 컬러 1개"
- **폰트 (2개)**: Cormorant Garamond (메인 카피·시그니처) + Inter (보조·태그)
- **레이아웃**: 1080 × 1350 px. 상단 30% 헤드라인 / 중앙 55% 히어로 사진(음료 ≥50% 충족) / 하단 15% 가격·캡션·CTA.
- **포인트 컬러 사용처**: "L'été" 단어 italic + 가격 ₩ 8,500 + 코너 작은 점/리본 — 그 외엔 모두 딥블루.

## 진행 상태
- [x] 폴더 + work_log 초안
- [x] gpt-image-2 히어로 이미지 생성 (1024×1536 portrait, 2.21 MB, 52s)
- [x] index.html 작성
- [x] preview.png 캡처
- [x] 접속 URL 안내

## 이미지 생성 결과 (gpt-image-2)
- 모델: `gpt-image-2` (1순위 호출 성공)
- API 키: `week-7/Quest/New_Menu_Poster/.env` 의 `OPENAI_API_KEY` 사용
- 스크립트: `.gen_hero.py`
- 자산: `images/hero_frappe_amande.png` (1024×1536, 2.21 MB)
- 콘셉트: tall French highball + 아이스 + 아몬드 크림 + 코랄 리넨 냅킨 + 인디고 천 + 해변 호라이즌 보케

## PRD 항목 충족 체크
| PRD 항목 | 결과 |
|---|---|
| 1080×1350 | ✓ `.poster` 고정 |
| 신메뉴 사진 ≥50% | ✓ `.hero`가 약 55% 면적 |
| 메인 카피 3~7단어 | ✓ "L'été, en amande." (3단어) |
| 보조 정보 명확 | ✓ ₩8,500 · 06.01–08.31 · Saison Limitée |
| 채도 포인트 1개 | ✓ Coral `#E26B4A` 단일 액센트 |
| 빅 타이포 | ✓ 178px Cormorant Garamond, 코랄 italic 'été' |
| 사야 하는 이유 | ✓ "Saison Limitée"·"Nouveauté" 배지 |
| GPT-image-2 | ✓ 정확히 명시 모델 사용 |

## 미리보기
- 로컬 서버: `python3 -m http.server 8770` (백그라운드)
- 접속 URL: <http://localhost:8770/take3_modern_parisian/>
- 캡처: `take3_modern_parisian/preview.png`

## 2026-05-15 · 히어로 사진 v2 추가
- gpt-image-2, 1024×1536 portrait, 2.30 MB, 55s
- 컷 차별점
  - v1 (현재 적용): 가운데 정렬 eye-level, 정적·광고형
  - v2 (추가): 우측 3/4 로우앵글, **코랄 종이 빨대** + 좌측 전경 아몬드 접시 + 해변 보케 후방, 라이프스타일·동적
- 비교 페이지: `compare.html` (<http://localhost:8770/take3_modern_parisian/compare.html>)
- 메뉴판 적용은 사용자 결정 후 교체 (현재: v1)

## 2026-05-15 · v2 채택 + 헤드라인 튜닝
- 사용자 결정: v2 채택 + 메인 카피 볼드/행간 줄임 + 크롭 조정 요청
- `index.html` 변경
  - hero src: `hero_frappe_amande.png` → `hero_frappe_amande_v2.png`
  - `.headline .h1` font-weight: 300 → **500**, font-size: 178 → 172, line-height: 0.92 → **0.84**, letter-spacing: -0.015em → -0.02em
  - `.headline .h1 em` weight 400 → **600**, `.small` weight 300 → 500
  - Google Fonts 링크에 Cormorant Garamond 0,600/0,700/1,500/1,600 추가 (italic em이 합성폰트 대신 정식 600 italic 사용)
  - `.hero` top: 510 → **462**, bottom: 220 → 210 (영역 약 +58px 확장)
  - `.hero img` `object-position: 58% 38%` — 우측 상단 보존, 음료/크림캡/빨대/호라이즌 살리고 전경 접시 자연 크롭
- preview.png 재캡처 완료

## 2026-05-15 · 이미지 위치 추가 상향
- 요청: 이미지를 좀 더 올려달라
- 변경
  - `.hero` top: 462 → **418**, bottom: 210 → 254 (프레임 크기 동일, 위로 44px 이동)
  - `.headline` top: 132 → **114** (헤드라인을 위로 18px 당김 → sub 줄과 NOUVEAUTÉ 배지 겹침 해소)
  - `.headline .sub` margin-top: 18 → 14
- 결과: 음료가 포스터 중앙 시각 무게축에 더 가깝게 위치, 카피~이미지 사이 호흡 정돈

## 2026-05-15 · 하단 여백 압축 + credit 가독성
- 요청
  1. 하단 빈 공간이 너무 크다 → 절반 이상 줄이고 이미지로 채워달라
  2. 우측 「servi glacé, 16oz」가 흰색이라 안 보임 → 다른 컬러로
- 변경
  - `.hero` bottom: 254 → **184** (이미지 영역 +70px 확장, 하단 빈 여백 ~120px → ~50px)
  - `.hero .credit`
    - color: `rgba(244,239,232,.92)` (아이보리/거의 흰색) → **`var(--ink)`** (딥블루)
    - 배경 추가: `rgba(244,239,232,.92)` 페이퍼 알약 + padding 6×12 → 어떤 배경 위에서도 또렷
    - text-shadow 제거, font-weight 400 → 500

## 2026-05-15 · 하단 추가 확장 + 이미지 상향
- 요청: +30px 더 이미지로 채우고, 이미지를 위로 더 올려달라 (빨대 잘려도 OK)
- 변경
  - `.hero` bottom: 184 → **154** (총 +100px 확장, 하단 빈 여백 ~50px → ~20px)
  - `.hero img` object-position: `58% 38%` → **`58% 62%`** (소스의 하단 영역 노출 비중↑, 상단 빨대/하늘 자연 크롭)
- 결과: 크림캡·슬라이스 아몬드·잔 전체·코랄 냅킨·전경 접시 모두 살림. 빨대 끝부분만 살짝 보이는 정도로 압축.

## 2026-05-15 · 헤드라인↔sub 간격 압축
- 요청: "en amande." 와 sub 줄(`ÉDITION SAISONNIÈRE…`) 사이 간격이 너무 떠 보임
- 변경
  - `.headline .sub` margin-top: **14 → 4px**
  - (중간 시도 -16/-2는 텍스트 겹침 발생 → 롤백)
- 결과: sub가 "amande." 베이스라인 바로 아래에 붙어 헤드라인 블록으로 묶임

## 기존 take2와의 차이
- take2 3종: cyan 액센트, 해변 자연광 사진(beach_splash / sunlit_terrace / frosty_studio)
- take3: **coral 액센트**, Modern Parisian Editorial 톤(잡지 표지형 빅 타이포 + 잔잔한 마블 카운터 + 호라이즌 보케)
- 자매 작업: `week-7/Quest/Cafe_Menu/prd_modern_parisian/` 와 동일한 컬러/폰트 DNA → 시리즈로 묶을 수 있음
