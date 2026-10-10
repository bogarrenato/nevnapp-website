import { COVER_MS, REEL_VERSION } from './reel-template.mjs';
import { fetchJson, findDailyPost, getBudapestIsoDate, graphRequest, requireCurrentMedia } from './social-publishing.mjs';

const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v25.0';
const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || 'https://nevnap.app');
const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.IG_DRY_RUN === '1';
const ALLOW_STALE = process.env.IG_ALLOW_STALE === '1';
const REPUBLISH = process.env.SOCIAL_REPUBLISH === '1';

const socialContent = await fetchJson(`${SITE_URL}/social/today.json?ts=${Date.now()}`);
const expectedIso = getBudapestIsoDate();

if (!ALLOW_STALE && socialContent.date?.iso !== expectedIso) {
  throw new Error(
    `The deployed social content is stale: got ${socialContent.date?.iso ?? 'unknown'}, expected ${expectedIso}.`,
  );
}

const media = await requireCurrentMedia(SITE_URL, 'reel', expectedIso, REEL_VERSION);
const videoUrl =
  process.env.IG_REEL_VIDEO_URL_OVERRIDE ||
  `${SITE_URL}/social/today-reel.mp4?v=${encodeURIComponent(`${socialContent.date.iso}-${media.reelSha256}`)}`;
const caption = process.env.IG_CAPTION_OVERRIDE || socialContent.facebookCaption;

if (DRY_RUN) {
  console.log('Instagram Reel dry run');
  console.log(JSON.stringify({ igUserId: IG_USER_ID || '<missing>', videoUrl, caption }, null, 2));
  process.exit(0);
}

if (!IG_USER_ID || !ACCESS_TOKEN) {
  throw new Error('Missing IG_USER_ID or IG_ACCESS_TOKEN environment variable.');
}

const recent = await graphRequest(GRAPH_VERSION, ACCESS_TOKEN, `/${IG_USER_ID}/media`, {
  fields: 'id,caption,timestamp,permalink', limit: '25',
});
const existing = findDailyPost(recent.data ?? [], caption, expectedIso, 'instagram');
if (existing && !REPUBLISH) {
  console.log(`Today's Instagram Reel already exists: ${existing.permalink || existing.id}`);
  process.exit(0);
}

const container = await graphRequest(GRAPH_VERSION, ACCESS_TOKEN, `/${IG_USER_ID}/media`, {
  media_type: 'REELS',
  video_url: videoUrl,
  caption,
  share_to_feed: 'true',
  // Frame 0 still shows yesterday's calendar sheet; use the name scene as the cover.
  thumb_offset: String(process.env.IG_THUMB_OFFSET_MS || COVER_MS),
}, 'POST');

const containerId = container.id;
if (!containerId) {
  throw new Error(`Instagram did not return a container id: ${JSON.stringify(container)}`);
}

await waitForContainer(containerId);

const published = await graphRequest(GRAPH_VERSION, ACCESS_TOKEN, `/${IG_USER_ID}/media_publish`, {
  creation_id: containerId,
}, 'POST');

console.log(`Published Instagram Reel: ${published.id}`);
try {
  const media = await graphRequest(GRAPH_VERSION, ACCESS_TOKEN, `/${published.id}`, { fields: 'permalink' });
  console.log(`Instagram permalink: ${media.permalink}`);
} catch {
  console.warn('Reel published; permalink lookup unavailable.');
}

async function waitForContainer(containerId) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const status = await graphRequest(GRAPH_VERSION, ACCESS_TOKEN, `/${containerId}`, { fields: 'status_code,status' });

    if (status.status_code === 'FINISHED') { return; }
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram container failed: ${JSON.stringify(status)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error(`Instagram container ${containerId} did not finish processing in time.`);
}

function normalizeSiteUrl(input) {
  return input.replace(/\/+$/, '');
}
