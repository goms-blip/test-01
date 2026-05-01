
## 나만의 가계부 앱 (Account Book App)

### 1. 프로젝트 개요사용자가 자신의 수입과 지출을 체계적으로 관리할 수 있는 가계부 웹 서비스입니다. Server와 Supabase DB를 연동하여 데이터를 영구적으로 저장하고, 카테고리별 통계를 통해 소비 습관을 파악하는 것을 목표로 합니다.

### 2. 핵심 목표
- **데이터 무결성:** 모든 수입/지출 내역을 Supabase DB에 안전하게 저장
- **직관적 조회:** 등록된 내역을 리스트 형태로 한눈에 확인
- **지출 분석:** 카테고리별 합계를 계산하여 소비 패턴 시각화

### 3. 핵심 기능 (User Stories)
### 3.1 내역 관리 (CRUD)
- **등록:** 사용자는 날짜, 금액, 카테고리, 메모, 타입(수입/지출)을 입력하여 내역을 저장할 수 있습니다.- **조회:** 저장된 내역을 최신순으로 리스트업하여 확인할 수 있습니다.
- **수정/삭제:** 잘못 입력된 내역을 수정하거나 삭제할 수 있습니다.

### 3.2 통계 및 분석
- **카테고리별 합계:** SQL `GROUP BY` 기능을 활용하여 식비, 교통, 주거 등 카테고리별 지출 합계를 계산합니다.
- **타입 분류:** 수입과 지출을 구분하여 총 잔액을 표시합니다.

### 4. 프론트 디자인 
- https://www.behance.net/gallery/175434819/_?tracking_source=search_projects|%EA%B0%80%EA%B3%84%EB%B6%80 에 보이는 형식처럼 구현 

### 5. 기술 스택 및 데이터 구조
### 5.1 Tech Stack
- **Frontend:** React / Next.js (추천)
- **Backend:** Node.js (Express) 또는 Next.js API Routes
- **Database:** Supabase (PostgreSQL)

### 5.2 Database Schema (Table: `ledgers`)

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | 고유 식별자 |
| `created_at` | Timestamp | 생성 일시 |
| `date` | Date | 사용자가 설정한 날짜 |
| `type` | Text | 수입(Income) / 지출(Expense) 구분 |
| `amount` | BigInt | 금액 |
| `category` | Text | 식비, 교통, 주거, 구독료, 경조사 등 |
| `memo` | Text | 상세 메모 |

### 6. 단계별 개발 계획 (Milestones)
- **Step 1:** Supabase 프로젝트 생성 및 테이블 스키마 설정
- **Step 2:** Server API 구축 (GET/POST/DELETE)
- **Step 3:** 사용자 입력 폼 및 리스트 UI 구현
- **Step 4:** 카테고리별 합계 쿼리 적용 및 대시보드 구현
- **Step 5 (Advanced):** 월별 리포트 작성 및 차트(Chart.js 등) 시각화