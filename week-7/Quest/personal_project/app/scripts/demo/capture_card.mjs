// Capture business card front/back as PNGs at print-quality resolution.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CARD_BASE_URL || 'http://localhost:4173';
const OUT_DIR = resolve(__dirname, '../../../../Business_card_digital');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shotFace(page, file, faceSelector) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await wait(800);
  // Pause shimmer animation so the screenshot is stable.
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  const el = page.locator(faceSelector).first();
  await el.screenshot({ path: file, omitBackground: false });
  console.log('saved', file);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2, // retina
  locale: 'ko-KR',
});
const page = await context.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

// Hide ambient chrome (toggle, action bar, hints) for a clean card shot.
await page.addStyleTag({ content: `
  .flip-hint, header, footer, [aria-label*="다크"], [aria-label*="라이트"],
  button[aria-label*="toggle"] { visibility: hidden !important; }
` });

// Front
await shotFace(page, resolve(OUT_DIR, 'card_front.png'), '.flip-inner');

// Flip via the explicit toolbar button (exact match — there's also a card-wrapper role=button)
await page.getByRole('button', { name: '뒷면 보기', exact: true }).click();
await wait(1100); // wait out the 0.85s flip transition
await shotFace(page, resolve(OUT_DIR, 'card_back.png'), '.flip-inner');

await browser.close();
console.log('done');
