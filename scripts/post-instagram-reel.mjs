const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v25.0';
const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || 'https://www.nevnap.app');
const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.IG_DRY_RUN === '1';
const ALLOW_STALE = process.env.IG_ALLOW_STALE === '1';

const socialContent = await fetchJson(`${SITE_URL}/social/today.json?ts=${Date.now()}`);
const expectedIso = getBudapestIsoDate();

if (!ALLOW_STALE && socialContent.date?.iso !== expectedIso) {
  throw new Error(
    `The deployed social content is stale: got ${socialContent.date?.iso ?? 'unknown'}, expected ${expectedIso}.`,
  );
}

const videoUrl = `${SITE_URL}/social/today-reel.mp4?v=${encodeURIComponent(socialContent.date.iso)}`;
const caption = process.env.IG_CAPTION_OVERRIDE || socialContent.facebookCaption;

if (DRY_RUN) {
  console.log('Instagram Reel dry run');
  console.log(JSON.stringify({ igUserId: IG_USER_ID || '<missing>', videoUrl, caption }, null, 2));
  process.exit(0);
}

if (!IG_USER_ID || !ACCESS_TOKEN) {
  throw new Error('Missing IG_USER_ID or IG_ACCESS_TOKEN environment variable.');
}

const container = await graphPost(`/${IG_USER_ID}/media`, {
  media_type: 'REELS',
  video_url: videoUrl,
  caption,
  share_to_feed: 'true',
  access_token: ACCESS_TOKEN,
});

const containerId = container.id;
if (!containerId) {
  throw new Error(`Instagram did not return a container id: ${JSON.stringify(container)}`);
}

await waitForContainer(containerId);

const published = await graphPost(`/${IG_USER_ID}/media_publish`, {
  creation_id: containerId,
  access_token: ACCESS_TOKEN,
});

console.log(`Published Instagram Reel: ${published.id}`);

async function waitForContainer(containerId) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const status = await fetchJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
    );

    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram container failed: ${JSON.stringify(status)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error(`Instagram container ${containerId} did not finish processing in time.`);
}

async function graphPost(path, params) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    body: new URLSearchParams(params),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const message = payload.error?.message || response.statusText;
    throw new Error(`Instagram API error (${response.status}): ${message}`);
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
