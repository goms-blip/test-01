# dev.md — 초보자를 위한 베이킹 재료 사전

## 1. 개요

한 줄 요약: 한국 베이킹 초보자가 레시피에서 마주치는 모르는 재료를 30초 안에 이해할 수 있도록 돕는 재료 사전 웹앱.

- 기준 미션 문서: [MISSION.md](./MISSION.md)
- 데드라인: 3주 (7주차 시작 → 데모데이 종료)
- v1 목표: 재료 30개 × 9개 정보 항목 = 270개 데이터 칸 100% 채움 + 검색 도달 3초 이내

---

## 2. MVP 범위 (3주 데드라인)

핵심 기능 4개만 v1에 포함한다. 그 외 모든 기능은 v1.5 이후로 미룬다.

### 포함 / 제외 결정표

| 기능 | 포함 여부 | 메모 |
|------|----------|------|
| 재료 검색 (한글/영문 부분 일치) | YES | MISSION.md 핵심 기능 #1 |
| 카테고리 탐색 (5개 카테고리) | YES | MISSION.md 핵심 기능 #2 |
| 재료 상세 페이지 (9개 정보 항목) | YES | MISSION.md 핵심 기능 #3 |
| 비교 모드 (재료 2~3개 나란히) | YES | MISSION.md 핵심 기능 #4 — 차별화 포인트 핵심 |
| 사용자 로그인 / 회원가입 | NO | v1은 읽기 전용 공개 사이트 |
| 결제 / 유료 기능 | NO | 개인 활용 우선, 수익화 없음 |
| 레시피 제공 | NO | Anti-Scope 명시 — 재료 사전이지 레시피북이 아님 |
| 사용자 커뮤니티 (댓글·팁) | NO | Anti-Scope |
| 즐겨찾기 / 북마크 | NO | 로그인 없이 구현 시 가치 낮음, v1.5 이후 |
| 다국어 UI | NO | Anti-Scope (재료명 영문 표기는 데이터에 포함, UI는 한국어) |
| 모바일 네이티브 앱 | NO | 반응형 웹으로만 대응 |
| 영상 콘텐츠 | NO | Anti-Scope |
| 베이킹 도구·장비 정보 | NO | Anti-Scope |

---

## 3. 기술 스택

이미 학습한 도구를 우선 사용해서 새 학습 비용을 0에 가깝게 유지한다.

| 영역 | 선택 | 이유 |
|------|------|------|
| 프론트엔드 프레임워크 | Next.js (App Router) | 학습 완료, SSR/라우팅/배포 통합 |
| 스타일 | Tailwind CSS | 학습 완료, 빠른 UI 작성 |
| 백엔드 / DB | Supabase (Postgres) | 학습 완료, ingredients 테이블 1개로 충분 |
| 이미지 저장 | Supabase Storage (권장) | 외부 URL 핫링크보다 안정적, 라이선스/만료 관리 용이 |
| 배포 | Vercel | Next.js 친화, GitHub 연동 자동 배포 |
| 인증 | 없음 | v1은 읽기 전용 공개 사이트 |
| 결제 | 없음 | 수익화 없음 |
| 데이터 입력 | Supabase 콘솔 직접 입력 또는 시드 SQL | 30개 분량은 관리자 페이지 만드는 비용보다 저렴 |

### 이미지 저장 결정 — 외부 URL vs Supabase Storage 트레이드오프

사용자 요청 옵션은 "외부 URL을 image_url 컬럼에 저장"이지만, 운영 안정성을 위해 다음을 권장한다.

- 외부 URL (Unsplash 핫링크 등) 단점: ① Unsplash는 핫링크 대신 다운로드 사용을 공식 권장, ② 외부 URL은 만료/끊김 리스크, ③ 라이선스 추적이 흩어짐.
- 권장 방식: 무료 이미지(Unsplash/Pexels) 다운로드 또는 AI 생성 → Supabase Storage에 업로드 → Storage가 발급하는 public URL을 ingredients.image_url 컬럼에 저장.
- 이렇게 하면 image_url 컬럼 구조는 그대로(B안 유지), 저장 위치만 안정적인 곳으로 이동하는 형태.

---

## 4. 데이터 모델

테이블 1개로 v1 전체를 커버한다.

### ingredients 테이블 스키마

| 컬럼 | 타입 | 9개 정보 항목 매핑 | 비고 |
|------|------|--------------------|------|
| id | uuid (PK) | - | Supabase 기본 |
| slug | text (unique) | - | URL용 (예: `bakryeokbun`) |
| name_ko | text | 항목 1 (이름 - 한글) | 검색 대상 |
| name_en | text | 항목 1 (이름 - 영문) | 검색 대상 |
| name_zh | text (nullable) | 항목 1 (이름 - 한자) | 없는 재료는 null |
| category | text | - | 가루류 / 팽창제 / 당류 / 유제품_지방 / 기타 |
| summary | text | 항목 2 (한 줄 정체) | 1~2문장 |
| image_url | text | 항목 3 (사진) | Supabase Storage public URL 권장 |
| role | text | 항목 4 (베이킹에서의 역할) | |
| similar_ingredients | text | 항목 5 (헷갈리는 비슷한 재료와의 차이) | |
| common_mistakes | text | 항목 6 (초보자 자주 하는 실수) | |
| substitutes | text | 항목 7 (대체 가능 여부 + 비율) | |
| storage | text | 항목 8 (보관법) | |
| where_to_buy | text | 항목 9 (한국에서 구매 가능한 곳) | |
| created_at | timestamptz | - | default now() |
| updated_at | timestamptz | - | trigger로 자동 갱신 |

### 카테고리 enum (text로 시작, 필요 시 enum 마이그레이션)

`flour` (가루류) / `leavening` (팽창제) / `sugar` (당류) / `dairy_fat` (유제품·지방) / `etc` (계란·견과·초콜릿·향료)

### 인덱스

- `name_ko`, `name_en`에 trigram 인덱스 (부분 일치 검색 속도)
- `category` 일반 인덱스 (카테고리 필터)
- `slug` unique 인덱스 (상세 페이지 라우팅)

---

## 5. 외부 설정 사항 (사용자가 직접 해야 할 일)

### 필수

| 항목 | 설명 | 획득/설정 방법 |
|------|------|----------------|
| Supabase 프로젝트 | DB + Storage 호스팅 | supabase.com 가입 → New Project → 리전은 가까운 곳 (Tokyo) |
| ingredients 테이블 생성 | 위 스키마대로 SQL Editor에서 실행 | Supabase Dashboard → SQL Editor |
| Supabase Storage 버킷 | 재료 이미지 보관 | Storage → New bucket → 이름 `ingredient-images` → Public 설정 |
| SUPABASE_URL | 클라이언트가 접근할 프로젝트 URL | Project Settings → API → Project URL |
| SUPABASE_ANON_KEY | 공개 읽기용 키 | Project Settings → API → anon public key |
| GitHub 리포 | 코드 버전 관리 + Vercel 연동 | github.com에서 새 private repo 생성 |
| Vercel 계정 + 프로젝트 연결 | 배포 | vercel.com 가입 → Import GitHub repo → 환경변수 등록 |
| .env.local 파일 | 로컬 개발용 환경변수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 두 줄 |

### 콘텐츠 자산

| 항목 | 설명 |
|------|------|
| 무료 이미지 출처 정리 | Unsplash / Pexels에서 재료별 다운로드 후 Supabase Storage에 업로드. 라이선스/출처는 별도 시트에 기록 (v1.5에서 크레딧 페이지 만들 때 사용) |
| AI 생성 이미지 (대안) | DALL-E / Midjourney 등으로 재료 사진 생성 → Storage 업로드. 일관된 스타일 유지 |
| 데이터 시드 (선택) | AI로 30개 재료 초안 생성 → CSV 또는 SQL INSERT 스크립트로 일괄 import |

### .env.local 예시

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 6. 주차별 체크리스트

### 7주차 — 셋업 + 데이터 50%

목표: "동작하는 빈 사이트 + 재료 15개가 DB에 들어있고 카테고리 페이지에서 보임"

- [ ] Next.js 프로젝트 생성 (`npx create-next-app@latest baking-dict --typescript --tailwind --app`)
- [ ] Supabase 프로젝트 생성 + ingredients 테이블 스키마 SQL 실행 + Storage 버킷 생성
- [ ] `.env.local`에 SUPABASE_URL / ANON_KEY 등록 + Supabase 클라이언트 헬퍼 작성 (`lib/supabase.ts`)
- [ ] 재료 30개 최종 리스트 확정 (카테고리별 분배 — MISSION.md 표 기준 8/3/5/5/9 정도)
- [ ] AI(Claude)로 재료 15개의 9개 항목 초안 일괄 생성 → 본인 검수 → DB 입력
- [ ] 이미지 15개 확보 (Unsplash 다운로드 또는 AI 생성) → Supabase Storage 업로드 → image_url 컬럼 채우기
- [ ] 메인 페이지 (`app/page.tsx`) — 5개 카테고리 카드 + 검색바 골격
- [ ] 카테고리 페이지 (`app/category/[slug]/page.tsx`) — 해당 카테고리 재료 리스트 출력 (DB fetch 동작 확인)

체크포인트: 7주차 끝 시점에 카테고리 페이지에서 15개 재료의 이름과 썸네일이 실제 DB에서 렌더링됨.

### 8주차 — 기능 완성 + 데이터 100%

목표: "모든 기능 동작 + 재료 30개 데이터 완성 + Vercel 배포 완료"

- [ ] 재료 상세 페이지 (`app/ingredient/[slug]/page.tsx`) — 9개 정보 항목을 정형 레이아웃으로 렌더링
- [ ] 검색 기능 — 한글/영문 부분 일치 (Supabase `ilike` 쿼리, 입력 → 결과 리스트 → 클릭 시 상세 페이지)
- [ ] **비교 모드 페이지** (`app/compare/page.tsx`) — 쿼리스트링(`?ids=a,b,c`)으로 재료 2~3개 받아 9개 항목을 컬럼으로 나란히 렌더링. 상세 페이지·카테고리 페이지에 "비교에 추가" 버튼 추가
- [ ] 비교 프리셋 — "박력분/중력분/강력분", "베이킹소다/베이킹파우더" 등 자주 헷갈리는 조합 3~5개를 메인 페이지에 바로 진입 가능한 카드로 노출
- [ ] 검색 도달 속도 점검 — 메인 진입 → 검색 → 상세 페이지까지 3초 이내인지 측정
- [ ] 나머지 재료 15개 데이터 + 이미지 완성 (총 30개 × 9항목 = 270칸 100%)
- [ ] 반응형 UI 점검 — 모바일 우선, 검색바·카테고리 카드·상세 페이지·비교 페이지가 360px 폭에서 깨지지 않는지 (비교 모드는 모바일에서 가로 스와이프 또는 세로 스택으로 대응)
- [ ] Vercel 프로젝트 연결 + 환경변수 등록 + production 배포
- [ ] 도메인 연결 (Vercel 기본 도메인으로 충분, 커스텀은 옵션)

체크포인트: 8주차 끝 시점에 production URL에서 외부인이 검색·탐색·상세 보기 전부 가능, 270칸 모두 채워져 있음.

### 데모데이 주 — 마무리 + 발표 준비

목표: "페르소나 시나리오 통과 + 발표 자료 + 백로그 정리"

- [ ] 페르소나 시나리오 직접 테스트 — "민지가 마들렌 레시피 보다 박력분에서 막힘 → 앱 검색 → 답 도달까지 3초" 실제 측정
- [ ] 비교 모드 시나리오 테스트 — "박력분/중력분/강력분 차이가 궁금함 → 메인 비교 프리셋 클릭 → 9개 항목 한 화면에서 비교 완료" 실제 측정
- [ ] 성공 기준 검증 — ① 270칸 100% ② 검색 도달 3초 이내 두 가지 모두 yes/no 기록
- [ ] 발표용 스크린샷 5~8장 (메인 / 카테고리 / 검색 결과 / 상세 페이지 / 모바일 뷰)
- [ ] 데모 영상 30초~1분 (페르소나 시나리오를 그대로 화면 녹화)
- [ ] README.md 작성 (프로젝트 소개 / 기술 스택 / 로컬 실행법 / 배포 URL)
- [ ] 알려진 버그 정리 + v1.5 백로그 분리 문서 (대체재 역방향 탐색, 마트 가이드 등 MISSION의 v1.5 항목)

---

## 7. 위험 요소 및 완화책

| 위험 | 영향 | 완화책 |
|------|------|--------|
| 데이터 작성이 가장 큰 병목 (30개 × 9항목 = 270칸) | 일정 전체 지연 | 7주차에 무조건 50% (15개) 끝낸다. AI 일괄 초안 생성 → 검수 파이프라인을 먼저 굳히고 반복 |
| 이미지 라이선스 추적 누락 | 추후 공개 시 법적 리스크 | 이미지 업로드 시 출처/라이선스를 별도 시트에 즉시 기록. AI 생성 이미지로 통일하면 추적 부담 0 |
| 본인이 베이킹 초보자 → 도메인 검수 어려움 | 데이터 정확도 우려 | MISSION.md에 명시된 대로 v1은 AI 초안 위주로 가고, v1.5에서 외부 베이킹 경험자 리뷰로 보강 |
| Supabase Storage 미설정 시 외부 URL 만료 | 시간 지나면 이미지 깨짐 | 처음부터 Supabase Storage로 가는 결정 고수. 외부 핫링크 금지 |
| 검색 속도 3초 초과 | 핵심 성공 기준 실패 | name_ko/name_en에 trigram 인덱스 추가, 결과는 상위 10개만 fetch |

---

## 8. 다음 단계 (7주차 첫날 시작 액션)

1. `npx create-next-app@latest baking-dict --typescript --tailwind --app` 실행하고 GitHub에 첫 커밋 push.
2. Supabase 프로젝트 생성 → ingredients 테이블 SQL 실행 → Storage 버킷(`ingredient-images`) 생성 → `.env.local`에 키 등록.

이 두 가지가 끝나면 7주차의 나머지 항목은 데이터·UI 작업이라 병렬로 진행 가능하다.
