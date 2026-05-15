import { isAuthed } from '../_lib/auth.mjs';
import { getJsonBody, isValidSlug, json } from '../_lib/http.mjs';
import { listIngredients, upsertRow } from '../_lib/supabase.mjs';

const UPSERT_COLUMNS = [
  'slug', 'name_ko', 'name_en', 'name_zh', 'category', 'summary', 'emoji',
  'role', 'similar_ingredients', 'common_mistakes', 'substitutes',
  'storage', 'where_to_buy', 'sort_order', 'is_visible', 'image_url',
];

export default async function handler(req, res) {
  if (!isAuthed(req)) return json(res, 401, { error: 'unauthorized' });

  if (req.method === 'GET') {
    try { return json(res, 200, await listIngredients()); }
    catch (e) { return json(res, 500, { error: e.message }); }
  }

  if (req.method === 'POST') {
    let body;
    try { body = await getJsonBody(req); }
    catch { return json(res, 400, { error: 'invalid json body' }); }
    if (!body || !body.slug) return json(res, 400, { error: 'slug required' });
    if (!isValidSlug(body.slug)) {
      return json(res, 400, { error: 'invalid slug — use lowercase a-z, 0-9, hyphen (1–80 chars)' });
    }
    const clean = {};
    for (const k of UPSERT_COLUMNS) if (k in body) clean[k] = body[k];
    try { return json(res, 200, await upsertRow(clean)); }
    catch (e) { return json(res, 500, { error: e.message }); }
  }

  return json(res, 405, { error: 'method not allowed' });
}
