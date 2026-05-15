// Minimal Supabase REST helpers — service_role context.
// Designed for both CLI scripts and a future admin module (Node side).
// Browser code should use lib/supabase-client.js (anon) instead.

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export function getClient() {
  const url = envOrThrow('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const key = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  };
}

/** Upsert rows into a PostgREST table by unique column (default: id). */
export async function upsertRows(table, rows, { onConflict = 'id' } = {}) {
  const c = getClient();
  const res = await fetch(`${c.url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      ...c.headers,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upsert ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Update a single row by a column value. */
export async function updateRow(table, match, patch) {
  const c = getClient();
  const qs = Object.entries(match)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join('&');
  const res = await fetch(`${c.url}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: {
      ...c.headers,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`update ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Upload (or overwrite) a single object in a Storage bucket. */
export async function uploadObject(bucket, path, body, { contentType = 'application/octet-stream' } = {}) {
  const c = getClient();
  const res = await fetch(`${c.url}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      ...c.headers,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload ${bucket}/${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Public URL for an object in a public bucket. */
export function publicUrl(bucket, path) {
  const url = envOrThrow('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}
