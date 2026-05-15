#!/usr/bin/env node
// admin/server.mjs — LOCAL DEV ONLY (excluded from Vercel via .vercelignore).
//
// Imports the same /api/**.mjs handlers Vercel will mount in production
// and routes requests to them on http://127.0.0.1:8787/. Static files
// (admin/index.html, admin/login.html, lib/, etc.) are served from the
// project root.

import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvOnce } from '../api/_lib/env.mjs';
import { usingDefaultPassword } from '../api/_lib/auth.mjs';

import authLogin    from '../api/auth/login.mjs';
import authLogout   from '../api/auth/logout.mjs';
import authMe       from '../api/auth/me.mjs';
import ingredients  from '../api/ingredients/index.mjs';
import ingredientBySlug from '../api/ingredients/[slug].mjs';
import ingredientImage  from '../api/ingredients/[slug]/image.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
loadEnvOnce();

const PORT = Number(process.env.ADMIN_PORT || 8787);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
};

// Same path patterns Vercel will recognize. The 2nd field is the imported handler.
// The 3rd field, when present, is a paramExtractor that mutates req.params so
// our shared http.getSlug() works locally just like it does on Vercel via req.query.
const routes = [
  { test: /^\/api\/auth\/login\/?$/,                          handler: authLogin },
  { test: /^\/api\/auth\/logout\/?$/,                         handler: authLogout },
  { test: /^\/api\/auth\/me\/?$/,                             handler: authMe },
  { test: /^\/api\/ingredients\/?$/,                          handler: ingredients },
  { test: /^\/api\/ingredients\/([^/]+)\/image\/?$/,          handler: ingredientImage,    params: (m) => ({ slug: decodeURIComponent(m[1]) }) },
  { test: /^\/api\/ingredients\/([^/]+)\/?$/,                 handler: ingredientBySlug,   params: (m) => ({ slug: decodeURIComponent(m[1]) }) },
];

// Static: anonymous can only reach /login.html (and admin/login.html).
// Everything else under /admin/ requires auth via redirect.
const STATIC_PUBLIC = new Set(['/login.html', '/admin/login.html', '/favicon.ico']);

import { isAuthed } from '../api/_lib/auth.mjs';

function serveStatic(req, res) {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/admin/index.html';                  // local dev entry
  if (p === '/admin' || p === '/admin/') p = '/admin/index.html';
  if (p === '/login.html') p = '/admin/login.html';        // mirror Vercel where login.html lives under /admin
  const authed = isAuthed(req);
  if (!authed && !STATIC_PUBLIC.has(decodeURIComponent((req.url || '/').split('?')[0])) && p !== '/admin/login.html') {
    res.writeHead(302, { Location: '/admin/login.html' });
    res.end();
    return;
  }
  const full = normalize(join(APP_DIR, p.replace(/^\//, '')));
  if (!full.startsWith(APP_DIR)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(full) || statSync(full).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(full));
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  for (const r of routes) {
    const m = url.match(r.test);
    if (!m) continue;
    if (r.params) req.params = r.params(m);
    try { await r.handler(req, res); }
    catch (e) {
      console.error(`[admin] ${req.method} ${req.url} →`, e.message);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }
  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(404); res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`admin (local dev): http://${HOST}:${PORT}/`);
  console.log(`  public site:     http://localhost:8080/  (separate static server)`);
  if (usingDefaultPassword()) {
    console.warn(`[admin] ⚠ ADMIN_PASSWORD not set; using default "admin1234". Set ADMIN_PASSWORD in .env.local.`);
  }
  if (!process.env.SESSION_SECRET) {
    console.warn(`[admin] ⚠ SESSION_SECRET not set. Sessions will fail. Add to .env.local:`);
    console.warn(`         SESSION_SECRET=$(openssl rand -hex 32)`);
  }
});
