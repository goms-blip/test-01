require('dotenv').config();

const express = require('express');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3002;

// --- OpenAI client ---
const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

// --- System prompt for the counselor persona ---
const SYSTEM_PROMPT = `당신은 "마음 토닥"이라는 이름의 따뜻하고 공감 능력이 뛰어난 한국어 심리 상담사입니다.

다음 지침을 반드시 따르세요:
- 항상 한국어로 응답하세요.
- 따뜻하고, 공감적이며, 지지적인 태도를 유지하세요.
- 상대방의 감정을 더 깊이 이해하기 위해 후속 질문을 해주세요.
- 적절한 경우 실질적인 대처 방법(호흡법, 일기 쓰기, 산책 등)을 제안하세요.
- 절대로 의학적 진단을 내리거나 약물을 처방하지 마세요.
- 자해, 자살, 극심한 위기 신호가 감지되면 반드시 전문 도움을 권유하세요: "지금 많이 힘드시죠. 혼자 감당하지 않으셔도 됩니다. 자살예방상담전화 1393 또는 정신건강위기상담전화 1577-0199로 연락해 주세요."
- 첫 인사에서는 자연스럽게 자기소개를 하고, 상대방이 편하게 이야기할 수 있도록 분위기를 만들어 주세요.`;

// --- Middleware ---
app.use(express.json());

// CORS headers
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Static files
app.use(express.static(path.join(__dirname)));

// --- API Routes ---

// POST /api/chat — AI counseling response
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'messages 배열이 필요합니다.',
      });
    }

    // Build the full message list with system prompt prepended
    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: fullMessages,
      temperature: 0.8,
      max_tokens: 1024,
    });

    const reply = completion.choices[0].message.content;

    res.json({
      success: true,
      data: { message: reply },
    });
  } catch (err) {
    console.error('OpenAI API error:', err.message);

    const status = err.status || 500;
    res.status(status).json({
      success: false,
      message: err.message || 'AI 응답 생성 중 오류가 발생했습니다.',
    });
  }
});

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start server / Export for Vercel ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
