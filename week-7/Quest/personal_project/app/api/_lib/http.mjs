// HTTP helpers that work in both Vercel Functions and a plain node:http server.

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

// Vercel parses application/json bodies automatically into req.body.
// In local dev (node:http) we read the stream ourselves.
export async function getJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return await readJsonStream(req);
}

function readJsonStream(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolveBody(null);
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export function readBodyBytes(req) {
  return new Promise((resolveBytes, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolveBytes(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Unified slug extractor.
// Vercel exposes path params via req.query for [slug].mjs files.
// Our local dev shim sets req.params instead. Both fall back to URL parse.
export function getSlug(req) {
  let raw = null;
  if (req.query && req.query.slug) {
    raw = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  } else if (req.params && req.params.slug) {
    raw = req.params.slug;
  } else {
    const m = (req.url || '').match(/^\/api\/ingredients\/([^/?]+)/);
    raw = m ? decodeURIComponent(m[1]) : null;
  }
  return isValidSlug(raw) ? raw : null;
}

// Slugs end up in Supabase Storage paths (`ingredients/<slug>.<ext>`),
// so anything that could traverse the prefix or inject unexpected chars
// must be rejected. lowercase letters, digits, hyphens, 1–80 chars,
// no leading/trailing hyphen.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
export function isValidSlug(s) {
  return typeof s === 'string' && SLUG_RE.test(s);
}
