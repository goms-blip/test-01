// Vercel Serverless Function — /api/imagekit-auth
//
// ImageKit 클라이언트 업로드용 인증 파라미터 발급.
// private key 는 서버에만 두고, 클라이언트에는 token/signature/expire 만 내려줌.
//
// docs: https://docs.imagekit.io/api-reference/upload-file-api/client-side-file-upload
//
// 이 엔드포인트는 admin 만 호출하도록 호출자에서 별도 보호 (관리자 페이지에서만 호출).
// 키 자체로는 업로드만 가능하고 DB write 권한은 없으므로 노출되어도 위험 < 결제키.

const crypto = require('crypto');

function generateAuth(privateKey) {
  const token = crypto.randomUUID();
  // 만료시간 — 30분 (초 단위 Unix timestamp). ImageKit 권장 max 1시간.
  const expire = Math.floor(Date.now() / 1000) + 60 * 30;
  // HMAC-SHA1(token + expire, privateKey) 의 hex
  const signature = crypto
    .createHmac('sha1', privateKey)
    .update(token + expire)
    .digest('hex');
  return { token, expire, signature };
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();
  const publicKey = (process.env.IMAGEKIT_PUBLIC_KEY || '').trim();
  const urlEndpoint = (process.env.IMAGEKIT_URL_ENDPOINT || '').trim();

  if (!privateKey || !publicKey || !urlEndpoint) {
    return res.status(500).json({
      error: 'imagekit_env_missing',
      detail: 'IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT 가 모두 필요합니다.',
    });
  }

  const auth = generateAuth(privateKey);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    ...auth,
    publicKey,
    urlEndpoint,
  });
};

// Vercel(ESM) + Express(CJS) 양쪽 호환
module.exports.default = module.exports;
