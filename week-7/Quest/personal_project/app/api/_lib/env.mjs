// In Vercel, env vars come from the project settings.
// Locally, fall back to .env.local in the app root. Idempotent.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..', '..');
const ENV_PATH = join(APP_DIR, '.env.local');

let loaded = false;
export function loadEnvOnce() {
  if (loaded) return;
  loaded = true;
  if (!existsSync(ENV_PATH)) return;
  for (const raw of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    if (!raw || /^\s*#/.test(raw)) continue;
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function isProd() {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}
