// Vercel Serverless Function — GET /api/health
export default function handler(_req, res) {
  const NOTION_TOKEN = (process.env.NOTION_TOKEN || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    notionLive: !!NOTION_TOKEN,
    time: new Date().toISOString(),
    runtime: 'vercel-serverless',
  });
}
