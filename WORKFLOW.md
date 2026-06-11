# 작업 로그 — 실시간 행사 Q&A 솔루션

> 이 파일은 사용자의 지시와 그에 따른 작업 내역을 누적 기록하는 워크플로우 로그입니다.
> **규칙:** 사용자가 따로 요청하지 않아도, 의미 있는 작업/결정/수정이 있을 때마다 이 파일에 항목을 추가합니다. (최신 항목이 위로 오도록 역순 기록)

- **프로젝트 기준 문서:** `realtime_event_qna_prd_supabase_mvp_v2.md`
- **산출물:** `index.html` (CDN React + Tailwind, 빌드 도구 없는 단일 파일)
- **로컬 실행:** `cd /Users/sh_oh/Downloads/QA && npx serve .` → 브라우저에서 `#/admin`

---

## 2026-06-11

### 18) 트랙(Track) + 강연자(speaker)
- **지시:** 멀티 트랙(최대 4 등) 운영 지원, 사용자도 트랙별로 보기, 세션 폼 '설명'→'강연자'.
- **처리:**
  - `add_tracks_speaker.sql`: `tracks` 테이블(project 하위, RLS on·anon 정책 없음=server 전용) + `sessions.track_id`(FK set null)·`sessions.speaker`.
  - server.js: 트랙 CRUD(`GET/POST /api/admin/projects/:pid/tracks`, `PATCH/DELETE /api/admin/tracks/:id`, 콘솔 보호). 세션 생성/수정이 track_id·speaker 저장. 매퍼에 speaker/track_id/track_name. 랜딩이 tracks 배열+세션 track_id/speaker 반환. 공개 세션 단건에 speaker/track_name. SQL 미실행 폴백(PGRST205/42703 방어).
  - index.html: 프로젝트 상세에 "트랙 추가" 버튼+트랙 칩(삭제), 세션을 트랙별 섹션으로. 세션 모달 '세션 설명'→'강연자' + 트랙 드롭다운. 랜딩(사용자) 트랙 2개+ 시 트랙별 섹션(같은 시간대 구분), 카드에 강연자 표시.
- **검증:** 트랙 2개 생성→세션 배정→랜딩/관리자 모두 트랙별 그룹핑+강연자 표시, 세션 모달 강연자/트랙 확인. 프로덕션 재배포.
- **주의:** 테스트로 트랙 2개(Track A·메인홀/Track B·세미나실)·강연자 2명을 실데이터에 넣음 → 사용자가 실제 값으로 교체/삭제 가능.

### 17) 짧은 코드 URL + 사용자 페이지 "전체 세션 보기" 버튼
- **지시:** "긴 UUID 안 보이게 짧게" + "사용자 페이지에 전체(목록)로 가는 버튼 추가."
- **처리:**
  - `add_short_codes.sql`: projects/sessions에 `code`(6 hex, unique) 컬럼 + 백필.
  - server.js: code 생성(생성 시 발급)·해석(uuid면 id, 아니면 code) 헬퍼. 신규 `GET /api/public/sessions/:codeOrId`(공개 세션+project_code). 랜딩·관리자 세션 라우트가 code/uuid 모두 수용. 매퍼에 code 추가.
  - index.html: 단축 라우트 `#/s/:code`·`#/e/:code`·`#/a/:code`(기존 긴 라우트 유지). URL 생성부(사용자 URL/관리자 URL/행사 QR)가 code 사용(없으면 UUID 폴백). UserSessionPage에 "전체 세션 보기" 버튼 → `#/e/<project_code>`.
  - SQL 미실행이어도 UUID 폴백으로 안 깨짐(42703 방어).
- **검증:** 코드 발급(프로젝트 feb8a3, 세션 5d6eb7/6ab014), 로컬·라이브 단축 라우트 200, "전체 세션" 버튼 랜딩 이동 확인. 프로덕션 재배포.

### 16) 관리자 대시보드 URL에서 토큰 숨김
- **지시:** "주소 뒤쪽 토큰값 안 보이게 삭제 가능하면 해줘."
- **처리:** `AdminDashboardPage`가 진입 시 `?token=`을 `sessionStorage(qa_admin_token_:id)`에 저장 후 `history.replaceState`로 주소창에서 토큰 제거. 새로고침 시 sessionStorage에서 복원. `sessionToken`은 useMemo(URL 우선, 없으면 sessionStorage). tokenInfo도 sessionToken 기준.
- **검증:** 토큰 URL 진입 → 주소 깨끗(토큰 없음)+sessionStorage 보관, 클린 URL 새로고침해도 "토큰 인증됨" 정상. 프로덕션 배포.

### 15) 관리자 대시보드 403 무한루프 버그 수정
- **증상:** 대시보드에서 `403 세션 접근 권한이 없습니다` 콘솔 폭주(수백 회).
- **원인 2가지:**
  1. (무한루프) `AdminDashboardPage`의 `load` useCallback deps에 `toast` 포함 → 에러 시 `toast.show` → 리렌더 → `useToast()` 새 객체 → load 재생성 → effect 재실행 → 무한 반복. (12번 모달과 동일 패턴)
  2. (403 자체) 사용자가 **옛/잘못된 토큰**(토큰 변경 전 구 콘솔토큰)이 든 대시보드 URL을 열었음. 라이브 API는 정상(세션토큰/콘솔토큰 200, 무토큰 401).
- **수정:** `toastRef = useRef(toast)` 안정화 + load deps에서 toast 제거 → 잘못된 토큰이어도 403 **단 1회**, "주소를 확인해 주세요" 안내 화면 표시(루프 없음). 올바른 토큰이면 정상 렌더 확인. 프로덕션 재배포.

### 14) Vercel 프로덕션 배포
- **지시:** "배포 들어가자."
- **보안 선수정(중요):** `server.js`의 `express.static(__dirname)` 제거 → 디렉토리 전체 정적 노출(`/.env.local`로 service_role 키 유출) 차단. 비-API GET은 catch-all `app.get('*')`로 index.html만 반환. 검증: `/.env.local`·`/server.js` 요청 시 시크릿 대신 HTML.
- **배포 구성:** `vercel.json`(@vercel/node, server.js로 라우팅, includeFiles index.html), `.vercelignore`(.env.local·*.sql·*.md·.claude 등 제외).
- **실행:** vercel CLI(로그인됨: seunghunoh-1757) → `vercel link`(384s-projects/event-qna) → 환경변수 4개(SUPABASE_URL·SERVICE_ROLE·ANON·ADMIN_CONSOLE_TOKEN) production 등록 → `vercel --prod`.
- **프로덕션 URL:** https://event-qna.vercel.app
- **검증(curl+브라우저):** `/` 200, 관리자 API 무토큰 401/토큰 200, 공개 랜딩 API 200, `/.env.local` 시크릿 0건, 사용자 페이지 실데이터 3단 렌더.
- **보안 TODO:** 공개 배포되었으므로 `ADMIN_CONSOLE_TOKEN`은 강한 값으로 유지(실제 값은 `.env.local`·Vercel 환경변수에만 보관, 저장소에 기록 금지).

### 13) 테스트 데이터 정리 (시드 상태 복구)
- **지시:** "테스트 질문 정리부터 해줘."
- **처리(service_role REST):** 테스트 질문 "Supabase 연동 테스트 질문입니다" 삭제 / 테스트 중 누른 좋아요 복구(한지원 18→17, 박매니저 10→9) / votes 0건 초기화.
- **결과:** b1 세션 좋아요 24·17·9·5·2(숨김), 질문 5건, votes 0 — 시드 상태 복구 확인.

### 12) 금지어 필터 (기본 목록 + 등록 차단 + 운영자 관리)
- **지시:** "추천 조합(기본 목록+등록 차단)으로 + 운영자 콘솔에서 추가/삭제도 가능하게."
- **처리:**
  - `banned_words.sql` 작성: 테이블 `banned_words(id,word unique,created_at)` + RLS(anon select만) + 기본 금지어 23개 + `questions` 트리거 `reject_banned_words`(제목/본문/작성자에 금지어 시 insert/update 거부, security definer).
  - server.js(single-server-specialist): 콘솔 보호 라우트 `GET/POST/DELETE /api/admin/banned-words`(중복 409, 빈값 400).
  - index.html: 사용자 폼 사전 차단(anon `banned_words` 조회·세션 캐시, 제목+내용+이름 부분매칭 → "부적절한 표현…" 오류) + 백스톱(insert가 트리거로 거부되면 동일 메시지 처리). 관리자 홈에 "금지어 관리" 모달(목록/추가/삭제, 콘솔 토큰).
  - 사전검사(빠른 UX) + DB 트리거(우회 방지) 2중.
  - 에이전트가 모달 무한 refetch 버그 발견·수정(toast useRef 안정화).
- **검증 완료(SQL 실행 후):** banned_words 23개 anon 조회 / 트리거 차단(직접 insert "병신" → 400 `BANNED_WORD`) / 사용자 폼 사전 차단("부적절한 표현…" + 등록 막힘) / 운영자 콘솔 "금지어 관리" 모달(목록 23·추가·삭제) 정상.

### 11) 공개 페이지 데스크탑 반응형 (모바일 무변경)
- **지시:** "핸드폰 위주로 짠 것 같다. 노트북/PC에선 여러 질문이 보이게 조정해줘. 모바일은 지금이 딱 맞음."
- **처리(single-react-dev):** 공개 페이지만 수정.
  - 사용자 질문 목록: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, 컨테이너 `max-w-7xl mx-auto`. 일반 CSS Grid(행 우선)로 인기순 좌상단→우 유지(`columns-*` 금지).
  - 랜딩 세션 목록: `grid md:grid-cols-2`, `max-w-6xl`.
  - "질문하기": 모바일 하단 고정 바 유지(`md:hidden`), 데스크탑은 헤더 우측 일반 버튼(`hidden md:inline-flex`).
- **검증:** 1440px 3단(24·17·10 / 5·0 순서 유지), 414px 단일 컬럼+하단 고정 버튼 무변경.

### 10) 행사용 단일 QR + 공개 랜딩 페이지
- **지시:** "QR 하나로 참가자가 세션을 골라서 진행하고 싶다."
- **처리(single-server-specialist):**
  - server.js: `GET /api/public/projects/:projectId/landing`(인증 불필요, 공개) — `{project:{id,title}, sessions:[공개 세션만 {id,title,description,starts_at,ends_at,questionCount}]}`. admin_token 등 민감필드 미노출.
  - index.html: 공개 랜딩 `#/event/:projectId`(`EventLandingPage`, 토큰 게이트 밖) — 행사 제목 + 공개 세션 카드, 탭 시 `#/session/:id` 이동.
  - 재사용 `QrCodeModal`(url prop) — 캔버스 QR + URL 복사 + PNG 다운로드, 다크모드에서도 흰배경/검은모듈. 프로젝트 상세 헤더에 `행사 QR` 버튼.
  - QR 라이브러리: 요청한 qrcode@1.5.3 UMD가 404라 글로벌 `QRCode` 제공하는 `qrcode@1.5.1/build/qrcode.min.js` 사용.
- **데모 QR URL:** `{origin}/#/event/00000000-0000-0000-0000-0000000000a1`
- **검증:** API 200(공개 세션 2, admin_token 미포함)/404, 브라우저 랜딩·세션이동·QR 렌더/다운로드 OK.

### 9) 관리자 백엔드 server.js 구축 + 관리자 프론트 연동
- **지시:** "server.js 작업을 해줘." (single-server-specialist 활용)
- **처리:**
  - `.env.local`에 `ADMIN_CONSOLE_TOKEN`(운영자 콘솔 보호용 글로벌 토큰) + `PORT=8787` 추가.
  - `server.js`(Express) + `package.json`(express·@supabase/supabase-js·exceljs·dotenv) 생성. service_role 클라이언트로 RLS 우회, index.html 같은 오리진 서빙.
  - 인증 2단계: `requireConsole`(=ADMIN_CONSOLE_TOKEN), `requireSessionAdmin`(콘솔 토큰 OR 해당 세션 admin_token). 토큰은 `x-admin-token` 헤더 또는 `?token=`.
  - 라우트: 프로젝트 CRUD+통계, 세션 CRUD+통계, 관리자 질문조회(숨김 포함), 답변/숨김 토글, 세션·프로젝트 엑셀 export(exceljs, PRD 컬럼/파일명).
  - index.html 관리자 mock 메서드 전부 → server API fetch로 교체. 콘솔 토큰 게이트(`ConsoleTokenGate`, sessionStorage). 세션 대시보드는 URL `?token=` 사용. 엑셀 버튼 실연결. 관리자 대시보드 anon Realtime 구독→refetch.
- **검증(curl+브라우저):** 무토큰 401 / 콘솔토큰 200(프로젝트 세션2·질문6) / 세션토큰 숨김포함 6건 좋아요순 / 오답토큰 403 / 엑셀 200(xlsx) / 답변·숨김 토글 DB 영속 / 콘솔 게이트 인증 후 실데이터 렌더.
- **실행:** `npm install && npm start` → `http://localhost:8787` (콘솔 `#/admin`, 토큰은 `.env.local`).

### 9-1) 비공개 세션 대시보드 버그 수정
- **문제:** 관리자 대시보드가 세션 메타를 anon `fetchSession`으로 가져와 비공개 세션은 "세션을 찾을 수 없음".
- **수정:** server.js에 `GET /api/admin/sessions/:sessionId`(requireSessionAdmin) 추가. index.html에 `fetchAdminSession(id, token)` 추가하고 `AdminDashboardPage`가 이걸 쓰도록 교체(사용자 페이지 anon fetchSession은 유지).
- **검증:** curl 200/401/403, 브라우저 대시보드 정상 렌더(전체5·대기4·완료1·숨김1).

### 8) 사용자(공개) 페이지 Supabase 실연동
- **지시:** URL/anon/service_role 키 3개 전달받음.
- **처리:**
  - `.env.local`에 키 3개 저장(gitignore됨). `supabase_seed.sql`(고정 UUID 데모 데이터) 작성.
  - `index.html`: supabase-js UMD CDN 추가, 설정 상수 + 클라이언트 `sb` 생성(anon만, service_role 미포함).
  - 사용자 경로 mockApi 4종을 Supabase 호출로 교체: `fetchSession`(maybeSingle, 실패 시 mock 폴백), `fetchQuestions(...,'user')`(is_hidden=false, like DESC/created ASC), `createQuestion`(insert, content↔body 매핑), `likeQuestion`(rpc `like_question`). 필드 매퍼 `mapSessionRow`/`mapQuestionRow`.
  - 관리자 경로(프로젝트/세션 CRUD·답변/숨김·대시보드 조회·통계·엑셀)는 mock 유지 + "TODO: server.js(service_role)" 주석. → 과도기 하이브리드.
- **블로커→해결:** REST가 `503 PGRST002` 반환 → 원인은 **Data API(PostgREST) 비활성화**(신규 프로젝트 기본 off)였음. Supabase 대시보드 Integrations → Data API → Overview에서 **Enable** 후 해결. (Exposed schemas에 `public` 필요.)
- **검증 완료(브라우저 + curl):**
  - 공개 세션 2건 anon 조회 / 질문 4건 좋아요순(24·17·9·5) 로드 ✅
  - RLS: 숨김 질문("점심 메뉴")은 anon에 미노출 ✅
  - 좋아요 RPC: 9→10 DB 반영, 클릭 후 버튼 disabled(1인1표) ✅
  - 질문 등록: DB 저장 + 목록 카운트 4→5 ✅
- 테스트 URL: `#/session/00000000-0000-0000-0000-0000000000b1`
- **남은 것:** 관리자 경로는 아직 mock. 다음 단계 = server.js(service_role) 로 프로젝트/세션 CRUD·답변/숨김·엑셀 이전 + 관리자 Realtime.

### 7) Supabase 셋업 시작 — 아키텍처 확정 + 스키마 작성
- **지시:** "supabase 셋업 들어가자. 필요한 거 알려줘." / "single-server-specialist 에이전트 활용하면 되지?"
- **결정(아키텍처):** 정적 프론트(`index.html`) + Supabase(DB·Realtime·like RPC) + 얇은 **server.js**(single-server-specialist) 하이브리드.
  - **Supabase**: 데이터 저장, 좋아요 RPC(원자적), 관리자 Realtime 변경감지. anon 키는 공개(사용자) 경로만 최소 허용.
  - **server.js**: `service_role` 키 보관, `admin_token` 서버 검증, 프로젝트/세션 CRUD·답변/숨김·숨김질문 열람·엑셀 export 담당(RLS 우회). → single-server-specialist가 적임.
  - **index.html**: 사용자 페이지는 Supabase 직접(anon), 관리자 페이지는 server.js 경유.
- **처리:** `supabase_schema.sql` 생성(테이블 4종 + 인덱스 + `like_question` RPC + RLS 정책 + questions Realtime publication). author는 not null(이름 필수 반영), status는 UI와 1:1로 한글 저장.
- **사용자에게 요청한 것:** Supabase 프로젝트 생성(Region: Seoul 권장) → SQL Editor에 스키마 실행 → Project URL / anon key / service_role key 전달.
- **상태:** 진행 중(자격증명 대기).

### 6) 질문자 이름 필수화
- **지시:** "질문자의 이름은 무조건 넣도록 수정해줘. 익명/별명보다 실명이 낫다."
- **처리:** `index.html` 직접 수정.
  - `QuestionFormModal` 검증에 `if (!form.author.trim()) errs.author = '이름을 입력해 주세요';` 추가 → 이름 미입력 시 등록 차단.
  - 입력 필드 라벨 `질문자명`(선택) → **`이름 *`(필수)**, 플레이스홀더 `미입력 시 '익명'으로 표시됩니다` → `실명 또는 소속을 입력해 주세요`, `error={errors.author}` 연결.
  - 데모 일관성: 시드 데이터의 빈 author/`익명` 5건을 실명으로 교체(한지원·윤서연·강민호·오세훈·배수진).
  - 참고: 표시 폴백 `q.author || '익명'`은 안전망으로 유지(신규 등록은 항상 이름 보유).
- **검증:** localStorage 초기화 후 재시드 → 사용자 페이지 질문 모달에서 이름 빈 채 등록 시 빨간 오류 표시·차단 확인(라이트/다크 정상).
- **후속 메모:** Supabase 연동 시 `questions.author`를 `not null`로 두고(또는 서버 검증), PRD의 author default '익명' 정책은 본 변경에 맞춰 제거 검토.

---

## 2026-06-10

### 5) 작업 과정 자동 기록 도입 (이 파일 생성)
- **지시:** "내가 따로 얘기하지 않아도 무조건 과정을 md파일로 같은 폴더에 저장해줘. 그래야 기억하고 다른 것에도 적용할 수 있다."
- **처리:**
  - `WORKFLOW.md`(이 파일)를 `/Users/sh_oh/Downloads/QA/`에 생성하고 지금까지의 전 과정을 소급 기록.
  - 앞으로 모든 작업 턴에서 이 파일을 자동 갱신하기로 함(별도 지시 불필요).
  - 동일 선호를 장기 메모리(feedback)로 저장하여 세션이 바뀌어도 유지되도록 함.

### 4) 세션(Session) 수정/삭제 기능 추가
- **지시:** "세션 수정/삭제도 (프로젝트와) 똑같이 추가해줘."
- **처리:** `single-react-dev` 에이전트로 프로젝트 수정/삭제 패턴을 1:1로 세션에 적용.
  - `mockApi.updateSession(id, fields)` — `id`/`project_id`/`admin_token`/`created_at` 보존(→ URL 유지), 나머지 필드만 갱신.
  - `mockApi.deleteSession(id)` — 세션 + 하위 질문 + 관련 votes(`qa_voted_*`) cascade 삭제, `{ removedQuestions }` 반환.
  - 세션 생성 모달을 생성/수정 겸용으로 리팩터(`mode`/`session` props).
  - `DeleteSessionModal` — confirm-by-typing(세션명 입력 시에만 삭제 활성), 삭제될 질문 수 집계, red 경고 박스.
  - 진입점: 프로젝트 상세 페이지의 각 세션 카드 우상단 연필/휴지통 `IconButton`.
- **검증:** 브라우저에서 콘솔 JS 에러 없음(CDN 경고/favicon 404만), 세션 삭제 모달 정상 표시 확인. 실제 삭제는 미실행.

### 3) 프로젝트(Project) 수정/삭제 기능 추가
- **지시:** "프로젝트 삭제/수정 기능이 없다. 잘못 기입하거나 취소된 프로젝트를 삭제할 수 있어야 한다."
- **처리:**
  - `mockApi.updateProject(id, fields)`, `mockApi.deleteProject(id)`(세션·질문·votes cascade) 추가.
  - 생성 모달을 생성/수정 겸용으로 리팩터.
  - `DeleteProjectModal` — confirm-by-typing(프로젝트명 정확 입력 시 활성), **삭제될 세션 수·질문 수** 집계, red 경고("되돌릴 수 없습니다").
  - 진입점: 관리자 홈 행(hover 시 연필/휴지통) + 프로젝트 상세 헤더.
  - 삭제 후: 상세→`#/admin` 이동, 홈→목록 제거 + 토스트.
  - 공용 컴포넌트 `IconButton`/`PencilIcon`/`TrashIcon` 도입.
- **검증:** 삭제 확인 모달 정상(세션 3·질문 8 집계, 타이핑 확인) — 다크모드 가독성 포함 확인.

### 2) 디자인 리뉴얼 + 다크모드 토글
- **지시:** "디자인이 너무 AI가 만든 것 같다. 그 느낌을 없애고, 야간(다크)모드 전환 스위치를 추가해줘."
- **처리:**
  - "AI 느낌" 제거: 인디고/보라 그라데이션·제목 이모지(🔥 등)·과한 라운드/그림자 전부 제거.
  - 팔레트 교체: 무채색 잉크(ink) 베이스 + 차분한 틸(teal) 액센트 1색. primary 버튼은 잉크 솔리드(검정/흰색).
  - 레이아웃: border/divider 기반 에디토리얼(밀도 있는 행 리스트, stat 스트립), `EVENT Q&A CONSOLE`/`LIVE Q&A` 소형 라벨로 위계 표현.
  - 다크모드: Tailwind `darkMode:'class'`, `<head>` 인라인 스크립트로 FOUC 방지, `ThemeProvider`(Context) + 전 화면 우상단 해/달 토글, `localStorage('qa_theme')` 저장, 최초엔 `prefers-color-scheme` 따름.
- **검증:** 라이트/다크 토글·페이지 이동 간 유지 확인, 4개 화면 dark: 변형 적용.

### 1) 프론트엔드 UI 셸 1차 구축
- **지시:** "PRD 기반으로 QA 솔루션 개발. 프론트 페이지부터 하나씩 진행."
- **처리:** `single-react-dev` 에이전트로 **목업 데이터 기반 단일 `index.html`** 생성(백엔드 연결 전 단계).
  - 해시 라우트 4개: 관리자 홈 `#/admin`, 프로젝트 상세 `#/admin/project/:id`, 사용자 페이지(모바일) `#/session/:id`, 관리자 대시보드 `#/admin/session/:id?token=`.
  - 모든 데이터 접근을 `mockApi` 객체 한 곳에 모음(추후 Supabase로 본문만 교체 가능). localStorage 키 `qa_mock_db_v1`.
  - 핵심 동작: 좋아요순 정렬(like DESC, created_at ASC), 좋아요 1인1표(voter_key + Optimistic UI), 글자수 제한(제목50/이름20/내용500), 필터 탭(전체/답변대기/답변완료/숨김), 세션 생성 시 session_id·admin_token 자동 발급, URL 복사.
  - 시드: 프로젝트 2개(Mendix/Unreal), 세션 5개, 질문 14개.
- **다음 단계(예정):** Supabase 셋업 → `mockApi` 실연동(사용자 Polling 8~12초) → 관리자 Realtime 구독 → 엑셀 다운로드 API/QR.

---

### 다음에 할 일 (백로그)
- [ ] Supabase 프로젝트/DB 스키마(projects·sessions·questions·votes)·`like_question` RPC·RLS 구축
- [ ] `mockApi` → Supabase 실연동 (사용자 페이지 랜덤 Polling 포함)
- [ ] 관리자 대시보드 Realtime 구독 + 변경 시 refetch
- [ ] 세션별/프로젝트별 Q&A 엑셀 다운로드 API + 관리자 토큰 검증
- [ ] QR 코드 생성, 현장 시나리오 테스트
