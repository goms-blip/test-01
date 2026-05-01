// 나만의 AI 대시보드 — 정적 + 실시간 Notion 프록시 서버
// 사용:  PORT=5731 NOTION_TOKEN=secret_xxx node server.js
//        (NOTION_TOKEN 미설정 시 정적 JSON 으로 fallback)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5731', 10);
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const NOTION_DATA_SOURCE = process.env.NOTION_DATA_SOURCE || 'd97755ef-0242-4a7e-b873-d75ca9bde5d1';
const NOTION_VERSION = '2025-09-03';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function sendJSON(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

// Notion property -> 우리가 쓰는 형식으로 정규화
function normalizeNotionPage(p) {
  const props = p.properties || {};
  const title = props['일정명']?.title?.[0]?.plain_text || '제목 없음';
  const dateProp = props['날짜']?.date || {};
  const status = props['상태']?.status?.name || '시작 전';
  const category = props['카테고리']?.select?.name || '기타';
  const location = props['장소']?.rich_text?.map((t) => t.plain_text).join('') || '';
  const memo = props['메모']?.rich_text?.map((t) => t.plain_text).join('') || '';
  return {
    id: p.id,
    title,
    category,
    status,
    location,
    memo,
    startUtc: dateProp.start || null,
    endUtc: dateProp.end || null,
    url: p.url,
    allDay: !!(dateProp.start && !dateProp.start.includes('T')),
  };
}

async function queryNotionDataSource() {
  // Notion API 2025-09-03+ uses /v1/data_sources/{id}/query
  const url = `https://api.notion.com/v1/data_sources/${NOTION_DATA_SOURCE}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      page_size: 100,
      sorts: [{ property: '날짜', direction: 'ascending' }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Notion HTTP ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const j = await res.json();
  return (j.results || []).map(normalizeNotionPage);
}

// Nominatim 역지오코딩 프록시 (User-Agent 헤더 필수)
async function reverseGeocodeProxy(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko&zoom=10`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'personal-ai-dashboard/1.0 (demo)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error('Nominatim HTTP ' + res.status);
  return res.json();
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(u.pathname);

  // ---------- API: GET /api/notion/tasks ----------
  if (req.method === 'GET' && pathname === '/api/notion/tasks') {
    if (!NOTION_TOKEN) {
      return sendJSON(res, 503, {
        error: 'NOTION_TOKEN_MISSING',
        message: 'NOTION_TOKEN 환경변수가 설정되지 않았어요. 정적 JSON 으로 fallback 해주세요.',
        hint: 'https://www.notion.so/my-integrations 에서 Internal Integration 만들고 「주간, 월간 일정관리」 DB에 권한을 부여한 뒤 NOTION_TOKEN=secret_xxx 로 서버를 실행하세요.',
      });
    }
    try {
      const tasks = await queryNotionDataSource();
      return sendJSON(res, 200, {
        source: 'live',
        databaseUrl: 'https://app.notion.com/p/c7a8cb04319447f78199aefd01aac44f',
        dataSourceId: NOTION_DATA_SOURCE,
        syncedAt: new Date().toISOString(),
        syncedBy: 'server.js · live Notion API',
        tasks,
      });
    } catch (e) {
      return sendJSON(res, 502, { error: 'NOTION_API_FAILED', message: e.message });
    }
  }

  // ---------- API: GET /api/geocode/reverse?lat=&lon= ----------
  if (req.method === 'GET' && pathname === '/api/geocode/reverse') {
    const lat = parseFloat(u.searchParams.get('lat'));
    const lon = parseFloat(u.searchParams.get('lon'));
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return sendJSON(res, 400, { error: 'lat/lon 필수' });
    }
    try {
      const j = await reverseGeocodeProxy(lat, lon);
      const a = j.address || {};
      return sendJSON(res, 200, {
        cityName: a.city || a.town || a.county || a.province || a.state || a.country || null,
        country: a.country || null,
        full: j.display_name || null,
      });
    } catch (e) {
      return sendJSON(res, 502, { error: e.message });
    }
  }

  // ---------- API: GET /api/health ----------
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJSON(res, 200, {
      ok: true,
      notionLive: !!NOTION_TOKEN,
      time: new Date().toISOString(),
    });
  }

  // ---------- 정적 파일 서빙 ----------
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  // 디렉터리 traversal 방지
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); return res.end('forbidden');
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=300',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`✨ AI Dashboard 서버: http://localhost:${PORT}`);
  console.log(`   · 정적: index.html / *.json / screenshot/*`);
  console.log(`   · API : /api/notion/tasks  (live: ${NOTION_TOKEN ? '✅' : '❌ NOTION_TOKEN 미설정'})`);
  console.log(`   · API : /api/geocode/reverse?lat=&lon=`);
  console.log(`   · API : /api/health`);
});
