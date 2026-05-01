
## [PRD] Simple E-Commerce (Auth + DB)

## 1. 프로젝트 개요

* 프로젝트 명: 커피향 가득한 5월의 풍경

* 핵심 목표: Supabase(Auth, DB)를 활용하여 상품 조회부터 장바구니 관리까지의 이커머스 핵심 흐름 구현
* 주요 타겟: 로그인 후 개인화된 장바구니 서비스를 이용하고자 하는 사용자

## 2. 사용자 흐름 (User Flow)

   1. 비로그인 사용자: 상품 목록 열람 → 상세 설명 확인 → 장바구니 담기 시도 → 로그인 페이지 유도
   2. 회원가입/로그인: 계정 생성 및 인증
   3. 로그인 사용자: 상품 목록 열람 → 장바구니 담기 → 장바구니 페이지 이동 → 수량 조절 및 삭제 → 총 합계 확인

## 3. 핵심 기능 명세## Part 1: 상품 목록 (Public)

* 데이터 표시: 상품명, 가격, 이미지, 설명
* 접근 권한: 로그인 여부와 관계없이 모든 방문자 노출
* UI 구성: 그리드(Grid) 형태의 카드 레이아웃(https://kurasu.kyoto/collections/kurasu-merch)

## Part 2: 인증 (Auth)

* 회원가입: 이메일/비밀번호 기반 가입
* 로그인: 가입된 계정으로 인증 및 세션 유지
* 인가(Authorization): 장바구니 추가/조회 기능은 로그인 세션이 있을 때만 활성화

## Part 3: 장바구니 (Private)

* 추가: 특정 상품을 내 장바구니에 저장 (중복 추가 시 수량 증가 로직 고려)
* 조회: 본인이 담은 상품 목록만 필터링하여 노출
* 수량 관리: +, - 버튼을 통한 실시간 수량 변경
* 삭제: 특정 아이템 제거 기능
* 합계 계산: 가격 x 수량의 전체 합계 금액 자동 산출

## 4. 데이터베이스 구조 (Supabase)## products 테이블 (Read Only for Public)

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 상품 고유 ID |
| name | text | 상품명 |
| price | int4 | 가격 |
| image_url | text | 상품 이미지 URL |
| description | text | 상품 상세 설명 |

## cart 테이블 (RLS 설정 필수)

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 장바구니 항목 고유 ID |
| user_id | uuid (FK) | auth.users.id 참조 |
| product_id | uuid (FK) | products.id 참조 |
| quantity | int4 | 담은 수량 (기본값 1) |

## 5. 기술 스택 및 배포

* Frontend: React / Next.js (선택)
* Backend/DB: Supabase (Auth, PostgreSQL)
* Styling: Tailwind CSS (권장)
* Deployment: Vercel

