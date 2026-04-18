// ---------------------------------------------------------------------------
// todos-postgresql : Express + node-postgres (pg) variant of the todo server.
// Sibling variants:
//   - ../my-data            (per-todo .txt files)
//   - ../todos-jason        (single todos.json)
//   - ../todos-sqlite       (better-sqlite3 local file)
//   - ../todos-localstorage (client-only)
// This variant persists to a PostgreSQL database (Supabase pooler by default).
// ---------------------------------------------------------------------------

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4324;

// ---------------------------------------------------------------------------
// Pool setup
// ---------------------------------------------------------------------------
// The password contains `,?/` which breaks URL parsing, so we prefer discrete
// fields. DATABASE_URL is honored if present (and `.trim()`ed to strip any
// trailing newline some platforms inject).
const DB_URL = (process.env.DATABASE_URL || '').trim();

const pool = DB_URL
  ? new Pool({
      connectionString: DB_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user: 'postgres.fyeooefvtacfmwxdmevi',
      password: 'iDnFZJ,hV?/zvg6',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });

// ---------------------------------------------------------------------------
// Lazy DB init (flag-guarded so cold starts don't re-run DDL).
// ---------------------------------------------------------------------------
let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;

  // Table is assumed to already exist; these ADD COLUMN IF NOT EXISTS calls
  // just ensure the UI-required columns are present.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.todos (
      id          serial PRIMARY KEY,
      title       text NOT NULL,
      completed   boolean DEFAULT false,
      created_at  timestamptz DEFAULT now(),
      content     text
    );
  `);
  await pool.query(`ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS date           date;`);
  await pool.query(`ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS priority       text;`);
  await pool.query(`ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS estimated_time text;`);

  dbInitialized = true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// DB row (snake_case) -> API shape (camelCase). `date` is already a string
// thanks to to_char() in the SELECT list.
function shapeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === true,
    date: row.date || '',
    priority: row.priority || '',
    estimatedTime: row.estimated_time || '',
    content: row.content || '',
    created_at: row.created_at,
  };
}

// Centralized SELECT list — keeps `date` as YYYY-MM-DD (never ISO timestamp).
const SELECT_COLS = `
  id,
  title,
  completed,
  to_char(date, 'YYYY-MM-DD') AS date,
  priority,
  estimated_time,
  content,
  created_at
`;

function parseIdOr400(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ success: false, message: 'Invalid id' });
    return null;
  }
  return id;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(__dirname));

// Run lazy initDB before any /api/* handler. Errors surface as 500 JSON.
app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('[initDB]', err);
    res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/todos — list all, id ASC.
app.get('/api/todos', async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${SELECT_COLS} FROM public.todos ORDER BY id ASC`);
    res.json({ success: true, data: rows.map(shapeRow) });
  } catch (err) {
    console.error('[GET /api/todos]', err);
    res.status(500).json({ success: false, message: 'Failed to read todos' });
  }
});

// POST /api/todos — create one.
app.post('/api/todos', async (req, res) => {
  try {
    const { title, date, priority, estimatedTime } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    // Empty strings -> NULL for typed columns (date especially).
    const safeDate = typeof date === 'string' && date ? date : null;
    const safePriority = typeof priority === 'string' && priority ? priority : null;
    const safeEstimated = typeof estimatedTime === 'string' && estimatedTime ? estimatedTime : null;

    const insert = await pool.query(
      `INSERT INTO public.todos (title, date, priority, estimated_time)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [title.trim(), safeDate, safePriority, safeEstimated],
    );
    const newId = insert.rows[0].id;

    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS} FROM public.todos WHERE id = $1`,
      [newId],
    );
    res.status(201).json({ success: true, data: shapeRow(rows[0]) });
  } catch (err) {
    console.error('[POST /api/todos]', err);
    res.status(500).json({ success: false, message: 'Failed to create todo' });
  }
});

// DELETE /api/todos — bulk-delete completed. MUST be declared before /:id.
app.delete('/api/todos', async (_req, res) => {
  try {
    await pool.query(`DELETE FROM public.todos WHERE completed = true`);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/todos]', err);
    res.status(500).json({ success: false, message: 'Failed to delete completed todos' });
  }
});

// PATCH /api/todos/:id — toggle `completed`.
app.patch('/api/todos/:id', async (req, res) => {
  const id = parseIdOr400(req, res);
  if (id === null) return;
  try {
    const updated = await pool.query(
      `UPDATE public.todos
         SET completed = NOT COALESCE(completed, false)
       WHERE id = $1
       RETURNING id`,
      [id],
    );
    if (updated.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS} FROM public.todos WHERE id = $1`,
      [id],
    );
    res.json({ success: true, data: shapeRow(rows[0]) });
  } catch (err) {
    console.error('[PATCH /api/todos/:id]', err);
    res.status(500).json({ success: false, message: 'Failed to update todo' });
  }
});

// DELETE /api/todos/:id — delete one.
app.delete('/api/todos/:id', async (req, res) => {
  const id = parseIdOr400(req, res);
  if (id === null) return;
  try {
    const result = await pool.query(`DELETE FROM public.todos WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/todos/:id]', err);
    res.status(500).json({ success: false, message: 'Failed to delete todo' });
  }
});

// ---------------------------------------------------------------------------
// SPA fallback (Express 5 splat syntax) — keep LAST so /api/* still matches.
// ---------------------------------------------------------------------------
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Last-resort error handler.
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Startup (local) + export (serverless)
// ---------------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`todos-postgresql server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
