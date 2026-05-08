// Vercel Serverless Function — /env.js
// 클라이언트가 Supabase URL / anon key / Toss client key 를 읽기 위한 엔드포인트.
// 값은 .env / Vercel 환경변수에서 주입.
//
// SECRET 키 (TOSS_SECRET_KEY, IMAGEKIT_PRIVATE_KEY) 는 절대 내려가면 안 됨.
module.exports = function handler(_req, res) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const TOSS_CLIENT_KEY = (process.env.TOSS_CLIENT_KEY || '').trim();

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(
    `window.__ENV = ${JSON.stringify({
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      TOSS_CLIENT_KEY,
    })};`
  );
};

module.exports.default = module.exports;
