# SETUP — 가계부 앱 셋업 가이드

PRD Step 1 ~ Step 2 의 인프라 구성을 그대로 따라 갈 수 있는 체크리스트입니다.

---

## 1. Supabase 프로젝트 생성 (PRD Step 1)

1. <https://supabase.com> 에 로그인 → **New project**
2. 프로젝트 이름: `ledger-app`, region: `Northeast Asia (Seoul)` 권장
3. DB 비밀번호는 안전한 곳에 보관 (재발급 가능하지만 번거로움)
4. 프로젝트가 만들어지면 **Project Settings → Database → Connection string → URI**
   에서 두 가지 문자열을 확인할 수 있습니다.
   - `Direct connection` (5432) — 로컬 개발/관리
   - `Connection pooling` (6543, *transaction* mode) — **서버에서 사용할 값**

> 보안: 이 값들은 비밀번호를 포함합니다. 채팅·커밋·문서 어디에도 평문으로
> 노출하지 마세요. (관련 메모: `feedback_mask_secrets.md`)

---

## 2. 스키마 적용

Supabase 대시보드의 **SQL Editor → New query** 에 [`schema.sql`](./schema.sql)
전체를 붙여넣고 **Run** 합니다. 또는 로컬에서:

```bash
psql "postgres://postgres.<ref>:<PW>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres" \
     -f schema.sql
```

스크립트가 만들어 주는 것:

- `ledgers` 테이블 (`id`, `created_at`, `date`, `type`, `amount`, `category`, `memo`)
- 인덱스: `date desc`, `type`, `category`
- 뷰: `ledger_balance`, `ledger_category_totals`, `ledger_monthly_summary`
- RLS 활성화 + 데모용 anon select/insert/update/delete 정책

> 실서비스로 확장한다면 `user_id uuid references auth.users` 컬럼을 추가하고,
> `using (user_id = auth.uid())` 정책으로 교체하는 것을 추천합니다.

---

## 3. 로컬 환경변수

```bash
cp .env.example .env
```

`.env` 의 `DATABASE_URL` 에 위에서 복사한 **Connection pooling** 문자열을 붙여 넣습니다.
포트는 반드시 `6543` (transaction mode) 을 권장합니다 — 서버리스/짧은 연결 패턴과 잘 맞습니다.

---

## 4. 의존성 설치 & 실행

```bash
npm install        # express, pg
npm start          # node --env-file=.env server.js
```

콘솔에 다음이 보이면 성공입니다:

```
[ledger] server running on http://localhost:3000
```

브라우저로 <http://localhost:3000> 을 열면 우상단 상태칩이
`● Supabase 연결됨` 으로 바뀝니다.

---

## 5. 데모 모드 (Supabase 없이 보기)

`index.html` 만 더블클릭 / VSCode Live Server 등으로 열어도 동작합니다.
이 경우 데이터는 브라우저 `localStorage` 에 저장되며, 우상단 칩이
`○ 데모 모드 (localStorage)` 로 표시됩니다.
디자인이나 UX 만 빠르게 검증하기에 좋습니다.

---

## 6. 트러블슈팅

| 증상 | 해결 |
| :--- | :--- |
| 서버 시작 시 `DATABASE_URL is not set` | `.env` 가 같은 폴더에 있는지 / 값이 비어있지 않은지 확인 |
| `password authentication failed` | Supabase **Database → Reset password** 후 새 URL 사용 |
| `relation "ledgers" does not exist` | `schema.sql` 적용 누락 — SQL Editor 에서 다시 실행 |
| 상태칩이 계속 `○ 데모 모드` | 서버가 안 떠 있거나, `index.html` 을 `file://` 로 열었기 때문. `npm start` 후 `http://localhost:3000` 으로 접속 |
| `EADDRINUSE :::3000` | `.env` 의 `PORT` 를 다른 값(예: 3001) 로 변경 |
