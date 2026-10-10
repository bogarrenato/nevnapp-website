import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { findDailyPost, getBudapestIsoDate, graphRequest, requireCurrentMedia, waitForFacebookReel } from '../scripts/social-publishing.mjs';

test('Budapest date changes at local midnight in summer and winter', () => {
  assert.equal(getBudapestIsoDate(new Date('2026-10-09T22:01:00Z')), '2026-10-10');
  assert.equal(getBudapestIsoDate(new Date('2026-12-31T23:01:00Z')), '2027-01-01');
});

test('deduplicate the daily nameday header even when caption details change', () => {
  const caption = '📅 Ma, október 10. Gedeon névnapja van.\nNew text';
  const post = { id: 'one', message: caption.split('\n')[0] + '\nOld text', created_time: '2026-10-10T04:00:00Z' };
  assert.equal(findDailyPost([post], caption, '2026-10-10', 'facebook'), post);
  const media = { id: 'two', caption, timestamp: '2026-10-09T22:01:00Z' };
  assert.equal(findDailyPost([media], caption, '2026-10-10', 'instagram'), media);
  assert.equal(findDailyPost([post], caption, '2026-10-11', 'facebook'), undefined);
  assert.equal(findDailyPost([{ ...post, message: 'Other post' }], caption, '2026-10-10', 'facebook'), undefined);
});

test('a current dynamic JSON cannot allow an old image or missing reel', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ imageDate: '2026-10-09', reelDate: null }));
  await assert.rejects(requireCurrentMedia('https://nevnap.app', 'image', '2026-10-10'), /image is stale/);
  await assert.rejects(requireCurrentMedia('https://nevnap.app', 'reel', '2026-10-10'), /reel is stale/);
});

test('current static image and video manifests are accepted', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ imageDate: '2026-10-10', reelDate: '2026-10-10' }));
  await requireCurrentMedia('https://nevnap.app', 'image', '2026-10-10');
  await requireCurrentMedia('https://nevnap.app', 'reel', '2026-10-10');
});

test('a rebuilt video must use the new renderer version before republishing', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ reelDate: '2026-10-10' }));
  await assert.rejects(requireCurrentMedia('https://nevnap.app', 'reel', '2026-10-10', 'calendar-sheets-v1'), /renderer is outdated/);
  const manifest = { reelDate: '2026-10-10', reelVersion: 'calendar-sheets-v1', reelSha256: 'abc123' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(manifest));
  assert.deepEqual(await requireCurrentMedia('https://nevnap.app', 'reel', '2026-10-10', 'calendar-sheets-v1'), manifest);
});

test('Meta reads use bearer auth, not a credential-bearing URL', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.searchParams.has('access_token'), false);
    assert.equal(options.headers.Authorization, 'Bearer secret-token');
    return Response.json({ data: [] });
  });
  assert.deepEqual(await graphRequest('v25.0', 'secret-token', '/account/media', { limit: '25' }), { data: [] });
});

test('Meta API failures surface the error code but redact credentials', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code: 190, message: 'Expired secret-token' } }, { status: 400 }));
  await assert.rejects(graphRequest('v25.0', 'secret-token', '/account/media', {}), (error) => {
    assert.match(error.message, /code 190/);
    assert.equal(error.message.includes('secret-token'), false);
    return true;
  });
});

test('Facebook Reel deduplication does not mistake a photo for a video', () => {
  const caption = '📅 Ma, október 10. Gedeon névnapja van.';
  const photo = { message: caption, created_time: '2026-10-10T04:00:00Z' };
  assert.equal(findDailyPost([photo], caption, '2026-10-10', 'facebook-reel'), undefined);
  const video = { description: caption, created_time: photo.created_time, id: 'reel' };
  assert.equal(findDailyPost([video], caption, '2026-10-10', 'facebook-reel'), video);
});

test('Facebook waits for confirmed publishing, not just accepted upload', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: {
    publishing_phase: { status: ++calls === 1 ? 'in_progress' : 'complete' },
  } }));
  await waitForFacebookReel('v25.0', 'secret-token', 'video', { attempts: 2, delayMs: 0 });
  assert.equal(calls, 2);
});

test('Facebook surfaces processing failures and unconfirmed publication', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: { video_status: 'error' } }));
  await assert.rejects(waitForFacebookReel('v25.0', 'secret-token', 'video'), /failed during processing/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: { video_status: 'processing' } }));
  await assert.rejects(waitForFacebookReel('v25.0', 'secret-token', 'video', { attempts: 1 }), /did not confirm publication/);
});

test('Facebook daily workflow publishes video; photos have no schedule', () => {
  const photo = readFileSync(new URL('../.github/workflows/facebook-daily-post.yml', import.meta.url), 'utf8');
  const reel = readFileSync(new URL('../.github/workflows/facebook-daily-reel.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(photo, /^  schedule:/m);
  assert.match(reel, /^  schedule:/m);
  assert.match(reel, /npm run facebook:reel/);
  assert.doesNotMatch(reel, /npm run facebook:post/);
  assert.match(reel, /workflow: facebook-daily-reel.yml/);
});
