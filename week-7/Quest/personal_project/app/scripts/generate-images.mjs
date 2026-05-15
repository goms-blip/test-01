#!/usr/bin/env node
// Generate ingredient images via fal.ai FLUX (schnell) — minimal studio style.
// Reads FAL_KEY from app/.env.local. Saves to app/images/{slug}.jpg.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const ENV_PATH = join(APP_DIR, '.env.local');
const OUT_DIR = join(APP_DIR, 'images');

function loadEnv(path) {
  if (!existsSync(path)) return;
  const txt = readFileSync(path, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv(ENV_PATH);

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error('FAL_KEY missing. Put it in app/.env.local');
  process.exit(1);
}

const COMMON_SUFFIX =
  ', minimal studio product photography, soft warm natural lighting, soft diffused shadow, ' +
  'clean off-white paper background, single subject centered, no text, no labels, no hands, no extra props, ' +
  'magazine editorial style, high detail, sharp focus, photorealistic';

const INGREDIENTS = [
  { slug: 'cake-flour',        prompt: 'a small neat mound of very fine soft white wheat cake flour on off-white paper, top-down view, slight powder dust around the base' },
  { slug: 'all-purpose-flour', prompt: 'a small neat mound of plain white all-purpose wheat flour on off-white paper, top-down view, slight powder dust' },
  { slug: 'bread-flour',       prompt: 'a small neat mound of slightly coarser cream-white bread flour on off-white paper, top-down view, very subtle texture' },
  { slug: 'almond-flour',      prompt: 'a small neat mound of pale beige almond flour with subtle nutty speckles on off-white paper, top-down view' },
  { slug: 'baking-soda',       prompt: 'a small neat mound of fine pure white baking soda (sodium bicarbonate) powder on off-white paper, top-down view, slight crystalline glint' },
  { slug: 'baking-powder',     prompt: 'a small neat mound of fine white baking powder on off-white paper, top-down view' },
  { slug: 'dry-yeast',         prompt: 'a small spoonful pile of beige dry instant yeast granules scattered on off-white paper, top-down view, individual grains visible' },
  { slug: 'granulated-sugar',  prompt: 'a small neat mound of sparkling white granulated sugar crystals on off-white paper, top-down view, crystals catching soft light' },
  { slug: 'powdered-sugar',    prompt: 'a small neat mound of extremely fine powdered sugar like soft snow on off-white paper, top-down view, soft edges' },
  { slug: 'butter',            prompt: 'a single rectangular cube of pale yellow unsalted butter on off-white paper, slight 3/4 angle, soft surface sheen' },
  { slug: 'heavy-cream',       prompt: 'a small clear glass cup half-filled with white heavy whipping cream on off-white surface, side view, soft natural light, slight gloss on cream surface' },
  { slug: 'egg',               prompt: 'a single fresh white chicken egg resting on off-white surface, side view, soft diffused shadow underneath' },
  { slug: 'dark-chocolate',    prompt: 'a small stack of three dark chocolate squares with glossy surface on off-white paper, top-down view' },
  { slug: 'vanilla-extract',   prompt: 'a small clear glass bottle of dark amber vanilla extract liquid, no label, simple cork, standing on off-white surface, side view, soft shadow' },
];

const ENDPOINT = 'https://fal.run/fal-ai/flux/schnell';

async function generate(slug, prompt) {
  const outPath = join(OUT_DIR, `${slug}.jpg`);
  if (existsSync(outPath) && !process.env.FORCE) {
    console.log(`✓ skip ${slug} (already exists)`);
    return { slug, skipped: true };
  }
  const fullPrompt = prompt + COMMON_SUFFIX;
  console.log(`→ generating ${slug} ...`);
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`fal ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = await res.json();
  const url = json?.images?.[0]?.url;
  if (!url) throw new Error(`no image url in response: ${JSON.stringify(json).slice(0, 200)}`);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`download failed: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(outPath, buf);
  const ms = Date.now() - t0;
  console.log(`✓ ${slug} (${(buf.length/1024).toFixed(0)} KB, ${ms} ms)`);
  return { slug, bytes: buf.length, ms };
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv.slice(2);
  const list = only.length ? INGREDIENTS.filter(i => only.includes(i.slug)) : INGREDIENTS;
  const results = [];
  for (const ing of list) {
    try {
      results.push(await generate(ing.slug, ing.prompt));
    } catch (e) {
      console.error(`✗ ${ing.slug}: ${e.message}`);
      results.push({ slug: ing.slug, error: e.message });
    }
  }
  const ok = results.filter(r => !r.error).length;
  console.log(`\nDone: ${ok}/${list.length} generated.`);
  if (ok < list.length) process.exit(2);
}

main().catch(e => { console.error(e); process.exit(1); });
