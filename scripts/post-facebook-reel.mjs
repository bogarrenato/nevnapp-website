const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v25.0';
const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || 'https://www.nevnap.app');
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

if (DRY_RUN) {
  console.log('Facebook Reel dry run');
  console.log(JSON.stringify({ pageId: PAGE_ID || '<missing>', videoUrl, title, description }, null, 2));
  process.exit(0);
}

if (!PAGE_ID || !PAGE_ACCESS_TOKEN) {
  throw new Error('Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN environment variable.');
}

const session = await graphPost(`/${PAGE_ID}/video_reels`, {
  upload_phase: 'start',
  access_token: PAGE_ACCESS_TOKEN,
});

const videoId = session.video_id;
const uploadUrl = session.upload_url;

if (!videoId || !uploadUrl) {
  throw new Error(`Facebook did not return a Reel upload session: ${JSON.stringify(session)}`);
}

await uploadHostedVideo(uploadUrl, videoUrl);

const published = await graphPost(`/${PAGE_ID}/video_reels`, {
  upload_phase: 'finish',
  video_id: videoId,
  video_state: 'PUBLISHED',
  title,
  description,
  access_token: PAGE_ACCESS_TOKEN,
});

if (published.success !== true && !published.id && !published.video_id) {
  throw new Error(`Facebook Reel publish returned an unexpected response: ${JSON.stringify(published)}`);
}

console.log(`Published Facebook Reel: ${published.id || published.video_id || videoId}`);

async function uploadHostedVideo(uploadUrl, fileUrl) {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${PAGE_ACCESS_TOKEN}`,
      file_url: fileUrl,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error || payload.success === false) {
    const message = payload.error?.message || response.statusText;
    throw new Error(`Facebook Reel upload failed (${response.status}): ${message}`);
  }
}

async function graphPost(path, params) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    body: new URLSearchParams(params),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const message = payload.error?.message || response.statusText;
    throw new Error(`Facebook Reels API error (${response.status}): ${message}`);
  }

  return payload;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalizeSiteUrl(input) {
  return input.replace(/\/+$/, '');
}

function getBudapestIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
