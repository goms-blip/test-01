# ⚙️ SETUP — Supabase + LLM 연결 가이드

> 데모는 `data.js`(오프라인)로 바로 동작합니다. 실제 Supabase + LLM에 연결하고 싶을 때만 이 문서를 따라가세요.

---

## 1. Supabase 프로젝트 준비

1. https://supabase.com 에서 새 프로젝트 생성
2. 좌측 **SQL Editor** 열기
3. `schema.sql` 내용을 붙여넣고 RUN
4. `seed.sql` 내용을 붙여넣고 RUN
5. **Database → Tables → travel_logs** 에 65 rows 들어왔는지 확인

확인 쿼리:

```sql
select location,
       count(distinct trip_id) as visits,
       round(avg(value)::numeric, 2) as avg_happiness
from public.travel_logs
group by location
order by avg_happiness desc;
```

기대 결과 (요약):

| location | visits | avg_happiness |
|---|---|---|
| 홋카이도 | 3 | 9.45 |
| 닛코 | 1 | 9.00 |
| 교토 | 1 | 8.27 |
| 도쿄 | 1 | 8.16 |
| ... | | |

---

## 2. 환경 변수 (Supabase MCP / Direct)

`.env.local` (프로젝트 루트):

```bash
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ...    # public anon key (RLS 권장)
```

> ⚠️ **보안**: anon key 외 service_role key는 클라이언트 코드에 절대 노출 금지.
> Row Level Security를 켜고 `select` 만 허용하는 정책을 권장합니다.

---

## 3. agent.js 의 ROWS_PROVIDER 교체

현재 `agent.js`는 오프라인 시드를 사용합니다:

```js
const ROWS = () => window.TRAVEL_SEED || [];
```

Supabase로 바꾸려면 (예시):

```js
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
async function fetchRows() {
  const { data, error } = await supabase
    .from('travel_logs')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data;
}
```

라우터/핸들러를 모두 async로 바꾸거나, 앱 시작 시 한 번 로드해서 `window.TRAVEL_SEED = data` 를 주입하는 방식이 가장 간단합니다.

---

## 4. LLM 연결 (선택)

현재 에이전트는 *규칙 기반(rule-based)* intent 라우터로 동작합니다. 실제 LLM에 연결하면 다음 두 가지가 자연스러워집니다.

1. **자연어 이해**가 더 유연해짐 (현재 정규식 매칭 한계 제거)
2. **응답 톤**을 사용자별로 조정 가능

### OpenAI 예시

```js
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = await fetch('/context.md').then(r => r.text());

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `다음은 사용자의 여행 DB rows입니다:\n${JSON.stringify(rows)}` },
    { role: "user",   content: question },
  ],
});
```

### Claude 예시

```js
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 1024,
  system: SYSTEM_PROMPT + "\n\n사용자 DB:\n" + JSON.stringify(rows),
  messages: [{ role: "user", content: question }],
});
```

> 💡 **프롬프트 캐싱** 사용을 권장: `context.md` + DB rows는 거의 변하지 않으므로 캐시 히트율이 높아 비용·속도 모두 이득.

---

## 5. Before/After 비교 시연 구현 (LLM 버전)

같은 질문을 두 번 호출 — `system` 만 다르게:

| 모드 | system message |
|---|---|
| BEFORE | (없음) 또는 "당신은 여행 가이드 봇입니다" 같은 일반 프롬프트 |
| AFTER  | `context.md` 전체 + DB rows |

UI에서는 `Promise.all([before, after])` 로 동시에 호출해 좌우 비교.

---

## 6. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `permission denied for table travel_logs` | RLS 정책 누락. `create policy "read" on travel_logs for select using (true);` |
| 차트가 안 그려짐 | Chart.js CDN 차단 — 회사 네트워크면 로컬에 다운로드 후 참조 |
| 한글 깨짐 | DB collation 확인. Supabase 기본값은 UTF-8로 OK |
| 컨텍스트 OFF인데 개인화된 답변이 나옴 | LLM이 시드를 학습/추론해버린 케이스. system 메시지를 완전히 비우고, DB rows도 빼서 호출 |

---

## 7. 다음 단계 (확장 아이디어)

- [ ] `created_at`을 timestamp로 바꿔 *시간대별 행복지수* 분석
- [ ] `category` 외 `weather`, `companions` 컬럼 추가 → 다차원 분석
- [ ] 새 여행 종료 시 행복지수 입력 폼 → DB INSERT 라우트 추가
- [ ] `pgvector` 연동: content를 임베딩해 *비슷한 여행 추천*
- [ ] 컨텍스트(.md) 자체를 LLM이 읽고 자동 갱신하는 *self-updating context* 패턴
