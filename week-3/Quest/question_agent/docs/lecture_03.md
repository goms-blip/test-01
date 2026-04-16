# 3강: 데이터베이스 연동

## 학습 목표
- SQL vs NoSQL 데이터베이스 비교
- PostgreSQL 기본 쿼리 작성
- Node.js에서 DB 연동 (pg 모듈)

## 주요 개념

### SQL vs NoSQL
| 구분 | SQL (PostgreSQL) | NoSQL (MongoDB) |
|------|------------------|-----------------|
| 구조 | 테이블, 행, 열 | 문서(Document), 컬렉션 |
| 스키마 | 고정 스키마 | 유연한 스키마 |
| 관계 | JOIN으로 연결 | 임베딩 또는 참조 |
| 적합한 경우 | 정형 데이터, 트랜잭션 | 비정형 데이터, 빠른 확장 |

### PostgreSQL 기본 쿼리
```sql
-- 테이블 생성
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- CRUD 쿼리
INSERT INTO users (name, email) VALUES ('홍길동', 'hong@test.com');
SELECT * FROM users WHERE id = 1;
UPDATE users SET name = '김철수' WHERE id = 1;
DELETE FROM users WHERE id = 1;
```

### Node.js + pg 모듈 연동
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 쿼리 실행
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
```

## 핵심 정리
1. 데이터 특성에 따라 SQL/NoSQL 선택
2. PostgreSQL의 기본 CRUD 쿼리 숙지
3. 환경변수로 DB 연결 정보 관리
4. 에러 핸들링 필수
