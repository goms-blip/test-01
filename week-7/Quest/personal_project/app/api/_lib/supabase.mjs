// Service-role REST helpers — never imported from browser code.
import { loadEnvOnce } from './env.mjs';

function client() {
  loadEnvOnce();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

export async function listIngredients() {
  const c = client();
  const r = await fetch(`${c.url}/rest/v1/ingredients?select=*&order=sort_order.asc.nullslast`, { headers: c.headers });
  if (!r.ok) throw new Error(`list failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function upsertRow(row) {
  const c = client();
  const r = await fetch(`${c.url}/rest/v1/ingredients?on_conflict=slug`, {
    method: 'POST',
    headers: {
      ...c.headers,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });
  if (!r.ok) throw new Error(`upsert failed: ${r.status} ${await r.text()}`);
  const arr = await r.json();
  return arr[0] || null;
}

export async function patchRow(slug, patch) {
  const c = client();
  const r = await fetch(`${c.url}/rest/v1/ingredients?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: {
      ...c.headers,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`patch failed: ${r.status} ${await r.text()}`);
  const arr = await r.json();
  return arr[0] || null;
}

export async function deleteRow(slug) {
  const c = client();
  const r = await fetch(`${c.url}/rest/v1/ingredients?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'DELETE', headers: c.headers,
  });
  if (!r.ok) throw new Error(`delete failed: ${r.status} ${await r.text()}`);
}

export async function uploadStorageObject(bucket, path, body, contentType) {
  const c = client();
  const r = await fetch(`${c.url}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { ...c.headers, 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  });
  if (!r.ok) throw new Error(`upload failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export function storagePublicUrl(bucket, path) {
  loadEnvOnce();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}
