const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
const JWT_EXPIRES_IN = '7d';

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Refusing to start.');
  process.exit(1);
}
if (!JWT_SECRET || JWT_SECRET.length < 24) {
  console.error('JWT_SECRET is missing or too short (need ≥24 chars). Refusing to start.');
  process.exit(1);
}

// why: Supabase pooler (port 6543) is transaction-mode pgbouncer; small pool, SSL on,
//      and unnamed extended queries only — node-pg's default param queries are fine.
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
});

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});
app.use(express.static(__dirname));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.display_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    avatar_emoji: u.avatar_emoji,
  };
}

// why: replaces the old X-User-Id middleware. Now requires a valid signed JWT
//      whose `sub` resolves to a real row in todo_app_users.
async function requireAuth(req, res, next) {
  try {
    const auth = req.header('Authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return bad(res, 'Missing Authorization: Bearer <token>', 401);
    let payload;
    try {
      payload = jwt.verify(m[1], JWT_SECRET);
    } catch {
      return bad(res, 'Invalid or expired token', 401);
    }
    const uid = payload && payload.sub;
    if (!uid || !UUID_RE.test(uid)) return bad(res, 'Invalid token subject', 401);
    const { rows } = await pool.query(
      'select id from public.todo_app_users where id = $1',
      [uid]
    );
    if (rows.length === 0) return bad(res, 'User no longer exists', 401);
    req.userId = uid;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ---- Auth ----
app.post('/api/auth/signup', wrap(async (req, res) => {
  const { email, password, display_name, avatar_emoji } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return bad(res, 'valid email required');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return bad(res, 'password must be 8..200 chars');
  }
  if (typeof display_name !== 'string') {
    return bad(res, 'display_name required');
  }
  const name = display_name.trim();
  if (name.length < 1 || name.length > 60) {
    return bad(res, 'display_name must be 1..60 chars');
  }
  const emoji = (typeof avatar_emoji === 'string' && avatar_emoji.trim()) || '🙂';
  const normalizedEmail = email.trim().toLowerCase();

  const password_hash = await bcrypt.hash(password, 10);

  let user;
  try {
    const { rows } = await pool.query(
      `insert into public.todo_app_users (display_name, email, avatar_emoji, password_hash)
       values ($1, $2, $3, $4)
       returning id, email, display_name, avatar_emoji`,
      [name, normalizedEmail, emoji, password_hash]
    );
    user = rows[0];
  } catch (err) {
    if (err && err.code === '23505') return bad(res, 'email already in use', 409);
    throw err;
  }
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return bad(res, 'email and password required');
  }
  const { rows } = await pool.query(
    `select id, email, display_name, avatar_emoji, password_hash
       from public.todo_app_users where email = $1`,
    [email.trim().toLowerCase()]
  );
  const u = rows[0];
  // why: constant-ish path — always run bcrypt.compare even on missing user
  //      so timing doesn't leak email existence.
  const dummy = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8yqQ8k6qX0vYwQy.qN7e1hF1PQzNyW';
  const ok = await bcrypt.compare(password, u && u.password_hash ? u.password_hash : dummy);
  if (!u || !u.password_hash || !ok) return bad(res, 'invalid credentials', 401);

  const token = signToken(u);
  res.json({ token, user: publicUser(u) });
}));

app.get('/api/auth/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    'select id, email, display_name, avatar_emoji from public.todo_app_users where id = $1',
    [req.userId]
  );
  if (rows.length === 0) return bad(res, 'not found', 404);
  res.json(publicUser(rows[0]));
}));

// ---- Categories ----
app.get('/api/categories', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    'select id, name, color from public.todo_app_categories where user_id = $1 order by name asc',
    [req.userId]
  );
  res.json(rows);
}));

// ---- Todos ----
app.get('/api/todos', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    `select t.id, t.text, t.completed, t.priority, t.due_date, t.position,
            t.category_id, c.name as category_name, c.color as category_color,
            t.created_at, t.updated_at, t.completed_at
       from public.todo_app_todos t
       left join public.todo_app_categories c on c.id = t.category_id
      where t.user_id = $1
      order by t.position asc, t.created_at asc`,
    [req.userId]
  );
  res.json(rows);
}));

async function validateCategory(userId, categoryId) {
  if (categoryId === null || categoryId === undefined) return null;
  if (!UUID_RE.test(categoryId)) return 'invalid category_id';
  const { rows } = await pool.query(
    'select id from public.todo_app_categories where id = $1 and user_id = $2',
    [categoryId, userId]
  );
  return rows.length === 0 ? 'category_id does not belong to user' : null;
}

app.post('/api/todos', requireAuth, wrap(async (req, res) => {
  const { text, category_id = null, priority = 2, due_date = null } = req.body || {};
  if (typeof text !== 'string') return bad(res, 'text required');
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 500) return bad(res, 'text must be 1..500 chars');
  if (![1, 2, 3].includes(priority)) return bad(res, 'priority must be 1, 2, or 3');
  if (due_date !== null && !(typeof due_date === 'string' && DATE_RE.test(due_date))) {
    return bad(res, 'due_date must be YYYY-MM-DD or null');
  }
  const catErr = await validateCategory(req.userId, category_id);
  if (catErr) return bad(res, catErr);

  // why: position = max(position) + 1 so new items go to the bottom of the user's list.
  const { rows } = await pool.query(
    `insert into public.todo_app_todos (user_id, category_id, text, priority, due_date, position)
     values ($1, $2, $3, $4, $5,
             coalesce((select max(position) + 1 from public.todo_app_todos where user_id = $1), 1))
     returning id, text, completed, priority, due_date, position, category_id,
               created_at, updated_at, completed_at`,
    [req.userId, category_id, trimmed, priority, due_date]
  );
  const row = rows[0];

  let category_name = null, category_color = null;
  if (row.category_id) {
    const c = await pool.query(
      'select name, color from public.todo_app_categories where id = $1',
      [row.category_id]
    );
    if (c.rows[0]) { category_name = c.rows[0].name; category_color = c.rows[0].color; }
  }
  res.status(201).json({ ...row, category_name, category_color });
}));

app.patch('/api/todos/:id', requireAuth, wrap(async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return bad(res, 'invalid id');
  const allowed = ['text', 'completed', 'category_id', 'priority', 'due_date', 'position'];
  const sets = [];
  const vals = [];
  let i = 1;

  for (const key of allowed) {
    if (!(key in (req.body || {}))) continue;
    const v = req.body[key];
    if (key === 'text') {
      if (typeof v !== 'string') return bad(res, 'text must be string');
      const t = v.trim();
      if (t.length < 1 || t.length > 500) return bad(res, 'text must be 1..500 chars');
      sets.push(`text = $${i++}`); vals.push(t);
    } else if (key === 'completed') {
      if (typeof v !== 'boolean') return bad(res, 'completed must be boolean');
      sets.push(`completed = $${i++}`); vals.push(v);
    } else if (key === 'priority') {
      if (![1, 2, 3].includes(v)) return bad(res, 'priority must be 1, 2, or 3');
      sets.push(`priority = $${i++}`); vals.push(v);
    } else if (key === 'due_date') {
      if (v !== null && !(typeof v === 'string' && DATE_RE.test(v))) {
        return bad(res, 'due_date must be YYYY-MM-DD or null');
      }
      sets.push(`due_date = $${i++}`); vals.push(v);
    } else if (key === 'position') {
      if (!Number.isInteger(v)) return bad(res, 'position must be integer');
      sets.push(`position = $${i++}`); vals.push(v);
    } else if (key === 'category_id') {
      const catErr = await validateCategory(req.userId, v);
      if (catErr) return bad(res, catErr);
      sets.push(`category_id = $${i++}`); vals.push(v);
    }
  }
  if (sets.length === 0) return bad(res, 'no fields to update');

  vals.push(id, req.userId);
  const { rows } = await pool.query(
    `update public.todo_app_todos set ${sets.join(', ')}
       where id = $${i++} and user_id = $${i++}
     returning id, text, completed, priority, due_date, position, category_id,
               created_at, updated_at, completed_at`,
    vals
  );
  if (rows.length === 0) return bad(res, 'not found', 404);
  const row = rows[0];
  let category_name = null, category_color = null;
  if (row.category_id) {
    const c = await pool.query(
      'select name, color from public.todo_app_categories where id = $1',
      [row.category_id]
    );
    if (c.rows[0]) { category_name = c.rows[0].name; category_color = c.rows[0].color; }
  }
  res.json({ ...row, category_name, category_color });
}));

app.delete('/api/todos', requireAuth, wrap(async (req, res) => {
  if (req.query.completed !== 'true') return bad(res, 'pass ?completed=true for bulk delete');
  const { rowCount } = await pool.query(
    'delete from public.todo_app_todos where user_id = $1 and completed = true',
    [req.userId]
  );
  res.json({ deleted: rowCount });
}));

app.delete('/api/todos/:id', requireAuth, wrap(async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return bad(res, 'invalid id');
  const { rowCount } = await pool.query(
    'delete from public.todo_app_todos where id = $1 and user_id = $2',
    [id, req.userId]
  );
  if (rowCount === 0) return bad(res, 'not found', 404);
  res.json({ deleted: 1 });
}));

// ---- Stats ----
app.get('/api/stats', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    'select total, active, completed, overdue from public.todo_app_stats where user_id = $1',
    [req.userId]
  );
  res.json(rows[0] || { total: 0, active: 0, completed: 0, overdue: 0 });
}));

// SPA fallback to index.html for any non-API path
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
