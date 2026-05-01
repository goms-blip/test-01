
# 📝 Project: Auth 기반 커뮤니티 앱 구축

## 1. 프로젝트 개요
- **목적**: Supabase Auth를 연동하여 '사용자 식별'이 가능한 커뮤니티 서비스를 구축합니다.
- **핵심 가치**: 익명 게시판에서 진화하여, 작성자 권한 관리(자신의 글만 수정/삭제)가 가능한 앱을 만듭니다.
- **기술 스택**: React/Next.js (선택), Supabase (Auth, Database), Vercel (Deployment)

## 2. 주요 기능 (User Stories)
### Part 1: 인증 (Authentication)
- [ ] **회원가입**: 이메일과 비밀번호를 통해 새로운 계정을 생성할 수 있다.
- [ ] **로그인/로그아웃**: 가입한 계정으로 서비스에 접속하고 나갈 수 있다.
- [ ] **프로필 확인**: 로그인한 사용자의 정보를 화면에 표시한다. 

### Part 2: 게시글 관리 (CRUD)
- [ ] **작성 (Create)**: 로그인한 사용자만 제목과 내용을 입력하여 글을 쓸 수 있다.
- [ ] **조회 (Read)**: 로그인 여부와 관계없이(또는 로그인 후) 모든 게시글 목록과 상세 내용을 볼 수 있다.
- [ ] **수정/삭제 (Update/Delete)**: 게시글의 작성자(user_id)와 현재 로그인한 사용자가 일치할 때만 수정/삭제 버튼이 활성화되고 동작한다.

### Part 3: 게시글 목록 (UI/UX)
- [ ] **리스트 뷰**: 전체 게시글을 최신순으로 정렬하여 표시한다.
- [ ] **메타 데이터**: 각 게시글에 제목, 작성자 이름(또는 이메일), 작성 시간을 표시한다.

## 3. 데이터베이스 구조 (Supabase)
### Table: `posts`

| Column Name | Type | Description |
| :--- | :--- | :--- |
| id | uuid (PK) | 게시글 고유 아이디 |
| created_at | timestamp | 작성 시간 (default: now()) |
| title | text | 게시글 제목 |
| content | text | 게시글 내용 |
| user_id | uuid (FK) | 작성자 ID (auth.users 참조) |
| author_email| text | 작성자 식별용 이메일 또는 닉네임 |

