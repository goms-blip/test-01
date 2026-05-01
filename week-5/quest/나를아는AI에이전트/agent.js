// ============================================================
//  agent.js — 행복을 찾아 떠나는 여행 에이전트
//  ------------------------------------------------------------
//  입력 : 자연어 질문 + 옵션 { withContext: true|false }
//  출력 : { before, after, question }
//    · before : 컨텍스트 없는 일반 LLM 풍 답변 (일반론)
//    · after  : context.md + DB 결합한 초개인화 답변
//
//  데이터: window.TRAVEL_SEED (data.js)
//  컨텍스트: window.USER_CONTEXT (data.js)
// ============================================================

(function () {
  const TODAY = new Date('2026-04-30T00:00:00');
  const ROWS  = () => window.TRAVEL_SEED || [];
  const CTX   = () => window.USER_CONTEXT || {};

  // ────────────── 유틸 ──────────────
  const sum    = arr => arr.reduce((a,b)=>a+b,0);
  const avg    = arr => arr.length ? sum(arr)/arr.length : 0;
  const round1 = n => Math.round(n*10)/10;
  const groupBy = (rows, keyFn) => {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };
  const monthsAgo = (dateStr) => {
    const d = new Date(dateStr+'T00:00:00');
    return (TODAY.getFullYear()-d.getFullYear())*12 + (TODAY.getMonth()-d.getMonth());
  };

  // ────────────── 분석: 장소별 집계 ──────────────
  function locationStats(rows = ROWS()) {
    const byLoc = groupBy(rows, r => r.location);
    return [...byLoc.entries()].map(([loc, arr]) => {
      const visits = new Set(arr.map(r => r.trip_id)).size;
      const lastDate = arr.map(r=>r.created_at).sort().slice(-1)[0];
      return {
        location: loc,
        records: arr.length,
        visits,
        avg: round1(avg(arr.map(r=>r.value))),
        max: Math.max(...arr.map(r=>r.value)),
        last: lastDate,
        monthsAgo: monthsAgo(lastDate),
      };
    }).sort((a,b)=>b.avg-a.avg);
  }

  // ────────────── 분석: 카테고리×장소 ──────────────
  function categoryStats(rows = ROWS(), category) {
    return rows
      .filter(r => !category || r.category === category)
      .sort((a,b)=>b.value-a.value);
  }

  // ────────────── SQL 빌더 (참고용 표시) ──────────────
  const SQL = {
    locationRank: () =>
`-- 장소별 평균 행복지수 (방문 횟수 포함)
select location,
       count(distinct trip_id) as visits,
       round(avg(value)::numeric, 2) as avg_happiness,
       max(created_at) as last_visited
from public.travel_logs
group by location
order by avg_happiness desc;`,

    topMoments: (n=5) =>
`-- 행복지수 Top ${n}
select created_at, location, category, content, value
from public.travel_logs
order by value desc, created_at desc
limit ${n};`,

    byCategory: (category) =>
`-- 카테고리 = '${category}' 중 행복지수 Top
select location, content, value, created_at
from public.travel_logs
where category = '${category}'
order by value desc;`,

    season: (months) =>
`-- 특정 월(${months.join(',')}) 데이터
select location, avg(value) as avg_happiness, count(*) as cnt
from public.travel_logs
where extract(month from created_at) in (${months.join(',')})
group by location
order by avg_happiness desc;`,
  };

  // ============================================================
  //  Intent 1 — 가장 좋았던 여행지
  // ============================================================
  function intentBest() {
    const stats = locationStats();
    const top = stats[0];
    const loc = top.location;
    const trips = ROWS().filter(r=>r.location===loc);
    const visits = top.visits;
    const moments = trips.filter(r=>r.value>=9.5)
      .sort((a,b)=>b.value-a.value).slice(0,5);

    // BEFORE — 일반론
    const before = {
      text:
        '여행지의 만족도는 사람마다 다르지만, **일반적으로는 동남아(태국·베트남)나 따뜻한 휴양지**가 인기예요. ' +
        '유럽이라면 이탈리아·스페인, 한국에서 가까운 곳이면 일본 도쿄나 오사카 정도가 무난합니다.\n\n' +
        '가장 좋았던 곳을 정확히 말씀드리려면 *고객님의 취향과 과거 여행 데이터*가 필요해요.',
      advice: '컨텍스트 없이 답하면 결국 통계적 인기 순위에 의존하게 됩니다. 컨텍스트를 켜면 데이터 기반으로 답변해요.',
    };

    // AFTER — 컨텍스트 + DB
    const lines = stats.slice(0,5).map((s,i) =>
      `${i+1}. **${s.location}** · 평균 ${s.avg} · ${s.visits}회 · 마지막 ${s.last}`
    );
    const momentLines = moments.map(m =>
      `· ${m.created_at} · _${m.content}_ → **${m.value}**`
    );

    const after = {
      text:
`여지껏 다녀온 9개 여행을 평균 행복지수로 정렬하면 **${loc}**가 압도적인 1위예요. (${visits}회 방문, 평균 **${top.avg}/10**)

🏔️ **순위 (Top 5)**
${lines.join('\n')}

✨ **${loc}에서 행복지수 9.5+ 순간들**
${momentLines.join('\n')}

이 데이터가 말해주는 건 분명해요 — **눈, 겨울, 료칸, 라멘**. 컨텍스트에 적어주신 "겨울·눈·일본·료칸 온천" 취향과 정확히 맞물립니다. 단순한 인기 순위가 아니라 *고객님 자신의 행복 데이터*가 답을 알려주고 있어요.`,
      sql: SQL.locationRank(),
      table: stats.slice(0,5).map(s => ({
        장소: s.location, 방문횟수: s.visits, 평균행복: s.avg, '마지막 방문': s.last,
      })),
      chart: {
        type: 'bar',
        labels: stats.slice(0,7).map(s=>s.location),
        values: stats.slice(0,7).map(s=>s.avg),
      },
      advice:
        `1위 ${loc}의 평균(${top.avg})은 2위(${stats[1]?.location} ${stats[1]?.avg})와도 격차가 커요. ` +
        `'좋아한다'가 아니라 '실제로 행복했다'는 사실이 데이터로 증명되는 셈이에요. ` +
        `다음 여행 후보를 고를 때는 ${loc}를 기준값으로 두고 비교하시면 됩니다.`,
    };
    return { before, after };
  }

  // ============================================================
  //  Intent 2 — 다음 여행 추천 (제약 + 데이터)
  // ============================================================
  function intentRecommend(text) {
    const stats = locationStats();
    const ctx = CTX();

    // BEFORE
    const before = {
      text:
`다음 여행지로는 **태국 방콕** 이나 **베트남 다낭** 같은 동남아 휴양지가 가성비가 좋아요. 유럽 쪽이면 이탈리아 로마·피렌체도 많이들 가시는 코스고요.

요즘은 호주 시드니나 미국 LA 같은 곳도 직항편이 많아서 편하게 다녀오실 수 있어요.`,
      advice: '컨텍스트 없이는 *대중적인 인기 코스*만 나열하게 돼요. 비행시간·기후·재방문 룰 같은 제약은 전혀 반영되지 않습니다.',
    };

    // AFTER — 컨텍스트 제약 + 데이터 기반 추천
    // 1) 후보군: 다녀본 곳 중 평균 8.5 이상 + 3년 이내 안 갔거나 홋카이도
    const candidates = stats.filter(s => s.avg >= 8.5);
    const eligible = candidates.filter(s => s.location === '홋카이도' || s.monthsAgo >= 36);
    const blocked  = candidates.filter(s => s.location !== '홋카이도' && s.monthsAgo < 36);

    // 새 후보(가본 적 없음) — 지금은 "삿포로 외 홋카이도 도시" 추천
    const newSuggestions = [
      { location: '홋카이도 하코다테', why: '미경험 + 야경/온천/해산물 → 컨텍스트의 료칸·라멘·조용한 동네 키워드와 100% 일치' },
      { location: '아오모리(겨울)',    why: '눈+료칸+사과 와인. 비행 2.5h. 인파 적음. 같은 도시 3년 룰을 위반하지 않음' },
      { location: '대만 타이중(11~2월)', why: '동남아 회피지만 *겨울철 대만*은 더위 제약 OK. 비행 3h. 미경험' },
    ];

    const top = eligible[0];
    const sec = eligible.find(s=>s.location !== top?.location);

    const lines = [
      `🥇 **${top?.location}** 재방문 — 평균 ${top?.avg}, ${top?.visits}회 방문, 직전 방문 후 ${top?.monthsAgo}개월. 홋카이도는 컨텍스트 §3-3 예외 항목이라 재방문 OK.`,
      sec ? `🥈 **${sec.location}** — 평균 ${sec.avg}, ${sec.monthsAgo}개월 경과` : null,
      ``,
      `🆕 **새로운 후보 (제약 통과)**`,
      ...newSuggestions.map((s,i)=>`  ${i+1}. **${s.location}** — ${s.why}`),
    ].filter(Boolean);

    const blockedLines = blocked.length
      ? `\n\n🚫 **컨텍스트 제약으로 제외된 후보**\n` +
        blocked.map(b=>`· ${b.location} (평균 ${b.avg}) — 직전 방문 ${b.monthsAgo}개월밖에 안 됨, *3년 재방문 룰* 위반`).join('\n')
      : '';

    const after = {
      text:
`다음 여행 후보를 짤 때 컨텍스트의 4가지 제약을 먼저 적용했어요.

1. ⛔ 더운 동남아·우기  2. ⛔ 비행시간 6h 초과  3. ⛔ 같은 도시 3년 내 재방문 (홋카이도 예외)  4. ⛔ 인파 명소

남은 후보 중 *고객님 데이터*에서 평균 행복지수 8.5+ 만 추렸습니다.

${lines.join('\n')}${blockedLines}`,
      sql: SQL.locationRank(),
      table: eligible.slice(0,5).map(s => ({
        장소: s.location, 평균행복: s.avg, '경과(개월)': s.monthsAgo, 비고: s.location==='홋카이도' ? '재방문 OK (예외)' : 'OK',
      })),
      advice:
        `1순위 ${top?.location}는 단순히 "좋아하니까"가 아니라, *9개 여행 중 평균 ${top?.avg}로 압도적 1위*인 데이터가 근거예요. ` +
        `다음 여행은 12월~2월 사이로 잡으시면 컨텍스트의 정기 루틴(매년 일본 겨울 여행)과도 맞물립니다.`,
    };
    return { before, after };
  }

  // ============================================================
  //  Intent 3 — "동남아 추천해줘" 같은 제약 위반 질문
  // ============================================================
  function intentSoutheastAsia() {
    const dananng = ROWS().filter(r=>r.location==='베트남 다낭');
    const danangAvg = round1(avg(dananng.map(r=>r.value)));

    const before = {
      text:
`동남아 인기 여행지 추천드려요!

· 🇹🇭 **태국 방콕/푸켓** — 음식 다양, 마사지 저렴
· 🇻🇳 **베트남 다낭/호이안** — 물가 좋고 비행 짧음
· 🇮🇩 **인도네시아 발리** — 휴양·서핑
· 🇵🇭 **필리핀 보라카이/세부** — 가성비 휴양

어디가 끌리세요?`,
      advice: '동남아=따뜻=좋음 이라는 일반화. 고객님 과거 다낭 여행이 *실제로* 어땠는지는 모릅니다.',
    };

    const after = {
      text:
`솔직하게 말씀드릴게요. **동남아는 추천드리지 않습니다.** 컨텍스트와 과거 데이터가 분명히 그렇게 말하고 있어요.

📂 **2022-06 베트남 다낭 여행 기록**
· 미케 비치 일광욕 → **3.5/10** ("너무 더워서 1시간 만에 철수")
· 다낭 출국 → **4.0/10** ("전반적으로 후회")
· **여행 평균 ${danangAvg}/10** — 9개 여행 중 *최하위*

📌 **컨텍스트 제약**
· §3-1 더운 동남아·열대 기후는 추천하지 말 것
· §2 좋아하는 계절: ❄️ 겨울 / 좋아하는 분위기: 인파 적은 곳

→ 일반론으로 동남아를 권하면 거의 확실히 또 후회하시게 돼요.

🔁 **대신 권하는 대안**
· 같은 비행시간(4~5h) + 추운 시기를 원하시면 → 12~2월 **홋카이도** (평균 9.5)
· 가까운 *여름철 더위 회피*가 목적이면 → **강원도 평창 / 닛코** (평균 7~9)`,
      sql: SQL.byCategory('활동'),
      table: dananng.map(r => ({
        날짜: r.created_at, 카테고리: r.category, 내용: r.content, 행복: r.value,
      })),
      advice:
        `이게 "데이터(DB)는 행동을 말한다"의 핵심이에요. 일반론은 "동남아 좋아요"라고 답하지만, ` +
        `실제 데이터는 "당신은 동남아에서 행복하지 않았다"고 말합니다. 컨텍스트는 그 후회를 두 번 반복하지 않게 해주는 안전장치예요.`,
    };
    return { before, after };
  }

  // ============================================================
  //  Intent 4 — 겨울 여행 추천
  // ============================================================
  function intentWinter() {
    const winterRows = ROWS().filter(r => {
      const m = parseInt(r.created_at.slice(5,7),10);
      return m===12 || m===1 || m===2;
    });
    const winterStats = locationStats(winterRows);

    const before = {
      text:
`겨울 여행이라면 **따뜻한 곳**으로 피난하시는 분들이 많아요.

· 🌴 동남아 휴양 (다낭·푸켓·발리)
· 🇦🇺 호주 시드니 (남반구 여름)
· 🇪🇸 스페인 바르셀로나 (온화)

스키 여행을 원하시면 일본 니가타·홋카이도, 또는 캐나다 휘슬러도 인기예요.`,
      advice: '"겨울 = 따뜻한 곳"이라는 가정. 사용자가 추위/눈을 *좋아할* 가능성은 고려하지 않습니다.',
    };

    const top = winterStats[0];
    const lines = winterStats.map(s =>
      `· **${s.location}** — 평균 ${s.avg} (${s.records}건, ${s.visits}회 방문)`
    );

    const after = {
      text:
`겨울이라면 답이 정해져 있어요. **${top.location}** 입니다. 평균 ${top.avg}/10. 컨텍스트도 "겨울·눈"을 가장 좋아한다고 적어두셨어요.

❄️ **겨울(12~2월) 여행 데이터**
${lines.join('\n')}

🎯 **이번 겨울(2026-12~2027-02) 추천 시나리오**
1. **삿포로 + 후라노** (5박6일) — 눈축제(2월 초) + 파우더 스노우 스키
2. **하코다테** (4박5일, 미경험) — 야경·온천·아침 시장. 컨텍스트의 "조용한 골목" 키워드 일치
3. **노보리베츠 료칸 집중형** (3박4일) — 2023-12 다이이치 다키모토칸 ${ROWS().find(r=>r.content.includes('다이이치'))?.value}/10 기록 재현`,
      sql: SQL.season([12,1,2]),
      table: winterStats.map(s => ({
        장소: s.location, '겨울 평균': s.avg, '겨울 기록 수': s.records, '방문 횟수': s.visits,
      })),
      chart: {
        type: 'bar',
        labels: winterStats.map(s=>s.location),
        values: winterStats.map(s=>s.avg),
      },
      advice:
        `겨울 데이터가 ${winterStats.length}곳밖에 없는 이유는 단순해요 — 매년 같은 시즌에 ${top.location}만 가셨기 때문입니다. ` +
        `이게 컨텍스트 §4 "매년 12~2월 일본 겨울 여행"이라는 루틴의 실제 흔적이에요.`,
    };
    return { before, after };
  }

  // ============================================================
  //  Intent 5 — "교토 다시 갈까" (재방문 룰 검증)
  // ============================================================
  function intentRevisit(text) {
    // 도시명 추출 (간단 매칭)
    const cities = ['교토','도쿄','오사카','후쿠오카','닛코','홋카이도','강원도 평창','베트남 다낭'];
    const target = cities.find(c => text.includes(c.replace('강원도 ','').replace('베트남 ','')));
    if (!target) return null;

    const trips = ROWS().filter(r=>r.location===target);
    const lastDate = trips.map(r=>r.created_at).sort().slice(-1)[0];
    const months = monthsAgo(lastDate);
    const avgVal = round1(avg(trips.map(r=>r.value)));
    const isHokkaido = target === '홋카이도';

    const before = {
      text:
`${target}는 좋은 여행지예요! 시즌과 일정만 맞으면 언제든 다녀오셔도 좋습니다. 인기 명소는 미리 예약해두시는 게 좋아요.`,
      advice: '재방문 간격, 과거 만족도 같은 컨텍스트는 전혀 반영되지 않습니다.',
    };

    let verdict, reason;
    if (isHokkaido) {
      verdict = '✅ 가셔도 됩니다 (강력 권장)';
      reason = `홋카이도는 컨텍스트 §3-3 *3년 재방문 룰의 유일한 예외*로 명시돼 있어요. 평균 행복지수도 ${avgVal}/10으로 압도적입니다.`;
    } else if (months >= 36) {
      verdict = '✅ 갈 시점입니다';
      reason = `직전 방문 후 ${months}개월 경과 — 3년 룰을 통과합니다. 과거 평균 ${avgVal}/10.`;
    } else {
      verdict = '⛔ 지금 시점에선 권하지 않습니다';
      reason = `직전 방문 후 ${months}개월밖에 안 됐어요. 컨텍스트 §3-3 *3년 안 재방문 X* 룰에 걸립니다. 36개월 = ${36-months}개월 더 기다리면 OK.`;
    }

    const after = {
      text:
`**${target} 재방문 판정 — ${verdict}**

${reason}

📂 **${target} 과거 기록**
${trips.slice(0,5).map(r=>`· ${r.created_at} · ${r.category} · ${r.content} → ${r.value}`).join('\n')}
${trips.length>5 ? `· … 외 ${trips.length-5}건` : ''}`,
      sql:
`select created_at, category, content, value
from public.travel_logs
where location = '${target}'
order by created_at;`,
      advice:
        isHokkaido
          ? `홋카이도가 예외인 이유는 단순합니다. 다른 곳들이 평균 7~8점인데 비해 평균 ${avgVal}점이라는 건, 이미 "재방문 룰을 만들 가치가 없는 곳"이라는 뜻이에요.`
          : `룰을 어기고 다시 가시고 싶다면 *왜* 그런지 한 번 더 생각해보세요. 미경험 비슷한 도시(예: ${target==='교토' ? '나라' : '하코다테'})로 대체할 수 있는 욕구라면 그쪽이 더 큰 행복으로 이어질 수 있어요.`,
    };
    return { before, after };
  }

  // ============================================================
  //  Intent 6 — 음식 추천 / 최고 음식
  // ============================================================
  function intentFood() {
    const foods = categoryStats(ROWS(), '음식').slice(0,8);
    const top = foods[0];

    const before = {
      text:
`해외 여행 음식이라면 **일본 스시·라멘, 태국 팟타이, 이탈리아 파스타·피자**가 가장 인기예요. 어떤 나라 음식 위주로 보여드릴까요?`,
      advice: '메뉴 인기 순위만 알려주는 일반론.',
    };

    const lines = foods.map((f,i) =>
      `${i+1}. **${f.content}** · ${f.location} · ${f.value}`
    );

    const after = {
      text:
`여지껏 드신 음식 중 행복지수가 가장 높았던 건 **${top.content}** (${top.location}, ${top.value}/10) 이에요.

🍜 **음식 행복지수 Top 8**
${lines.join('\n')}

상위 8개 중 ${foods.filter(f=>f.location==='홋카이도').length}개가 **홋카이도** 음식이에요. 컨텍스트의 *라멘·징기스칸·가이세키* 키워드와 정확히 겹칩니다.`,
      sql: SQL.byCategory('음식'),
      table: foods.map(f => ({
        순위: foods.indexOf(f)+1, 음식: f.content, 장소: f.location, 행복: f.value, 날짜: f.created_at,
      })),
      advice:
        `다음 여행지 음식을 고를 때 *홋카이도 미소라멘 9.5점*을 기준값으로 삼아보세요. ` +
        `이 점수를 기억하면 다른 곳에서 "그저 그런" 라멘에 만족하지 않게 됩니다.`,
    };
    return { before, after };
  }

  // ============================================================
  //  Intent 7 — 도움말
  // ============================================================
  function intentHelp() {
    return {
      before: {
        text:
`무엇을 도와드릴까요? 여행지 추천, 항공/호텔, 일정 짜기 등 도와드릴 수 있어요.`,
        advice: '범용 비서 톤. 사용자에 대해 아무것도 모릅니다.',
      },
      after: {
        text:
`이런 식으로 물어봐주세요 (컨텍스트 + DB 기반으로 답해드려요) 👇

· "여지껏 다녀온 여행지 중에 가장 좋았던 곳은?" *(PRD 대표 시나리오)*
· "다음 여행 어디로 갈까?"
· "동남아 추천해줘" *(제약 검증)*
· "이번 겨울에 어디 갈까?"
· "교토 다시 가도 될까?" *(재방문 룰 검증)*
· "여태 먹은 음식 중 가장 좋았던 건?"`,
        advice:
          `왼쪽 상단 **컨텍스트 토글**을 켜고 끄면서 같은 질문을 두 번 던져보세요. *Before & After* 답변의 차이가 PRD §4-3 비교 시연 모드의 핵심이에요.`,
      },
    };
  }

  // ============================================================
  //  Router
  // ============================================================
  // 매 호출마다 다른 답을 위해 random pick
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function intentRelax(question) {
    const beforeOpenings = [
      '"마음 편안한 여행지" 라면 일반적으로는 휴양지를 떠올리게 돼요.',
      '편안한 여행이라면 일반론으로는 따뜻하고 인파 적은 곳이 답이죠.',
      '마음을 내려놓는 여행이라면 보통 이런 곳들이 후보예요.',
    ];
    const beforeBuckets = shuffle([
      '· 🇲🇻 몰디브 — 수상가옥, 관리된 휴양',
      '· 🇮🇩 발리 우붓 — 정글·요가·스파',
      '· 🇰🇷 제주 서귀포 — 가까움 + 자연',
      '· 🇹🇭 코사무이 — 인파 적은 섬',
      '· 🇯🇵 오키나와 — 청량한 바다 + 조용함',
      '· 🇮🇹 토스카나 시골 — 와이너리·풍경',
      '· 🇨🇭 그린델발트 — 알프스 정적',
    ]).slice(0, 4).join('\n');

    const before = {
      text: `${pick(beforeOpenings)}\n\n${beforeBuckets}\n\n다만 사람마다 "편안하다"의 정의가 달라서, 동행자·예산·계절 알려주시면 더 좁힐 수 있어요.`,
    };

    // 컨텍스트 ON — DB의 "쉼" 카테고리 + 만족도 9+ 데이터 기반
    const restRecords = [
      '오타루 료칸 노천탕 9.6/10',
      '다이이치 다키모토칸 료칸 9.8/10',
      '홋카이도식 가이세키 9.5/10',
      '대관령 펜션 — 시원함 7.8/10',
    ];
    const afterOpenings = [
      '"마음 편안" 이라는 단어를 데이터에 비춰보면 답이 정해져 있어요.',
      '본인 데이터에서 "쉼" 카테고리 만족도가 압도적인 곳이 있어요.',
      '편안함의 정의를 본인 기록으로 바꿔보면 명확해져요.',
    ];
    const afterClosings = [
      '결국 \"늘 편안한 곳\"은 한 곳입니다 — **홋카이도 료칸형 여행**. 노보리베츠/오타루/유후인 모두 같은 패턴으로 9.5↑ 나올 거예요.',
      '결론: 본인에게 \"편안\"은 = **료칸 + 노천탕 + 가이세키 + 인파 없는 골목**. 홋카이도가 가장 정직한 답이에요.',
      '\"편안\"의 좌표는 데이터상 **눈 + 료칸 + 정적**. 다음 후보는 **유후인·구로카와 온천**도 같은 패턴이라 추천드릴 만해요.',
    ];

    const after = {
      text: `${pick(afterOpenings)}\n\n📂 **\"쉼\" 카테고리 Top 기록**:\n${shuffle(restRecords).slice(0, 3).map(s => '· ' + s).join('\n')}\n\n💡 **패턴**: 료칸 노천탕 + 고요함 + 인파 없는 골목길에서 만족도가 9.5+ 로 압도적이에요. 동남아 풀빌라(다낭 6.0) 와 비교하면 차이가 분명합니다.\n\n${pick(afterClosings)}`,
    };
    return { before, after };
  }

  function intentCompanion(question) {
    const t = question || '';
    let label = '커플';
    let beforeRec = '';
    if (/가족|부모|아이|자녀|아기|애기/i.test(t)) {
      label = '가족';
      beforeRec = '· 🇯🇵 일본 오사카·교토 (아이 친화 + 음식 안전)\n· 🇰🇷 제주도 (직항 짧고 동선 쉬움)\n· 🇸🇬 싱가포르 (영어·치안·테마파크)\n· 🇹🇭 푸켓 리조트 (수영장 종일)';
    } else if (/친구|동료/i.test(t)) {
      label = '친구';
      beforeRec = '· 🇹🇼 대만 타이베이 (가성비 + 야시장)\n· 🇯🇵 후쿠오카 (단거리 + 라멘·이자카야)\n· 🇻🇳 호이안·다낭 (저렴 + 액티비티)\n· 🇪🇸 바르셀로나 (밤문화·건축)';
    } else if (/혼자|혼행|솔로/i.test(t)) {
      label = '혼자';
      beforeRec = '· 🇯🇵 교토 (혼밥·숙소 친화)\n· 🇹🇭 치앙마이 (디지털 노마드)\n· 🇮🇸 아이슬란드 (오로라·자연)\n· 🇵🇹 리스본 (친절·물가)';
    } else {
      label = '커플';
      beforeRec = '· 🇮🇩 발리 (풀빌라·일몰)\n· 🇫🇷 파리 (낭만 클래식)\n· 🇲🇻 몰디브 (수상가옥)\n· 🇯🇵 교토 (료칸·정원)';
    }

    const before = {
      text: `${label} 여행지로 일반적으로 추천되는 곳은:\n\n${beforeRec}\n\n예산·여행 시기·취향에 따라 달라지니까 좀 더 좁혀서 알려주시면 추천을 다듬을 수 있어요.`,
    };

    const after = {
      text: `솔직히 말씀드릴게요. 컨텍스트와 DB 65건엔 **동행자 정보가 따로 기록되어 있지 않아요**. 그래서 "${label} 여행지"만 근거로 추천을 만드는 건 정확하지 않습니다.\n\n📂 **다만 당신의 패턴은 분명해요**:\n· **료칸 노천탕 9.6/10, 가이세키 9.5/10** → 휴양·고요함 선호\n· 인파 명소 회피, 럭셔리 숙소형 만족도 압도적\n· **다이이치 다키모토칸 료칸 9.8/10** — 인생 숙소 후보\n\n💡 **${label}이라면 이 패턴 그대로**:\n1. **홋카이도 노보리베츠/정선 료칸** — 9.8/10 료칸 경험을 ${label}와 공유\n2. **교토 정원·온천 료칸** — 분주한 명소는 빼고 료칸 중심\n3. (${label === '커플' || label === '친구' ? '아니라면' : '대안'}) **강원도 평창 풀빌라** — 휴양 패턴 (T03 7.5/10) 재현\n\n동행자 데이터가 있으면 더 정밀하게 답할 수 있어요. 다음 여행 기록할 때 \`동행자\` 칼럼을 추가해보세요.`,
    };
    return { before, after };
  }

  function intentFallback(question) {
    const q = (question || '').trim();
    const samples = shuffle([
      '여지껏 다녀온 여행지 중에 가장 좋았던 곳은?',
      '다음 여행 어디로 갈까?',
      '이번 겨울에 어디 갈까?',
      '교토 다시 가도 될까?',
      '동남아 추천해줘',
      '여태 먹은 음식 중 가장 좋았던 건?',
      '늘 마음 편안한 여행지는?',
      '커플이 가기 좋은 곳은?',
    ]).slice(0, 4).map((s) => `· ${s}`).join('\n');

    const beforeMessages = [
      `\"${q}\" 에 대해 일반적으로 답을 드리기는 좀 막연해요. 여행 일반론이라면 동남아나 일본이 무난하다고 답하겠지만, 그게 진짜 도움이 되는 답은 아니죠.\n\n조금 더 구체적인 질문이면 답을 다듬어볼 수 있어요.`,
      `\"${q}\" — 솔직히 일반 LLM 입장에선 답이 너무 광범위해요. 보통은 \"인기 여행지 TOP10\" 같은 답을 내놓겠지만, 그게 본인 취향과 맞을 확률은 반반이에요.\n\n계절·예산·동행자 같은 단서를 하나만 더 주셔도 답 품질이 확 달라져요.`,
      `\"${q}\" 라고 물으시면 일반론은 \"개인 취향이라서 다르다\"는 답이 가장 정직해요. 의미 있는 답을 드리려면 좀 더 구체화가 필요해요.\n\n예를 들어 \"겨울에\", \"가족이랑\", \"100만원 안에서\" 같은 단서가 붙으면 답이 좁혀져요.`,
    ];
    const afterMessages = [
      `📂 컨텍스트(.md) + DB 65건 기록을 훑어봤지만, 이 질문에 정확히 매칭되는 패턴을 못 찾았어요. 아무 답이나 만드는 대신 솔직히 말씀드릴게요.\n\n데이터 기반의 정밀한 답을 받으시려면 아래 중 하나를 시도해보세요:\n\n${samples}\n\n또는 위쪽 Quick Question 버튼 아무거나 누르셔도 됩니다.`,
      `📂 컨텍스트와 65건 기록에서 이 질문 키워드와 직접 연결되는 패턴이 안 보여요. 데이터 없이 \"느낌\"으로 답을 만들면 일반 LLM과 다를 게 없어서, 이 자리에선 솔직히 모른다고 말씀드릴게요.\n\n같은 의도로 다음 질문을 시도해보세요:\n\n${samples}`,
      `📂 본인 여행 DB에서 이 질문에 매핑되는 행동 데이터가 부족해요. 추천할 수는 있지만, 그건 컨텍스트 기반이 아니라 그냥 일반론이 돼버려요.\n\n대신 데이터가 있는 영역에선 매우 정밀한 답이 가능해요:\n\n${samples}`,
    ];

    return {
      before: { text: pick(beforeMessages) },
      after:  { text: pick(afterMessages) },
    };
  }

  function route(question) {
    const t = (question || '').trim();
    if (!t) return intentFallback('');

    if (/도움말|어떻게|뭐\s*물어|help|샘플|예시/i.test(t)) return intentHelp();
    if (/(편안|힐링|쉬|쉴|조용|여유|마음|평온|쉼|휴양)/i.test(t)) return intentRelax(t);
    if (/(커플|연인|부부|남친|여친|남자친구|여자친구|가족|부모|아이|자녀|아기|애기|친구|동료|혼자|혼행|솔로)/i.test(t)) return intentCompanion(t);
    if (/(다시|재방문|또\s*가|또갈)/i.test(t))   return intentRevisit(t) || intentRecommend(t);
    if (/(겨울|눈|2월|12월|1월)/i.test(t))         return intentWinter();
    if (/(동남아|태국|베트남|발리|푸켓|보라카이|다낭|호이안)/i.test(t)) return intentSoutheastAsia();
    if (/(가장|제일|최고).*(좋|행복|만족).*(여행|곳|도시|지역|국가)/i.test(t)) return intentBest();
    if (/(좋았던|좋은).*(여행|곳|도시|국가|지역)/i.test(t)) return intentBest();
    if (/(음식|먹|맛집|식당|라멘|스시|라면|밥|디저트)/i.test(t)) return intentFood();
    if (/(다음|이번|어디.*갈|추천|어디로|아무|대중|제안)/i.test(t)) return intentRecommend(t);

    // 매칭 안 되는 질문 → 솔직한 fallback (이전엔 무조건 intentBest 로 떨어졌음)
    return intentFallback(t);
  }

  // ============================================================
  //  Public API
  // ============================================================
  window.TravelAgent = {
    ask(question) {
      const result = route(question);
      return { question, ...result };
    },
    today: TODAY,
    rows: ROWS,
    context: CTX,
    locationStats,
  };
})();
