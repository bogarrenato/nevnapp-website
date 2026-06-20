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

if (DRY_RUN) {
  console.log('Facebook post dry run');
  console.log(JSON.stringify({ pageId: PAGE_ID || '<missing>', imageUrl, caption }, null, 2));
  process.exit(0);
}

if (!PAGE_ID || !PAGE_ACCESS_TOKEN) {
  throw new Error('Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN environment variable.');
}

const body = new URLSearchParams({
  url: imageUrl,
  caption,
  published: 'true',
  access_token: PAGE_ACCESS_TOKEN,
});

const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/photos`, {
  method: 'POST',
  body,
});
const payload = await response.json().catch(() => ({}));

if (!response.ok || payload.error) {
  const message = payload.error?.message || response.statusText;
  throw new Error(`Facebook publish failed (${response.status}): ${message}`);
}

console.log(`Published Facebook photo post: ${payload.post_id || payload.id}`);

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
