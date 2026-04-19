냉장고 재료 및 레시피 관리 앱의 PRD(제품 요구사항 정의서)입니다. 이 내용을 바탕으로 개발을 시작하시면 Supabase 설계부터 API 구현까지 체계적으로 진행하실 수 있습니다.
------------------------------
## 📝 [PRD] 냉장고 재료 & 레시피 관리 앱 (Refri-Manager)

## 1. 프로젝트 개요
사용자가 냉장고 속 식재료를 관리하고, 자신만의 요리 레시피를 저장할 수 있는 풀스택 웹 서비스입니다. Supabase를 활용하여 데이터의 영속성을 유지하며, 추후 AI 기능을 확장할 수 있는 기초 구조를 구축합니다.
## 2. 핵심 목표

* 재료 관리: 냉장고 내 재료의 실시간 CRUD (생성, 조회, 삭제)
* 레시피 저장: 나만의 요리법 기록 및 목록 열람
* 데이터 연동: Supabase DB를 통한 안정적인 데이터 저장 및 서버 API 통신

## 3. 유저 스토리

* "나는 냉장고에 남은 재료를 등록해서 무엇이 있는지 한눈에 보고 싶다."
* "더 이상 없는 재료는 목록에서 바로 삭제하고 싶다."
* "나중에 참고하기 위해 내가 만든 요리의 레시피를 재료와 함께 기록하고 싶다."

## 4. 핵심 기능 (Features)
## 4.1. 식재료 관리 (Ingredients)

* 등록: 재료명 입력 및 카테고리(육류, 채소 등) 선택 후 저장
* 조회: 현재 냉장고에 있는 재료 목록을 태그 형태 혹은 리스트로 표시
* 삭제: 소비한 재료를 목록에서 즉시 제거

## 4.2. 레시피 관리 (Recipes)

* 작성: 요리명, 필요한 재료, 단계별 조리법(Steps) 입력 및 저장
* 목록 조회: 저장된 전체 레시피 카드로 확인
* 상세 보기: 특정 레시피의 세부 조리법 확인

## 4.3. 추가 구현 (창의성 포인트)

* 유통기한 관리: 재료 등록 시 유통기한 입력 및 디데이 표시
* 카테고리 분류: 식재료별 아이콘/태그 분류
* 검색: 재료명이나 레시피 제목으로 검색

## 5. 기술 스택 및 데이터 구조## 5.1. Tech Stack

* Frontend: React, Next.js, or Vue (선택)
* Backend: Node.js (Express) or Next.js API Routes
* Database: Supabase (PostgreSQL)

## 5.2. Database Schema (Supabase)## ingredients Table

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | 고유 ID |
| name | Text | 재료 이름 |
| category | Text | 카테고리 (육류, 채소, 유제품 등) |
| expiry_date | Date | 유통기한 (선택 사항) |
| created_at | Timestamp | 등록 일시 |

## recipes Table

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | 고유 ID |
| title | Text | 요리명 |
| ingredients | Text[] | 필요 재료 (배열 형식) |
| steps | Text | 조리법 (Markdown 혹은 긴 텍스트) |
| created_at | Timestamp | 생성 일시 |

## 6. 핵심 로직 흐름 (Data Flow)

   1. 입력: 사용자 UI에서 데이터 입력 (Fetch API/Axios 사용)
   2. 요청: Server(API Route)로 데이터 전송
   3. 저장: Server에서 Supabase Client를 통해 DB에 INSERT
   4. 갱신: 성공 응답 후 UI에서 최신 목록을 다시 GET 하여 화면 동기화

------------------------------
다음 단계로 무엇을 도와드릴까요?

   1. 이 PRD를 바탕으로 Supabase 테이블 생성 SQL 쿼리를 짜드릴까요?
   2. React/Next.js 기반의 기본 UI 코드를 작성해드릴까요?


