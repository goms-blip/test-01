const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());

// CORS headers
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Static files (index.html, client.js, etc.)
app.use(express.static(path.join(__dirname)));

// ── In-Memory Data ─────────────────────────────────────────
const pokemon = [
  {
    id: 25,
    name: { ko: '피카츄', en: 'Pikachu' },
    types: [{ ko: '전기', en: 'electric' }],
    stats: { hp: 35, attack: 55, defense: 40, speed: 90 },
    description: '꼬리를 세우고 전기를 느끼면 뺨의 전기 주머니에서 전기가 나온다.',
    image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
  },
  {
    id: 6,
    name: { ko: '리자몽', en: 'Charizard' },
    types: [{ ko: '불꽃', en: 'fire' }],
    stats: { hp: 78, attack: 84, defense: 78, speed: 100 },
    description: '지상 1400미터 상공까지 날아올라 높은 온도의 불꽃을 내뿜는다.',
    image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png',
  },
  {
    id: 9,
    name: { ko: '거북왕', en: 'Blastoise' },
    types: [{ ko: '물', en: 'water' }],
    stats: { hp: 79, attack: 83, defense: 100, speed: 78 },
    description: '등껍질의 분사구에서 로켓처럼 물을 뿜어 콘크리트 벽도 부순다.',
    image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9.png',
  },
  {
    id: 3,
    name: { ko: '이상해꽃', en: 'Venusaur' },
    types: [{ ko: '풀', en: 'grass' }, { ko: '독', en: 'poison' }],
    stats: { hp: 80, attack: 82, defense: 83, speed: 80 },
    description: '태양 에너지를 양분으로 하여 등의 커다란 꽃에서 기분 좋은 향기가 난다.',
    image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/3.png',
  },
  {
    id: 150,
    name: { ko: '뮤츠', en: 'Mewtwo' },
    types: [{ ko: '에스퍼', en: 'psychic' }],
    stats: { hp: 106, attack: 110, defense: 90, speed: 130 },
    description: '유전자 조작으로 만들어진 포켓몬. 인간의 과학력으로 몸은 만들었지만 마음까지는 만들 수 없었다.',
    image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png',
  },
];

// ── API Routes ─────────────────────────────────────────────

// Search Pokemon by name (ko/en) or type (ko/en)
// Must be defined BEFORE /api/pokemon/:id to avoid "search" matching as :id
app.get('/api/pokemon/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();

    if (!q) {
      return res.json({ success: true, data: pokemon });
    }

    const results = pokemon.filter((p) => {
      const nameMatch =
        p.name.ko.toLowerCase().includes(q) ||
        p.name.en.toLowerCase().includes(q);
      const typeMatch = p.types.some(
        (t) => t.ko.toLowerCase().includes(q) || t.en.toLowerCase().includes(q)
      );
      return nameMatch || typeMatch;
    });

    return res.json({ success: true, data: results });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all Pokemon
app.get('/api/pokemon', (_req, res) => {
  try {
    res.json({ success: true, data: pokemon });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get single Pokemon by id
app.get('/api/pokemon/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Pokemon ID' });
    }

    const found = pokemon.find((p) => p.id === id);

    if (!found) {
      return res.status(404).json({ success: false, message: 'Pokemon not found' });
    }

    return res.json({ success: true, data: found });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── SPA Fallback (Express 5 syntax) ───────────────────────
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start Server / Export for Vercel ───────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pokemon API server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
