// 60-second desktop demo recording for o_house_v2.
// Flow: 홈 → 로그인 → 스토어(카테고리) → 상품 상세 → 결제 위젯
// Requires the Next.js dev server running at http://localhost:3000.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');
const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3000';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoothScroll(page, total, durationMs) {
  const steps = 30;
  const stepMs = durationMs / steps;
  const stepPx = total / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((p) => window.scrollBy({ top: p, behavior: 'instant' }), stepPx);
    await wait(stepMs);
  }
}

async function moveCursorTo(page, selector, opts = {}) {
  const el = await page.locator(selector).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: opts.steps ?? 18 });
  return { x, y };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const VIEWPORT = { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'ko-KR',
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  // ── 0–5s: 홈
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await wait(2800);
  await smoothScroll(page, 500, 1800);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await wait(700);

  // ── 5–9s: 로그인 페이지로 이동 (헤더 로그인 링크 클릭)
  const loginLink = page.locator('a[href="/login"]').first();
  if (await loginLink.count()) {
    await moveCursorTo(page, 'a[href="/login"]');
    await wait(500);
    await loginLink.click();
  } else {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  }
  await page.waitForLoadState('networkidle');
  await wait(2500);

  // ── 9–16s: 데모 빠른 로그인 ("홈데코로 로그인")
  const quickBtn = page.getByRole('button', { name: /홈데코로 로그인/ });
  await quickBtn.scrollIntoViewIfNeeded().catch(() => {});
  await moveCursorTo(page, 'button:has-text("홈데코로 로그인")');
  await wait(1300);
  await quickBtn.click();
  // 홈으로 리다이렉트 대기
  await page.waitForURL(`${BASE}/`, { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await wait(2800);

  // ── 16–22s: 스토어 진입
  const storeLink = page.locator('a[href="/store"]').first();
  if (await storeLink.count()) {
    await moveCursorTo(page, 'a[href="/store"]');
    await wait(500);
    await storeLink.click();
  } else {
    await page.goto(`${BASE}/store`, { waitUntil: 'networkidle' });
  }
  await page.waitForLoadState('networkidle');
  await wait(2200);
  await smoothScroll(page, 400, 1600);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await wait(800);

  // ── 22–27s: 카테고리 칩 하나 클릭 (있으면 첫 번째 비-"전체" 칩)
  const chip = page.locator('a.chip').nth(1); // 0번이 "전체"
  if (await chip.count()) {
    await moveCursorTo(page, 'a.chip >> nth=1');
    await wait(700);
    await chip.click();
    await page.waitForLoadState('networkidle');
    await wait(2200);
  } else {
    await wait(2200);
  }

  // ── 27–34s: 상품 카드 클릭 → 상품 상세
  const card = page.locator('a[href^="/product/"]').first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await moveCursorTo(page, 'a[href^="/product/"]');
  await wait(800);
  await card.click();
  await page.waitForLoadState('networkidle');
  await wait(2400);
  await smoothScroll(page, 300, 1500);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await wait(800);

  // ── 34–38s: "바로 구매" 클릭 → 결제 페이지
  const buy = page.getByRole('link', { name: /바로 구매/ });
  await moveCursorTo(page, 'a:has-text("바로 구매")');
  await wait(900);
  await buy.click();
  await page.waitForLoadState('networkidle');

  // ── 38–58s: 결제 페이지 — 토스 위젯 로드/스크롤
  // 위젯은 iframe 형태로 마운트되므로 약간 시간이 필요
  await page.waitForSelector('#pm-widget', { timeout: 15000 }).catch(() => {});
  await wait(4500);
  await smoothScroll(page, 700, 4200);
  await wait(1800);
  await smoothScroll(page, 500, 3200);
  await wait(1800);

  // ── 58–62s: "결제하기" 버튼 강조 (호버) — 실제 결제창은 띄우지 않음
  const payBtn = page.getByRole('button', { name: /결제하기/ });
  if (await payBtn.count()) {
    await payBtn.scrollIntoViewIfNeeded().catch(() => {});
    await moveCursorTo(page, 'button:has-text("결제하기")', { steps: 30 });
    await wait(3500);
  } else {
    await wait(3500);
  }

  await context.close();
  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
