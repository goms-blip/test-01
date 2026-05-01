# API 명세 — 가계부 앱

> Base URL: `http://localhost:3000`
> 모든 응답은 `application/json` 입니다.

## 데이터 모델

```ts
type Ledger = {
  id: string;            // uuid
  created_at: string;    // ISO 8601
  date: string;          // YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;        // 원 (정수, 0 이상)
  category: string;      // 식비/교통/주거/구독료/경조사/...
  memo: string;          // 최대 200자
};
```

---

## 1. 내역 CRUD

### `GET /api/ledgers`
전체 내역을 최신순(`date desc`, `created_at desc`)으로 반환.

**Response 200**
```json
[
  {
    "id": "8a4e…",
    "created_at": "2026-04-28T03:11:22.000Z",
    "date": "2026-04-28",
    "type": "expense",
    "amount": 12500,
    "category": "식비",
    "memo": "점심 김치찌개"
  }
]
```

### `POST /api/ledgers`
새 내역 등록.

**Body**
```json
{
  "date": "2026-04-28",
  "type": "expense",
  "amount": 12500,
  "category": "식비",
  "memo": "점심"
}
```

| 필드 | 검증 |
| :--- | :--- |
| `date` | `YYYY-MM-DD` (필수) |
| `type` | `income` 또는 `expense` (필수) |
| `amount` | 0 이상 정수 (필수) |
| `category` | 1자 이상, 40자 이하 (필수) |
| `memo` | 0 ~ 200자 (선택) |

**Response 201**: 생성된 `Ledger`

### `PATCH /api/ledgers/:id`
부분 업데이트. 위 필드 중 보낸 것만 수정.

### `DELETE /api/ledgers/:id`
**Response 200**: `{ "deleted": 1 }`

---

## 2. 통계

### `GET /api/stats/balance`
잔액 요약.

```json
{ "total_income": 3200000, "total_expense": 293400, "balance": 2906600 }
```

### `GET /api/stats/categories`
카테고리별 **지출** 합계 (PRD 3.2 — `GROUP BY category` 결과).

```json
[
  { "category": "주거", "total_amount": 120000, "entry_count": 1 },
  { "category": "교통", "total_amount":  45000, "entry_count": 1 },
  { "category": "식비", "total_amount":  12500, "entry_count": 1 }
]
```

### `GET /api/stats/monthly`
월별 수입/지출 합계 (Step 5 advanced 리포트용).

```json
[
  { "month": "2026-04", "type": "income",  "total": 3200000 },
  { "month": "2026-04", "type": "expense", "total":  293400 }
]
```

---

## 3. 에러 형식

| HTTP | 의미 |
| :--- | :--- |
| 400 | 잘못된 입력 — `{ "error": "amount must be a non-negative integer" }` |
| 404 | 대상 행 없음 — `{ "error": "not found" }` |
| 500 | 내부 오류 — `{ "error": "Internal server error" }` |

---

## 4. 빠른 호출 예시 (curl)

```bash
# 등록
curl -X POST http://localhost:3000/api/ledgers \
  -H 'content-type: application/json' \
  -d '{"date":"2026-04-28","type":"expense","amount":12500,"category":"식비","memo":"점심"}'

# 리스트
curl http://localhost:3000/api/ledgers

# 카테고리별 합계
curl http://localhost:3000/api/stats/categories
```
