# 모두의 광장 — Auth 기반 커뮤니티 앱

PRD: [`prd.md`](./prd.md) · 작업 히스토리: [`WORK_HISTORY.md`](./WORK_HISTORY.md) · Supabase 설정: [`SETUP.md`](./SETUP.md)

> Supabase Auth 로 사용자를 식별하고, 자기 글만 수정·삭제할 수 있는 한 페이지짜리 커뮤니티.
> 디자인은 [godly.website / Gamma](https://godly.website/website/gamma-272) 의 **떠다니는 캐릭터 + 굵은 고딕 타이포** 무드를 차용.

## 스택
- **Frontend** — React 18 (UMD CDN) + Tailwind (CDN) + Babel standalone
- **Auth & DB** — Supabase (`@supabase/supabase-js@2`)
- **Server** — Express (정적 호스팅 + `/env.js` 로 환경변수 주입)
- **Font** — Pretendard (고딕) + Space Grotesk (디스플레이)

## 빠른 시작
```bash
cd week-5/quest/community_app

# 1) 의존성
npm install

# 2) Supabase 키 채우기
cp .env.example .env
#   .env 의 SUPABASE_URL / SUPABASE_ANON_KEY 를 본인 프로젝트 값으로 교체

# 3) Supabase SQL Editor 에서 schema.sql 한 번 실행
#    (posts 테이블 + RLS 정책이 만들어집니다)

# 4) 개발 서버
npm run dev      # 또는 npm start
# → http://localhost:4000
```

## 화면
| 영역 | 설명 |
| :--- | :--- |
| 헤더 | 로고 / 로그인 상태 / 로그아웃 |
| 히어로 | 떠있는 코랄 캐릭터 + 별·하트 스티커 + 굵은 디스플레이 타이포 |
| 글쓰기 | 로그인 시에만 활성화. 로그아웃 상태에서는 안내 카드 |
| 피드 | 최신순 2-컬럼 그리드 카드. 작성자 이메일 해시로 캐릭터 색·기호 결정 |
| 카드 | 본인 글이면 수정/삭제 버튼 노출 (RLS 가 한 번 더 차단) |

## 폴더
```
community_app/
├─ prd.md             요구사항
├─ schema.sql         Supabase posts 테이블 + RLS
├─ server.js          Express 정적 서버 + /env.js
├─ index.html         단일 SPA (React + Supabase JS)
├─ package.json
├─ .env.example
├─ README.md
├─ SETUP.md           Supabase 프로젝트 설정 가이드
└─ WORK_HISTORY.md    이 프로젝트의 모든 작업 기록
```

## 주의
- `SUPABASE_ANON_KEY` 는 클라이언트에 노출돼도 안전한 공개 키입니다 (RLS 가 권한 통제).
- `SERVICE_ROLE` 키는 절대 `index.html` / `.env.example` 에 두지 마세요.
- `.env` 는 `.gitignore` 에 등록되어 있습니다.
