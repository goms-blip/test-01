// Stateless session — HMAC-signed cookie. No server-side store.
//
// Token format: `<expiresAt>.<randomHex>.<base64url(hmac_sha256(secret, payload))>`
// On verify: split → recompute hmac → constant-time compare → check expiry.
//
// Survives serverless cold starts (Vercel) because nothing is kept in memory.

import crypto from 'node:crypto';
import { loadEnvOnce, isProd } from './env.mjs';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = 'admin_session';

function readSecret() {
  loadEnvOnce();
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET not set');
  return s;
}

function readAdminPassword() {
  loadEnvOnce();
  const p = process.env.ADMIN_PASSWORD;
  if (!p) {
    // Production must never silently accept the dev default.
    if (isProd()) throw new Error('ADMIN_PASSWORD not set');
    return 'admin1234';
  }
  return p;
}

export function usingDefaultPassword() {
  loadEnvOnce();
  return !process.env.ADMIN_PASSWORD;
}

export function pwMatches(input) {
  const a = Buffer.from(String(input ?? ''), 'utf8');
  const b = Buffer.from(readAdminPassword(), 'utf8');
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

export function mintToken() {
  const exp = Date.now() + TTL_MS;
  const rnd = crypto.randomBytes(16).toString('hex');
  const payload = `${exp}.${rnd}`;
  const sig = crypto.createHmac('sha256', readSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, rnd, sig] = parts;
  const expected = crypto.createHmac('sha256', readSecret()).update(`${expStr}.${rnd}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { if (!crypto.timingSafeEqual(a, b)) return false; }
  catch { return false; }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function parseCookies(req) {
  const out = {};
  // Vercel exposes parsed cookies on req.cookies
  if (req.cookies && typeof req.cookies === 'object') {
    for (const k of Object.keys(req.cookies)) out[k] = req.cookies[k];
    return out;
  }
  const h = req.headers?.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function isAuthed(req) {
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

function flags() {
  const arr = ['HttpOnly', 'SameSite=Lax', 'Path=/'];
  if (isProd()) arr.push('Secure');
  return arr.join('; ');
}

export function setSessionCookie(res, token) {
  const maxAge = Math.floor(TTL_MS / 1000);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; ${flags()}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; ${flags()}`);
}
