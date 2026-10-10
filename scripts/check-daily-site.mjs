import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../src/data/nevnapok.json', import.meta.url), 'utf8'));
const base = process.env.PUBLIC_SITE_URL || 'https://nevnap.app';

// Allow a short propagation window after deployment, but fail visibly if the
// live site is still static or disagrees with today's Budapest calendar date.
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [, month, day] = iso.split('-').map(Number);
    const expected = data.namedays.find(entry => entry.month === month && entry.day === day);
    for (const path of ['/', '/en/']) {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-nameday-date'), iso, `${path} is not using the current edge renderer`);
      const html = await response.text();
      assert.ok(html.includes(`datetime="${iso}"`), `${path} has an incorrect daily date`);
      const title = html.match(/<title>(.*?)<\/title>/s)?.[1] || '';
      for (const name of expected.primary) assert.ok(title.includes(name), `${path} title is missing ${name}`);
    }
    const social = await fetch(new URL('/social/today.json', base), { signal: AbortSignal.timeout(15000) });
    assert.equal((await social.json()).date.iso, iso);
    console.log(`Live nameday verified: ${iso}, ${expected.primary.join(', ')}`);
    break;
  } catch (error) {
    if (attempt === 6) throw error;
    console.log(`Waiting for deployment propagation (${attempt}/6).`);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
