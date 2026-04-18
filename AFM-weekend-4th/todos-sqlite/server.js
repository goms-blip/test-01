// ---------------------------------------------------------------------------
// todos-sqlite : Express + better-sqlite3 variant of the todo server.
// Sibling variants:
//   - ../my-data      (port 4321, per-todo .txt files)
//   - ../todos-jason  (port 4322, single todos.json)
// This variant persists to a local SQLite file (./todos.db) on port 4323.
// ---------------------------------------------------------------------------

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 4323;
const DB_PATH = path.join(__dirname, 'todos.db');

// ---------------------------------------------------------------------------
// Database init (synchronous — better-sqlite3 is blocking by design)
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT '보통',
    estimated_time TEXT NOT NULL DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);

// Seed on empty table. Uses a transaction so either all 5 rows land or none.
const countRow = db.prepare('SELECT COUNT(*) AS c FROM todos').get();
if (countRow.c === 0) {
  const baseTs = Date.now();
  const seedRows = [
    { id: 'todo_1', title: 'AFM 주말 4차 과제 요구사항 검토하기', date: '2026-04-18', priority: '높음', estimated_time: '30분' },
    { id: 'todo_2', title: 'my-data 폴더 구조 설계하기',            date: '2026-04-18', priority: '높음', estimated_time: '1시간' },
    { id: 'todo_3', title: '지난주 학습한 에이전트 코드 복습하기',   date: '2026-04-18', priority: '중간', estimated_time: '1시간 30분' },
    { id: 'todo_4', title: 'Claude Code 신규 기능 문서 읽기',        date: '2026-04-18', priority: '중간', estimated_time: '45분' },
    { id: 'todo_5', title: '오늘 작업 내용 git 커밋 및 정리하기',    date: '2026-04-18', priority: '낮음', estimated_time: '20분' },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO todos (id, title, date, priority, estimated_time, completed, created_at)
    VALUES (@id, @title, @date, @priority, @estimated_time, 0, @created_at)
  `);
  const insertMany = db.transaction((rows) => {
    rows.forEach((row, idx) => {
      // Incrementing created_at so ASC sort preserves seed order.
      insertStmt.run({ ...row, created_at: baseTs + idx });
    });
  });
  insertMany(seedRows);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ID_RE = /^[a-zA-Z0-9_-]+$/;

// DB row (snake_case, completed:int) -> API shape (camelCase, completed:bool).
function shapeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    priority: row.priority,
    estimatedTime: row.estimated_time,
    completed: row.completed === 1,
  };
}

function generateId() {
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function validIdOr400(req, res) {
  if (!ID_RE.test(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid id format' });
    return false;
  }
  return true;
}

// Prepared statements (compile once, reuse).
const stmtAll          = db.prepare('SELECT * FROM todos ORDER BY created_at ASC');
const stmtGetById      = db.prepare('SELECT * FROM todos WHERE id = ?');
const stmtInsert       = db.prepare(`
  INSERT INTO todos (id, title, date, priority, estimated_time, completed, created_at)
  VALUES (@id, @title, @date, @priority, @estimated_time, 0, @created_at)
`);
const stmtDeleteById   = db.prepare('DELETE FROM todos WHERE id = ?');
const stmtSelectDoneIds = db.prepare('SELECT id FROM todos WHERE completed = 1');
const stmtDeleteDone    = db.prepare('DELETE FROM todos WHERE completed = 1');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(__dirname));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/todos  — list all, oldest first.
app.get('/api/todos', (_req, res) => {
  try {
    const rows = stmtAll.all().map(shapeRow);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[GET /api/todos]', err);
    res.status(500).json({ success: false, message: 'Failed to read todos' });
  }
});

// POST /api/todos  — create one.
app.post('/api/todos', (req, res) => {
  try {
    const { title, date, priority, estimatedTime } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const row = {
      id: generateId(),
      title: title.trim(),
      date: typeof date === 'string' ? date : '',
      priority: typeof priority === 'string' && priority ? priority : '보통',
      estimated_time: typeof estimatedTime === 'string' ? estimatedTime : '',
      created_at: Date.now(),
    };
    stmtInsert.run(row);

    const created = shapeRow(stmtGetById.get(row.id));
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[POST /api/todos]', err);
    res.status(500).json({ success: false, message: 'Failed to create todo' });
  }
});

// DELETE /api/todos  — bulk delete completed. MUST be declared before /:id.
app.delete('/api/todos', (_req, res) => {
  try {
    const doneIds = stmtSelectDoneIds.all().map((r) => r.id);
    stmtDeleteDone.run();
    res.json({ success: true, data: { deleted: doneIds } });
  } catch (err) {
    console.error('[DELETE /api/todos]', err);
    res.status(500).json({ success: false, message: 'Failed to delete completed todos' });
  }
});

// PATCH /api/todos/:id  — empty body toggles `completed`, non-empty does partial update.
app.patch('/api/todos/:id', (req, res) => {
  if (!validIdOr400(req, res)) return;
  try {
    const existing = stmtGetById.get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    const body = req.body || {};
    const bodyKeys = Object.keys(body);

    // Build dynamic UPDATE from a whitelist of allowed columns.
    // Column name is hard-coded from the map — never interpolated from input.
    const colMap = {
      title: 'title',
      date: 'date',
      priority: 'priority',
      estimatedTime: 'estimated_time',
      completed: 'completed',
    };

    const sets = [];
    const params = { id: req.params.id };

    if (bodyKeys.length === 0) {
      // Empty body = toggle completed.
      sets.push('completed = @completed');
      params.completed = existing.completed === 1 ? 0 : 1;
    } else {
      for (const key of bodyKeys) {
        const col = colMap[key];
        if (!col) continue; // silently drop unknown keys (id, created_at, etc.)
        let val = body[key];
        if (key === 'completed') {
          val = val ? 1 : 0;
        } else if (typeof val !== 'string') {
          return res.status(400).json({ success: false, message: `Field "${key}" must be a string` });
        }
        sets.push(`${col} = @${key}`);
        params[key] = val;
      }
      if (sets.length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided' });
      }
    }

    const sql = `UPDATE todos SET ${sets.join(', ')} WHERE id = @id`;
    db.prepare(sql).run(params);

    const updated = shapeRow(stmtGetById.get(req.params.id));
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PATCH /api/todos/:id]', err);
    res.status(500).json({ success: false, message: 'Failed to update todo' });
  }
});

// DELETE /api/todos/:id  — delete one.
app.delete('/api/todos/:id', (req, res) => {
  if (!validIdOr400(req, res)) return;
  try {
    const info = stmtDeleteById.run(req.params.id);
    if (info.changes === 0) {
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
    console.log(`todos-sqlite server running on http://localhost:${PORT}`);
    console.log(`DB file: ${DB_PATH}`);
  });
}

module.exports = app;
