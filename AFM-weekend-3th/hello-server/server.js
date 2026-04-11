const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================================================
// Middleware
// ===========================================================================
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 요청 로그 자동 기록 미들웨어 (모든 /api 요청을 logs에 저장)
app.use('/api', (req, _res, next) => {
  logs.push({
    id: logNextId++,
    method: req.method,
    path: req.originalUrl,
    body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
    timestamp: new Date().toISOString(),
  });
  // 로그가 너무 많아지지 않도록 최대 200개 유지
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  next();
});

// ===========================================================================
// In-memory data stores
// ===========================================================================

// --- Items ---
let items = [
  { id: 1, name: 'Learn Express', done: false },
  { id: 2, name: 'Build API', done: false },
  { id: 3, name: 'Deploy to Vercel', done: true },
];
let nextItemId = 4;

// --- Users ---
let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', createdAt: '2026-04-01T09:00:00.000Z' },
  { id: 2, name: 'Bob', email: 'bob@example.com', createdAt: '2026-04-05T12:30:00.000Z' },
];
let nextUserId = 3;

// --- Logs ---
let logs = [];
let logNextId = 1;

// --- Random data ---
const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Code is like humor. When you have to explain it, it is bad.', author: 'Cory House' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { text: 'Any fool can write code that a computer can understand.', author: 'Martin Fowler' },
  { text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
  { text: 'The best error message is the one that never shows up.', author: 'Thomas Fuchs' },
];

const COLORS = [
  { name: 'Coral', hex: '#FF6F61' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Crimson', hex: '#DC143C' },
  { name: 'SkyBlue', hex: '#87CEEB' },
  { name: 'Mint', hex: '#98FF98' },
  { name: 'Salmon', hex: '#FA8072' },
];

// ===========================================================================
// 1. Items CRUD  —  /api/items
// ===========================================================================

// GET /api/items — list all items
app.get('/api/items', (_req, res) => {
  res.json({ success: true, data: items });
});

// GET /api/items/:id — get one item
app.get('/api/items/:id', (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }
  res.json({ success: true, data: item });
});

// POST /api/items — create a new item
app.post('/api/items', (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, message: '"name" is required (non-empty string)' });
  }
  const item = { id: nextItemId++, name: name.trim(), done: false };
  items.push(item);
  res.status(201).json({ success: true, data: item });
});

// PUT /api/items/:id — update an item
app.put('/api/items/:id', (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }
  const { name, done } = req.body || {};
  if (name !== undefined) item.name = String(name).trim();
  if (done !== undefined) item.done = Boolean(done);
  res.json({ success: true, data: item });
});

// DELETE /api/items/:id — delete an item
app.delete('/api/items/:id', (req, res) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }
  const [deleted] = items.splice(idx, 1);
  res.json({ success: true, data: deleted });
});

// ===========================================================================
// 2. Users CRUD  —  /api/users
// ===========================================================================

// GET /api/users — list all users
app.get('/api/users', (_req, res) => {
  res.json({ success: true, data: users });
});

// GET /api/users/:id — get one user
app.get('/api/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, data: user });
});

// POST /api/users — create a new user
app.post('/api/users', (req, res) => {
  const { name, email } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, message: '"name" is required (non-empty string)' });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, message: '"email" is required (valid email)' });
  }
  // 이메일 중복 체크
  if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(409).json({ success: false, message: 'Email already exists' });
  }
  const user = {
    id: nextUserId++,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  res.status(201).json({ success: true, data: user });
});

// PUT /api/users/:id — update a user
app.put('/api/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const { name, email } = req.body || {};
  if (name !== undefined) user.name = String(name).trim();
  if (email !== undefined) {
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed.includes('@')) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (users.some((u) => u.id !== user.id && u.email === trimmed)) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    user.email = trimmed;
  }
  res.json({ success: true, data: user });
});

// DELETE /api/users/:id — delete a user
app.delete('/api/users/:id', (req, res) => {
  const idx = users.findIndex((u) => u.id === Number(req.params.id));
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const [deleted] = users.splice(idx, 1);
  res.json({ success: true, data: deleted });
});

// ===========================================================================
// 3. Search  —  /api/search?q=keyword
// ===========================================================================

// GET /api/search — search items and users by keyword
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) {
    return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
  }
  const matchedItems = items.filter((i) => i.name.toLowerCase().includes(q));
  const matchedUsers = users.filter(
    (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );
  res.json({
    success: true,
    data: {
      query: q,
      items: matchedItems,
      users: matchedUsers,
      totalResults: matchedItems.length + matchedUsers.length,
    },
  });
});

// ===========================================================================
// 4. Stats  —  /api/stats
// ===========================================================================

// GET /api/stats — aggregate statistics
app.get('/api/stats', (_req, res) => {
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.done).length;
  const pendingItems = totalItems - doneItems;
  const totalUsers = users.length;
  const totalLogs = logs.length;
  res.json({
    success: true,
    data: {
      items: { total: totalItems, done: doneItems, pending: pendingItems },
      users: { total: totalUsers },
      logs: { total: totalLogs },
      serverUptime: `${Math.floor(process.uptime())}s`,
      memoryUsageMB: +(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    },
  });
});

// ===========================================================================
// 5. Random  —  /api/random, /api/random/quote, /api/random/color, /api/random/number
// ===========================================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// GET /api/random — random assortment (quote + color + number)
app.get('/api/random', (_req, res) => {
  res.json({
    success: true,
    data: {
      quote: pick(QUOTES),
      color: pick(COLORS),
      number: Math.floor(Math.random() * 1000),
      uuid: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });
});

// GET /api/random/quote — random quote
app.get('/api/random/quote', (_req, res) => {
  res.json({ success: true, data: pick(QUOTES) });
});

// GET /api/random/color — random color
app.get('/api/random/color', (_req, res) => {
  res.json({ success: true, data: pick(COLORS) });
});

// GET /api/random/number?min=0&max=100 — random number in range
app.get('/api/random/number', (req, res) => {
  const min = parseInt(req.query.min, 10) || 0;
  const max = parseInt(req.query.max, 10) || 100;
  if (min >= max) {
    return res.status(400).json({ success: false, message: '"min" must be less than "max"' });
  }
  const value = Math.floor(Math.random() * (max - min + 1)) + min;
  res.json({ success: true, data: { min, max, value } });
});

// ===========================================================================
// 6. Calculator  —  /api/calc?a=10&op=add&b=5
// ===========================================================================

// GET /api/calc — simple arithmetic
app.get('/api/calc', (req, res) => {
  const a = parseFloat(req.query.a);
  const b = parseFloat(req.query.b);
  const op = (req.query.op || '').toLowerCase();

  if (isNaN(a) || isNaN(b)) {
    return res.status(400).json({ success: false, message: '"a" and "b" must be valid numbers' });
  }

  const ops = {
    add: () => a + b,
    subtract: () => a - b,
    sub: () => a - b,
    multiply: () => a * b,
    mul: () => a * b,
    divide: () => {
      if (b === 0) return null;
      return a / b;
    },
    div: () => {
      if (b === 0) return null;
      return a / b;
    },
    modulo: () => {
      if (b === 0) return null;
      return a % b;
    },
    mod: () => {
      if (b === 0) return null;
      return a % b;
    },
    power: () => Math.pow(a, b),
    pow: () => Math.pow(a, b),
  };

  if (!ops[op]) {
    return res.status(400).json({
      success: false,
      message: `Unknown operator "${op}". Supported: add, subtract(sub), multiply(mul), divide(div), modulo(mod), power(pow)`,
    });
  }

  const result = ops[op]();
  if (result === null) {
    return res.status(400).json({ success: false, message: 'Division by zero' });
  }

  res.json({
    success: true,
    data: { a, op, b, result: +result.toFixed(10) },
  });
});

// ===========================================================================
// 7. Logs  —  /api/logs
// ===========================================================================

// GET /api/logs — view request history (newest first)
app.get('/api/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const recent = logs.slice(-limit).reverse();
  res.json({ success: true, data: recent, total: logs.length });
});

// DELETE /api/logs — clear all logs
app.delete('/api/logs', (_req, res) => {
  const count = logs.length;
  logs = [];
  logNextId = 1;
  res.json({ success: true, message: `Cleared ${count} log entries` });
});

// ===========================================================================
// 8. Utility endpoints
// ===========================================================================

// GET /api/hello — simple greeting
app.get('/api/hello', (_req, res) => {
  res.json({ success: true, data: { message: 'Hello from the server!' } });
});

// POST /api/echo — echo back whatever was sent
app.post('/api/echo', (req, res) => {
  res.json({ success: true, data: req.body });
});

// GET /api/time — current server time
app.get('/api/time', (_req, res) => {
  const now = new Date();
  res.json({
    success: true,
    data: {
      iso: now.toISOString(),
      unix: now.getTime(),
      readable: now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    },
  });
});

// ===========================================================================
// 9. API Endpoints Directory  —  /api/endpoints
// ===========================================================================

// GET /api/endpoints — list all available API endpoints with descriptions
app.get('/api/endpoints', (_req, res) => {
  res.json({
    success: true,
    data: [
      // Items CRUD
      { method: 'GET', path: '/api/items', description: '아이템 전체 조회' },
      { method: 'GET', path: '/api/items/:id', description: '아이템 단건 조회' },
      { method: 'POST', path: '/api/items', description: '아이템 생성', body: '{ "name": "string" }' },
      { method: 'PUT', path: '/api/items/:id', description: '아이템 수정', body: '{ "name"?: "string", "done"?: boolean }' },
      { method: 'DELETE', path: '/api/items/:id', description: '아이템 삭제' },
      // Users CRUD
      { method: 'GET', path: '/api/users', description: '유저 전체 조회' },
      { method: 'GET', path: '/api/users/:id', description: '유저 단건 조회' },
      { method: 'POST', path: '/api/users', description: '유저 생성', body: '{ "name": "string", "email": "string" }' },
      { method: 'PUT', path: '/api/users/:id', description: '유저 수정', body: '{ "name"?: "string", "email"?: "string" }' },
      { method: 'DELETE', path: '/api/users/:id', description: '유저 삭제' },
      // Search
      { method: 'GET', path: '/api/search?q=keyword', description: 'items + users 키워드 검색' },
      // Stats
      { method: 'GET', path: '/api/stats', description: '전체 통계 (아이템, 유저, 로그, 서버 상태)' },
      // Random
      { method: 'GET', path: '/api/random', description: '랜덤 종합 (명언 + 색상 + 숫자 + UUID)' },
      { method: 'GET', path: '/api/random/quote', description: '랜덤 명언' },
      { method: 'GET', path: '/api/random/color', description: '랜덤 색상' },
      { method: 'GET', path: '/api/random/number?min=0&max=100', description: '범위 내 랜덤 숫자' },
      // Calculator
      { method: 'GET', path: '/api/calc?a=10&op=add&b=5', description: '계산기 (add, sub, mul, div, mod, pow)' },
      // Logs
      { method: 'GET', path: '/api/logs?limit=50', description: '요청 히스토리 조회 (최신순)' },
      { method: 'DELETE', path: '/api/logs', description: '로그 전체 삭제' },
      // Utility
      { method: 'GET', path: '/api/hello', description: '인사 메시지' },
      { method: 'POST', path: '/api/echo', description: '요청 body 그대로 반환', body: '{ ...anything }' },
      { method: 'GET', path: '/api/time', description: '서버 현재 시각' },
      // This endpoint
      { method: 'GET', path: '/api/endpoints', description: '이 API 목록' },
    ],
  });
});

// ===========================================================================
// Error handling
// ===========================================================================
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ===========================================================================
// Start / Export
// ===========================================================================
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
