const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const { fal } = require('@fal-ai/client');

// .env 로드 (로컬 실행 시)
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch {}

const app = express();
const PORT = process.env.PORT || 3010;

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

// Fal AI 설정
fal.config({ credentials: (process.env.FAL_KEY || '').trim() });

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── 인메모리 데이터 저장소 ──
let history = [];
let nextId = 1;

// ── API: 별명 생성 + 캐릭터 이미지 ──
app.post('/api/generate-nickname', async (req, res) => {
  try {
    const { name, personality, hobby } = req.body;

    if (!name || !personality || !hobby) {
      return res.status(400).json({
        success: false,
        message: '이름, 성격, 취미를 모두 입력해주세요.',
      });
    }

    // ── 1) 별명 생성 (OpenAI) ──
    const nicknamePrompt = `너는 친구들 사이에서 별명 짓기로 유명한 센스쟁이다.
네가 지은 별명은 한번 들으면 바로 외워지고, 자꾸 부르고 싶어지는 중독성이 있다.

사용자 정보:
- 이름: ${name}
- 성격: ${personality}
- 취미: ${hobby}

다음 JSON 형식으로만 응답 (다른 텍스트 없이):
{
  "nicknames": [
    { "nickname": "별명1", "reason": "이유" },
    { "nickname": "별명2", "reason": "이유" },
    { "nickname": "별명3", "reason": "이유" },
    { "nickname": "별명4", "reason": "이유" },
    { "nickname": "별명5", "reason": "이유" }
  ],
  "character_prompt": "이 사람을 표현하는 캐릭터 일러스트 프롬프트 (영어, 1문장)"
}

별명 생성 규칙:
1. 한국어로! 입으로 소리 내서 읽었을 때 부르기 쉽고 귀에 착 감겨야 한다
2. 이름에서 글자를 따거나, 발음을 살짝 바꾸거나, 운율을 맞추는 식으로 (예: 민수→민수르, 지은→지으니, 승훈→훈이삼촌)
3. 친구가 실제로 불러줄 법한 자연스러운 별명이어야 한다. 어색하면 탈락
4. 각 별명은 다른 느낌:
   - 😄 웃긴 별명: 듣는 순간 빵 터지는 (예: 코딩충민수, 게임하다죽을지은, 산악회장훈)
   - 🥰 귀여운 별명: 부르면 기분 좋아지는 (예: 민수댕댕, 훈이방울, 지으닝)
   - 😎 쿨한 별명: 폼나는데 자연스러운 (예: 민수형, 코드훈, 지은프로)
   - 🎯 찰떡 별명: 성격이나 취미가 딱 드러나는 (예: 등산민수, 게임신훈, 책벌레지은)
   - 🤣 드립 별명: 말장난/라임이 들어간 (예: 민수가좋수, 훈훈한훈이, 지은이지은거)
5. 특수문자, 영어 섞기, 대문자 남발 금지! 한글 위주로 깔끔하게
6. character_prompt는 이 사람의 성격+취미를 반영한 귀여운 캐릭터 묘사 (영어)
7. 이유는 재치있고 웃기게 1문장으로`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: nicknamePrompt }],
      temperature: 1.0,
      max_tokens: 800,
    });

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return res.status(500).json({
        success: false,
        message: 'AI 응답을 파싱하는 데 실패했습니다.',
      });
    }

    // ── 2) 캐릭터 이미지 생성 (Fal AI) ──
    let imageUrl = null;
    try {
      const charPrompt = parsed.character_prompt ||
        `anime style character, ${personality} personality, hobby is ${hobby}, colorful, dynamic pose`;

      const result = await fal.subscribe('fal-ai/flux/schnell', {
        input: {
          prompt: `high quality anime character illustration, single character, vibrant colors, detailed, ${charPrompt}, purple and blue gradient background, digital art, trending on artstation`,
          image_size: 'square',
          num_images: 1,
        },
      });

      if (result.data && result.data.images && result.data.images.length > 0) {
        imageUrl = result.data.images[0].url;
      }
    } catch (err) {
      console.error('Fal image generation error:', err.message);
      // 이미지 생성 실패해도 별명은 정상 반환
    }

    // 히스토리 저장
    const record = {
      id: nextId++,
      name,
      personality,
      hobby,
      nicknames: parsed.nicknames,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    history.unshift(record);
    if (history.length > 50) history = history.slice(0, 50);

    res.json({ success: true, data: record });
  } catch (err) {
    console.error('Nickname generation error:', err.message);
    res.status(500).json({
      success: false,
      message: 'AI 별명 생성 중 오류가 발생했습니다.',
    });
  }
});

// ── API: 히스토리 조회 ──
app.get('/api/history', (_req, res) => {
  res.json({ success: true, data: history });
});

// ── API: 히스토리 삭제 ──
app.delete('/api/history', (_req, res) => {
  history = [];
  nextId = 1;
  res.json({ success: true, message: '히스토리가 초기화되었습니다.' });
});

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 로컬 / Vercel 듀얼 모드
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
