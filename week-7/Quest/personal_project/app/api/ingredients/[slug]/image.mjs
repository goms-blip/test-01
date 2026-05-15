import { isAuthed } from '../../_lib/auth.mjs';
import { getSlug, json, readBodyBytes } from '../../_lib/http.mjs';
import { uploadStorageObject, storagePublicUrl, patchRow } from '../../_lib/supabase.mjs';

export const config = {
  // Image payloads can exceed 1MB; raise the limit safely under the Hobby cap.
  api: { bodyParser: false },
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (!isAuthed(req)) return json(res, 401, { error: 'unauthorized' });
  if (req.method !== 'PUT') return json(res, 405, { error: 'method not allowed' });

  const slug = getSlug(req);
  if (!slug) return json(res, 400, { error: 'invalid or missing slug' });

  const ct = (req.headers['content-type'] || '').toLowerCase();
  // Whitelist only inert raster formats. SVG is excluded — it can embed
  // <script> and would execute when served from the public storage URL.
  const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
  const ctype = ct.split(';')[0].trim();
  const ext = ALLOWED[ctype];
  if (!ext) return json(res, 415, { error: 'only jpeg/png/webp/avif allowed' });

  const bytes = await readBodyBytes(req);
  if (!bytes.length) return json(res, 400, { error: 'empty body' });
  // Vercel caps request bodies around 4.5MB on Hobby; reject explicitly so
  // the UI hint ("최대 5MB" → updated to 4MB) stays honest.
  const MAX_BYTES = 4 * 1024 * 1024;
  if (bytes.length > MAX_BYTES) return json(res, 413, { error: '이미지 용량 초과 (최대 4MB)' });

  const path = `ingredients/${slug}.${ext}`;
  try {
    await uploadStorageObject('ingredient-images', path, bytes, ctype);
    const url = `${storagePublicUrl('ingredient-images', path)}?v=${Date.now()}`;
    await patchRow(slug, { image_url: url });
    return json(res, 200, { image_url: url });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
