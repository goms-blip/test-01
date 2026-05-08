# Week-6 Quest All — Work Log

## 작업 목적
6주차에 만든 5개 과제(`carrot_app` · `shoppingmall` · `mini_app` · `personal_project` · `chrome_research`)를 한 페이지에서 한눈에 둘러볼 수 있는 통합 허브를 만든다.
Week-5 quest_all과 동일한 디자인 언어(Inter + Noto Sans KR · Tailwind · 카드 + stagger 애니메이션)를 따르되, 컬러 테마는 6주차의 시그니처인 당근 오렌지 계열로 변경.

## 산출물
- `week-6/quest/quest_all/index.html` — 단일 HTML, CDN Tailwind, 외부 의존성 없음
- `week-6/quest/quest_all/work_log.md` — 본 문서

## 카드 구성 (5장)
| # | 카드 | 링크 | 비고 |
|---|---|---|---|
| 01 | 당근마켓 클론 (carrot_app) | https://carrot-market-clone-five.vercel.app | Vercel · 실시간 채팅 |
| 02 | Shoppingmall | https://shoppingmall-pearl.vercel.app | Vercel · Toss + ImageKit |
| 03 | 베이킹 지식 상점 (mini_app) | https://miniapp-weld-six.vercel.app | Vercel · 단건 결제 |
| 04 | 베이킹 재료 사전 (personal_project) | GitHub 폴더 | 기획 문서 (MISSION · AUDIENCES) |
| 05 | Chrome 경쟁 리서치 | GitHub 폴더 | research.md + 스크린샷 4장 |

## 데이터 출처 검증 절차
- `vercel ls` / `vercel project ls` 로 각 프로젝트의 안정 도메인(별칭) 확인 — `*-five.vercel.app` / `*-pearl.vercel.app` / `miniapp-weld-six.vercel.app`.
- 각 폴더의 `prd.md` · `MISSION.md` 에서 한 줄 설명 추출 후 카드 본문에 반영.
- `personal_project` / `chrome_research` 는 배포 산출물이 아니라 문서 산출물 — GitHub 트리 링크로 처리.

## 디자인 결정
- 컬러: 당근 오렌지(`brand-500: #F97316`) 계열로 Week-5의 보라 테마와 차별화.
- 그라디언트 5종(carrot · 코랄 · 시안블루 · 핑크 · 민트그린)으로 카드 헤더 색을 달리해 5개 미션의 성격 차이를 한눈에 노출.
- 통계 4개: `5 미션 · 3 배포 · 2 Toss 연동 · 4 리서치 캡처`.

## 로컬 확인
- 정적 단일 파일이므로 `python3 -m http.server` 로 즉시 시연 가능.
- 백그라운드 서버 띄워두고 접속 URL 안내 (메모리 디폴트 규칙 준수).
