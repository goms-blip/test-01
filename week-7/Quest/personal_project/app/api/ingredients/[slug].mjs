import { isAuthed } from '../_lib/auth.mjs';
import { getJsonBody, getSlug, json } from '../_lib/http.mjs';
import { patchRow, deleteRow } from '../_lib/supabase.mjs';

const PATCH_COLUMNS = [
  'name_ko', 'name_en', 'name_zh', 'category', 'summary', 'emoji',
  'role', 'similar_ingredients', 'common_mistakes', 'substitutes',
  'storage', 'where_to_buy', 'sort_order', 'is_visible', 'image_url',
];

export default async function handler(req, res) {
  if (!isAuthed(req)) return json(res, 401, { error: 'unauthorized' });

  const slug = getSlug(req);
  if (!slug) return json(res, 400, { error: 'slug missing in path' });

  if (req.method === 'PATCH') {
    let body;
    try { body = await getJsonBody(req); }
    catch { return json(res, 400, { error: 'invalid json body' }); }
    if (!body) return json(res, 400, { error: 'body required' });
    const patch = {};
    for (const k of PATCH_COLUMNS) if (k in body) patch[k] = body[k];
    if (!Object.keys(patch).length) return json(res, 400, { error: 'no editable fields in body' });
    try { return json(res, 200, await patchRow(slug, patch)); }
    catch (e) { return json(res, 500, { error: e.message }); }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteRow(slug);
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  return json(res, 405, { error: 'method not allowed' });
}
