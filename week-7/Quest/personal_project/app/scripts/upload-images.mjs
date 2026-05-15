#!/usr/bin/env node
// Upload ingredient images from app/images_gpt2/<slug>.png to Supabase Storage,
// then patch public.ingredients.image_url with the public URL.
//
// Idempotent — overwrites bucket objects and updates DB rows on every run.
// Used now for the initial bulk upload, and later from the admin module
// (one ingredient at a time) via the same supabase-rest helpers.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requireEnv } from './lib/env.mjs';
import { uploadObject, updateRow, publicUrl } from './lib/supabase-rest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
loadEnv(join(APP_DIR, '.env.local'));
requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const BUCKET = 'ingredient-images';
const SRC_DIR = join(APP_DIR, 'images_gpt2');
const DATA = JSON.parse(readFileSync(join(APP_DIR, 'data', 'ingredients.json'), 'utf8'));

const args = new Set(process.argv.slice(2));
const ONLY_SLUG = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
const SKIP_DB = args.has('--no-db');

let okCount = 0;
let skipCount = 0;
const missing = [];

for (const it of DATA) {
  if (ONLY_SLUG && it.slug !== ONLY_SLUG) continue;
  const file = join(SRC_DIR, `${it.slug}.png`);
  if (!existsSync(file)) {
    missing.push(it.slug);
    continue;
  }
  const buf = readFileSync(file);
  const objectPath = `ingredients/${it.slug}.png`;
  try {
    await uploadObject(BUCKET, objectPath, buf, { contentType: 'image/png' });
    const url = publicUrl(BUCKET, objectPath);
    if (!SKIP_DB) {
      await updateRow('ingredients', { slug: it.slug }, { image_url: url });
    }
    okCount++;
    if (okCount % 10 === 0) console.log(`  uploaded ${okCount}...`);
  } catch (e) {
    console.error(`FAIL ${it.slug}: ${e.message}`);
    skipCount++;
  }
}

console.log(`Done. uploaded=${okCount} failed=${skipCount} missing_local=${missing.length}`);
if (missing.length) console.log('  missing local png:', missing.join(', '));
