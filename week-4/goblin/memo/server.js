const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const connectionString = (process.env.DATABASE_URL || '').trim();
const pool = connectionString
  ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user: 'postgres.fyeooefvtacfmwxdmevi',
      password: 'iDnFZJ,hV?/zvg6',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.memos (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  dbInitialized = true;
}

app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('initDB error:', err);
    res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

function parseId(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/memos?q=keyword — list DESC, optional case-insensitive search on title/content.
app.get('/api/memos', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const result = q
      ? await pool.query(
          `SELECT id, title, content, created_at
             FROM public.memos
            WHERE title ILIKE $1 OR content ILIKE $1
            ORDER BY created_at DESC`,
          [`%${q}%`]
        )
      : await pool.query(
          `SELECT id, title, content, created_at
             FROM public.memos
            ORDER BY created_at DESC`
        );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/memos error:', err);
    res.status(500).json({ success: false, message: 'Failed to list memos' });
  }
});

// POST /api/memos — create a new memo.
app.post('/api/memos', async (req, res) => {
  try {
    const { title, content } = req.body || {};
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'title is required and must be a non-empty string',
      });
    }
    const safeContent = typeof content === 'string' ? content : null;

    const result = await pool.query(
      `INSERT INTO public.memos (title, content)
            VALUES ($1, $2)
         RETURNING id, title, content, created_at`,
      [title.trim(), safeContent]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/memos error:', err);
    res.status(500).json({ success: false, message: 'Failed to create memo' });
  }
});

// PATCH /api/memos/:id — partial update on title and/or content.
app.patch('/api/memos/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const { title, content } = req.body || {};
    const sets = [];
    const values = [];

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'title must be a non-empty string when provided',
        });
      }
      values.push(title.trim());
      sets.push(`title = $${values.length}`);
    }

    if (content !== undefined) {
      values.push(typeof content === 'string' ? content : null);
      sets.push(`content = $${values.length}`);
    }

    if (sets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one of title or content must be provided',
      });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE public.memos
          SET ${sets.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, title, content, created_at`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Memo not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PATCH /api/memos/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update memo' });
  }
});

// DELETE /api/memos/:id — remove a memo.
app.delete('/api/memos/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const result = await pool.query(
      `DELETE FROM public.memos WHERE id = $1 RETURNING id, title, content, created_at`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Memo not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /api/memos/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete memo' });
  }
});

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) res.status(404).json({ success: false, message: 'Not found' });
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
