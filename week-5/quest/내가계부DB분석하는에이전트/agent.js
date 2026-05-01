// ============================================================
// 가계부 분석 에이전트 — 자연어 질문 → 분석 결과
// ------------------------------------------------------------
// 입력: 자연어 질문 (string)
// 출력: { text, sql, table, chart, advice }
// 동작 방식:
//   1) 질문에서 기간/카테고리/의도(intent) 추출
//   2) 의도별 핸들러가 ledgers 데이터를 집계
//   3) 결과 + 실행 SQL을 함께 반환 → UI에서 함께 노출
//
// 데이터 소스: window.LEDGER_SEED (오프라인 데모)
//   ※ Supabase MCP 연결 시에는 ask() 안의 분기에서
//     mcp.supabase_query(sql) 호출 결과를 사용하면 됨
// ============================================================

(function () {
  const TODAY = new Date('2026-04-29T00:00:00');           // 데모 고정 기준일
  const DEFAULT_BUDGET = 1_000_000;                         // 월 기본 예산 (원)
  const ROWS_PROVIDER = () => (window.LEDGER_SEED || []).map(r => ({ ...r, _date: new Date(r.date + 'T00:00:00') }));

  // ────────────── 유틸 ──────────────
  const fmtKRW = n => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원';
  // 한국어 조사 자동 선택 (받침 유무 기반)
  const hasBatchim = s => {
    if (!s) return false;
    const c = s.charCodeAt(s.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return false;
    return ((c - 0xAC00) % 28) !== 0;
  };
  const josa = (s, withBatchim, withoutBatchim) =>
    s + (hasBatchim(s) ? withBatchim : withoutBatchim);
  const J = {
    eunNeun: s => josa(s, '은', '는'),
    iGa:     s => josa(s, '이', '가'),
    eulReul: s => josa(s, '을', '를'),
  };
  const fmtPct = n => (n >= 0 ? '+' : '') + (n).toFixed(1) + '%';
  const pad2   = n => String(n).padStart(2, '0');
  const ymd    = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const ym     = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth   = d => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const addMonths    = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const startOfWeek  = d => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; };
  const daysBetween  = (a, b) => Math.round((b - a) / 86400000) + 1;
  const weekdayKR    = ['일','월','화','수','목','금','토'];
  const sum          = arr => arr.reduce((a, b) => a + b, 0);
  const groupBy      = (rows, keyFn) => {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };

  // ────────────── 기간 파서 ──────────────
  function parsePeriod(text) {
    // 명시적 월 (예: 3월, 4월)
    const m = text.match(/(\d{1,2})\s*월/);
    if (m) {
      const month = parseInt(m[1], 10) - 1;
      const start = new Date(TODAY.getFullYear(), month, 1);
      const end   = endOfMonth(start);
      return { start, end, label: `${month + 1}월`, scope: 'month' };
    }
    if (/지난\s*달|저번\s*달|전\s*달/.test(text)) {
      const start = addMonths(startOfMonth(TODAY), -1);
      return { start, end: endOfMonth(start), label: '지난달', scope: 'month' };
    }
    if (/이번\s*달|이번달|이달|당월/.test(text)) {
      const start = startOfMonth(TODAY);
      return { start, end: endOfMonth(start), label: '이번 달', scope: 'month' };
    }
    if (/지난\s*주|저번\s*주/.test(text)) {
      const start = startOfWeek(new Date(TODAY)); start.setDate(start.getDate() - 7);
      const end   = new Date(start); end.setDate(end.getDate() + 6);
      return { start, end, label: '지난주', scope: 'week' };
    }
    if (/이번\s*주|이번주|금주/.test(text)) {
      const start = startOfWeek(new Date(TODAY));
      const end   = new Date(start); end.setDate(end.getDate() + 6);
      return { start, end, label: '이번 주', scope: 'week' };
    }
    if (/오늘|금일/.test(text)) return { start: TODAY, end: TODAY, label: '오늘', scope: 'day' };
    if (/어제|전일/.test(text)) {
      const d = new Date(TODAY); d.setDate(d.getDate() - 1);
      return { start: d, end: d, label: '어제', scope: 'day' };
    }
    if (/전체|모든\s*기간|총|누적/.test(text)) {
      return { start: new Date('2000-01-01'), end: new Date('2999-12-31'), label: '전체 기간', scope: 'all' };
    }
    // 기본값: 이번 달
    const start = startOfMonth(TODAY);
    return { start, end: endOfMonth(start), label: '이번 달', scope: 'month' };
  }

  // ────────────── 카테고리 파서 ──────────────
  const CATEGORY_ALIASES = {
    '식비': ['식비', '밥', '식사', '외식', '점심', '저녁'],
    '카페': ['카페', '커피', '디저트'],
    '교통': ['교통', '교통비', '지하철', '버스', '택시'],
    '주거': ['주거', '관리비', '월세', '공과금'],
    '통신비': ['통신', '통신비', '핸드폰', '휴대폰'],
    '구독료': ['구독', '구독료', '넷플릭스', '유튜브'],
    '경조사': ['경조사', '축의', '조의'],
    '의료':   ['의료', '병원', '약'],
    '쇼핑':   ['쇼핑', '의류', '옷', '운동화', '생활용품'],
    '문화/여가': ['문화', '여가', '영화', '전시', '공연'],
  };
  function parseCategory(text) {
    for (const [cat, kws] of Object.entries(CATEGORY_ALIASES)) {
      if (kws.some(k => text.includes(k))) return cat;
    }
    return null;
  }

  // ────────────── 필터 ──────────────
  function filterRows(rows, { period, category, type }) {
    return rows.filter(r => {
      if (type && r.type !== type) return false;
      if (period && (r._date < period.start || r._date > period.end)) return false;
      if (category && r.category !== category) return false;
      return true;
    });
  }

  // ────────────── SQL 빌더 (참고용 표시) ──────────────
  function periodSqlClause(p) {
    if (p.scope === 'all') return '';
    return `where date between '${ymd(p.start)}' and '${ymd(p.end)}'`;
  }

  // ============================================================
  // 의도(intent) 핸들러
  // ============================================================

  // 1) 총 지출
  function handleTotal(text, rows) {
    const period = parsePeriod(text);
    const category = parseCategory(text);
    const list = filterRows(rows, { period, category, type: 'expense' });
    const total = sum(list.map(r => r.amount));
    const days  = daysBetween(period.start, period.end);
    const elapsed = Math.min(daysBetween(period.start, TODAY), days);
    const dailyAvg = elapsed > 0 ? total / elapsed : 0;

    const sql = [
      `-- ${period.label}${category ? ` · ${category}` : ''} 총 지출`,
      `select coalesce(sum(amount), 0) as total`,
      `from public.ledgers`,
      `where type = 'expense'`,
      period.scope === 'all' ? '' : `  and date between '${ymd(period.start)}' and '${ymd(period.end)}'`,
      category ? `  and category = '${category}'` : '',
    ].filter(Boolean).join('\n') + ';';

    const head = category
      ? `${period.label} **${category}** 지출은 **${fmtKRW(total)}** 입니다.`
      : `${period.label} 총 지출은 **${fmtKRW(total)}** 정도예요.`;
    let text2 = head;
    if (period.scope === 'month' && elapsed > 0 && elapsed < days) {
      text2 += `\n하루 평균 약 **${fmtKRW(dailyAvg)}**, 4월의 ${elapsed}/${days}일을 지나는 시점이라 사실상 한 달치가 거의 다 잡힌 셈이에요.`;
    } else {
      text2 += `\n총 ${list.length}건의 거래가 있었어요.`;
    }

    // 조언: 카테고리별/기간별 컨텍스트
    let advice = '';
    if (category) {
      const all = filterRows(rows, { period, type: 'expense' });
      const grand = sum(all.map(r => r.amount));
      const pct = grand ? (total / grand) * 100 : 0;
      advice = `${period.label} 전체 지출의 **${pct.toFixed(1)}%** 를 ${J.iGa(category)} 차지하고 있어요. ` +
               (pct >= 30
                 ? `한 항목에 30% 이상 몰리면 다른 영역이 줄어들기 쉬워요. "${category} 가장 많이 쓴 날" 도 같이 봐드릴까요?`
                 : `다른 영역과 비교하면 비중이 크지 않은 편이에요.`);
    } else if (period.scope === 'month') {
      advice = elapsed >= days - 2
        ? `한 달이 거의 마무리됐어요. 카테고리별 분석으로 어디에 가장 많이 들어갔는지 짚어보고, 5월 예산을 잡아두면 다음 달이 훨씬 편해져요.`
        : `아직 ${days - elapsed}일 남았어요. 일평균을 조금만 의식해도 월말 숫자가 꽤 달라집니다.`;
    } else {
      advice = `이 기간 중 가장 큰 한 건이 무엇이었는지 같이 살펴보시면, 다음에 비슷한 지출이 또 생길지 미리 가늠할 수 있어요.`;
    }

    return {
      text: text2,
      sql,
      advice,
      table: list.slice(-10).reverse().map(r => ({
        날짜: r.date, 카테고리: r.category, 금액: fmtKRW(r.amount), 메모: r.memo,
      })),
    };
  }

  // 2) 카테고리 분포
  function handleBreakdown(text, rows) {
    const period = parsePeriod(text);
    const list = filterRows(rows, { period, type: 'expense' });
    const byCat = groupBy(list, r => r.category);
    const totals = [...byCat.entries()]
      .map(([cat, arr]) => ({ category: cat, total: sum(arr.map(r => r.amount)), count: arr.length }))
      .sort((a, b) => b.total - a.total);
    const grand = sum(totals.map(t => t.total));

    const sql = [
      `-- ${period.label} 카테고리별 지출`,
      `select category, sum(amount) as total, count(*) as entry_count`,
      `from public.ledgers`,
      `where type = 'expense'`,
      period.scope === 'all' ? '' : `  and date between '${ymd(period.start)}' and '${ymd(period.end)}'`,
      `group by category`,
      `order by total desc;`,
    ].filter(Boolean).join('\n');

    const top = totals[0];
    const lines = totals.slice(0, 8).map(t => {
      const pct = grand ? (t.total / grand) * 100 : 0;
      return `· **${t.category}** ${fmtKRW(t.total)} · ${pct.toFixed(1)}% · ${t.count}건`;
    });

    let advice = '';
    if (top) {
      const topPct = (top.total / grand) * 100;
      const cafeRow = totals.find(t => t.category === '카페');
      const subsRow = totals.find(t => t.category === '구독료');
      const parts = [];
      parts.push(`${J.eunNeun(period.label)} **${top.category}** (${topPct.toFixed(0)}%) 위주의 흐름이에요.`);
      if (top.category === '식비' && topPct >= 35) {
        parts.push(`식비가 35%를 넘으면 보통 "외식·배달이 많았다" 는 신호예요. 회식이 잡혀 있던 금요일 저녁이 패턴화되어 있는지 한 번 짚어보면 좋아요.`);
      } else if (top.category === '주거' || top.category === '월세') {
        parts.push(`주거가 1순위면 다른 변동비가 잘 잡혀 있다는 뜻이라 좋은 신호예요.`);
      }
      if (cafeRow && cafeRow.count >= 6) {
        const saving = fmtKRW(Math.round(cafeRow.total * 0.25));
        parts.push(`카페가 ${cafeRow.count}회 (${fmtKRW(cafeRow.total)}) 인데, 주 1회만 줄여도 한 달에 약 ${J.iGa(saving)} 남아요.`);
      }
      if (subsRow) {
        parts.push(`구독료(${fmtKRW(subsRow.total)})는 적극 사용 중이지 않다면 분기에 한 번씩 점검해주세요.`);
      }
      advice = parts.join(' ');
    }

    return {
      text:
        `${period.label} 어디에 돈이 흘러갔는지 정리해봤어요. 총 **${fmtKRW(grand)}** 중 비중 높은 순서예요.\n\n` +
        `${lines.join('\n')}`,
      sql,
      advice,
      chart: {
        type: 'bar',
        labels: totals.map(t => t.category),
        values: totals.map(t => t.total),
      },
    };
  }

  // 3) 가장 많이 쓴 날
  function handleTopDay(text, rows) {
    const period = parsePeriod(text);
    const category = parseCategory(text);
    const list = filterRows(rows, { period, category, type: 'expense' });
    const byDate = groupBy(list, r => r.date);
    const days = [...byDate.entries()]
      .map(([date, arr]) => ({ date, total: sum(arr.map(r => r.amount)), items: arr }))
      .sort((a, b) => b.total - a.total);

    const sql = [
      `-- ${period.label}${category ? ` · ${category}` : ''} 일자별 지출 (Top)`,
      `select date, sum(amount) as total, count(*) as cnt`,
      `from public.ledgers`,
      `where type = 'expense'`,
      period.scope === 'all' ? '' : `  and date between '${ymd(period.start)}' and '${ymd(period.end)}'`,
      category ? `  and category = '${category}'` : '',
      `group by date order by total desc limit 5;`,
    ].filter(Boolean).join('\n');

    if (!days.length) return { text: `${period.label} 동안 지출이 없네요.`, sql };

    const top = days[0];
    const topDow = weekdayKR[new Date(top.date + 'T00:00:00').getDay()];
    const detail = top.items
      .sort((a, b) => b.amount - a.amount)
      .map(i => `· ${i.category} ${fmtKRW(i.amount)} _(${i.memo})_`)
      .join('\n');

    const lines = days.slice(0, 5).map((d, i) => {
      const dow = weekdayKR[new Date(d.date + 'T00:00:00').getDay()];
      return `${i + 1}. ${d.date} (${dow}) · ${fmtKRW(d.total)}`;
    });

    // Top5 의 요일 분포로 패턴 추출
    const dowCount = {};
    days.slice(0, 5).forEach(d => {
      const k = weekdayKR[new Date(d.date + 'T00:00:00').getDay()];
      dowCount[k] = (dowCount[k] || 0) + 1;
    });
    const repeatDow = Object.entries(dowCount).find(([, c]) => c >= 3);

    let advice = '';
    if (repeatDow) {
      const dowName = `${repeatDow[0]}요일`;
      advice = `Top 5 중 ${repeatDow[1]}일이 **${dowName}**에 몰려 있어요. ${dowName}에 잡힌 약속이나 회식이 자주 큰 금액으로 이어진다는 뜻이라, 다음 달엔 ${dowName} 일정에서 한 번만 줄이거나 옮겨도 효과가 큽니다.`;
    } else {
      advice = `상위 5일이 골고루 분산돼 있어 특정 요일 패턴은 두드러지지 않아요. 대신 이날들의 메모를 보면 *왜 그날 컸는지* 이유가 보여요.`;
    }

    return {
      text:
        `${period.label}${category ? ` ${category} 기준으로` : ''} 가장 많이 쓴 날은 **${top.date}(${topDow})**, ` +
        `**${fmtKRW(top.total)}** 였어요.\n\n그날 내역\n${detail}\n\nTOP 5\n${lines.join('\n')}`,
      sql,
      advice,
    };
  }

  // 4) 요일별 패턴
  function handleWeekday(text, rows) {
    const period = parsePeriod(text);
    const list = filterRows(rows, { period, type: 'expense' });

    // 일자별 합계로 먼저 묶고 → 요일별 평균
    const byDate = groupBy(list, r => r.date);
    const dayTotals = [...byDate.entries()].map(([date, arr]) => ({
      date, total: sum(arr.map(r => r.amount)), dow: new Date(date + 'T00:00:00').getDay(),
    }));
    const byDow = groupBy(dayTotals, d => d.dow);
    const stats = [];
    for (let i = 0; i < 7; i++) {
      const arr = byDow.get(i) || [];
      const total = sum(arr.map(a => a.total));
      stats.push({ dow: i, label: weekdayKR[i], total, days: arr.length, avg: arr.length ? total / arr.length : 0 });
    }
    const weekday = stats.filter(s => s.dow >= 1 && s.dow <= 5);
    const weekend = stats.filter(s => s.dow === 0 || s.dow === 6);
    const wAvg = sum(weekday.flatMap(s => Array(s.days).fill(s.avg))) / Math.max(1, sum(weekday.map(s => s.days)));
    const eAvg = sum(weekend.flatMap(s => Array(s.days).fill(s.avg))) / Math.max(1, sum(weekend.map(s => s.days)));

    const sql = [
      `-- ${period.label} 요일별 평균 지출`,
      `with daily as (`,
      `  select date, sum(amount) as day_total`,
      `  from public.ledgers`,
      `  where type = 'expense'`,
      period.scope === 'all' ? '' : `    and date between '${ymd(period.start)}' and '${ymd(period.end)}'`,
      `  group by date`,
      `)`,
      `select extract(dow from date)::int as dow, count(*) as days,`,
      `       sum(day_total) as total, round(avg(day_total)) as avg_per_day`,
      `from daily group by 1 order by 1;`,
    ].filter(Boolean).join('\n');

    const diff = Math.abs(eAvg - wAvg);
    const ratio = wAvg ? eAvg / wAvg : 1;

    // 가장 많이 쓴 요일 / 가장 적게 쓴 요일 (실제 데이터가 있는 요일만)
    const measured = stats.filter(s => s.days > 0);
    const topDow    = [...measured].sort((a, b) => b.avg - a.avg)[0];
    const bottomDow = [...measured].sort((a, b) => a.avg - b.avg)[0];

    // 합계 기준 1위가 평균 기준과 다르면 함께 알려줌
    const topByTotal = [...measured].sort((a, b) => b.total - a.total)[0];

    const headline = topDow
      ? `${period.label} 가장 많이 쓰는 요일은 **${topDow.label}요일** 이에요. 하루 평균 **${fmtKRW(topDow.avg)}**${topByTotal && topByTotal.dow !== topDow.dow ? ` (총합 기준 1위는 ${topByTotal.label}요일이에요)` : ''}.`
      : `${period.label} 동안 지출 데이터가 없어요.`;

    const lines = stats.map(s => {
      const mark = topDow && s.dow === topDow.dow ? ' 👑'
                 : (bottomDow && s.dow === bottomDow.dow && s.days > 0 ? ' ⬇︎' : '');
      return `· ${s.label}요일 하루 평균 ${fmtKRW(s.avg)}${mark}`;
    });

    let advice = '';
    if (eAvg > wAvg * 1.3) {
      advice = `주말이 주중보다 약 **${ratio.toFixed(1)}배** 더 쓰는 흐름이에요. 평일은 비교적 절제하지만 토·일에 외식·쇼핑이 몰리는 전형적인 패턴이에요. **주말 1회 외식 → 집밥 또는 산책+커피**로 바꾸면 한 달에 약 ${fmtKRW(Math.round(diff * 4))} 정도 차이가 납니다.`;
    } else if (wAvg > eAvg * 1.2) {
      advice = `오히려 주중에 더 쓰는 편이에요. 평일 점심·카페가 매일 누적되는 구조라, 주 1회 도시락이나 회사 카페 멤버십을 알아보는 게 효과적이에요.`;
    } else {
      advice = `주중·주말 격차가 크지 않은 편이에요. 큰 결심 없이도 균형이 잡혀 있다는 뜻이라, 지금 패턴을 그대로 유지해도 좋아요.`;
    }
    if (topDow) {
      advice += ` ${topDow.label}요일 평균(${fmtKRW(topDow.avg)})이 가장 높으니, ${topDow.label}요일 일정에 잡힌 약속이나 외식 패턴을 한 번 떠올려보면 좋아요.`;
    }

    return {
      text:
        `${headline}\n\n` +
        `요일별 하루 평균은 이렇게 나뉘어요.\n${lines.join('\n')}\n\n` +
        `주중 평균은 **${fmtKRW(wAvg)}**, 주말 평균은 **${fmtKRW(eAvg)}** 이에요.`,
      sql,
      advice,
      chart: { type: 'bar', labels: stats.map(s => s.label), values: stats.map(s => Math.round(s.avg)) },
    };
  }

  // 5) 월말 예측 (현재 속도)
  function handleForecast(text, rows) {
    const period = { start: startOfMonth(TODAY), end: endOfMonth(TODAY), label: '이번 달', scope: 'month' };
    const list = filterRows(rows, { period, type: 'expense' });
    const total = sum(list.map(r => r.amount));
    const totalDays = daysBetween(period.start, period.end);
    const elapsed   = daysBetween(period.start, TODAY);
    const dailyAvg  = total / Math.max(1, elapsed);
    const projected = Math.round(dailyAvg * totalDays);
    const remainDays = totalDays - elapsed;

    // 지난달과 비교
    const prevPeriod = { start: addMonths(period.start, -1), end: endOfMonth(addMonths(period.start, -1)), scope: 'month', label: '지난달' };
    const prevTotal = sum(filterRows(rows, { period: prevPeriod, type: 'expense' }).map(r => r.amount));
    const delta = prevTotal ? ((projected - prevTotal) / prevTotal) * 100 : 0;

    const sql = [
      `-- 일평균 × 월 일수로 월말 예측`,
      `with cur as (select sum(amount)::numeric as total from public.ledgers`,
      `             where type='expense' and date between '${ymd(period.start)}' and '${ymd(TODAY)}')`,
      `select round((total / ${elapsed}) * ${totalDays})::bigint as projected,`,
      `       round(total / ${elapsed})::bigint as daily_avg from cur;`,
    ].join('\n');

    let advice = '';
    if (Math.abs(delta) < 5) {
      advice = `지난달과 거의 비슷한 흐름(${fmtPct(delta)})이에요. 큰 사고 없이 한 달을 마무리한 셈이라 안정적이에요. 이참에 5월에 예정된 가정의 달 행사·경조사를 미리 떠올려 5만원 정도 여유 예산을 따로 잡아두시면 다음 달이 훨씬 편해집니다.`;
    } else if (delta > 0) {
      advice = `지난달보다 ${fmtPct(delta)} 늘어날 페이스예요. 이번 달에 평소엔 없던 **큰 1회성 지출**(쇼핑·경조사·의료 등)이 있었는지부터 확인해주세요. 그게 원인이면 다음 달엔 자연스럽게 평소 수준으로 돌아옵니다.`;
    } else {
      advice = `지난달보다 ${fmtPct(delta)} 적은 페이스예요. 잘 절제되고 있어요. 5월은 가정의 달이라 변동비가 늘어나기 쉬우니, 줄어든 만큼은 비상 예산으로 옮겨두는 걸 추천드려요.`;
    }

    return {
      text:
        `지금 속도(하루 약 **${fmtKRW(dailyAvg)}**)로 가면, 4월은 약 **${fmtKRW(projected)}** 정도로 마무리될 것 같아요.\n` +
        `· 누적 ${fmtKRW(total)} (${ymd(period.start)} ~ ${ymd(TODAY)})\n` +
        `· 남은 일수: ${remainDays}일\n` +
        (prevTotal ? `· 지난달 대비 ${fmtPct(delta)}` : ''),
      sql,
      advice,
    };
  }

  // 6) 예산 잔여 (이번 달 기준)
  function handleBudget(text, rows) {
    const m = text.match(/(\d{2,4})\s*만\s*원|(\d{3,8})\s*원|예산\s*(\d+)/);
    let budget = DEFAULT_BUDGET;
    if (m) {
      if (m[1]) budget = parseInt(m[1], 10) * 10000;
      else if (m[2]) budget = parseInt(m[2], 10);
      else if (m[3]) budget = parseInt(m[3], 10) * 10000;
    }
    const period = { start: startOfMonth(TODAY), end: endOfMonth(TODAY), label: '이번 달', scope: 'month' };
    const used = sum(filterRows(rows, { period, type: 'expense' }).map(r => r.amount));
    const left = budget - used;
    const pct  = (used / budget) * 100;
    const totalDays = daysBetween(period.start, period.end);
    const elapsed   = daysBetween(period.start, TODAY);
    const remainDays = totalDays - elapsed;
    const dailyLeft  = remainDays > 0 ? left / remainDays : 0;

    const sql = [
      `-- 월 예산 ${budget.toLocaleString('ko-KR')}원 대비 잔여`,
      `select ${budget} - coalesce(sum(amount), 0) as remaining`,
      `from public.ledgers`,
      `where type='expense'`,
      `  and date between '${ymd(period.start)}' and '${ymd(period.end)}';`,
    ].join('\n');

    // 큰 1회성 지출 식별 (예산 초과의 진짜 이유 파악)
    const monthRows = filterRows(rows, { period, type: 'expense' });
    const bigOneOff = monthRows
      .filter(r => r.amount >= 50000 && ['쇼핑','경조사','의료','문화/여가'].includes(r.category))
      .sort((a, b) => b.amount - a.amount);

    let advice = '';
    if (left < 0) {
      const oneOffSum = sum(bigOneOff.map(r => r.amount));
      const dailyTotal = used - oneOffSum;
      if (oneOffSum > 0) {
        advice = `예산을 ${fmtKRW(-left)} 넘었는데, 자세히 보면 **큰 1회성 지출** (${bigOneOff.map(r => `${r.category} ${fmtKRW(r.amount)}`).join(', ')}) 합계가 ${fmtKRW(oneOffSum)} 이에요. 이걸 빼면 일상 지출은 ${fmtKRW(dailyTotal)} 라서, 사실상 예산 안에서 잘 지내신 셈이에요. 다음 달부터는 "일상 100만 + 비고정 30만" 처럼 구조를 둘로 나눠두시는 걸 권해드려요.`;
      } else {
        advice = `예산을 ${fmtKRW(-left)} 정도 넘었어요. 하루씩 쪼개면 큰 차이는 아니지만, 5월 시작 전에 어느 카테고리에서 새는지 한 번 점검하시면 좋아요. *"카테고리별 분석해줘"* 가 도움이 됩니다.`;
      }
    } else if (pct > 80) {
      advice = `예산 80%를 넘긴 상태예요. 남은 ${remainDays}일 동안 하루 **${fmtKRW(dailyLeft)}** 정도가 가능해요. 외식·쇼핑은 잠시 멈춰두고, 식비는 집밥 위주로 가시면 부담 없이 마무리할 수 있어요.`;
    } else {
      advice = `여유롭게 잘 가고 있어요. 이대로면 ${fmtKRW(left)} 정도가 남을 텐데, 남는 만큼은 다음 달 비상 예산이나 작은 적금으로 옮겨두면 다음 달의 안정감이 달라집니다.`;
    }

    return {
      text:
        `이번 달 예산 **${fmtKRW(budget)}** 중\n` +
        `· 지출: **${fmtKRW(used)}** (${pct.toFixed(1)}%)\n` +
        `· 잔여: **${fmtKRW(left)}**` + (left < 0 ? ' ⚠️' : '') + `\n` +
        (remainDays <= 0
          ? `· 이번 달은 마무리됐어요.`
          : left <= 0
            ? `· 남은 ${remainDays}일은 가급적 추가 지출을 줄이는 게 좋아요.`
            : `· 남은 ${remainDays}일 동안 하루 ${fmtKRW(dailyLeft)} 까지 가능`),
      sql,
      advice,
    };
  }

  // 7) 절약 조언
  function handleAdvice(text, rows) {
    const period = parsePeriod(text);
    const list = filterRows(rows, { period, type: 'expense' });
    const byCat = groupBy(list, r => r.category);
    const totals = [...byCat.entries()]
      .map(([cat, arr]) => ({ category: cat, total: sum(arr.map(r => r.amount)), count: arr.length, items: arr }))
      .sort((a, b) => b.total - a.total);

    const advice = [];
    // (a) 카페·외식 빈도
    const cafe = byCat.get('카페') || [];
    if (cafe.length >= 6) {
      const cafeTotal = sum(cafe.map(r => r.amount));
      advice.push(`☕ **카페** 지출이 ${period.label} ${cafe.length}회, ${fmtKRW(cafeTotal)}입니다. 주 1회만 줄여도 약 ${fmtKRW(Math.round(cafeTotal * 0.25))} 절약 효과가 예상됩니다.`);
    }
    // (b) 구독료 점검
    const subs = byCat.get('구독료') || [];
    if (subs.length) {
      const subsTotal = sum(subs.map(r => r.amount));
      const services = [...new Set(subs.map(s => s.memo))].join(', ');
      advice.push(`📺 **구독료** ${fmtKRW(subsTotal)} (${services}) — 6개월 시청 빈도가 낮은 서비스가 있다면 정리 후 ${fmtKRW(Math.round(subsTotal * 0.5))}/월 절감 가능합니다.`);
    }
    // (c) 식비 큰 건 (1건당 25,000원 이상)
    const big = (byCat.get('식비') || []).filter(r => r.amount >= 25000);
    if (big.length >= 3) {
      const bigTotal = sum(big.map(r => r.amount));
      advice.push(`🍽 25,000원↑ 외식이 ${big.length}건 (${fmtKRW(bigTotal)}). 회식·약속 외 자율 외식을 절반으로 줄이면 ${fmtKRW(Math.round(bigTotal * 0.3))} 절약이 가능합니다.`);
    }
    // (d) Top 1 카테고리 비중
    const grand = sum(totals.map(t => t.total));
    if (totals[0] && grand) {
      const t = totals[0];
      const pct = (t.total / grand) * 100;
      if (pct >= 30) advice.push(`📊 **${t.category}** 비중이 ${pct.toFixed(1)}%로 가장 큽니다. 이 카테고리에서 10%만 줄여도 약 ${fmtKRW(Math.round(t.total * 0.1))} 절감 효과.`);
    }
    if (!advice.length) advice.push('현재 지출 구조는 비교적 균형이 잡혀 있습니다. 큰 1회성 지출(경조사·쇼핑) 변동에만 주의하세요.');

    const sql = [
      `-- 절약 후보 탐색: 빈도 + 금액 모두 고려`,
      `select category, count(*) as cnt, sum(amount) as total,`,
      `       round(avg(amount)) as avg_amount`,
      `from public.ledgers`,
      `where type='expense'`,
      period.scope === 'all' ? '' : `  and date between '${ymd(period.start)}' and '${ymd(period.end)}'`,
      `group by category order by total desc;`,
    ].filter(Boolean).join('\n');

    return {
      text:
        `${period.label} 지출을 보면서 정리해본 절약 포인트예요. 너무 빡빡하게 줄이지 말고, 한두 가지만 바꿔도 충분합니다.\n\n` +
        `${advice.map((a, i) => `**${i + 1}.** ${a}`).join('\n\n')}`,
      sql,
      advice:
        `절약은 *총량*보다 *습관 1~2개 바꾸기*가 오래 갑니다. 위 항목 중 가장 부담 적은 것 한 가지만 다음 달 목표로 정해보세요. 예: "주말 카페는 1회만" 같은 작은 룰이 효과가 가장 큽니다.`,
    };
  }

  // 8) 월간 비교
  function handleCompare(text, rows) {
    const cur  = { start: startOfMonth(TODAY), end: endOfMonth(TODAY), label: '이번 달' };
    const prev = { start: addMonths(cur.start, -1), end: endOfMonth(addMonths(cur.start, -1)), label: '지난달' };
    const sumPeriod = p => sum(filterRows(rows, { period: { ...p, scope: 'month' }, type: 'expense' }).map(r => r.amount));
    const a = sumPeriod(cur), b = sumPeriod(prev);
    const delta = b ? ((a - b) / b) * 100 : 0;

    // 카테고리별 변화
    const catSum = (p, cat) => sum(filterRows(rows, { period: { ...p, scope: 'month' }, type: 'expense', category: cat }).map(r => r.amount));
    const cats = [...new Set(rows.filter(r => r.type === 'expense').map(r => r.category))];
    const diffs = cats.map(cat => ({
      category: cat,
      cur: catSum(cur, cat), prev: catSum(prev, cat),
      delta: catSum(cur, cat) - catSum(prev, cat),
    })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 5);

    const sql = [
      `-- 이번 달 vs 지난달`,
      `select to_char(date, 'YYYY-MM') as month, category, sum(amount) as total`,
      `from public.ledgers where type='expense'`,
      `  and date >= '${ymd(prev.start)}' and date <= '${ymd(cur.end)}'`,
      `group by 1, 2 order by 1, 3 desc;`,
    ].join('\n');

    const lines = diffs.map(d => {
      const sign = d.delta > 0 ? '🔺' : d.delta < 0 ? '🔻' : '–';
      return `· ${sign} ${d.category}: ${fmtKRW(d.prev)} → ${fmtKRW(d.cur)} (${d.delta >= 0 ? '+' : ''}${fmtKRW(d.delta)})`;
    });

    // 가장 큰 증가 / 감소
    const inc = [...diffs].filter(d => d.delta > 0).sort((x, y) => y.delta - x.delta)[0];
    const dec = [...diffs].filter(d => d.delta < 0).sort((x, y) => x.delta - y.delta)[0];
    const advParts = [];
    if (Math.abs(delta) < 5) advParts.push(`전체 규모는 ${fmtPct(delta)} 로 거의 그대로예요. 합계는 비슷해도 *어디에 쓰는지* 가 바뀌었는지가 더 중요합니다.`);
    else if (delta > 0) advParts.push(`전체적으로 ${fmtPct(delta)} 늘었어요.`);
    else                advParts.push(`전체적으로 ${fmtPct(delta)} 줄었어요. 잘 절제됐어요.`);
    if (inc) advParts.push(`가장 많이 늘어난 항목은 **${inc.category}** 예요 (+${fmtKRW(inc.delta)}).`);
    if (dec) advParts.push(`반대로 가장 많이 줄어든 항목은 **${dec.category}** 예요 (−${fmtKRW(Math.abs(dec.delta))}).`);
    advParts.push(`늘어난 곳이 *예측 가능한 일회성*인지(경조사·의료·여행), *반복되는 패턴*인지(외식·카페)에 따라 다음 달 액션이 달라집니다.`);

    return {
      text:
        `**${prev.label}** 과 **${cur.label}** 을 비교해봤어요.\n` +
        `· ${prev.label}: ${fmtKRW(b)}\n` +
        `· ${cur.label}: ${fmtKRW(a)} (${fmtPct(delta)})\n\n` +
        `카테고리별 변동 Top 5\n${lines.join('\n')}`,
      sql,
      advice: advParts.join(' '),
    };
  }

  // 9) 잔액
  function handleBalance(text, rows) {
    const period = parsePeriod(text);
    const inc = sum(filterRows(rows, { period, type: 'income' }).map(r => r.amount));
    const exp = sum(filterRows(rows, { period, type: 'expense' }).map(r => r.amount));
    const sql = [
      `select sum(amount) filter (where type='income')  as income,`,
      `       sum(amount) filter (where type='expense') as expense,`,
      `       sum(amount) filter (where type='income')`,
      `     - sum(amount) filter (where type='expense') as balance`,
      `from public.ledgers`,
      period.scope === 'all' ? '' : `where date between '${ymd(period.start)}' and '${ymd(period.end)}';`,
    ].filter(Boolean).join('\n');
    const balance = inc - exp;
    const savingRate = inc ? (balance / inc) * 100 : 0;
    let advice = '';
    if (inc === 0) {
      advice = `${period.label} 동안은 수입이 없는 시기예요. 잔액 흐름은 누적 기준으로 보시는 편이 더 의미가 있습니다.`;
    } else if (savingRate >= 50) {
      advice = `저축률 **${savingRate.toFixed(0)}%** — 매우 건강해요. 남는 돈을 그대로 두지 말고, 자동이체로 다음 날 다른 계좌(비상금/투자)에 옮기면 안 쓰게 돼요.`;
    } else if (savingRate >= 20) {
      advice = `저축률 **${savingRate.toFixed(0)}%** — 평균보다 좋은 편이에요. 5%만 더 끌어올려도 1년 뒤 차이가 꽤 커집니다.`;
    } else if (savingRate >= 0) {
      advice = `저축률 **${savingRate.toFixed(0)}%** — 빠듯한 흐름이에요. 큰 카테고리부터 천천히 살펴보면서 1~2개만 손보시면 됩니다.`;
    } else {
      advice = `이번 ${period.label} 은 지출이 수입을 넘어선 흐름이에요. 큰 1회성 지출이 있었는지부터 확인하시고, 다음 달 예산을 보수적으로 잡아두시는 걸 추천드려요.`;
    }

    return {
      text:
        `${period.label} 잔액 정리예요.\n` +
        `· 수입: **${fmtKRW(inc)}**\n` +
        `· 지출: **${fmtKRW(exp)}**\n` +
        `· 잔액: **${fmtKRW(balance)}**`,
      sql,
      advice,
    };
  }

  // 10) 최근 내역
  function handleRecent(text, rows) {
    const m = text.match(/(\d+)\s*건/);
    const n = m ? Math.min(parseInt(m[1], 10), 30) : 10;
    const list = [...rows].sort((a, b) => b._date - a._date).slice(0, n);
    const sql = `select date, type, amount, category, memo\nfrom public.ledgers\norder by date desc, created_at desc\nlimit ${n};`;
    const expSum = sum(list.filter(r => r.type === 'expense').map(r => r.amount));
    const incSum = sum(list.filter(r => r.type === 'income').map(r => r.amount));
    return {
      text: `가장 최근 ${n}건이에요. 합계는 수입 **${fmtKRW(incSum)}**, 지출 **${fmtKRW(expSum)}** 입니다.`,
      sql,
      table: list.map(r => ({
        날짜: r.date,
        구분: r.type === 'income' ? '수입' : '지출',
        금액: fmtKRW(r.amount),
        카테고리: r.category,
        메모: r.memo,
      })),
      advice:
        `최근 며칠은 어떤 흐름이었는지 한 번 훑어주세요. 작은 거래가 많이 보이면 *카드값이 늘어나는 신호*, 큰 거래 한두 건이 잡혀 있으면 그게 한 달 기조를 만든 거예요.`,
    };
  }

  // 11) 도움말
  function handleHelp() {
    return {
      text:
        '이런 식으로 물어봐주시면 가장 자연스럽게 답해드려요 👇\n' +
        '· "이번 달 총 지출은 얼마야?"\n' +
        '· "카테고리별 지출 분석해줘"\n' +
        '· "이번 달 식비가 가장 컸던 날은?"\n' +
        '· "주말이랑 주중 중 어디에 더 많이 써?"\n' +
        '· "월말까지 예상 지출은?"\n' +
        '· "100만원 예산 중 남은 금액은?"\n' +
        '· "절약할 수 있는 항목 추천해줘"\n' +
        '· "지난달이랑 이번 달 비교해줘"\n' +
        '· "최근 5건 보여줘"\n' +
        '· "잔액 알려줘"',
      advice:
        '꼭 정확한 표현이 아니어도 평소 말투로 물어주세요. "요즘 카페 너무 자주 가는 거 같은데?" 같은 막연한 질문도 받아드려요.',
    };
  }

  // ============================================================
  // 라우터
  // ============================================================
  function route(question) {
    const t = question.trim();

    if (/도움말|어떤\s*질문|뭐\s*물어|help/i.test(t)) return handleHelp();
    if (/잔액|잔고|남은\s*돈|총\s*수입.*지출|수지/.test(t)) return handleBalance(t, ROWS_PROVIDER());
    if (/예산|남은\s*금액|예산.*남|얼마.*남/.test(t))      return handleBudget(t, ROWS_PROVIDER());
    if (/예측|쓸\s*것\s*같|월말까지|현재\s*속도|이번\s*달.*예상|예상\s*지출/.test(t)) return handleForecast(t, ROWS_PROVIDER());
    // 주말/주중/요일은 "비교" 단어와 함께 자주 쓰이므로 compare 보다 먼저 매칭
    if (/요일|주말|주중|평일/.test(t)) return handleWeekday(t, ROWS_PROVIDER());
    if (/비교|지난달.*이번|이번달.*지난|대비|증가|감소/.test(t)) return handleCompare(t, ROWS_PROVIDER());
    if (/절약|줄일|줄이|아낄|아끼|추천.*항목|추천\s*해|불필요/.test(t)) return handleAdvice(t, ROWS_PROVIDER());
    if (/(가장|제일|최대).*?(많|컸|크).*?(날|일)|어느\s*날|어떤\s*날/.test(t)) return handleTopDay(t, ROWS_PROVIDER());
    if (/카테고리|어디에.*많이|어디다가|뭐\s*에\s*가장|어떤\s*항목|어느\s*항목|항목별|분포|분석/.test(t)) return handleBreakdown(t, ROWS_PROVIDER());
    if (/최근|리스트|내역|보여/.test(t)) return handleRecent(t, ROWS_PROVIDER());
    // 기본: 총 지출
    return handleTotal(t, ROWS_PROVIDER());
  }

  // ============================================================
  // Public API
  // ============================================================
  window.LedgerAgent = {
    ask: route,
    today: TODAY,
    rows: ROWS_PROVIDER,
    fmtKRW, fmtPct,
  };
})();
