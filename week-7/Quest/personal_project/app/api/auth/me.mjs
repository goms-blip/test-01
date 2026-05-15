import { isAuthed } from '../_lib/auth.mjs';
import { json } from '../_lib/http.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
  const ok = isAuthed(req);
  return json(res, ok ? 200 : 401, { ok });
}
