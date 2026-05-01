# Notion 실시간 연동 가이드

대시보드는 두 단계로 Notion 데이터를 가져옵니다.

```
1) GET /api/notion/tasks   ← server.js 가 NOTION_TOKEN 으로 Notion API 직접 호출 (실시간)
                              실패(토큰 미설정/네트워크/권한) 시 ↓
2) GET ./notion-tasks.json ← 정적 스냅샷 (Claude Code MCP 로 갱신)
```

위젯 헤더의 배지로 어느 경로로 들어왔는지 확인할 수 있습니다.

| 배지 | 의미 |
|---|---|
| 🟢 **실시간 API** | server.js + NOTION_TOKEN 으로 Notion 워크스페이스에서 방금 가져옴 |
| 📸 **스냅샷** | server.js 미가동 또는 토큰 미설정 → 정적 `notion-tasks.json` 사용 |
| ⚠ **오프라인** | 둘 다 실패 |

---

## 옵션 A — 실시간 API 활성화 (권장)

### 1. Notion 통합(Integration) 토큰 발급

1. <https://www.notion.so/my-integrations> 접속.
2. **+ New integration** 클릭.
3. Type: **Internal**, Workspace: 본인 워크스페이스 선택.
4. 생성 후 **Internal Integration Secret** 복사 (`secret_xxxx...` 형식).

### 2. DB 에 통합 권한 부여

1. Notion 에서 「주간, 월간 일정관리」 DB 페이지 열기.
2. 우측 상단 `···` → **Connections** → 방금 만든 통합 추가.
3. (놓치기 쉬움) 상위 페이지에도 권한 줘야 하는 경우가 있음.

### 3. 서버 실행

```bash
cd week-5/quest/나만의AI대시보드
NOTION_TOKEN=secret_xxxxxxxxxx node server.js
```

콘솔 출력에서 `live: ✅` 가 보이면 성공.

```
✨ AI Dashboard 서버: http://localhost:5731
   · 정적: index.html / *.json / screenshot/*
   · API : /api/notion/tasks  (live: ✅)
```

이제 대시보드의 "🔄 동기화" 버튼을 누를 때마다 Notion 워크스페이스를 직접 조회합니다. Notion 에서 일정을 추가/수정/삭제하면 즉시 반영됩니다.

### 4. 환경변수 영구 저장 (선택)

매번 `NOTION_TOKEN=...` 을 치기 싫다면 `.env.local` 파일을 만들고:

```bash
# .env.local
NOTION_TOKEN=secret_xxxxxxxxxx
```

`server.js` 가 자동 로드하지는 않지만, 다음과 같이 실행 가능:

```bash
export $(cat .env.local | xargs) && node server.js
```

> ⚠ `.env.local` 은 `.gitignore` 에 반드시 추가하세요. 이 저장소엔 push 금지.

---

## 옵션 B — 스냅샷만 갱신 (Claude Code 안에서)

토큰 발급이 부담스럽거나 일회성 갱신만 필요하다면:

> "`week-5/quest/나만의AI대시보드/notion-tasks.json` 을 Notion 「주간, 월간 일정관리」 DB(`collection://d97755ef-0242-4a7e-b873-d75ca9bde5d1`) 의 최신 데이터로 갱신해줘"

Claude Code 가 MCP 로 직접 Notion 에서 데이터를 가져와 JSON 을 덮어씁니다. 이 방식은 토큰이 Claude Code 의 MCP 통합 안에 안전하게 저장되어 있어 별도 발급이 불필요합니다.

---

## API 엔드포인트 (server.js)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/health` | 서버 상태 + `notionLive` (토큰 유무) |
| GET | `/api/notion/tasks` | Notion 「주간, 월간 일정관리」 DB 실시간 조회 |
| GET | `/api/geocode/reverse?lat=&lon=` | Nominatim 역지오코딩 프록시 (User-Agent 필요해서 서버에서 처리) |

응답 스키마는 `notion-tasks.json` 과 동일합니다.

---

## 자동화 후보

- **routine 등록**: 매일 07:00 KST 에 옵션 B 자동 실행 → 매일 아침 최신 스냅샷 보장.
- **systemd / launchd**: `node server.js` 를 부팅 시 자동 실행.
- **Vercel Edge Function**: 정적 호스팅 + Edge 에서 Notion 프록시. 토큰은 Vercel 환경변수.
