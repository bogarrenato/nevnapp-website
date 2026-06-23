const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v25.0';
const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || 'https://www.nevnap.app');
const GROUP_ID = process.env.FB_GROUP_ID;
const ACCESS_TOKEN = process.env.FB_GROUP_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.FB_GROUP_DRY_RUN === '1';
const ALLOW_STALE = process.env.FB_GROUP_ALLOW_STALE === '1';
const POST_FORMAT = process.env.FB_GROUP_POST_FORMAT || 'video';
const DISABLE_FALLBACK = process.env.FB_GROUP_DISABLE_FALLBACK === '1';

const socialContent = await fetchJson(`${SITE_URL}/social/today.json?ts=${Date.now()}`);
const expectedIso = getBudapestIsoDate();

if (!ALLOW_STALE && socialContent.date?.iso !== expectedIso) {
  throw new Error(
    `The deployed social content is stale: got ${socialContent.date?.iso ?? 'unknown'}, expected ${expectedIso}.`,
  );
}

const imageUrl = `${SITE_URL}/social/today.png?v=${encodeURIComponent(socialContent.date.iso)}`;
const videoUrl = `${SITE_URL}/social/today-reel.mp4?v=${encodeURIComponent(socialContent.date.iso)}`;
const caption = process.env.FB_GROUP_CAPTION_OVERRIDE || socialContent.facebookCaption;
const title =
  process.env.FB_GROUP_VIDEO_TITLE_OVERRIDE ||
  `Mai névnap: ${(socialContent.primaryNames || ['NévnapTárX']).join(', ')}`;

if (DRY_RUN) {
  console.log('Facebook group post dry run');
  console.log(
    JSON.stringify(
      {
        groupId: GROUP_ID || '<missing>',
        hasAccessToken: Boolean(ACCESS_TOKEN),
        postFormat: POST_FORMAT,
        videoUrl,
        imageUrl,
        title,
        caption,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!GROUP_ID) {
  throw new Error('Missing FB_GROUP_ID environment variable.');
}

if (!ACCESS_TOKEN) {
  throw new Error('Missing FB_GROUP_ACCESS_TOKEN or FB_PAGE_ACCESS_TOKEN environment variable.');
}

if (POST_FORMAT === 'video') {
  try {
    const video = await graphPost(`/${GROUP_ID}/videos`, {
      file_url: videoUrl,
      title,
      description: caption,
      access_token: ACCESS_TOKEN,
    });
    console.log(`Published Facebook group video post: ${video.post_id || video.id}`);
    process.exit(0);
  } catch (videoError) {
    if (DISABLE_FALLBACK) {
      throw videoError;
    }
    console.warn(`Facebook group video post failed, trying photo fallback: ${videoError.message}`);
  }
}

try {
  await publishPhoto();
} catch (photoError) {
  if (DISABLE_FALLBACK) {
    throw photoError;
  }
  console.warn(`Facebook group photo post failed, trying feed fallback: ${photoError.message}`);

  const feed = await graphPost(`/${GROUP_ID}/feed`, {
    message: `${caption}\n\n${SITE_URL}/`,
    link: SITE_URL,
    access_token: ACCESS_TOKEN,
  });
  console.log(`Published Facebook group feed post: ${feed.id}`);
}

async function publishPhoto() {
  const photo = await graphPost(`/${GROUP_ID}/photos`, {
    url: imageUrl,
    caption,
    published: 'true',
    access_token: ACCESS_TOKEN,
  });
  console.log(`Published Facebook group photo post: ${photo.post_id || photo.id}`);
}

async function graphPost(path, params) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    body: new URLSearchParams(params),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const message = payload.error?.message || response.statusText;
    const code = payload.error?.code || response.status;
    throw new Error(`Facebook Graph API error (${code}): ${message}`);
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
