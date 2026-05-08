#!/usr/bin/env node
// gen-thumbnails.js — 6개 콘텐츠 썸네일을 FAL flux/schnell로 생성하여 public/thumbnails/{id}.jpg에 저장
// 한 번만 실행하면 됨. 이미 파일이 있으면 스킵.

const fs = require('fs');
const path = require('path');

// .env 로더 (의존성 없이)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const KEY = (process.env.FAL_API_KEY || '').trim();
if (!KEY) {
  console.error('FAL_API_KEY missing. Add it to mini_app/.env');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'public', 'thumbnails');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROMPTS = [
  {
    id: 'c1',
    prompt:
      'top-down close-up of golden madeleines fresh out of the oven on a wooden board, ' +
      'visible bumps, light dust of powdered sugar, warm soft natural light, ' +
      'editorial food photography, shallow depth of field, 4:3',
  },
  {
    id: 'c2',
    prompt:
      'three small linen sacks of flour side by side on a rustic kitchen counter, ' +
      'labels showing soft / all-purpose / bread, wooden scoops, ' +
      'warm bakery lighting, editorial food photography, 4:3',
  },
  {
    id: 'c3',
    prompt:
      'two small ceramic bowls with white powders side by side, ' +
      'one labeled baking soda one labeled baking powder, lemon and vinegar bottle nearby, ' +
      'clean white kitchen counter, soft natural light, minimal flatlay, 4:3',
  },
  {
    id: 'c4',
    prompt:
      'three blocks of fat side by side on parchment paper: ' +
      'a yellow butter block, a pale margarine block, a white shortening block, ' +
      'soft warm light, professional food photography, 4:3',
  },
  {
    id: 'c5',
    prompt:
      'whipped cream peaks in a chilled stainless steel bowl, soft and glossy, ' +
      'a metal whisk lifting up cream with stiff peaks, vanilla pod nearby, ' +
      'bright clean kitchen, editorial food photography, 4:3',
  },
  {
    id: 'c6',
    prompt:
      'an open home oven with a tray of baked goods inside, warm orange glow, ' +
      'an oven thermometer hanging on the rack, cozy home kitchen, ' +
      'cinematic light, editorial food photography, 4:3',
  },
];

async function genOne({ id, prompt }) {
  const out = path.join(OUT_DIR, `${id}.jpg`);
  if (fs.existsSync(out) && fs.statSync(out).size > 1024) {
    console.log(`[skip] ${id} already exists`);
    return;
  }
  console.log(`[gen]  ${id} ...`);

  const r = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      Authorization: `Key ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_4_3',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: false,
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`FAL ${r.status} for ${id}: ${txt.slice(0, 200)}`);
  }

  const json = await r.json();
  const url = json.images?.[0]?.url;
  if (!url) throw new Error(`No image URL for ${id}: ${JSON.stringify(json).slice(0, 200)}`);

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`download failed for ${id}: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log(`[ok]   ${id} -> ${out} (${buf.length} bytes)`);
}

(async () => {
  for (const p of PROMPTS) {
    try {
      await genOne(p);
    } catch (err) {
      console.error(`[fail] ${p.id}:`, err.message);
      process.exitCode = 1;
    }
  }
})();
