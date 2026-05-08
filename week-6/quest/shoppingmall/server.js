// ============================================================
// shoppingmall — 로컬 개발 서버
//   · index.html / 정적 자산 서빙
//   · /env.js                 → 클라이언트가 Supabase URL·anon key·Toss client key 읽음
//   · /api/imagekit-auth      → ImageKit 클라이언트 업로드용 토큰 발급
//   · /api/toss-confirm       → 토스 결제 승인 + orders 갱신
//
//   Vercel 에서는 동일 핸들러가 api/*.js (Serverless Function) 로 동작.
//   여기서는 require 해서 직접 호출 → 환경 일치 보장.
// ============================================================

const express = require('express');
const path = require('path');

const envHandler = require('./api/env.js');
const imagekitAuthHandler = require('./api/imagekit-auth.js');
const tossConfirmHandler = require('./api/toss-confirm.js');

const PORT = process.env.PORT || 4001;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const TOSS_SECRET_KEY = (process.env.TOSS_SECRET_KEY || '').trim();
const IMAGEKIT_PRIVATE_KEY = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[warn] SUPABASE_URL / SUPABASE_ANON_KEY 가 비어있습니다. (.env 확인)');
}
if (!TOSS_SECRET_KEY) {
  console.warn('[warn] TOSS_SECRET_KEY 가 비어있습니다. — 결제 승인 불가');
}
if (!IMAGEKIT_PRIVATE_KEY) {
  console.warn('[warn] IMAGEKIT_PRIVATE_KEY 가 비어있습니다. — 이미지 업로드 불가');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// --- API 라우팅 ---
app.get('/env.js', (req, res) => envHandler(req, res));
app.all('/api/imagekit-auth', (req, res) => imagekitAuthHandler(req, res));
app.all('/api/toss-confirm', (req, res) => tossConfirmHandler(req, res));

// --- 정적 자산 + SPA fallback ---
app.use(express.static(__dirname, { extensions: ['html'] }));

app.get(/^\/(?!env\.js|api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[shoppingmall] http://localhost:${PORT}`);
});
