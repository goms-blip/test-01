// db/apply.js — schema.sql 을 Supabase Postgres 에 적용
// 사용: node db/apply.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = (process.env.DATABASE_URL || require('dotenv').config({ path: path.join(__dirname, '..', '.env') }).parsed?.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('DATABASE_URL 이 설정되지 않았습니다. .env 를 확인하세요.');
  process.exit(1);
}

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  try {
    console.log('[apply] connecting...');
    await pool.query('SELECT 1');
    console.log('[apply] running schema.sql ...');
    await pool.query(sql);
    console.log('[apply] OK ✅');

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      ORDER BY table_name
    `);
    console.log('[apply] public 테이블 목록:');
    for (const r of tables.rows) console.log('  -', r.table_name);
  } catch (err) {
    console.error('[apply] FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
