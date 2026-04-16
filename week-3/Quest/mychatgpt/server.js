require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// API Keys
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const FAL_API_KEY = (process.env.FAL_API_KEY || '').trim();

// System prompt for 성질급한 곰 character
const SYSTEM_PROMPT = `너는 "성질급한 곰"이야. 다음 성격을 반드시 지켜:

성격:
- 말투가 거칠고 직설적이야. 반말을 기본으로 써.
- 성격이 급해서 빙빙 돌려 말하는 걸 싫어해.
- 하지만 속마음은 따뜻하고, 상대방을 진심으로 걱정해.
- 가끔 툴툴거리면서도 결국 도와주는 츤데레 같은 느낌.
- "흥", "뭐", "에이", "아 진짜" 같은 감탄사를 자주 써.

전문 분야:
- 디자인 (UI/UX, 그래픽, 브랜딩, 타이포그래피 등)에 특히 깊은 지식이 있어.
- 음식과 디저트에 대해 매우 해박해. 레시피, 맛집, 재료 지식이 풍부해.
- 그 외 다양한 분야에도 폭넓은 지식을 가지고 있어.

말투 예시:
- "아 뭐야, 그것도 모르냐? ...근데 모르면 알려줘야지 뭐."
- "에이, 그건 이렇게 하는 거야. 잘 들어."
- "흥, 내가 왜 이걸... 아 됐고, 들어봐."
- "진짜 답답하다... 자, 이렇게 해봐. 이번엔 제대로 해."

중요한 규칙:
- 너무 길게 말하지 마. 핵심만 딱딱 전달해.
- 질문에 대한 답을 줄 때는 정확하고 실용적으로.
- 상대가 힘들어하면 투덜거리면서도 위로해줘.
- 이모지는 최소한으로만 써.

사용자가 이미지 생성을 요청하면:
- "그림 그려줘", "이미지 만들어줘", "그려봐" 등의 요청에 반응해.
- 응답에 [IMAGE_REQUEST: 영어 프롬프트] 형식을 포함시켜.
- 예: "흥, 그림? 알았어. [IMAGE_REQUEST: a cute brown bear sitting in a cafe, watercolor style]"`;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Chat history (in-memory, per-session via client)
const chatSessions = new Map();

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, sessionId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: '메시지가 필요해, 뭐야!' });
    }

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: apiMessages,
        temperature: 0.8,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return res.status(response.status).json({ success: false, message: 'AI 응답 실패' });
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Check for image request in reply
    const imageMatch = reply.match(/\[IMAGE_REQUEST:\s*(.+?)\]/);
    let imageUrl = null;

    if (imageMatch) {
      try {
        imageUrl = await generateImage(imageMatch[1].trim());
      } catch (err) {
        console.error('Image generation failed:', err.message);
      }
    }

    const cleanReply = reply.replace(/\[IMAGE_REQUEST:\s*.+?\]/, '').trim();

    res.json({
      success: true,
      data: {
        reply: cleanReply,
        imageUrl
      }
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ success: false, message: '서버 에러났어... 다시 해봐.' });
  }
});

// Image generation with Fal AI
async function generateImage(prompt) {
  // Submit request
  const submitRes = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${FAL_API_KEY}`
    },
    body: JSON.stringify({
      prompt,
      image_size: 'square_hd',
      num_images: 1
    })
  });

  if (!submitRes.ok) {
    throw new Error(`Fal API submit failed: ${submitRes.status}`);
  }

  const submitData = await submitRes.json();

  // If direct result
  if (submitData.images && submitData.images.length > 0) {
    return submitData.images[0].url;
  }

  // If queued, poll for result
  const requestId = submitData.request_id;
  if (!requestId) throw new Error('No request_id from Fal');

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));

    const statusRes = await fetch(`https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${FAL_API_KEY}` }
    });

    const statusData = await statusRes.json();

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${FAL_API_KEY}` }
      });
      const resultData = await resultRes.json();
      if (resultData.images && resultData.images.length > 0) {
        return resultData.images[0].url;
      }
    }

    if (statusData.status === 'FAILED') {
      throw new Error('Image generation failed');
    }
  }

  throw new Error('Image generation timeout');
}

// POST /api/image (direct image generation)
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: '뭘 그리라는 건데!' });
    }

    const imageUrl = await generateImage(prompt);
    res.json({ success: true, data: { imageUrl } });
  } catch (err) {
    console.error('Image error:', err);
    res.status(500).json({ success: false, message: '그림 그리다 에러남...' });
  }
});

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
