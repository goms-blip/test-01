
## 📝 [PRD] 실시간 밸런스 게임 앱: "Money Balance"

## 1. 프로젝트 개요
사용자가 흥미로운 밸런스 게임 질문(특히 '돈' 관련)을 등록하고, 실시간으로 투표 결과(퍼센티지 및 참여자 수)를 확인할 수 있는 웹 애플리케이션입니다.

## 2. 목표

* 실시간성: 투표 시 즉각적으로 변하는 투표율 그래프 구현
* 데이터 영속성: Supabase를 활용한 질문 및 투표 데이터 저장
* 사용자 경험: 누구나 쉽게 질문을 올리고 결과에 참여하는 간단한 UI

## 3. 프론트 디자인 

* http://softbook.co.kr/book/magazine/yakult/sm-15/pt-post/nd-165 에 있는 이미지처럼 디자인 작업 진행 

## 4. 핵심 기능 (Features)

## 4.1 질문 등록 (Create)

* 입력 항목: 선택지 A, 선택지 B (예: 월 500 주7일 vs 월 300 주4일)
* 카테고리 분류 (창의성 포인트): '직장/연봉', '재테크/소비', '일상/음식' 등 태그 선택 기능

## 4.2 실시간 투표 (Vote & Real-time Update)

* 투표 로직: 사용자가 버튼 클릭 시 votes 테이블에 데이터 추가
* 실시간 반영: Supabase의 Realtime 기능을 활용해 페이지 새로고침 없이 투표율 업데이트
* 중복 투표 방지: 로컬 스토리지 또는 IP 기반 간단한 체크

## 4.3 결과 조회 (Read & Rank)

* 투표 결과: 총 참여자 수와 A vs B의 백분율(%) 표시
* 인기 질문 랭킹 (창의성 포인트): 투표 수가 많은 순서대로 질문 정렬

## 5. 기술 스택 (Tech Stack)

* Frontend: React.js / Next.js (Tailwind CSS로 디자인)
* Backend/DB: Supabase (PostgreSQL)
* State Management: React Query (서버 상태 관리)

## 6. 데이터베이스 설계 (ERD)## questions 테이블

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | 질문 고유 아이디 |
| created_at | timestamp | 생성 시간 |
| option_a | text | 선택지 A 내용 |
| option_b | text | 선택지 B 내용 |
| category | text | 질문 카테고리 |

## votes 테이블

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | 투표 고유 아이디 |
| question_id | uuid (FK) | questions.id 참조 |
| choice | text | 'A' 또는 'B' |
| created_at | timestamp | 투표 시간 |

## 7. 개발 로드맵

   1. 1단계: Supabase 프로젝트 생성 및 테이블 셋팅
   2. 2단계: 질문 등록 폼 및 질문 리스트 UI 구현
   3. 3단계: 투표 기능 연동 및 COUNT 함수를 이용한 투표율 계산 API 작성
   4. 4단계: Supabase Realtime 구독 설정으로 실시간 바 애니메이션 적용
   5. 5단계: 카테고리 필터링 및 인기순 정렬 기능 추가 (창의성 보너스)



