#!/usr/bin/env node
// Seed/refresh public.ingredients from data/ingredients.json.
// Uses service_role via REST (bypasses RLS). Idempotent — upserts by `slug`.
//
// Re-runnable for future admin-module imports.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requireEnv } from './lib/env.mjs';
import { upsertRows } from './lib/supabase-rest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
loadEnv(join(APP_DIR, '.env.local'));
requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const DATA = JSON.parse(readFileSync(join(APP_DIR, 'data', 'ingredients.json'), 'utf8'));

console.log(`Seeding ${DATA.length} ingredients via REST upsert (on_conflict=slug)...`);

const CHUNK = 50;
let total = 0;
for (let i = 0; i < DATA.length; i += CHUNK) {
  const slice = DATA.slice(i, i + CHUNK);
  const got = await upsertRows('ingredients', slice, { onConflict: 'slug' });
  total += got.length;
  console.log(`  upserted ${total}/${DATA.length}`);
}

console.log(`Done. ${total} rows upserted.`);
