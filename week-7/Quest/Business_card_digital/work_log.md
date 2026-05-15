# Digital Business Card — work_log

## 개요
오승훈 / (주)그리프 / 마케팅 & 디자인 에이전시 대표용 **디지털 명함**. 단일 `index.html`로 어디서나 (Notion 임베드, GitHub Pages, Vercel, 그냥 파일 더블클릭) 동작. 종이 명함이 못 하는 즉시 액션을 디지털 매체의 강점으로 살림.

## 산출물
- `index.html` — 단일 파일, CDN 기반 (React 18 + Tailwind + Babel standalone + qrcode.js)
- `work_log.md` — 본 문서

## 노출 정보 (PRD 6가지만, 더 추가 없음)
1. 카테고리: 마케팅 & 디자인 에이전시
2. 태그라인: AI와 함께 커나가고 있는
3. 회사 + 이름: (주)그리프 오승훈
4. 이메일: seunghun.oh@griff.co.kr
5. 전화: 010-8565-7487
6. 주소: 서울시 성동구 광나루로 8길 31, 11층

## 디지털 명함만의 기능
- **앞/뒤 Flip** — 카드 탭/클릭/Enter/Space로 3D Y축 회전. 앞=핵심 인식, 뒤=연락처 + QR
- **즉시 액션 패널** — Email은 `mailto:`, Phone은 `tel:`, Address는 카카오맵 검색 URL로 연결. 각 항목 옆에 클립보드 복사 버튼 분리 배치 (탭 = 액션 / 작은 복사 아이콘 = 복사)
- **vCard 다운로드 (.vcf)** — `Blob('text/vcard;charset=utf-8')` + UTF-8 BOM. 표준 vCard 3.0 포맷으로 iOS Safari·Android Chrome 양쪽 연락처 앱에서 자동 열림
- **QR 코드** — 페이지 URL을 담아 뒷면에 배치. 다른 사람이 폰으로 스캔하면 바로 이 명함이 열림
- **다크/라이트 자동 감지 + 토글** — 초기 `prefers-color-scheme` 자동 적용, 우상단 버튼으로 수동 전환
- **토스트 피드백** — 복사·vCard 저장 시 1.8초 토스트로 성공 알림

## 디자인 결정 근거

### 폰트 2종
- **Pretendard Variable** (한국어) + **Inter** (라틴/숫자)
- 기존 PRD가 Inter + Noto Sans KR를 썼지만, Pretendard가 Noto Sans KR보다 한국어 자체적인 균형(특히 작은 사이즈에서의 글자폭·자간)이 더 우수해서 디지털 매체에 더 맞음. 차별화 포인트.
- Inter는 라틴/숫자 전용 (전화번호의 tabular-nums, 라벨의 트래킹된 대문자)

### 컬러 3색 이내
- **잉크 #0e0e0e** (텍스트/주 배경 다크)
- **종이 #fafaf7 / #f1f0eb** (배경) — 순수 흰색 대신 미세하게 따뜻한 오프화이트로 종이 명함의 촉감을 디지털로 옮김
- **세이지 그린 #6f7a5c** (액센트 1색) — 그라데이션 글로우/네온이 아닌 정제된 식물 톤. "AI와 함께 커나가고 있는"의 "커나가다"라는 성장 메타포와 어울리며, 마케팅·디자인 에이전시의 안정감과 AI의 미래감 사이의 균형점

### 강조 1개
- **태그라인 "AI와 함께 커나가고 있는"** 에만 시각적 무게 집중. `clamp(22px, 5.4vw, 46px)`로 모든 뷰포트에서 가장 큰 텍스트. 미세한 shimmer (6초 주기, 가운데 한 줄을 세이지로 스쳐 지나감) — 절제된 동적 요소로 "AI와 함께"의 진행형 뉘앙스를 표현
- 이름이 아닌 태그라인을 강조한 이유: 5초 인식 시 "이 사람은 누구인가?"의 답은 "AI와 함께 성장하는 마케팅/디자인 에이전시 대표"라는 정체성이 이름 자체보다 차별성을 가짐

### 레이아웃
- **9:5 비율 (90×50mm 종이 명함과 동일)** — `aspect-ratio: 9/5`로 모든 화면 크기에서 유지. 디지털이지만 명함의 정체성은 비율에 있음
- **앞면**: 중앙 정렬, 좌상단 카테고리 라벨, 우상단 발행 연도 — 정보지 헤더 느낌의 작은 메타. 가운데에 hairline (44px 검정 선) → 카테고리 → 태그라인(강조) → 회사·이름 → 이름 영문(트래킹)
- **뒷면**: 좌 60% Contact, 우 40% QR — 그리드 분할로 명확한 위계
- 카드 외부는 `max-w-[760px]`로 데스크탑에서도 카드가 너무 커지지 않도록 제한. 1920px 화면에서도 카드는 약 720px 폭 (적절한 가독성)

### 미세 요소
- **Grain 텍스처** — 3px 간격 radial-gradient dot으로 종이 질감의 디지털 번역
- **Hairline 디테일** — 기존 카드에서 가져온 44px 1px 선. 미니멀하면서 식별 가능한 서명
- **3D Flip 회전** — `transform-style: preserve-3d` + cubic-bezier(0.22, 1, 0.36, 1). 0.85s로 빠르지도 느리지도 않게
- **호버 hint** — "Tap to flip" 텍스트가 카드 하단에 항상 보이되 호버 시 더 진해짐 (의도 명시)

## 사용 방법

### 로컬 미리보기
```bash
# 옵션 1: VS Code Live Server
# week-7/Quest/Business_card_digital 우클릭 → Open with Live Server

# 옵션 2: 터미널
cd week-7/Quest/Business_card_digital
npx serve .
# → http://localhost:3000

# 옵션 3: 파일 더블클릭 (가장 간단, CDN으로 모두 동작)
```

### 배포
- **GitHub Pages**: 폴더만 push → Settings → Pages → 폴더 선택
- **Vercel**: `vercel` CLI 또는 대시보드 import → root directory를 이 폴더로
- **Notion 임베드**: Vercel/Pages 배포 URL을 Notion `/embed` 블록에 붙여넣기
- 단일 파일이라 어떤 정적 호스팅에서도 즉시 동작

### 모바일 vCard 동작
1. 카톡으로 명함 URL 전송
2. 받은 사람이 링크 탭 → 모바일 브라우저에서 명함 열림
3. "내 연락처에 저장" 버튼 탭 → `.vcf` 파일 다운로드
4. iOS/Android 모두 연락처 앱이 자동으로 파일을 인식해 "추가하시겠습니까?" 다이얼로그 표시

## 체크리스트 결과
- [x] 정보 6가지만 노출
- [x] 단일 `index.html` 자체 완결
- [x] vCard 표준 3.0 포맷 + UTF-8 BOM (한글 안정)
- [x] `tel:` / `mailto:` / 카카오맵 URL 정상 작동
- [x] 3D Flip 부드러움 (0.85s cubic-bezier)
- [x] 폰트 2종 (Pretendard + Inter) · 컬러 3색 (잉크/페이퍼/세이지)
- [x] 1920×1080: max-w-760px로 카드 적절히 중앙 배치
- [x] 360px: clamp() 폰트 + truncate로 정보 잘림 방지

## 제약 준수
- CDN만 사용 (React 18 UMD, Tailwind Play CDN, Babel standalone, Pretendard CDN, qrcode.js CDN)
- 빌드 도구 없음
- 글로벌 상태는 useState/useEffect/useRef/useCallback만
- 외부 API 호출 없음 (모든 데이터는 PROFILE 상수)
- `localhost` 하드코딩 없음 — `window.location.href` 기반 QR 생성
