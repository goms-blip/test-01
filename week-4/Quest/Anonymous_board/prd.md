
# [Server+DB] 익명 고민/칭찬 게시판 PRD

## 🎯 프로젝트 개요Supabase와 Server를 활용하여 익명으로 고민과 칭찬을 나눌 수 있는 게시판 서비스를 구축합니다.

## 프론트 디자인 
**프론트디자인** 깔끔하면서도 절제된 디자인을 사용. 
**칼라사용** 칼라는 형광칼라를 사용해도 괜찮음.
**참고 디자인 사이트** https://lgartssponsorship.lg.co.kr/kr/

## 🚀 주요 기능 (MVP)
1. **익명 글 작성**: 카테고리(고민, 칭찬, 응원 등) 선택 및 내용 작성.
2. **공감 기능**: 게시글별 공감 버튼 클릭 시 DB의 `likes` 수 +1 업데이트.
3. **정렬 조회**: 최신순 및 공감순 정렬 기능.
4. **실시간 반영**: 데이터 변경 사항을 DB(Supabase)에 즉시 저장 및 화면 반영.

## 📊 데이터베이스 구조 (Supabase)### `posts` 테이블

| 컬럼명 | 데이터 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | uuid / int8 | 기본키 (PK) |
| `category` | text | 고민, 칭찬, 응원 등 카테고리 |
| `content` | text | 게시글 본문 |
| `likes` | int8 | 공감 수 (기본값 0) |
| `created_at` | timestamptz | 생성 일시 (기본값 now()) |

## 🛠 기술 스택- **Frontend/Server**: React, Next.js (또는 Node.js Express)- **Database**: Supabase (PostgreSQL)

## 📝 미션 체크리스트- [ ] Supabase 프로젝트 생성 및 `posts` 테이블 설정
- [ ] 글 작성 UI 및 DB Insert API 구현
- [ ] 게시글 리스트 Fetch 및 정렬 기능 구현
- [ ] 공감 버튼 클릭 시 DB Update 로직 구현 (likes + 1)
- [ ] GitHub 저장소 업로드 및 동작 스크린샷 준비