// ============================================================
// shoppingmall — 정적 호스팅 서버
//   · index.html / 정적 자산 서빙
//   · /env.js : 클라이언트가 Supabase URL·anon key 를 읽기 위함
//   · 인증·CRUD 는 모두 Supabase JS SDK 가 직접 호출 (RLS로 권한 통제)
// ============================================================

const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 4001;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[warn] SUPABASE_URL / SUPABASE_ANON_KEY 가 비어있습니다.\n' +
    '       .env 에 값을 채우면 인증/DB 가 동작합니다.'
  );
}

const app = express();
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.get('/env.js', (_req, res) => {
  res.type('application/javascript').send(
    `window.__ENV = ${JSON.stringify({ SUPABASE_URL, SUPABASE_ANON_KEY })};`
  );
});

app.use(express.static(__dirname, { extensions: ['html'] }));

app.get(/^\/(?!env\.js).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[shoppingmall] http://localhost:${PORT}`);
});
