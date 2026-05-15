import { clearSessionCookie } from '../_lib/auth.mjs';
import { json } from '../_lib/http.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}
