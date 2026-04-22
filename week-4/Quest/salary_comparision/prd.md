## [PRD] 익명 연봉/지출 비교 앱: "너 얼마 벌고 얼마나 써?"

### 1. 프로젝트 개요사용자가 자신의 연봉과 지출 데이터를 익명으로 입력하고, 다른 사용자들의 데이터와 비교하여 자신의 경제적 위치를 파악할 수 있는 웹 서비스입니다. 데이터의 시각화를 통해 직군별 평균 및 상위 백분위를 제공합니다.

### 2. 핵심 목표
- **익명성 보장:** 사용자 인증 없이 누구나 익명으로 데이터를 입력하고 조회할 수 있는 환경 구축.
- **데이터 기반 인사이트:** 단순 저장이 아닌, 수집된 데이터를 가공하여 평균, 분포, 백분위 등의 통계 제공.
- **실시간 업데이트:** 새로운 데이터가 입력될 때마다 실시간으로 변하는 통계 체험.

### 3. 프론트 디자인
- **깔끔한 웹진 형태의 디자인:** https://modoodesign.net/portfolio/%ea%b3%b5%ea%b3%b5%ea%b8%b0%ea%b4%80-%ec%9b%b9%ec%a7%84-%eb%a6%ac%eb%89%b4%ec%96%bc/ 이런형태의 웹진 형태면 좋을듯

### 4. 기술 스택
- **Framework:** Next.js (또는 React + Vite)
- **Backend/Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Visualization:** Recharts 또는 Chart.js (권장)

### 5. 상세 기능 요구사항

### 5.1. 데이터 입력 (User Input)
- **필수 입력 항목:**
    - 월급 (Monthly Income)
    - 총 월 지출 (Total Monthly Expenses)
    - 직군 (Job Category: 개발, 디자인, 기획, 마케팅 등)
    - 연차 (Years of Experience)- **선택 입력 항목 (카테고리별 지출):**
    - 식비, 주거비, 교통비, 구독료 등

### 5.2. 통계 및 비교 (Analytics)
- **내 위치 산출:** 입력한 월급/지출이 전체 데이터 중 상위 몇 %에 해당되는지 계산.
- **전체 통계:**
    - 전체 사용자 평균 월급 및 지출액.
    - 직군별/연차별 평균 데이터 비교.
    - **카테고리별 분석:** 사용자의 지출 비중과 전체 평균 지출 비중 비교 시각화.

### 5.3. 데이터베이스 구조 (Supabase Table)
- **Table Name:** `salary_stats` (예시)
- **Columns:**
    - `id`: uuid (Primary Key)
    - `created_at`: timestamp
    - `monthly_income`: int8
    - `monthly_expenses`: int8
    - `job_category`: text
    - `experience_years`: int4
    - `category_expenses`: jsonb (식비, 주거비 등 상세 내역 저장용)

### 6. 핵심 로직 (API & SQL)
- **평균 계산:** `SELECT AVG(monthly_income) FROM salary_stats WHERE job_category = '개발';`
- **백분위 계산:** 전체 카운트와 나보다 낮은 금액을 가진 사용자의 카운트를 비교하여 계산.
- **그룹화:** `GROUP BY job_category`를 활용한 직군별 통계 추출.

### 7. 사용자 경험 (UX) 및 창의성 포인트
- **차트 시각화:** 막대 그래프나 파이 차트로 내 지출 구조 보여주기.
- **필터링:** 특정 직군이나 특정 연차끼리만 비교할 수 있는 필터 기능.
- **반응형 디자인:** 모바일에서도 간편하게 입력하고 확인할 수 있는 레이아웃.

### 8. 파일의 저장경로 
- **파일저장:** week-4/Quest/salary_comparision 에 모든 파일 저장 

### 9. 히스토리 파일 저장 
- **히스토리:** week-4/Quest/salary_comparision 에 작업 히스토리를 md파일로 저장 