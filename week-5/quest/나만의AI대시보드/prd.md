
## 🚀 나만의 AI 대시보드 (Personal AI Dashboard)

## 1. 프로젝트 개요
사용자의 개인 데이터(Notion, DB, API)를 한곳에 모아 시각화하고, AI 에이전트가 이를 분석하여 개인화된 "오늘의 브리핑"을 제공하는 통합 대시보드 웹 서비스입니다.

* 통합(Integration): 흩어져 있는 개인 데이터를 하나의 화면에 집약
* 지능화(Intelligence): 단순 나열을 넘어 AI가 데이터를 해석하고 인사이트 제공
* 보안(Security): Auth를 통해 개인 정보 보호 및 사용자별 맞춤 경험 제공

## 2. 핵심 기능 (User Stories)
## Part 2-1: 인증 (Auth)
* 사용자는 이메일 또는 소셜 로그인을 통해 대시보드에 접근할 수 있다.
* 로그인하지 않은 사용자는 대시보드 데이터에 접근할 수 없다.

## Part 2-2: 데이터 연동 (Data Sources) - 최소 2개 선택
* Notion 연동: 내 노션 데이터베이스의 할 일(To-do) 목록을 실시간으로 불러온다.
* Supabase DB: 나의 소비 기록이나 습관 형성 데이터를 조회 및 저장한다.
* 외부 API: 현재 위치의 날씨 정보나 관심 분야의 뉴스 헤드라인을 가져온다.

## Part 2-3: AI 브리핑 (AI Agent)
* 연결된 모든 데이터(할 일, 지출, 날씨 등)를 AI에게 컨텍스트로 전달한다.
* AI는 데이터를 분석하여 요약된 "오늘의 브리핑" 텍스트를 생성한다.
* (예: "비가 오니 우산을 챙기시고, 예산이 부족하니 점심은 지출을 아끼세요!")

## Part 2-4: UI/UX 및 배포
* 반응형 웹 디자인으로 제작하여 데스크탑과 모바일에서 확인 가능하다.
* Vercel을 통해 누구나 접속 가능한 URL로 배포된다.

## 3. 기술 스택 (Suggested Stack)
* Framework: Next.js (App Router)
* Auth & DB: Supabase (Auth + PostgreSQL)
* AI: OpenAI SDK (GPT-4o / GPT-3.5-turbo)
* Styling: Tailwind CSS + shadcn/ui (빠른 위젯 구현용)
* Deployment: Vercel

## 4. 단계별 구현 계획 (Roadmap)
* 1단계: Supabase Auth 설정 및 기본 로그인/로그아웃 페이지 구현
* 2단계: 데이터 소스 1개 연결 (예: 외부 날씨 API 또는 DB 연동)
* 3단계: 데이터 소스 2개 연결 (예: Notion MCP 또는 DB CRUD)
* 4단계: AI 브리핑 로직 작성 (Prompt Engineering) 및 위젯 배치
* 5단계: Vercel 배포 및 최종 테스트

## 5. 성공 지표 (Definition of Done)
* 로그인이 정상적으로 작동하는가?
* 최소 2개 이상의 외부/내부 데이터가 화면에 출력되는가?
* AI 브리핑이 실시간 데이터를 반영하여 생성되는가?
* 배포된 URL을 통해 외부에서 접속이 가능한가?

------------------------------
팁: 첫 시작은 Supabase Auth 설정부터 하시는 것을 추천합니다. 그 다음 가장 만만한 날씨 API나 DB 메모장부터 하나씩 붙여보세요!
어떤 데이터 소스를 먼저 연결해볼까요? 구체적인 구현 코드가 필요하시면 말씀해 주세요.

