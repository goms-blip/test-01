# QUEST — Week-4 통합 사이트

`week-4/Quest` 폴더에 흩어져 있던 6개 미션을 **하나의 사이트**로 통합한 프로젝트입니다.
프론트 디자인은 미니멀·블랙&화이트 톤을 사용했고, 모든 페이지가 모바일·태블릿·데스크톱에서
매끄럽게 동작하도록 처음부터 반응형으로 설계됐습니다.

---

## 통합된 6개 서비스

| # | 서비스 | 경로 | 원본 폴더 |
|---|--------|------|-----------|
| 01 | 익명 고민·칭찬 게시판 | `/pages/board.html`        | `Anonymous_board`        |
| 02 | Money Balance (밸런스 게임) | `/pages/balance.html`      | `balance_Game`           |
| 03 | 너 얼마 벌고 얼마나 써? | `/pages/salary.html`       | `salary_comparision`     |
| 04 | 냉장고 재료 & 레시피 관리 | `/pages/refrigerator.html` | `Refrigerator_recipe`    |
| 05 | AI 냉장고 파먹기 | `/pages/refri-ai.html`     | `Refrigerator_recipe_app`|
| 06 | JSON 재료 → 레시피 Skill | `/pages/skill.html`        | `Refrigerator_skill`     |

---

## 폴더 구조

```
quest_all/
├── server.js              # 모든 API를 하나의 Express 앱으로 통합
├── index.html             # 메인 랜딩 페이지
├── pages/
│   ├── board.html         # 익명 게시판
│   ├── balance.html       # 밸런스 게임
│   ├── salary.html        # 연봉 비교
│   ├── refrigerator.html  # 냉장고 관리 + AI 추천
│   ├── refri-ai.html      # 테마 기반 AI 레시피 생성
│   └── skill.html         # JSON 재료 스킬 소개
├── assets/
│   ├── css/common.css     # 공통 디자인 토큰 + 컴포넌트
│   └── js/common.js       # 공통 헤더/푸터/API/토스트
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
├── README.md              ← (이 파일)
├── WORKLOG.md             # 작업 진행 로그
└── ARCHITECTURE.md        # 아키텍처/디자인 결정
```

---

## 실행 방법

```bash
cd week-4/Quest/quest_all
npm install
npm start            # http://localhost:4330
```

`PORT` / `DATABASE_URL` / `OPENAI_API_KEY` 는 `.env` 또는 환경변수로 주입할 수 있습니다.
DB 미설정 시 기존 Quest 프로젝트들이 사용한 Supabase 폴백이 적용됩니다.

---

## API 엔드포인트 요약

### Board (`/api/board`)
- `GET    /posts?sort=recent|likes&category=`
- `POST   /posts` `{ category, content }`
- `POST   /posts/:id/like`
- `DELETE /posts/:id`
- `GET    /meta`

### Balance (`/api/balance`)
- `GET    /questions?sort=recent|popular&category=`
- `GET    /questions/:id`
- `POST   /questions` `{ option_a, option_b, category }`
- `POST   /questions/:id/vote` `{ choice: 'A'|'B' }`
- `DELETE /questions/:id`
- `GET    /meta`

### Salary (`/api/salary`)
- `POST   /` `{ monthly_income, monthly_expenses, job_category, experience_years, category_expenses }`
- `GET    /stats?job=&experience=&income=&expenses=`
- `GET    /meta`

### Refrigerator (`/api/refri`)
- `GET    /ingredients?q=&category=`
- `POST   /ingredients` `{ name, category?, expiry_date? }`
- `DELETE /ingredients/:id`
- `GET    /recipes?q=`
- `POST   /recipes` `{ title, ingredients[], steps }`
- `DELETE /recipes/:id`
- `POST   /recipes/suggest` `{ days_within? }` (AI)
- `GET    /meta`

### Refri-AI (`/api/refri-ai`)
- `GET    /ingredients?q=` · `POST /ingredients` · `DELETE /ingredients/:id`
- `GET    /recipes?...` · `POST /recipes` · `PATCH /recipes/:id` (`{ is_favorite }`) · `DELETE /recipes/:id`
- `POST   /generate` `{ theme }` (AI)
- `GET    /meta`

### Skill (`/api/skill`)
- `GET    /ingredients` — `../Refrigerator_skill/ingredients/*.json` 파일을 읽어 반환

### Health
- `GET    /api/health`

---

## DB 테이블 (Supabase Postgres)

| 테이블 | 사용 서비스 |
|--------|-------------|
| `posts`              | Board                |
| `mb_questions`, `mb_votes` | Balance              |
| `salary_stats`       | Salary               |
| `ingredients`, `recipes` | Refrigerator        |
| `ingredients_app`, `recipes_app` | Refri-AI |

테이블명이 모두 다르게 설계되어 있어 한 DB 안에서 충돌 없이 공존합니다.

---

## 디자인 시스템

- **컬러**: `#000` / `#fff` / `#666` / `#e5e5e5` (모노 톤)
- **폰트**: Pretendard (CDN)
- **모서리**: `0` (라운드 없음 — 직각 미학)
- **버튼**: 검은 솔리드 ↔ 화이트 테두리 호버 반전
- **카드**: 흰 배경, 회색 외곽선, hover 시 검정 외곽선 + 위로 살짝
- **그리드**: 데스크톱 3단 → 태블릿 2단 → 모바일 1단

자세한 결정 사항은 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 참고.

---

## 라이선스 / 출처

- 폰트: [Pretendard](https://github.com/orioncactus/pretendard) (Open Font License)
