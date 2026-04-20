
## 📝 [PRD] AI 기반 냉장고 파먹기 (AI Recipe Generator)## 1. 제품 개요 (Product Overview)

* 목적: 사용자의 냉장고에 있는 재료를 활용하여 AI가 최적의 레시피를 제안하고, 이를 관리할 수 있는 서비스 제공.
* 핵심 가치: 재료 낭비 방지, 메뉴 결정 장애 해결, 개인화된 요리 경험.
* 기술 스택: Supabase (DB/Auth), AI API (OpenAI/Claude 등), 프레임워크 (Next.js/React 등). [1] 

## 2. 주요 기능 (Key Features)## 2.1 재료 관리 (Existing)

* 기존 ingredients 테이블을 활용한 재료 목록 조회 및 관리.
* 냉장고에 현재 남아있는 재료 리스트업.

## 2.2 AI 레시피 생성 (Core)

* 프롬프트 엔진: DB의 재료 목록을 AI API에 전달하여 레시피 생성.
* 옵션 선택: "간단 요리", "다이어트", "야식", "술안주" 등 사용자 취향 옵션 제공.
* 추가 정보 생성: 요리명, 단계별 조리법, 예상 조리 시간, 난이도 포함.

## 2.3 레시피 저장 및 조회 (New)

* 선택적 저장: AI가 생성한 레시피 중 사용자가 마음에 드는 것만 DB에 저장.
* 레시피 보관함: 저장된 레시피 목록 조회 및 상세 보기 기능.
* 필터링: 난이도별, 조리 시간별 정렬 및 필터 기능.

## 3. 데이터 모델 (Database Schema)## 3.1 ingredients (기존 테이블 활용)

* id: primary key
* name: 재료명
* quantity: 수량
* created_at: 등록일

## 3.2 recipes (신규 테이블)

* id: primary key
* title: 요리 제목
* content: 조리 방법 (Text/JSON)
* ingredients_used: 사용된 재료 목록
* difficulty: 난이도 (쉬움/보통/어려움)
* cooking_time: 예상 소요 시간 (분)
* category: 카테고리 (다이어트, 야식 등)
* is_favorite: 즐겨찾기 여부 (boolean)

## 4. 사용자 흐름 (User Flow)

   1. 재료 확인: 사용자가 냉장고 속 재료 목록을 확인합니다.
   2. 조건 설정: 원하는 테마(예: 야식)를 선택하고 '레시피 생성' 버튼을 클릭합니다.
   3. AI 호출: 서버에서 DB 재료 + 선택 옵션을 조합해 AI API를 호출합니다.
   4. 결과 확인: 생성된 레시피의 시간, 난이도를 확인합니다.
   5. 저장: 레시피가 마음에 들면 '저장하기'를 눌러 DB(recipes)에 기록합니다.
   6. 목록 보기: '나의 레시피' 메뉴에서 저장된 목록을 조회합니다.

## 5. 창의성 포인트 (Extra)

* 즐겨찾기: 자주 만드는 레시피 하트 표시 기능.
* 난이도 뱃지: 목록에서 난이도별로 컬러 뱃지 표시 (초록-쉬움, 빨강-어려움).
* 재료 연동: 레시피 저장 시 사용된 재료를 DB에서 차감하는 기능 (도전 과제).

------------------------------
## 🚀 개발을 위한 다음 단계
이 PRD를 복사해서 AI 에이전트(Cursor, ChatGPT 등)에게 다음과 같이 질문하며 시작해 보세요!

"첨부한 PRD를 바탕으로 Supabase의 ingredients 테이블에서 데이터를 가져와 AI 레시피를 만들고, 다시 recipes 테이블에 저장하는 Next.js API route 코드를 짜줘."

어떤 프레임워크(React, Next.js, Flutter 등)를 사용하여 개발하실 예정인가요? 말씀해 주시면 그에 맞는 DB 스키마 생성 SQL이나 API 연동 코드 작성을 도와드릴 수 있습니다.

[1] [https://play.google.com](https://play.google.com/store/apps/details?id=com.exciting.fridgemate.fridgemate&hl=ko#:~:text=AI%20%EA%B8%B0%EC%88%A0%EC%9D%84%20%ED%99%9C%EC%9A%A9%ED%95%98%EC%97%AC%20%EB%83%89%EC%9E%A5%EA%B3%A0%20%EC%86%8D%20%EC%9E%AC%EB%A3%8C%EB%A5%BC%20%EB%98%91%EB%98%91%ED%95%98%EA%B2%8C,%EA%B3%A0%EA%B0%9D%EB%8B%98%EC%9D%98%20%EB%AA%A8%EB%93%A0%20%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%8A%94%20%EC%8A%A4%EB%A7%88%ED%8A%B8%ED%8F%B0%20%EB%82%B4%EB%B6%80%EC%97%90%EB%A7%8C%20%EC%95%88%EC%A0%84%ED%95%98%EA%B2%8C%20%EC%A0%80%EC%9E%A5%EB%90%A9%EB%8B%88%EB%8B%A4.)
