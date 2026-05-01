// Vercel Serverless Function — /env.js
// 클라이언트가 Supabase URL/anon key 를 읽기 위한 엔드포인트.
// 값은 Vercel 환경변수에서 주입 (.env 와 동일한 키).
export default function handler(_req, res) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__ENV = ${JSON.stringify({ SUPABASE_URL, SUPABASE_ANON_KEY })};`);
}
