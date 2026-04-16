require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

const FAL_API_KEY = (process.env.FAL_API_KEY || '').trim();
const FAL_API_URL = 'https://fal.run/fal-ai/flux/dev';

const STYLE_PREFIX = 'A beautiful painterly artwork of ';
const STYLE_SUFFIX = ', vivid rich colors, expressive brushstrokes, vibrant colorful palette, masterful oil painting, high detail, 8k';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── API Routes ────────────────────────────────────────────────

// POST /api/generate — generate an image via Fal AI
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'prompt is required and must be a non-empty string' });
    }

    if (!FAL_API_KEY) {
      return res.status(500).json({ success: false, message: 'FAL_API_KEY is not configured' });
    }

    const userPrompt = prompt.trim();

    // Translate Korean prompt to English description for better image quality
    let basePrompt = userPrompt;
    const hasKorean = /[가-힣]/.test(userPrompt);
    if (hasKorean) {
      try {
        const translateRes = await fetch('https://fal.run/fal-ai/any-llm', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${FAL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            prompt: `You are an expert image prompt writer. Convert the following Korean text into a detailed, vivid English image generation prompt. Rules:
- If it references a well-known character, story, or cultural reference (e.g. "장화신은 고양이" = "Puss in Boots"), use the proper English name and describe the character visually in detail.
- Add specific visual details: pose, setting, lighting, mood, composition.
- Output ONLY the English prompt, nothing else.

Korean: ${userPrompt}`,
          }),
        });
        if (translateRes.ok) {
          const translateData = await translateRes.json();
          const translated = (translateData.output || '').trim();
          if (translated) basePrompt = translated;
        }
      } catch (_) { /* use original if translation fails */ }
    }

    const enhancedPrompt = STYLE_PREFIX + basePrompt + STYLE_SUFFIX;

    const falResponse = await fetch(FAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        image_size: 'landscape_16_9',
        num_images: 1,
      }),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      return res.status(falResponse.status).json({
        success: false,
        message: `Fal API error (${falResponse.status}): ${errorText}`,
      });
    }

    const data = await falResponse.json();

    res.json({ success: true, data: { images: data.images || [] } });
  } catch (err) {
    console.error('Image generation failed:', err.message);
    res.status(500).json({ success: false, message: 'Image generation failed: ' + err.message });
  }
});

// ─── SPA Fallback ──────────────────────────────────────────────

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start / Export ────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
