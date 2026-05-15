#!/usr/bin/env node
// Generate the three illustration slots used by the PT deck.
// Screenshots of the live site are NOT in this list — capture those manually.
//
// Run:  node presentation/scripts/generate-pt-images.mjs
//       node presentation/scripts/generate-pt-images.mjs cover-hero   (single slug)
//       FORCE=1 ...                                                    (overwrite)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PT_DIR = resolve(__dirname, '..');
const APP_ENV = resolve(PT_DIR, '..', 'app', '.env.local');
const OUT_DIR = join(PT_DIR, 'images');

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv(APP_ENV);

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY missing.'); process.exit(1); }

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'high';

// Each entry: slug, size (wide vs square), prompt
const IMAGES = [
  {
    slug: 'cover-hero',
    size: '1536x1024',
    prompt:
      'a clean editorial composition of baking essentials — cake flour mound, a single brown egg, a cube of unsalted butter, ' +
      'a small jar of vanilla, a few dark chocolate squares, all arranged on a warm cream off-white paper background, ' +
      'minimalist top-down view, soft warm natural lighting, gentle diffused shadows, very generous negative space on the left half, ' +
      'magazine cover aesthetic, no text or labels, no hands, photorealistic, sharp focus, neutral color grading with a touch of warm cream tone',
  },
  {
    slug: 'persona-minji',
    size: '1024x1024',
    prompt:
      'a single warm flat illustration of a young Korean woman in her twenties sitting at a tiny apartment kitchen counter, ' +
      'looking at a phone screen showing an unreadable Korean baking recipe, with a confused expression at the word she does not understand, ' +
      'a small bowl and a measuring cup beside her, warm pastel palette (cream, soft coral, dusty rose), clean simple linework, ' +
      'gentle atmosphere, no UI text, no logos, editorial illustration style, single subject, soft natural daylight from a window',
  },
  {
    slug: 'solution-flow',
    size: '1536x1024',
    prompt:
      'a clean flat infographic illustrating a three-step product flow on a warm off-white background: ' +
      'step 1 — a stylized search bar with a magnifying glass and the word area blurred, ' +
      'step 2 — a single ingredient card showing a circular placeholder photo and stylized text blocks, ' +
      'step 3 — a 3x3 grid of small information tiles labeled subtly with abstract dots, ' +
      'arrows connecting the three steps, monochrome with a single warm coral accent (#E25A5A) on key elements, ' +
      'editorial wireframe aesthetic, generous whitespace, no real text, no UI screenshots, no shadows besides faint flat ones',
  },
];

const ENDPOINT = 'https://api.openai.com/v1/images/generations';

async function generate({ slug, size, prompt }) {
  const outPath = join(OUT_DIR, `${slug}.png`);
  if (existsSync(outPath) && !process.env.FORCE) {
    console.log(`✓ skip ${slug} (already exists; set FORCE=1 to overwrite)`);
    return { slug, skipped: true };
  }
  console.log(`→ ${slug} (${MODEL} ${size} ${QUALITY}) …`);
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, n: 1, size, quality: QUALITY }),
  });
  if (!res.ok) {
    throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  const url = json?.data?.[0]?.url;
  let buf;
  if (b64) buf = Buffer.from(b64, 'base64');
  else if (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`download ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  } else throw new Error('no image in response');
  writeFileSync(outPath, buf);
  console.log(`✓ ${slug} (${(buf.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms)`);
  return { slug, bytes: buf.length };
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv.slice(2);
  const list = only.length ? IMAGES.filter((i) => only.includes(i.slug)) : IMAGES;
  for (const img of list) {
    try { await generate(img); }
    catch (e) { console.error(`✗ ${img.slug}: ${e.message}`); }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
