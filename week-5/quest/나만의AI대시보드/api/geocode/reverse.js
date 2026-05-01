// Vercel Serverless Function — GET /api/geocode/reverse?lat=&lon=
// Nominatim 이 User-Agent 헤더 정책을 요구하므로 서버 측에서 프록시.

export default async function handler(req, res) {
  const { lat: latStr, lon: lonStr } = req.query || {};
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ error: 'lat / lon required' });
    return;
  }
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko&zoom=10`,
      {
        headers: {
          'User-Agent': 'personal-ai-dashboard/1.0 (vercel)',
          Accept: 'application/json',
        },
      }
    );
    if (!r.ok) {
      res.status(502).json({ error: `Nominatim HTTP ${r.status}` });
      return;
    }
    const j = await r.json();
    const a = j.address || {};
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json({
      cityName:
        a.city || a.town || a.county || a.province || a.state || a.country || null,
      country: a.country || null,
      full: j.display_name || null,
    });
  } catch (e) {
    res.status(502).json({ error: e.message || String(e) });
  }
}
