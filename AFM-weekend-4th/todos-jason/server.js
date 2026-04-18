// server.js — Todo API backed by a single todos.json file.
// File shape: { "todos": [ { id, title, date, priority, estimatedTime, completed }, ... ] }

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const app = express();
const PORT = process.env.PORT || 4322;

const DATA_FILE = path.join(__dirname, 'todos.json');
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

app.use(express.json());
app.use(express.static(__dirname));

// ---------- storage helpers ----------

async function readStore() {
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.todos)) return parsed.todos;
    return [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeStore(todos) {
  const payload = JSON.stringify({ todos }, null, 2) + '\n';
  await fsp.writeFile(DATA_FILE, payload, 'utf8');
}

function isValidId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128
    && !id.includes('..') && !id.includes('/') && !id.includes('\\')
    && ID_PATTERN.test(id);
}

function generateId() {
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- routes ----------

// GET /api/todos
app.get('/api/todos', async (_req, res) => {
  try {
    const todos = await readStore();
    res.json({ success: true, data: todos });
  } catch (err) {
    console.error('GET /api/todos error:', err);
    res.status(500).json({ success: false, message: 'Failed to read todos' });
  }
});

// POST /api/todos
app.post('/api/todos', async (req, res) => {
  try {
    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const todo = {
      id: generateId(),
      title,
      date: typeof body.date === 'string' ? body.date : '',
      priority: typeof body.priority === 'string' ? body.priority : '보통',
      estimatedTime: typeof body.estimatedTime === 'string' ? body.estimatedTime : '',
      completed: false,
    };

    const todos = await readStore();
    todos.push(todo);
    await writeStore(todos);

    res.status(201).json({ success: true, data: todo });
  } catch (err) {
    console.error('POST /api/todos error:', err);
    res.status(500).json({ success: false, message: 'Failed to create todo' });
  }
});

// DELETE /api/todos  -> delete all completed (declare BEFORE :id variant)
app.delete('/api/todos', async (_req, res) => {
  try {
    const todos = await readStore();
    const kept = todos.filter((t) => t.completed !== true);
    const deleted = todos.filter((t) => t.completed === true).map((t) => t.id);
    await writeStore(kept);
    res.json({ success: true, data: { deleted } });
  } catch (err) {
    console.error('DELETE /api/todos error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete completed todos' });
  }
});

// PATCH /api/todos/:id  -> empty body flips completed; non-empty body does partial update
app.patch('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  try {
    const todos = await readStore();
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    const current = todos[idx];
    const body = req.body || {};
    const bodyKeys = Object.keys(body);

    let updated;
    if (bodyKeys.length === 0) {
      updated = { ...current, completed: !current.completed };
    } else {
      updated = { ...current };
      if (typeof body.title === 'string') updated.title = body.title;
      if (typeof body.date === 'string') updated.date = body.date;
      if (typeof body.priority === 'string') updated.priority = body.priority;
      if (typeof body.estimatedTime === 'string') updated.estimatedTime = body.estimatedTime;
      if (typeof body.completed === 'boolean') updated.completed = body.completed;
    }
    updated.id = current.id; // id is immutable

    todos[idx] = updated;
    await writeStore(todos);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(`PATCH /api/todos/${id} error:`, err);
    res.status(500).json({ success: false, message: 'Failed to update todo' });
  }
});

// DELETE /api/todos/:id
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  try {
    const todos = await readStore();
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    todos.splice(idx, 1);
    await writeStore(todos);
    res.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/todos/${id} error:`, err);
    res.status(500).json({ success: false, message: 'Failed to delete todo' });
  }
});

// SPA fallback (Express 5 wildcard)
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Final error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Todos server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
