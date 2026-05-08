require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');
const ImageKit = require('imagekit');

// ----------------------------------------
// Environment validation (fail loudly)
// ----------------------------------------
const PUBLIC_KEY = (process.env.IMAGEKIT_PUBLIC_KEY || '').trim();
const PRIVATE_KEY = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();
const URL_ENDPOINT = (process.env.IMAGEKIT_URL_ENDPOINT || '').trim();

const missing = [];
if (!PUBLIC_KEY) missing.push('IMAGEKIT_PUBLIC_KEY');
if (!PRIVATE_KEY) missing.push('IMAGEKIT_PRIVATE_KEY');
if (!URL_ENDPOINT) missing.push('IMAGEKIT_URL_ENDPOINT');

if (missing.length) {
  console.error('[server] Missing required env vars:', missing.join(', '));
  console.error('[server] Copy .env.example to .env and fill in your ImageKit credentials.');
  process.exit(1);
}

// Reject obvious placeholder values
if (PUBLIC_KEY.includes('your_public_key') || PRIVATE_KEY.includes('your_private_key')) {
  console.error('[server] Refusing to start with placeholder ImageKit keys. Edit .env with real values.');
  process.exit(1);
}

// ----------------------------------------
// App init
// ----------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

const imagekit = new ImageKit({
  publicKey: PUBLIC_KEY,
  privateKey: PRIVATE_KEY,
  urlEndpoint: URL_ENDPOINT,
});

// JSON body parser (small payloads only — uploads use multer)
app.use(express.json({ limit: '1mb' }));

// Static files (index.html, client.js, anything else in project root)
app.use(express.static(path.join(__dirname)));

// Multer in-memory storage with 15MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ----------------------------------------
// Routes
// ----------------------------------------

// 1) Auth params for client-side direct upload
app.get('/api/imagekit/auth', (_req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    res.json({
      ...authParams,
      publicKey: PUBLIC_KEY,
      urlEndpoint: URL_ENDPOINT,
    });
  } catch (err) {
    console.error('[server] Failed to generate auth params:', err);
    res.status(500).json({ error: 'Failed to generate ImageKit auth parameters' });
  }
});

// 2) Server-side proxy upload (fallback)
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      console.error('[server] Multer error:', err.code || err.message);
      return res.status(status).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided (expected field "file")' });
    }

    try {
      const result = await imagekit.upload({
        file: req.file.buffer,
        fileName: req.file.originalname,
        folder: '/uploads',
      });
      res.json(result);
    } catch (uploadErr) {
      console.error('[server] ImageKit upload failed:', uploadErr.message || uploadErr);
      res.status(500).json({ error: uploadErr.message || 'Upload failed' });
    }
  });
});

// Generic error handler (last resort)
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ----------------------------------------
// Start
// ----------------------------------------
app.listen(PORT, () => {
  console.log(`[server] Image upload server running on http://localhost:${PORT}`);
  console.log(`[server] ImageKit endpoint: ${URL_ENDPOINT}`);
});

module.exports = app;
