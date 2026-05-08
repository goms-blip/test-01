#!/usr/bin/env node
// db/apply.js — schema.sql을 DATABASE_URL에 적용하고, demo 계정을 upsert.
// 안전: CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING — 여러 번 실행해도 부작용 없음.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[apply] DATABASE_URL missing in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

(async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('[apply] schema applied');

    // demo 계정 upsert (없으면 생성, 있으면 그대로)
    const hash = bcrypt.hashSync('demo1234', 10);
    await pool.query(
      `INSERT INTO miniapp_users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      ['demo@local', hash],
    );
    console.log('[apply] demo@local seeded (or already exists)');

    const r = await pool.query('SELECT COUNT(*)::int AS n FROM miniapp_users');
    console.log(`[apply] miniapp_users count = ${r.rows[0].n}`);
  } catch (err) {
    console.error('[apply] error:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
