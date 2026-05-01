// ============================================================
// Auth 기반 커뮤니티 앱 — 정적 호스팅 서버
// ------------------------------------------------------------
// · index.html / 정적 자산 서빙
// · /env.js  : 클라이언트가 Supabase URL·anon key 를 읽기 위한
//              경량 엔드포인트 (값은 서버에서 .env 로 주입)
// · 인증·CRUD 는 모두 Supabase JS SDK 가 직접 호출하므로
//   별도 비즈니스 API 는 두지 않는다.
// ============================================================

const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 4000;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[warn] SUPABASE_URL / SUPABASE_ANON_KEY 가 비어있습니다.\n' +
    '       .env.example 를 .env 로 복사해 값을 채우면 인증/DB 가 동작합니다.'
  );
}

const app = express();
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// 클라이언트 부트스트랩 — window.__ENV 로 주입
app.get('/env.js', (_req, res) => {
  const payload = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  };
  res.type('application/javascript').send(
    `window.__ENV = ${JSON.stringify(payload)};`
  );
});

app.use(express.static(__dirname, { extensions: ['html'] }));

// SPA fallback — 모든 라우트는 index.html 로
app.get(/^\/(?!env\.js).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[community] http://localhost:${PORT}`);
});
