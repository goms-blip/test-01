#!/usr/bin/env node
// Generate ingredient images via OpenAI gpt-image-2 — minimal studio style.
// Reads OPENAI_API_KEY from app/.env.local. Saves to app/images_gpt/{slug}.png.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const ENV_PATH = join(APP_DIR, '.env.local');
const OUT_DIR = process.env.OPENAI_IMAGE_OUT_DIR
  ? resolve(APP_DIR, process.env.OPENAI_IMAGE_OUT_DIR)
  : join(APP_DIR, 'images_gpt');

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv(ENV_PATH);

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY missing.'); process.exit(1); }

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium'; // low | medium | high | auto

const COMMON_SUFFIX =
  ', minimalist studio product photography, soft warm natural lighting, soft diffused shadow, ' +
  'clean off-white paper background, single subject centered, no text, no labels, no hands, no extra props, ' +
  'magazine editorial style, high detail, sharp focus, photorealistic, neutral color grading';

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

  // === 라운드 7 추가 (20개) ===
  // Flour 4
  { slug: 'whole-wheat-flour', prompt: 'a small neat mound of beige whole wheat flour with subtle bran flecks on off-white paper, top-down view, slight texture' },
  { slug: 'rye-flour',         prompt: 'a small neat mound of grey-beige rye flour on off-white paper, top-down view, slight powder dust' },
  { slug: 'corn-starch',       prompt: 'a small neat mound of pure white corn starch powder on off-white paper, top-down view, very fine smooth texture' },
  { slug: 'rice-flour',        prompt: 'a small neat mound of fine pale white rice flour on off-white paper, top-down view, very fine texture' },

  // Leavening 2
  { slug: 'instant-yeast',     prompt: 'a small spoonful pile of very fine beige instant yeast granules on off-white paper, top-down view, individual tiny grains visible' },
  { slug: 'cream-of-tartar',   prompt: 'a small neat mound of fine pure white cream of tartar powder on off-white paper, top-down view' },

  // Sugar 4
  { slug: 'brown-sugar',       prompt: 'a small neat mound of moist golden brown sugar with visible damp clumping texture on off-white paper, top-down view' },
  { slug: 'honey',             prompt: 'a small clear glass jar of golden translucent honey, no label, on off-white surface, side view, soft natural light catching the amber liquid' },
  { slug: 'maple-syrup',       prompt: 'a small clear glass bottle of dark amber maple syrup, no label, on off-white surface, side view, soft shadow' },
  { slug: 'molasses',          prompt: 'a small clear glass jar of very dark thick molasses, no label, on off-white surface, side view, glossy dark brown liquid' },

  // Dairy & Fat 4
  { slug: 'milk',              prompt: 'a small clear glass cup half-filled with fresh white milk on off-white surface, side view, soft natural light' },
  { slug: 'sour-cream',        prompt: 'a small white ramekin filled with thick white sour cream on off-white paper, top-down view, soft creamy texture visible' },
  { slug: 'cream-cheese',      prompt: 'a small rectangular block of soft white cream cheese on off-white paper, slight 3/4 angle, soft surface texture' },
  { slug: 'vegetable-oil',     prompt: 'a small clear glass bottle of pale yellow neutral vegetable oil, no label, simple cork, standing on off-white surface, side view, soft shadow' },

  // Etc 6
  { slug: 'white-chocolate',   prompt: 'a small stack of three pale ivory white chocolate squares with glossy surface on off-white paper, top-down view' },
  { slug: 'milk-chocolate',    prompt: 'a small stack of three light brown milk chocolate squares with glossy surface on off-white paper, top-down view' },
  { slug: 'cocoa-powder',      prompt: 'a small neat mound of dark brown unsweetened cocoa powder on off-white paper, top-down view, very fine texture' },
  { slug: 'salt',              prompt: 'a small neat mound of coarse sea salt crystals on off-white paper, top-down view, individual crystal facets catching light' },
  { slug: 'cinnamon',          prompt: 'a small mound of orange-brown ground cinnamon powder beside two short cinnamon sticks on off-white paper, top-down view' },
  { slug: 'gelatin',           prompt: 'a small fan of pale transparent yellowish gelatin sheets on off-white paper, top-down view, slight glossy translucency' },

  // === 라운드 8 추가 (16개) ===
  // Flour 4
  { slug: 'glutinous-rice-flour', prompt: 'a small neat mound of fine pure white glutinous (sticky) rice flour on off-white paper, top-down view, very fine smooth powder texture' },
  { slug: 'tapioca-starch',       prompt: 'a small neat mound of pure white tapioca starch powder on off-white paper, top-down view, very fine smooth texture' },
  { slug: 'potato-starch',        prompt: 'a small neat mound of fine pure white potato starch on off-white paper, top-down view, smooth fine texture' },
  { slug: 'hazelnut-flour',       prompt: 'a small neat mound of pale beige hazelnut flour with subtle warm nutty speckles on off-white paper, top-down view' },

  // Sugar 3
  { slug: 'dark-brown-sugar',     prompt: 'a small neat mound of moist very dark brown sugar with deep molasses color and visible damp clumping texture on off-white paper, top-down view' },
  { slug: 'corn-syrup',           prompt: 'a small clear glass jar of clear colorless thick corn syrup, no label, on off-white surface, side view, glossy translucent viscous liquid' },
  { slug: 'agave-syrup',          prompt: 'a small clear glass jar of light amber translucent agave syrup, no label, on off-white surface, side view, glossy liquid' },

  // Dairy & Fat 4
  { slug: 'buttermilk',           prompt: 'a small clear glass cup half-filled with cultured white buttermilk on off-white surface, side view, soft natural light, slightly thicker than regular milk' },
  { slug: 'yogurt',               prompt: 'a small white ramekin filled with thick plain white yogurt on off-white paper, top-down view, smooth glossy surface' },
  { slug: 'mascarpone',           prompt: 'a small white ramekin filled with thick rich ivory mascarpone cheese on off-white paper, top-down view, soft creamy luxurious texture' },
  { slug: 'coconut-oil',          prompt: 'a small open clear glass jar of solid creamy white coconut oil at room temperature, no label, on off-white surface, top-down view, soft solid creamy texture' },

  // Etc 5
  { slug: 'walnut',               prompt: 'a small pile of shelled walnut halves with distinctive folded ridged surface on off-white paper, top-down view, warm brown color, individual halves visible' },
  { slug: 'raisin',               prompt: 'a small pile of dark wrinkled raisins on off-white paper, top-down view, glossy dark brown, individual raisins visible' },
  { slug: 'vanilla-bean',         prompt: 'two long dark brown vanilla bean pods lying parallel on off-white paper, top-down view, glossy slender pods' },
  { slug: 'matcha-powder',        prompt: 'a small neat mound of vivid bright green matcha tea powder on off-white paper, top-down view, very fine smooth texture, vibrant emerald green color' },
  { slug: 'ground-ginger',        prompt: 'a small neat mound of pale yellow-beige ground ginger powder on off-white paper, top-down view, very fine texture' },

  // === 라운드 9 추가 (Spirits 7종) ===
  { slug: 'rum',                  prompt: 'a small clear glass bottle of dark amber rum, no label, simple cork, standing on off-white surface, side view, soft shadow, magazine editorial style' },
  { slug: 'brandy',               prompt: 'a small clear glass bottle of warm amber brandy, no label, simple cork, standing on off-white surface, side view, soft shadow' },
  { slug: 'kahlua',               prompt: 'a small clear glass bottle of very dark brown coffee liqueur, no label, simple cork, standing on off-white surface, side view, soft natural light catching the dark glossy liquid' },
  { slug: 'grand-marnier',        prompt: 'a small clear glass bottle of deep golden orange liqueur, no label, simple cork, standing on off-white surface, side view, soft shadow, warm amber glow' },
  { slug: 'kirsch',               prompt: 'a small clear glass bottle of clear colorless cherry brandy (kirsch), no label, simple cork, standing on off-white surface, side view, soft refractive light, crystal-clear liquid' },
  { slug: 'amaretto',             prompt: 'a small clear glass bottle of warm amber almond liqueur, no label, simple cork, standing on off-white surface, side view, soft shadow' },
  { slug: 'baileys',              prompt: 'a small clear glass bottle of creamy pale beige Irish cream liqueur, no label, simple cork, standing on off-white surface, side view, soft natural light, opaque creamy liquid' },
];

const ENDPOINT = 'https://api.openai.com/v1/images/generations';

async function generate(slug, prompt) {
  const outPath = join(OUT_DIR, `${slug}.png`);
  if (existsSync(outPath) && !process.env.FORCE) {
    console.log(`✓ skip ${slug} (already exists)`);
    return { slug, skipped: true };
  }
  const fullPrompt = prompt + COMMON_SUFFIX;
  console.log(`→ generating ${slug} (${MODEL}, ${SIZE}, ${QUALITY}) ...`);
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: fullPrompt,
      n: 1,
      size: SIZE,
      quality: QUALITY,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`openai ${res.status}: ${txt.slice(0, 500)}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  const url = json?.data?.[0]?.url;
  let buf;
  if (b64) {
    buf = Buffer.from(b64, 'base64');
  } else if (url) {
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`download ${imgRes.status}`);
    buf = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 200)}`);
  }
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
