// Regression tests for the responsive header: on a phone nothing the header
// opens may leave the viewport, and the support (Ko-fi) link is always visible
// right next to the menu button. Run after `npm run build`:
//   node --test tests/responsive-header.test.mjs
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
let server, browser, origin;

before(async () => {
  server = createServer(async (req, res) => {
    try {
      let file = join(dist, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      if (!file.startsWith(dist.replace(/\/$/, ''))) throw new Error('outside dist');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function open(width, height, path = '/') {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  // Third-party scripts are irrelevant here and unreachable offline.
  await context.route((url) => !url.href.startsWith(origin), (route) => route.abort());
  await context.addInitScript(() => { try { localStorage.setItem('nevnap-consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() })); } catch {} });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(origin + path, { waitUntil: 'load' });
  return page;
}
const box = (page, selector) => page.locator(selector).first().boundingBox();
const settled = (page) => page.waitForTimeout(700);

for (const width of [320, 360, 375, 390, 430]) {
  test(`${width}px: page and open menu stay inside the viewport`, async () => {
    const page = await open(width, 800);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(await overflow(), 0, 'the page scrolls horizontally');

    await page.click('[data-menu-toggle]');
    await settled(page);
    const menu = await box(page, '#site-menu');
    assert.ok(menu, 'menu panel is not rendered');
    assert.ok(menu.x >= 0, `menu starts off-screen at x=${menu.x}`);
    assert.ok(menu.x + menu.width <= width, `menu ends off-screen at ${menu.x + menu.width}`);
    assert.equal(await overflow(), 0, 'opening the menu causes horizontal scroll');
    await page.context().close();
  });

  test(`${width}px: support link sits beside the menu button, both tappable`, async () => {
    const page = await open(width, 800);
    const kofi = await box(page, 'header a[href*="ko-fi.com"]');
    const toggle = await box(page, '[data-menu-toggle]');
    assert.ok(kofi && toggle, 'support link or menu button is missing from the header');
    assert.ok(kofi.width >= 44 && kofi.height >= 44, 'support link is smaller than 44px');
    assert.ok(kofi.x >= 0 && kofi.x + kofi.width <= width, 'support link is off-screen');
    assert.ok(Math.abs(kofi.y - toggle.y) < 4, 'support link is not on the menu row');
    assert.ok(toggle.x - (kofi.x + kofi.width) <= 16, 'support link is not adjacent to the menu button');
    await page.context().close();
  });

  test(`${width}px: download panel stays inside the viewport`, async () => {
    const page = await open(width, 800);
    await page.click('header [data-download-trigger]');
    await settled(page);
    const sheet = await box(page, '#download-sheet [role="dialog"]');
    assert.ok(sheet, 'download sheet is not rendered');
    assert.ok(sheet.x >= 0 && sheet.x + sheet.width <= width, 'download sheet is wider than the screen');
    assert.ok(sheet.y + sheet.height <= 800 + 1, 'download sheet is below the screen');
    assert.equal(await page.locator('#download-sheet a[href*="apps.apple.com"]').count(), 1);
    assert.equal(await page.locator('#download-sheet a[href*="play.google.com"]').count(), 1);
    await page.keyboard.press('Escape');
    await settled(page);
    assert.equal(await page.locator('#download-sheet').isHidden(), true, 'Escape does not close the sheet');
    await page.context().close();
  });
}

test('desktop: full navigation, labelled support link, anchored download popover', async () => {
  const page = await open(1440, 900);
  assert.equal(await page.locator('[data-menu-toggle]').isVisible(), false);
  assert.equal(await page.locator('header nav a[href="/names"]').first().isVisible(), true);
  assert.match(await page.locator('header a[href*="ko-fi.com"]').first().innerText(), /Támogass/);
  await page.click('header [data-download-trigger]');
  await settled(page);
  const pop = await box(page, 'header [data-download-menu]');
  assert.ok(pop && pop.x >= 0 && pop.x + pop.width <= 1440, 'download popover leaves the viewport');
  await page.context().close();
});
test('inner pages keep the same header behaviour', async () => {
  const page = await open(375, 800, '/names/');
  await page.click('[data-menu-toggle]');
  await settled(page);
  const menu = await box(page, '#site-menu');
  assert.ok(menu.x >= 0 && menu.x + menu.width <= 375);
  assert.ok(await box(page, 'header a[href*="ko-fi.com"]'));
  await page.context().close();
});

// Inner pages share the system: none of them may scroll sideways on a phone,
// and the sticky jump bars (letters, months) must stay inside the screen.
for (const path of ['/names/', '/calendar/', '/name/Brigitta/', '/day/10-13/', '/blog/', '/blog/mi-a-nevnap/', '/contact/', '/privacy/', '/en/']) {
  test(`375px: ${path} fits the viewport`, async () => {
    const page = await open(375, 800, path);
    await settled(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `${path} scrolls horizontally by ${overflow}px`);
    const jump = await page.locator('[data-jump]').count() ? await box(page, '[data-jump]') : null;
    if (jump) assert.ok(jump.x >= 0 && jump.x + jump.width <= 375, 'jump bar leaves the viewport');
    await page.context().close();
  });
}

test('jump bar follows the section being read', async () => {
  const page = await open(375, 800, '/names/');
  await page.evaluate(() => document.getElementById('letter-M')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(900);
  assert.equal(await page.locator('[data-jump] a[aria-current="true"]').innerText(), 'M');
  await page.context().close();
});
