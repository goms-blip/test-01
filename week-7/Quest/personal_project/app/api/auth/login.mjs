import { pwMatches, mintToken, setSessionCookie } from '../_lib/auth.mjs';
import { getJsonBody, json } from '../_lib/http.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  let body;
  try { body = await getJsonBody(req); }
  catch { return json(res, 400, { error: 'invalid json body' }); }
  if (!body || !pwMatches(body.password)) {
    return json(res, 401, { error: '비밀번호가 일치하지 않습니다.' });
  }
  setSessionCookie(res, mintToken());
  return json(res, 200, { ok: true });
}
