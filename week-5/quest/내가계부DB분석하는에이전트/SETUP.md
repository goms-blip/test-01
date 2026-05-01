# SETUP — Supabase MCP 연결 가이드

이 문서는 가계부앱과 같은 Supabase 프로젝트(`ledgers` 테이블)를
**Claude Code / Cursor / Claude Desktop** 에서 분석 에이전트로 부르도록
연결하는 단계별 가이드입니다.

---

## 0. 사전 준비

- 가계부앱(`week-5/quest/가계부앱`)이 Supabase 와 정상 연동되어
  `ledgers` 테이블에 **10건 이상의 데이터**가 들어 있어야 합니다.
- 본 폴더의 `schema.sql` 은 가계부앱 스키마와 동일하므로,
  같은 프로젝트를 그대로 재사용합니다.

---

## 1. 분석용 뷰 추가 (한 번만)

Supabase Dashboard → **SQL Editor** 에 접속해
이 폴더의 `schema.sql` 을 붙여넣고 **Run** 을 누르세요.
> 메인 테이블 `public.ledgers` 가 이미 있어도 `create table if not exists`
> 라 안전하게 실행됩니다. 추가되는 것은 분석용 뷰 7개뿐입니다.

추가되는 뷰
| 뷰 이름 | 설명 |
| --- | --- |
| `v_category_totals`   | 카테고리별 합계·건수·평균 |
| `v_monthly_summary`   | 월별 type 합계 |
| `v_monthly_category`  | 월×카테고리 합계 |
| `v_daily_expense`     | 일자별 합계 |
| `v_weekday_pattern`   | 요일별 평균/총합 |
| `v_balance`           | 누적 수입·지출·잔액 |
| `v_category_by_weekday` | 카테고리×요일 합계 |

---

## 2. (선택) 데모 데이터로 채우기

가계부앱에 데이터가 부족하면 본 폴더 `seed.sql` 로 60일치 샘플 데이터를
주입할 수 있습니다. **기존 데이터를 truncate 하므로 주의**하세요.

---

## 3. MCP 서버 등록

### 3-1. Claude Code

`~/.claude/mcp_servers.json` (없으면 생성) 에 다음을 추가:

```json
{
  "mcpServers": {
    "supabase-ledger": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase", "--read-only"],
      "env": {
        "SUPABASE_URL": "https://YOUR-PROJECT-REF.supabase.co",
        "SUPABASE_ANON_KEY": "YOUR_ANON_KEY"
      }
    }
  }
}
```

> ⚠️ **`--read-only`** 플래그를 붙여, 분석 에이전트가 실수로 데이터를
> 변경하지 못하게 합니다.

### 3-2. Cursor

`~/.cursor/mcp.json` 에 같은 블록을 추가합니다.

### 3-3. Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` 의
`mcpServers` 항목에 동일하게 등록합니다.

전체 예제는 본 폴더의 `mcp.example.json` 참고.

---

## 4. 동작 확인 (Claude Code 기준)

```
/mcp          # 등록된 서버 목록과 상태 확인
```

`supabase-ledger` 가 `connected` 로 표시되면 다음 중 한 개를 시도:

> "ledgers 테이블 스키마 알려줘"
>
> "이번 달 카테고리별 지출 SQL 짜서 실행해줘"
>
> "v_weekday_pattern 뷰 select 해서 결과 정리해줘"

---

## 5. 시스템 프롬프트 (에이전트에 붙일 가이드)

분석 에이전트로 동작시키고 싶다면 다음 시스템 프롬프트를 권장합니다.

```text
당신은 개인 가계부 DB(Supabase, 테이블 public.ledgers)에 접근하는 분석가입니다.
스키마: ledgers(id, created_at, date, type{income,expense}, amount, category, memo).
보조 뷰: v_category_totals, v_monthly_summary, v_monthly_category,
v_daily_expense, v_weekday_pattern, v_balance, v_category_by_weekday.

규칙:
1) 모든 분석은 단일 사용자(나)에 한정한다.
2) 가능한 경우 보조 뷰를 우선 사용해 SQL 을 단순화한다.
3) DML(insert/update/delete) 은 절대 실행하지 않는다.
4) 답변은 한국어로, "결과 + 사용한 SQL" 을 함께 보여준다.
5) 금액은 항상 원(KRW) 단위와 천 단위 콤마로 표기한다.
6) 데이터가 부족할 땐 "샘플 부족" 이라고 분명히 알린다.
```

---

## 6. 보안 체크리스트

- [ ] `.env`, `mcp.json` 의 키는 **절대 깃 커밋 금지** (이미 `.gitignore` 처리 완료)
- [ ] MCP 등록 시 `--read-only` 플래그 사용
- [ ] Supabase 에 `analyzer_ro` read-only 롤을 만들어두면 더 안전
  (`schema.sql` 하단 주석 참고)
- [ ] 외부에 화면 공유할 때 **테이블 데이터/메모 노출 여부** 확인
