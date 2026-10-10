import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { COVER_MS, DURATION, FPS, REEL_VERSION, pickTheme, prepareReelData, renderReelHtml } from '../scripts/reel-template.mjs';

const namedays = JSON.parse(readFileSync(new URL('../src/data/nevnapok.json', import.meta.url))).namedays;
const meanings = JSON.parse(readFileSync(new URL('../src/data/name_meanings.json', import.meta.url)));

test('new renderer has a valid cover frame, five scenes, and a stable version', () => {
  assert.ok(COVER_MS > 0 && COVER_MS < DURATION * 1000);
  assert.equal(DURATION * FPS, 345);
  assert.equal(REEL_VERSION, 'calendar-sheets-v1');
  const data = prepareReelData({ date: { iso: '2026-10-10' }, primaryNames: ['Gedeon'], secondaryNames: ['Ferenc'] }, { namedays, meanings });
  assert.equal(data.day, 10);
  assert.equal(data.yesterdayDay, 9);
  assert.match(data.tomorrow, /Brigitta/);
  const html = renderReelHtml({ data, theme: pickTheme('2026-10-10'), fontsDir: 'file:///fonts', iconSrc: 'file:///icon.png' });
  for (let scene = 1; scene <= 5; scene++) { assert.match(html, new RegExp(`id="s${scene}"`)); }
  assert.match(html, /window\.__seek/);
});

test('all 366 dates produce valid template data, including year rollover', () => {
  for (let day = 0; day < 366; day++) {
    const date = new Date(Date.UTC(2028, 0, 1 + day));
    const iso = date.toISOString().slice(0, 10);
    const entry = namedays.find((n) => n.month === date.getUTCMonth() + 1 && n.day === date.getUTCDate());
    const data = prepareReelData({ date: { iso }, primaryNames: entry?.primary ?? [], secondaryNames: entry?.secondary ?? [] }, { namedays, meanings });
    assert.ok(data.displayNames.length > 0, iso);
    assert.ok(data.meaningText.length > 0, iso);
    assert.equal(data.day, date.getUTCDate(), iso);
    assert.ok(pickTheme(iso).key, iso);
  }
  const data = prepareReelData({ date: { iso: '2026-01-01' }, primaryNames: [], secondaryNames: [] }, { namedays, meanings });
  assert.equal(data.yesterdayDay, 31);
});
