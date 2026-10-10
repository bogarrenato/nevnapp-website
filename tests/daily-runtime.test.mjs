import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

let runtime;
before(async () => {
  const hu = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const en = await readFile(new URL('../dist/en/index.html', import.meta.url), 'utf8');
  const bundle = await build({
    stdin: {
      contents: `
        import { renderDailyResponse, onRequest } from './functions/_middleware.js';
        const shells = ${JSON.stringify({ hu, en })};
        export default { async fetch(request) {
          const url = new URL(request.url);
          const lang = url.searchParams.get('lang') || 'hu';
          const shell = new Response(shells[lang], {headers:{'Content-Type':'text/html', ETag:'old-build'}});
          // This clock override exists only in the test worker, never in production.
          if (url.searchParams.has('now')) return renderDailyResponse(shell, lang, new Date(url.searchParams.get('now')));
          return onRequest({request, next:async()=>shell});
        }};
      `,
      resolveDir: process.cwd(), sourcefile: 'daily-runtime-fixture.js',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser',
  });
  runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-08-06' });
});
after(async () => { await runtime?.dispose(); });

async function page(now, lang = 'hu') {
  const response = await runtime.dispatchFetch(`https://nevnap.app/?now=${encodeURIComponent(now)}&lang=${lang}`);
  assert.equal(response.status, 200);
  return response.text();
}

test('the same built shell changes at Budapest midnight, without a rebuild', async () => {
  const before = await page('2026-10-09T21:59:59Z');
  const after = await page('2026-10-09T22:00:00Z');
  assert.match(before, /Mai névnap: Dénes — Október 9\./);
  assert.match(after, /Mai névnap: Gedeon — Október 10\./);
  assert.match(after, /datetime="2026-10-10"/);
  assert.match(after, /Ma <span class="gradient-text">Gedeon<\/span> névnapja van/);
  assert.match(after, /data-upcoming-names="1"[^>]*>Brigitta</);
  assert.match(after, /href="\/name\/Gedeon"/);
  assert.match(after, /href="\/name\/Bendeg%C3%BAz"/);
  const schemas = [...after.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
  assert.match(schemas.find(s => s['@type'] === 'WebPage').name, /Gedeon/);
  assert.match(schemas.find(s => s['@type'] === 'FAQPage').mainEntity[0].acceptedAnswer.text, /október 10.*Gedeon/);
  assert.match(after, /property="og:title" content="Mai névnap: Gedeon/);
});

test('English content and upcoming links also change the next day', async () => {
  const html = await page('2026-10-10T22:00:00Z', 'en');
  assert.match(html, /<title>Today's Hungarian nameday: Brigitta/);
  assert.match(html, /Today is <span class="gradient-text">Brigitta<\/span>'s nameday/);
  assert.match(html, /datetime="2026-10-11"/);
  assert.match(html, /Today in Hungary, Brigitta celebrate their nameday/);
});

test('winter midnight and year rollover do not use a fixed UTC offset', async () => {
  const dec = await page('2026-12-31T22:59:59Z');
  const jan = await page('2026-12-31T23:00:00Z');
  assert.match(dec, /Mai névnap: Szilveszter — December 31\./);
  assert.match(dec, /data-upcoming-date="1" datetime="2027-01-01"/);
  assert.match(jan, /Mai névnap: Fruzsina — Január 1\./);
  assert.match(jan, /datetime="2027-01-01"/);
});

test('DST transition days have consistent Budapest dates', async () => {
  for (const now of ['2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z']) {
    assert.match(await page(now), /Mai névnap: Auguszta — Március 29\./);
  }
  for (const now of ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z']) {
    assert.match(await page(now), /Mai névnap: Blanka és Bianka — Október 25\./);
  }
});

test('leap day and an empty secondary list do not retain names from the build', async () => {
  const leap = await page('2028-02-29T12:00:00Z');
  assert.match(leap, /datetime="2028-02-29"/);
  assert.match(leap, /data-daily="year-days"[^>]*>366</);
  const data = JSON.parse(await readFile(new URL('../src/data/nevnapok.json', import.meta.url)));
  const day = data.namedays.find(d => !d.secondary.length);
  if (day) {
    const iso = `2026-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    const html = await page(`${iso}T12:00:00Z`);
    assert.match(html, /data-daily="secondary-section"[^>]*hidden/);
    assert.match(html, /data-daily="secondary-links"[^>]*><\/ul>/);
  }
});

test('HTTP responses never cache an old day or reuse the static-shell ETag', async () => {
  for (const path of ['/', '/en/', '/social/today.json', '/llms.txt', '/llms-full.txt']) {
    const response = await runtime.dispatchFetch(`https://nevnap.app${path}`, { headers: { 'If-None-Match': 'old-build' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('x-nameday-date'), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(response.headers.get('etag'), null);
    const body = await response.text();
    if (path === '/social/today.json') assert.equal(JSON.parse(body).date.iso, response.headers.get('x-nameday-date'));
    if (path.startsWith('/llms')) assert.ok(body.includes(response.headers.get('x-nameday-date')));
  }
  const head = await runtime.dispatchFetch('https://nevnap.app/', { method: 'HEAD' });
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('cache-control'), 'no-store');
});

test('alternate hosts and machine context retain their noindex policy', async () => {
  for (const url of ['https://preview.nevnap-website.pages.dev/', 'https://www.nevnap.app/', 'https://nevnap.app/llms.txt']) {
    const response = await runtime.dispatchFetch(url);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
  }
  const response = await runtime.dispatchFetch('https://nevnap.app/name/Gedeon/');
  assert.equal(response.headers.get('x-nameday-date'), null);
});
