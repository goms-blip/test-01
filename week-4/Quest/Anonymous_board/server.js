try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) { /* optional */ }

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4327;

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

const CATEGORIES = ['고민', '칭찬', '응원', '기타'];
const MAX_CONTENT_LEN = 2000;

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.posts (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category   TEXT NOT NULL,
      content    TEXT NOT NULL,
      likes      BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS posts_likes_idx      ON public.posts (likes DESC);`);
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

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// GET /api/posts?sort=recent|likes&category=
app.get('/api/posts', async (req, res) => {
  try {
    const sort = req.query.sort === 'likes' ? 'likes' : 'recent';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const clauses = [];
    const values = [];
    if (category) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: '알 수 없는 카테고리' });
      }
      values.push(category);
      clauses.push(`category = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderBy = sort === 'likes'
      ? 'likes DESC, created_at DESC'
      : 'created_at DESC';
    const result = await pool.query(
      `SELECT id, category, content, likes, created_at
         FROM public.posts
         ${where}
         ORDER BY ${orderBy}
         LIMIT 200`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/posts error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// POST /api/posts { category, content }
app.post('/api/posts', async (req, res) => {
  try {
    const { category, content } = req.body || {};
    const cat = typeof category === 'string' ? category.trim() : '';
    const body = typeof content === 'string' ? content.trim() : '';

    if (!CATEGORIES.includes(cat)) {
      return res.status(400).json({ success: false, message: '카테고리를 선택해주세요' });
    }
    if (!body) {
      return res.status(400).json({ success: false, message: '내용을 입력해주세요' });
    }
    if (body.length > MAX_CONTENT_LEN) {
      return res.status(400).json({ success: false, message: `내용은 ${MAX_CONTENT_LEN}자 이하로 작성해주세요` });
    }

    const result = await pool.query(
      `INSERT INTO public.posts (category, content)
       VALUES ($1, $2)
       RETURNING id, category, content, likes, created_at`,
      [cat, body]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/posts error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// POST /api/posts/:id/like  (+1)
app.post('/api/posts/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(
      `UPDATE public.posts SET likes = likes + 1
       WHERE id = $1
       RETURNING id, category, content, likes, created_at`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: '게시글을 찾을 수 없어요' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/posts/:id/like error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// DELETE /api/posts/:id  (optional cleanup)
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(`DELETE FROM public.posts WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: '게시글을 찾을 수 없어요' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/posts/:id error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// SPA fallback (Express 5)
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
    console.log(`Anonymous-Board server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
