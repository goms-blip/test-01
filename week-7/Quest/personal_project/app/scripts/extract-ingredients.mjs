#!/usr/bin/env node
// Extract INGREDIENTS array from index_studio.html into data/ingredients.json.
// One-time / re-runnable when the frontend mock is the source of truth.
// After this, the JSON file is the canonical seed input for seed-ingredients.mjs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const HTML = join(APP_DIR, 'index_studio.html');
const OUT = join(APP_DIR, 'data', 'ingredients.json');

const html = readFileSync(HTML, 'utf8');

// Capture: const INGREDIENTS = [ ... ];
const m = html.match(/const\s+INGREDIENTS\s*=\s*(\[[\s\S]*?\n\s*\])\s*;/);
if (!m) {
  console.error('INGREDIENTS array not found in index_studio.html');
  process.exit(1);
}

let items;
try {
  items = vm.runInNewContext('(' + m[1] + ')');
} catch (e) {
  console.error('Failed to eval INGREDIENTS literal:', e.message);
  process.exit(1);
}

if (!Array.isArray(items) || items.length === 0) {
  console.error('Parsed INGREDIENTS but it is not a non-empty array');
  process.exit(1);
}

// image_url is intentionally excluded — it's managed by upload-images.mjs
// (file → Storage → DB). Seeding from this JSON should never overwrite the
// Storage URL that upload-images set.
const ALLOWED = new Set([
  'slug', 'name_ko', 'name_en', 'name_zh', 'category', 'summary', 'emoji',
  'role', 'similar_ingredients', 'common_mistakes',
  'substitutes', 'storage', 'where_to_buy',
]);

const cleaned = items.map((it, i) => {
  const out = {};
  for (const k of Object.keys(it)) {
    if (ALLOWED.has(k)) out[k] = it[k];
  }
  // sort_order preserves the curated order from the HTML mock (10-step stride
  // so the admin module can insert between rows without resequencing).
  out.sort_order = (i + 1) * 10;
  for (const req of ['slug', 'name_ko', 'name_en', 'category', 'summary', 'role']) {
    if (!out[req]) {
      console.error(`item #${i} missing required field "${req}":`, out.slug || it);
      process.exit(1);
    }
  }
  return out;
});

// Slug uniqueness check
const seen = new Set();
for (const it of cleaned) {
  if (seen.has(it.slug)) {
    console.error(`duplicate slug: ${it.slug}`);
    process.exit(1);
  }
  seen.add(it.slug);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(cleaned, null, 2) + '\n');

const byCat = {};
for (const it of cleaned) byCat[it.category] = (byCat[it.category] || 0) + 1;
console.log(`Extracted ${cleaned.length} ingredients → ${OUT}`);
console.log('  by category:', byCat);
