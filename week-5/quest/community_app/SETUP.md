# Supabase 설정 가이드

PRD §3 의 `posts` 테이블과 Auth 를 동작시키기 위한 1회성 설정입니다.

## 1) Supabase 프로젝트 만들기
1. https://supabase.com 접속 → 프로젝트 생성 (무료 플랜으로 충분)
2. 리전은 `Northeast Asia (Seoul)` 권장
3. 프로젝트 생성 후 **Project Settings → API** 에서 아래 두 값 확보
   - `Project URL` → `.env` 의 `SUPABASE_URL`
   - `anon public` 키 → `.env` 의 `SUPABASE_ANON_KEY`

## 2) Auth 설정
1. **Authentication → Providers → Email** 탭에서 *Email + Password* 활성화
2. (선택) 빠른 테스트를 위해 **"Confirm email" 토글 OFF**
   - 운영에서는 ON 권장. OFF 면 가입 즉시 로그인 세션이 만들어집니다.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:4000`
   - Redirect URLs 에 `http://localhost:4000/**` 추가

## 3) 스키마 적용
1. **SQL Editor → New query** 열기
2. 이 폴더의 [`schema.sql`](./schema.sql) 전체를 붙여넣고 **Run**
3. 다음이 만들어집니다
   - `public.posts` 테이블 (uuid PK, created_at, title, content, user_id FK, author_email)
   - 인덱스 2개 (`created_at desc`, `user_id`)
   - RLS 정책 4개
     - `posts_select_all`  — 누구나 SELECT (anon, authenticated)
     - `posts_insert_own`  — `auth.uid() = user_id` 일 때만 INSERT
     - `posts_update_own`  — 본인만 UPDATE
     - `posts_delete_own`  — 본인만 DELETE
   - 보조 뷰 `public.posts_list` (preview/length 포함)

## 4) 동작 확인
1. 로컬 서버 기동: `npm run dev`
2. http://localhost:4000 접속 → 가입 → 글쓰기 → 다른 계정으로 로그인 후 수정/삭제 버튼이 안 보이는지 확인
3. **RLS 검증** (선택, SQL Editor 에서)
   ```sql
   -- A 계정으로 가입 후 글 1개 작성
   -- B 계정으로 로그인 상태에서:
   update public.posts set title='해킹시도' where user_id <> auth.uid();
   -- → 0 rows affected (RLS 가 차단)
   ```

## 5) 트러블슈팅
| 증상 | 원인 / 해결 |
| :--- | :--- |
| 화면에 "Supabase 연결 필요" 카드 | `.env` 미설정. `cp .env.example .env` 후 값 채우기 → 서버 재시작 |
| 로그인은 되는데 글 작성 시 RLS error | `posts_insert_own` 정책 누락. `schema.sql` 다시 실행 |
| 가입 후 세션 없음 | Email confirmation 활성화 상태. 메일 확인하거나 토글 OFF |
| CORS / 401 | `SUPABASE_ANON_KEY` 가 `service_role` 키로 잘못 들어가지 않았는지 확인 |
