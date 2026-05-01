# INTENTS — 자연어 ↔ SQL 매핑 카탈로그

분석 에이전트가 인식하는 의도(intent)와 그에 대응하는 SQL/뷰의 매핑표입니다.
오프라인 데모(`agent.js`)와 실제 Supabase MCP 연결 양쪽에서 동일하게 사용합니다.

> 표기: `{period}` = 기간 필터, `{category}` = 카테고리 필터,
> `{N}` = 사용자가 말한 숫자.

---

## 1. 총 지출 (total_expense)

| 사용자 발화 예시 | 추출 |
| --- | --- |
| "이번 달 얼마 썼어?" | period=current_month |
| "지난주 식비 얼마야?" | period=prev_week, category=식비 |
| "오늘 지출" | period=today |
| "전체 지출 총합" | period=all |

```sql
select coalesce(sum(amount), 0) as total
from public.ledgers
where type = 'expense'
  and date between {start} and {end}
  [and category = {category}]
;
```

---

## 2. 카테고리별 분포 (breakdown)

| 사용자 발화 | 비고 |
| --- | --- |
| "카테고리별 지출 분석해줘" | 기본: 이번 달 |
| "어디에 가장 많이 썼어?" | sort desc, top 1 강조 |
| "이번 달 항목별 비중" | % 비중 함께 |

```sql
select category, sum(amount) as total, count(*) as entry_count
from public.ledgers
where type = 'expense'
  and date between {start} and {end}
group by category
order by total desc;
-- 또는 v_category_totals 뷰 사용 가능
```

---

## 3. 가장 많이 쓴 날 (top_day)

| 사용자 발화 | 비고 |
| --- | --- |
| "이번 달 식비가 가장 컸던 날은?" | category=식비 |
| "가장 많이 쓴 날 알려줘" | category=null |

```sql
select date, sum(amount) as total, count(*) as cnt
from public.ledgers
where type='expense'
  and date between {start} and {end}
  [and category = {category}]
group by date
order by total desc
limit 5;
```

---

## 4. 요일별 패턴 (weekday)

| 사용자 발화 | |
| --- | --- |
| "주말과 주중 어느 쪽에 많이 써?" | 주중 평균 vs 주말 평균 |
| "요일별 패턴 보여줘" | 7일 평균 막대 |

```sql
-- 일자별 합계 → 요일별 평균
with daily as (
  select date, sum(amount) as day_total
  from public.ledgers
  where type='expense'
    and date between {start} and {end}
  group by date
)
select extract(dow from date)::int as dow, count(*) as days,
       sum(day_total) as total, round(avg(day_total)) as avg_per_day
from daily group by 1 order by 1;
-- 또는 v_weekday_pattern 뷰 사용
```

---

## 5. 월말 예측 (forecast)

| 사용자 발화 | |
| --- | --- |
| "현재 속도로 쓰면 이번 달 얼마 쓸까?" | 일평균 × 월일수 |
| "월말까지 예상 지출은?" | 동일 |

```sql
with cur as (
  select sum(amount)::numeric as total
  from public.ledgers
  where type='expense' and date between {month_start} and {today}
)
select round((total / {elapsed_days}) * {month_days})::bigint as projected,
       round(total / {elapsed_days})::bigint as daily_avg
from cur;
```

---

## 6. 예산 잔여 (budget)

| 사용자 발화 | 추출 |
| --- | --- |
| "100만원 예산 중 남은 금액은?" | budget=1,000,000 |
| "예산 50만원에서 얼마 남았어?" | budget=500,000 |

```sql
select {budget} - coalesce(sum(amount), 0) as remaining
from public.ledgers
where type='expense'
  and date between {month_start} and {month_end};
```

---

## 7. 절약 조언 (advice)

| 사용자 발화 | 분석 포인트 |
| --- | --- |
| "절약할 수 있는 항목 추천해줘" | 카페 빈도 / 구독료 / 외식 큰 건 / Top1 비중 |
| "어디서 줄일 수 있을까?" | 동일 |

```sql
select category, count(*) as cnt, sum(amount) as total,
       round(avg(amount)) as avg_amount
from public.ledgers
where type='expense'
  and date between {start} and {end}
group by category
order by total desc;
```

규칙
- 카페 발생 6회 이상 → 빈도 절감 제안
- 구독료 존재 → 사용 빈도 점검 제안
- 25,000원 ↑ 외식이 3건 이상 → 자율 외식 ½ 제안
- Top1 비중 30% 이상 → 10% 절감 시 효과 시뮬레이션

---

## 8. 월간 비교 (compare)

| 사용자 발화 | |
| --- | --- |
| "지난달이랑 이번 달 비교해줘" | 전체 + 카테고리별 변동 Top 5 |

```sql
select to_char(date, 'YYYY-MM') as month, category, sum(amount) as total
from public.ledgers
where type='expense'
  and date >= {prev_month_start} and date <= {cur_month_end}
group by 1, 2 order by 1, 3 desc;
-- 또는 v_monthly_category 뷰 사용
```

---

## 9. 잔액 (balance)

```sql
select sum(amount) filter (where type='income')  as income,
       sum(amount) filter (where type='expense') as expense,
       sum(amount) filter (where type='income')
     - sum(amount) filter (where type='expense') as balance
from public.ledgers
[where date between {start} and {end}];
-- 또는 v_balance 뷰
```

---

## 10. 최근 내역 (recent)

| 사용자 발화 | 추출 |
| --- | --- |
| "최근 5건 보여줘" | N=5 |
| "최근 내역" | N=10 (default) |

```sql
select date, type, amount, category, memo
from public.ledgers
order by date desc, created_at desc
limit {N};
```

---

## 라우터 우선순위

`agent.js` 의 `route()` 가 다음 순서로 매칭합니다.
앞쪽 패턴이 더 구체적이므로 충돌 시 앞쪽이 이깁니다.

```
help → balance → budget → forecast → compare → advice
     → weekday → top_day → breakdown → recent → total(default)
```
