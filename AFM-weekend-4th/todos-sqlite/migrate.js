// One-shot migration: todos-jason/todos.json -> todos-sqlite/todos.db
// Usage: node migrate.js
// Safe to re-run: uses INSERT OR REPLACE so existing ids get updated rather than duplicated.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const SRC = path.resolve(__dirname, '..', 'todos-jason', 'todos.json');
const DB_PATH = path.join(__dirname, 'todos.db');

const raw = fs.readFileSync(SRC, 'utf8');
const parsed = JSON.parse(raw);
const todos = Array.isArray(parsed.todos) ? parsed.todos : [];

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

const upsert = db.prepare(`
  INSERT INTO todos (id, title, date, priority, estimated_time, completed, created_at)
  VALUES (@id, @title, @date, @priority, @estimated_time, @completed, @created_at)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    date = excluded.date,
    priority = excluded.priority,
    estimated_time = excluded.estimated_time,
    completed = excluded.completed
`);

const baseTs = Date.now();
const run = db.transaction((rows) => {
  rows.forEach((t, idx) => {
    upsert.run({
      id: t.id,
      title: t.title || '',
      date: t.date || '',
      priority: t.priority || '보통',
      estimated_time: t.estimatedTime || '',
      completed: t.completed ? 1 : 0,
      created_at: baseTs + idx,
    });
  });
});
run(todos);

const count = db.prepare('SELECT COUNT(*) AS c FROM todos').get().c;
console.log(`Migrated ${todos.length} todos from JSON. DB now has ${count} rows.`);
db.close();
