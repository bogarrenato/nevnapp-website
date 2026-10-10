import { fetchJson, findDailyPost, getBudapestIsoDate, graphRequest, requireCurrentMedia } from './social-publishing.mjs';

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v22.0';
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

const imageUrl = `${SITE_URL}/social/today.png?v=${encodeURIComponent(socialContent.date.iso)}`;
const caption = process.env.FB_CAPTION_OVERRIDE || socialContent.facebookCaption;
await requireCurrentMedia(SITE_URL, 'image', expectedIso);

if (DRY_RUN) {
  console.log('Facebook post dry run');
  console.log(JSON.stringify({ pageId: PAGE_ID || '<missing>', imageUrl, caption }, null, 2));
  process.exit(0);
}

if (!PAGE_ID || !PAGE_ACCESS_TOKEN) {
  throw new Error('Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN environment variable.');
}

const recent = await graphRequest(GRAPH_VERSION, PAGE_ACCESS_TOKEN, `/${PAGE_ID}/posts`, {
  fields: 'id,message,created_time,permalink_url', limit: '25',
});
const existing = findDailyPost(recent.data ?? [], caption, expectedIso, 'facebook');
if (existing) {
  console.log(`Today's Facebook post already exists: ${existing.permalink_url || existing.id}`);
  process.exit(0);
}

const payload = await graphRequest(GRAPH_VERSION, PAGE_ACCESS_TOKEN, `/${PAGE_ID}/photos`, {
  url: imageUrl,
  caption,
  published: 'true',
}, 'POST');

console.log(`Published Facebook photo post: ${payload.post_id || payload.id}`);

try {
  const post = await graphRequest(GRAPH_VERSION, PAGE_ACCESS_TOKEN, `/${payload.post_id || payload.id}`, {
    fields: 'permalink_url',
  });
  console.log(`Facebook permalink: ${post.permalink_url}`);
} catch {
  console.warn('Post published; permalink lookup unavailable.');
}

function normalizeSiteUrl(input) {
  return input.replace(/\/+$/, '');
}
