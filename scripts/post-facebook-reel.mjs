import { fetchJson, findDailyPost, getBudapestIsoDate, graphRequest, requireCurrentMedia, waitForFacebookReel } from './social-publishing.mjs';

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v25.0';
const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || 'https://nevnap.app');
const PAGE_ID = process.env.FB_PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.FB_DRY_RUN === '1';
const ALLOW_STALE = process.env.FB_ALLOW_STALE === '1';

const socialContent = await fetchJson(`${SITE_URL}/social/today.json?ts=${Date.now()}`);
const expectedIso = getBudapestIsoDate();

if (!ALLOW_STALE && socialContent.date?.iso !== expectedIso) {
  throw new Error(
    `The deployed social content is stale: got ${socialContent.date?.iso ?? 'unknown'}, expected ${expectedIso}.`,
  );
}

const videoUrl = `${SITE_URL}/social/today-reel.mp4?v=${encodeURIComponent(socialContent.date.iso)}`;
const description = process.env.FB_REEL_DESCRIPTION_OVERRIDE || socialContent.facebookCaption;
const title =
  process.env.FB_REEL_TITLE_OVERRIDE ||
  `Mai névnap: ${(socialContent.primaryNames || ['NévnapTárX']).join(', ')}`;
await requireCurrentMedia(SITE_URL, 'reel', expectedIso);

if (DRY_RUN) {
  console.log('Facebook Reel dry run');
  console.log(JSON.stringify({ pageId: PAGE_ID || '<missing>', videoUrl, title, description }, null, 2));
  process.exit(0);
}

if (!PAGE_ID || !PAGE_ACCESS_TOKEN) {
  throw new Error('Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN environment variable.');
}

// Query videos, not photo posts: today's photo must not suppress the Reel.
const recent = await graphRequest(GRAPH_VERSION, PAGE_ACCESS_TOKEN, `/${PAGE_ID}/videos`, {
  fields: 'id,description,created_time,permalink_url', limit: '25',
});
const existing = findDailyPost(recent.data ?? [], description, expectedIso, 'facebook-reel');
if (existing) {
  console.log(`Today's Facebook Reel already exists: ${existing.permalink_url || existing.id}`);
  process.exit(0);
}

const session = await graphRequest(GRAPH_VERSION, PAGE_ACCESS_TOKEN, `/${PAGE_ID}/video_reels`, {
  upload_phase: 'start',
}, 'POST');

const videoId = session.video_id;
const uploadUrl = session.upload_url;

if (!videoId || !uploadUrl) {
  throw new Error(`Facebook did not return a Reel upload session: ${JSON.stringify(session)}`);
}

await uploadHostedVideo(uploadUrl, videoUrl);

const published = await graphRequest(GRAPH_VERSION, PAGE_ACCESS_TOKEN, `/${PAGE_ID}/video_reels`, {
  upload_phase: 'finish',
  video_id: videoId,
  video_state: 'PUBLISHED',
  title,
  description,
}, 'POST');

if (published.success !== true && !published.id && !published.video_id) {
  throw new Error(`Facebook Reel publish returned an unexpected response: ${JSON.stringify(published)}`);
}

console.log(`Facebook Reel accepted for publication: ${videoId}`);
await waitForFacebookReel(GRAPH_VERSION, PAGE_ACCESS_TOKEN, videoId);
console.log(`Published Facebook Reel: ${videoId}`);
try {
  const video = await graphRequest(GRAPH_VERSION, PAGE_ACCESS_TOKEN, `/${videoId}`, { fields: 'permalink_url' });
  console.log(`Facebook Reel permalink: ${video.permalink_url}`);
} catch {
  console.warn(`Reel published; permalink lookup unavailable. Video ID: ${videoId}`);
}

async function uploadHostedVideo(uploadUrl, fileUrl) {
  const target = new URL(uploadUrl);
  if (target.protocol !== 'https:' || target.hostname !== 'rupload.facebook.com') {
    throw new Error('Facebook returned an unexpected upload host.');
  }
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${PAGE_ACCESS_TOKEN}`,
      file_url: fileUrl,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error || payload.success === false) {
    const message = String(payload.error?.message || response.statusText).replaceAll(PAGE_ACCESS_TOKEN, '[REDACTED]');
    throw new Error(`Facebook Reel upload failed (${response.status}): ${message}`);
  }
}

function normalizeSiteUrl(input) {
  return input.replace(/\/+$/, '');
}
