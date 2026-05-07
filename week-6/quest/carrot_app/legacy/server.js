// server.js — 당근마켓 클론 백엔드 (인메모리 데모)
//
// PRD: week-6/quest/carrot_app/prd.md
// Supabase 권장 스택을 인메모리로 우회 구현. 동일한 API 형태를 유지해
// 추후 Supabase Auth/DB/Storage/Realtime로 교체 가능하도록 설계.
//
// 보안/소유권 (RLS 시뮬레이션):
//  - 모든 보호 API는 Authorization: Bearer <token> 또는 쿠키 토큰 검사.
//  - 상품 수정/삭제는 작성자(seller_id === me.id)만 허용.
//  - 채팅방 메시지 조회/전송은 buyer 또는 seller 본인만 허용.

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3030;
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────
// 인메모리 데이터베이스
// ─────────────────────────────────────────────────────────────
const db = {
  users: [],          // { id, email, password, nickname, region, created_at }
  sessions: {},       // token -> user_id
  products: [],       // { id, seller_id, title, price, description, category, images[], region, status, created_at }
  favorites: [],      // { user_id, product_id }
  chatRooms: [],      // { id, product_id, buyer_id, seller_id, created_at }
  messages: [],       // { id, room_id, sender_id, text, created_at }
};
let seq = { user: 1, product: 1, room: 1, msg: 1 };

const CATEGORIES = ['디지털기기', '생활가전', '가구/인테리어', '의류', '도서', '뷰티/미용', '스포츠/레저', '기타'];

// ─────────────────────────────────────────────────────────────
// 시드 — 빠른 시연을 위한 더미 데이터
// ─────────────────────────────────────────────────────────────
function seed() {
  const u1 = createUser({ email: 'alice@test.com', password: '1234', nickname: '앨리스', region: '강남구 역삼동' });
  const u2 = createUser({ email: 'bob@test.com',   password: '1234', nickname: '밥',     region: '강남구 역삼동' });
  const u3 = createUser({ email: 'carol@test.com', password: '1234', nickname: '캐롤',   region: '서초구 반포동' });

  createProduct(u1.id, {
    title: '아이폰 14 Pro 256GB 딥퍼플',
    price: 850000,
    description: '약 1년 사용. 생활기스 약간, 배터리 92%. 박스/케이블 모두 있어요.',
    category: '디지털기기',
    images: [],
    region: u1.region,
  });
  createProduct(u1.id, {
    title: '이케아 책상 (LINNMON 100x60)',
    price: 25000,
    description: '이사로 처분합니다. 직거래만 가능 (역삼역).',
    category: '가구/인테리어',
    images: [],
    region: u1.region,
  });
  createProduct(u2.id, {
    title: '나이키 에어맥스 270 (270mm)',
    price: 60000,
    description: '몇 번 안 신었어요. 박스 없음.',
    category: '의류',
    images: [],
    region: u2.region,
  });
  createProduct(u3.id, {
    title: '한강뷰 캠핑의자 2개',
    price: 30000,
    description: '세트로만 판매합니다.',
    category: '스포츠/레저',
    images: [],
    region: u3.region,
  });
}

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────
function now() { return new Date().toISOString(); }
function newToken() { return crypto.randomBytes(24).toString('hex'); }

function createUser({ email, password, nickname, region }) {
  const u = {
    id: seq.user++,
    email: String(email).toLowerCase().trim(),
    password,
    nickname: nickname || email.split('@')[0],
    region: region || '',
    created_at: now(),
  };
  db.users.push(u);
  return u;
}

function createProduct(seller_id, { title, price, description, category, images, region }) {
  const p = {
    id: seq.product++,
    seller_id,
    title,
    price: Number(price) || 0,
    description: description || '',
    category: category || '기타',
    images: Array.isArray(images) ? images : [],
    region: region || '',
    status: 'on_sale', // on_sale | reserved | sold
    created_at: now(),
  };
  db.products.push(p);
  return p;
}

function getUserByToken(token) {
  if (!token) return null;
  const uid = db.sessions[token];
  if (!uid) return null;
  return db.users.find((u) => u.id === uid) || null;
}

function pickToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, nickname: u.nickname, region: u.region };
}

function publicProduct(p) {
  if (!p) return null;
  const seller = db.users.find((u) => u.id === p.seller_id);
  const fav_count = db.favorites.filter((f) => f.product_id === p.id).length;
  return {
    ...p,
    seller: publicUser(seller),
    fav_count,
  };
}

function authRequired(req, res, next) {
  const token = pickToken(req);
  const me = getUserByToken(token);
  if (!me) return res.status(401).json({ error: 'unauthorized' });
  req.me = me;
  next();
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────
app.post('/api/auth/signup', (req, res) => {
  const { email, password, nickname, region } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: '이메일/비밀번호 필수' });
  const exists = db.users.find((u) => u.email === String(email).toLowerCase().trim());
  if (exists) return res.status(409).json({ error: '이미 가입된 이메일' });
  const u = createUser({ email, password, nickname, region });
  const token = newToken();
  db.sessions[token] = u.id;
  res.json({ token, user: publicUser(u) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.users.find((x) => x.email === String(email || '').toLowerCase().trim());
  if (!u || u.password !== password) return res.status(401).json({ error: '이메일/비밀번호 불일치' });
  const token = newToken();
  db.sessions[token] = u.id;
  res.json({ token, user: publicUser(u) });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  const token = pickToken(req);
  if (token) delete db.sessions[token];
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.me) });
});

app.patch('/api/auth/region', authRequired, (req, res) => {
  const { region } = req.body || {};
  if (!region) return res.status(400).json({ error: 'region 필수' });
  req.me.region = String(region).trim();
  res.json({ user: publicUser(req.me) });
});

// ─────────────────────────────────────────────────────────────
// Storage (이미지 업로드)
// ─────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('이미지 파일만 가능'));
    cb(null, true);
  },
});

app.post('/api/upload', authRequired, upload.array('images', 3), (req, res) => {
  const urls = (req.files || []).map((f) => `/uploads/${f.filename}`);
  res.json({ urls });
});

// ─────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const { q, category, region } = req.query;
  let list = db.products.slice();
  if (category && category !== '전체') list = list.filter((p) => p.category === category);
  if (region) list = list.filter((p) => (p.region || '').includes(String(region)));
  if (q) {
    const kw = String(q).toLowerCase();
    list = list.filter((p) =>
      p.title.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw)
    );
  }
  list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json({ items: list.map(publicProduct), categories: CATEGORIES });
});

app.get('/api/products/:id', (req, res) => {
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json({ item: publicProduct(p) });
});

app.post('/api/products', authRequired, (req, res) => {
  const { title, price, description, category, images } = req.body || {};
  if (!title || price == null) return res.status(400).json({ error: '제목/가격 필수' });
  if (Array.isArray(images) && images.length > 3) return res.status(400).json({ error: '이미지는 최대 3장' });
  const p = createProduct(req.me.id, {
    title, price, description, category, images,
    region: req.me.region,
  });
  res.json({ item: publicProduct(p) });
});

app.patch('/api/products/:id', authRequired, (req, res) => {
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'not found' });
  // RLS: 작성자만 수정 가능
  if (p.seller_id !== req.me.id) return res.status(403).json({ error: 'forbidden' });
  const { title, price, description, category, images, status } = req.body || {};
  if (title !== undefined) p.title = String(title);
  if (price !== undefined) p.price = Number(price) || 0;
  if (description !== undefined) p.description = String(description);
  if (category !== undefined) p.category = String(category);
  if (Array.isArray(images)) p.images = images.slice(0, 3);
  if (status && ['on_sale', 'reserved', 'sold'].includes(status)) p.status = status;
  res.json({ item: publicProduct(p) });
});

app.delete('/api/products/:id', authRequired, (req, res) => {
  const idx = db.products.findIndex((x) => x.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  // RLS: 작성자만 삭제 가능
  if (db.products[idx].seller_id !== req.me.id) return res.status(403).json({ error: 'forbidden' });
  db.products.splice(idx, 1);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// Favorites (관심)
// ─────────────────────────────────────────────────────────────
app.post('/api/products/:id/favorite', authRequired, (req, res) => {
  const pid = Number(req.params.id);
  const p = db.products.find((x) => x.id === pid);
  if (!p) return res.status(404).json({ error: 'not found' });
  const idx = db.favorites.findIndex((f) => f.product_id === pid && f.user_id === req.me.id);
  let favorited;
  if (idx >= 0) {
    db.favorites.splice(idx, 1);
    favorited = false;
  } else {
    db.favorites.push({ user_id: req.me.id, product_id: pid });
    favorited = true;
  }
  res.json({ favorited, fav_count: db.favorites.filter((f) => f.product_id === pid).length });
});

app.get('/api/me/favorites', authRequired, (req, res) => {
  const ids = db.favorites.filter((f) => f.user_id === req.me.id).map((f) => f.product_id);
  const items = db.products.filter((p) => ids.includes(p.id)).map(publicProduct);
  res.json({ items });
});

// ─────────────────────────────────────────────────────────────
// Chat (1:1, polling 기반 "실시간")
// ─────────────────────────────────────────────────────────────
app.post('/api/chat/rooms', authRequired, (req, res) => {
  const { product_id } = req.body || {};
  const p = db.products.find((x) => x.id === Number(product_id));
  if (!p) return res.status(404).json({ error: 'product not found' });
  if (p.seller_id === req.me.id) return res.status(400).json({ error: '본인 상품과는 채팅 불가' });
  let room = db.chatRooms.find(
    (r) => r.product_id === p.id && r.buyer_id === req.me.id && r.seller_id === p.seller_id
  );
  if (!room) {
    room = {
      id: seq.room++,
      product_id: p.id,
      buyer_id: req.me.id,
      seller_id: p.seller_id,
      created_at: now(),
    };
    db.chatRooms.push(room);
  }
  res.json({ room: enrichRoom(room) });
});

app.get('/api/chat/rooms', authRequired, (req, res) => {
  const list = db.chatRooms
    .filter((r) => r.buyer_id === req.me.id || r.seller_id === req.me.id)
    .map(enrichRoom)
    .sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
  res.json({ items: list });
});

app.get('/api/chat/rooms/:id/messages', authRequired, (req, res) => {
  const room = db.chatRooms.find((r) => r.id === Number(req.params.id));
  if (!room) return res.status(404).json({ error: 'not found' });
  if (room.buyer_id !== req.me.id && room.seller_id !== req.me.id)
    return res.status(403).json({ error: 'forbidden' });
  const since = Number(req.query.since || 0);
  const msgs = db.messages
    .filter((m) => m.room_id === room.id && m.id > since)
    .sort((a, b) => a.id - b.id);
  res.json({ room: enrichRoom(room), messages: msgs });
});

app.post('/api/chat/rooms/:id/messages', authRequired, (req, res) => {
  const room = db.chatRooms.find((r) => r.id === Number(req.params.id));
  if (!room) return res.status(404).json({ error: 'not found' });
  if (room.buyer_id !== req.me.id && room.seller_id !== req.me.id)
    return res.status(403).json({ error: 'forbidden' });
  const text = String((req.body && req.body.text) || '').trim();
  if (!text) return res.status(400).json({ error: 'text 필수' });
  const m = { id: seq.msg++, room_id: room.id, sender_id: req.me.id, text, created_at: now() };
  db.messages.push(m);
  res.json({ message: m });
});

function enrichRoom(r) {
  const product = db.products.find((p) => p.id === r.product_id);
  const buyer = publicUser(db.users.find((u) => u.id === r.buyer_id));
  const seller = publicUser(db.users.find((u) => u.id === r.seller_id));
  const msgs = db.messages.filter((m) => m.room_id === r.id);
  const last = msgs[msgs.length - 1] || null;
  return {
    id: r.id,
    product: product ? { id: product.id, title: product.title, price: product.price, images: product.images } : null,
    buyer,
    seller,
    last_message: last ? last.text : '',
    last_at: last ? last.created_at : r.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// MyPage 보조 (내가 등록한 상품 등)
// ─────────────────────────────────────────────────────────────
app.get('/api/me/products', authRequired, (req, res) => {
  const items = db.products
    .filter((p) => p.seller_id === req.me.id)
    .map(publicProduct)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json({ items });
});

// ─────────────────────────────────────────────────────────────
// Categories meta
// ─────────────────────────────────────────────────────────────
app.get('/api/meta', (_req, res) => {
  res.json({ categories: CATEGORIES });
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error('[ERR]', err.message);
  res.status(400).json({ error: err.message });
});

seed();
app.listen(PORT, () => {
  console.log(`🥕 Carrot clone ready → http://localhost:${PORT}`);
  console.log('   demo accounts: alice@test.com / bob@test.com / carol@test.com  (pw: 1234)');
});
