// Vercel Serverless Function — GET /api/notion/tasks
// server.js 의 queryNotionDataSource 를 그대로 옮긴 버전.
// NOTION_TOKEN 은 Vercel 환경변수에만 저장됨 (클라이언트 노출 X).

const NOTION_DATA_SOURCE =
  process.env.NOTION_DATA_SOURCE || 'd97755ef-0242-4a7e-b873-d75ca9bde5d1';
const NOTION_VERSION = '2025-09-03';

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

export default async function handler(_req, res) {
  const NOTION_TOKEN = (process.env.NOTION_TOKEN || '').trim();
  if (!NOTION_TOKEN) {
    res.status(503).json({
      error: 'NOTION_TOKEN_MISSING',
      message: 'NOTION_TOKEN 환경변수가 설정되지 않았어요.',
      hint: 'Vercel 프로젝트 설정 → Environment Variables 에서 NOTION_TOKEN 추가 후 재배포.',
    });
    return;
  }
  try {
    const r = await fetch(
      `https://api.notion.com/v1/data_sources/${NOTION_DATA_SOURCE}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 100,
          sorts: [{ property: '날짜', direction: 'ascending' }],
        }),
      }
    );
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      res.status(502).json({
        error: 'NOTION_API_FAILED',
        message: `Notion HTTP ${r.status}`,
        detail: detail.slice(0, 400),
      });
      return;
    }
    const j = await r.json();
    const tasks = (j.results || []).map(normalizeNotionPage);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      source: 'live',
      databaseUrl: 'https://app.notion.com/p/c7a8cb04319447f78199aefd01aac44f',
      dataSourceId: NOTION_DATA_SOURCE,
      syncedAt: new Date().toISOString(),
      syncedBy: 'vercel-serverless · live Notion API',
      tasks,
    });
  } catch (e) {
    res.status(502).json({
      error: 'NOTION_FETCH_ERROR',
      message: e.message || String(e),
    });
  }
}
