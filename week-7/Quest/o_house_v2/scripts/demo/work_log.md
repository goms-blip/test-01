# o_house_v2 시연 영상 녹화 작업 로그

- 작성일: 2026-05-15
- 산출물: `scripts/demo/out/o_house_v2_demo.mp4` (약 54초, 1280×800, mp4/H.264)
- 원본: `scripts/demo/out/page@*.webm` (Playwright 녹화 원본)

## 시나리오 (로그인 → 구매 흐름, 약 1분)

| 구간 | 화면 | 동작 |
|---|---|---|
| 0–5s | 홈 (`/`) | 진입, 살짝 스크롤 후 복귀 |
| 5–9s | 헤더 → 로그인 | "로그인" 링크 클릭 → `/login` |
| 9–16s | 로그인 페이지 | 데모 빠른 로그인 "홈데코로 로그인" 클릭 → 홈 리다이렉트 |
| 16–22s | 헤더 → 스토어 | "스토어" 클릭 → `/store`, 카드 그리드 둘러보기 |
| 22–27s | 스토어 카테고리 필터 | 첫 번째 카테고리 칩 클릭 |
| 27–34s | 상품 상세 (`/product/[id]`) | 상품 카드 클릭, 가격·셀러·바로구매 영역 노출 |
| 34–38s | "바로 구매" 클릭 | `/checkout/[productId]` 진입 |
| 38–58s | 결제 페이지 | Toss 결제 위젯(결제수단·약관) 마운트 후 스크롤 |
| 58–end | "결제하기" 버튼 호버 | 외부 결제창은 띄우지 않고 마무리 |

> 메모리 [feedback_mask_secrets](.../memory/feedback_mask_secrets.md) 상 데모 계정 비밀번호는 평문 노출 금지 — 본 영상은 클릭만 자동 입력하므로 화면에는 비밀번호가 표시되지 않음.

## 파일

```
scripts/demo/
├── package.json        # playwright 의존성
├── record.mjs          # 시연 자동화 스크립트
├── work_log.md         # (이 문서)
└── out/
    ├── o_house_v2_demo.mp4   # 최종 영상
    └── page@*.webm           # Playwright 원본
```

## 재현

```bash
# 1) Next.js dev 서버 (포트 3000은 다른 앱이 점유 중이라 3100 사용)
cd week-7/Quest/o_house_v2
PORT=3100 npm run dev > dev.log 2>&1 &

# 2) 녹화
cd scripts/demo
npm install
npx playwright install chromium   # 최초 1회
DEMO_BASE_URL=http://localhost:3100 node record.mjs

# 3) webm → mp4 변환
cd out
ffmpeg -y -i page@*.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 22 o_house_v2_demo.mp4
```

## 트러블슈팅 메모

- 포트 3000 충돌: `node server.js`(다른 앱)가 점유 → `PORT=3100`으로 우회.
- 외부 토스 결제창은 카드/생년월일 입력이 필요해 영상에서는 "결제하기" 버튼 호버까지로 종료. success 페이지까지 보여주려면 `record.mjs` 끝에 `page.goto('/checkout/success?...')`로 미리 만들어 둔 주문번호를 붙여 추가 가능.
- 영상 길이 미세 조정은 `record.mjs` 안의 `wait(...)` 값으로 조절(현재 약 54초).
