// server.js — Todo API backed by .txt files in ./todos
//
// Completion convention:
//   A todo is considered "completed" when the FIRST LINE of its .txt file
//   starts with the literal prefix "[DONE] ".
//   Toggling completion adds or removes that prefix on the first line.

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const app = express();
const PORT = process.env.PORT || 4321;

const TODOS_DIR = path.join(__dirname, 'todos');
const DONE_PREFIX = '[DONE] ';
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// -------------------- middleware --------------------
app.use(express.json());
app.use(express.static(__dirname));

// Ensure the todos directory exists (lazy, idempotent)
function ensureTodosDir() {
  if (!fs.existsSync(TODOS_DIR)) {
    fs.mkdirSync(TODOS_DIR, { recursive: true });
  }
}

// -------------------- helpers --------------------

// Validate an :id param and resolve it to a safe absolute path inside TODOS_DIR.
// Returns { ok: true, filename, fullPath } or { ok: false, status, message }.
function resolveTodoPath(id) {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, status: 400, message: 'Invalid id' };
  }
  if (!ID_REGEX.test(id)) {
    return { ok: false, status: 400, message: 'Invalid id format' };
  }
  // Extra defensive checks on top of the regex
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return { ok: false, status: 400, message: 'Invalid id' };
  }

  const filename = `${id}.txt`;
  const fullPath = path.join(TODOS_DIR, filename);
  const resolved = path.resolve(fullPath);
  const base = path.resolve(TODOS_DIR);

  // Path traversal guard
  if (resolved !== path.join(base, filename) || !resolved.startsWith(base + path.sep)) {
    return { ok: false, status: 400, message: 'Path traversal detected' };
  }

  return { ok: true, filename, fullPath: resolved };
}

// Read a single todo file and shape it into the response object.
async function readTodo(filename) {
  const fullPath = path.join(TODOS_DIR, filename);
  const content = await fsp.readFile(fullPath, 'utf8');
  const firstLineEnd = content.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd);
  const completed = firstLine.startsWith(DONE_PREFIX);
  const id = filename.replace(/\.txt$/, '');
  return { id, filename, content, completed };
}

// -------------------- routes --------------------

// GET /api/todos — list all todos
app.get('/api/todos', async (_req, res) => {
  try {
    ensureTodosDir();
    const entries = await fsp.readdir(TODOS_DIR);
    const txtFiles = entries.filter((f) => f.endsWith('.txt'));

    // Sort for deterministic ordering (natural-ish by name)
    txtFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const todos = [];
    for (const f of txtFiles) {
      try {
        todos.push(await readTodo(f));
      } catch (err) {
        // Skip files that can't be read but keep serving the rest
        console.error(`Failed to read ${f}:`, err.message);
      }
    }

    res.json({ success: true, data: todos });
  } catch (err) {
    console.error('GET /api/todos failed:', err);
    res.status(500).json({ success: false, message: 'Failed to list todos' });
  }
});

// POST /api/todos — create a new todo file
app.post('/api/todos', async (req, res) => {
  try {
    ensureTodosDir();
    const { content } = req.body || {};
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'content is required' });
    }

    // Timestamp-based id to avoid collisions across quick successive requests
    const id = `todo_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const filename = `${id}.txt`;
    const fullPath = path.join(TODOS_DIR, filename);

    // Normalize: ensure the file ends with a newline
    const body = content.endsWith('\n') ? content : content + '\n';
    await fsp.writeFile(fullPath, body, 'utf8');

    const todo = await readTodo(filename);
    res.status(201).json({ success: true, data: todo });
  } catch (err) {
    console.error('POST /api/todos failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create todo' });
  }
});

// PATCH /api/todos/:id — toggle completion via [DONE] prefix on first line
app.patch('/api/todos/:id', async (req, res) => {
  const check = resolveTodoPath(req.params.id);
  if (!check.ok) {
    return res.status(check.status).json({ success: false, message: check.message });
  }

  try {
    const raw = await fsp.readFile(check.fullPath, 'utf8');
    const nlIdx = raw.indexOf('\n');
    const firstLine = nlIdx === -1 ? raw : raw.slice(0, nlIdx);
    const rest = nlIdx === -1 ? '' : raw.slice(nlIdx);

    let newFirstLine;
    if (firstLine.startsWith(DONE_PREFIX)) {
      newFirstLine = firstLine.slice(DONE_PREFIX.length);
    } else {
      newFirstLine = DONE_PREFIX + firstLine;
    }

    const updated = newFirstLine + rest;
    await fsp.writeFile(check.fullPath, updated, 'utf8');

    const todo = await readTodo(check.filename);
    res.json({ success: true, data: todo });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    console.error('PATCH /api/todos/:id failed:', err);
    res.status(500).json({ success: false, message: 'Failed to update todo' });
  }
});

// DELETE /api/todos — delete all completed todos
// Note: declared BEFORE /api/todos/:id so the literal path wins
app.delete('/api/todos', async (_req, res) => {
  try {
    ensureTodosDir();
    const entries = await fsp.readdir(TODOS_DIR);
    const txtFiles = entries.filter((f) => f.endsWith('.txt'));

    const deleted = [];
    for (const f of txtFiles) {
      try {
        const fullPath = path.join(TODOS_DIR, f);
        const raw = await fsp.readFile(fullPath, 'utf8');
        const nlIdx = raw.indexOf('\n');
        const firstLine = nlIdx === -1 ? raw : raw.slice(0, nlIdx);
        if (firstLine.startsWith(DONE_PREFIX)) {
          await fsp.unlink(fullPath);
          deleted.push(f.replace(/\.txt$/, ''));
        }
      } catch (innerErr) {
        console.error(`Failed while processing ${f}:`, innerErr.message);
      }
    }

    res.json({ success: true, data: { deleted } });
  } catch (err) {
    console.error('DELETE /api/todos failed:', err);
    res.status(500).json({ success: false, message: 'Failed to delete completed todos' });
  }
});

// DELETE /api/todos/:id — delete a single todo file
app.delete('/api/todos/:id', async (req, res) => {
  const check = resolveTodoPath(req.params.id);
  if (!check.ok) {
    return res.status(check.status).json({ success: false, message: check.message });
  }

  try {
    await fsp.unlink(check.fullPath);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    console.error('DELETE /api/todos/:id failed:', err);
    res.status(500).json({ success: false, message: 'Failed to delete todo' });
  }
});

// SPA fallback — Express 5 wildcard syntax
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Generic error handler (last-resort)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// -------------------- startup --------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
