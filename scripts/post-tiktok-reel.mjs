import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://open.tiktokapis.com/v2';
const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || 'https://www.nevnap.app');
const ROOT_DIR = process.cwd();
const VIDEO_PATH = path.resolve(process.env.TIKTOK_VIDEO_PATH || path.join(ROOT_DIR, 'dist/social/today-reel.mp4'));
const SOCIAL_JSON_PATH = path.resolve(
  process.env.TIKTOK_SOCIAL_JSON_PATH || path.join(ROOT_DIR, 'dist/social/today.json'),
);
const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const REFRESH_TOKEN = process.env.TIKTOK_REFRESH_TOKEN;
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REQUESTED_PRIVACY_LEVEL = process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';
const DRY_RUN = process.argv.includes('--dry-run') || process.env.TIKTOK_DRY_RUN === '1';
const ALLOW_STALE = process.env.TIKTOK_ALLOW_STALE === '1';
const STATUS_ATTEMPTS = Number.parseInt(process.env.TIKTOK_STATUS_ATTEMPTS || '30', 10);
const STATUS_DELAY_MS = Number.parseInt(process.env.TIKTOK_STATUS_DELAY_MS || '10000', 10);

const socialContent = await loadSocialContent();
const expectedIso = getBudapestIsoDate();

if (!ALLOW_STALE && socialContent.date?.iso !== expectedIso) {
  throw new Error(
    `The social content is stale: got ${socialContent.date?.iso ?? 'unknown'}, expected ${expectedIso}.`,
  );
}

const caption = process.env.TIKTOK_CAPTION_OVERRIDE || socialContent.facebookCaption;

if (DRY_RUN) {
  console.log('TikTok Reel dry run');
  console.log(
    JSON.stringify(
      {
        hasAccessToken: Boolean(ACCESS_TOKEN),
        hasRefreshToken: Boolean(REFRESH_TOKEN),
        hasClientCredentials: Boolean(CLIENT_KEY && CLIENT_SECRET),
        videoPath: VIDEO_PATH,
        caption,
        requestedPrivacyLevel: REQUESTED_PRIVACY_LEVEL,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!fs.existsSync(VIDEO_PATH)) {
  throw new Error(`Missing TikTok Reel video at ${VIDEO_PATH}. Run npm run build && npm run social:reel first.`);
}

const token = await getTikTokAccessToken();
const creator = await apiPost('/post/publish/creator_info/query/', token, {});
const privacyLevel = choosePrivacyLevel(creator.data?.privacy_level_options || []);
const videoSize = fs.statSync(VIDEO_PATH).size;

const init = await apiPost('/post/publish/video/init/', token, {
  post_info: {
    title: caption,
    privacy_level: privacyLevel,
    disable_duet: envBool('TIKTOK_DISABLE_DUET', false),
    disable_comment: envBool('TIKTOK_DISABLE_COMMENT', false),
    disable_stitch: envBool('TIKTOK_DISABLE_STITCH', false),
    video_cover_timestamp_ms: Number.parseInt(process.env.TIKTOK_COVER_TIMESTAMP_MS || '1000', 10),
    brand_content_toggle: envBool('TIKTOK_BRAND_CONTENT', false),
    brand_organic_toggle: envBool('TIKTOK_BRAND_ORGANIC', true),
    is_aigc: envBool('TIKTOK_IS_AIGC', false),
  },
  source_info: {
    source: 'FILE_UPLOAD',
    video_size: videoSize,
    chunk_size: videoSize,
    total_chunk_count: 1,
  },
});

const publishId = init.data?.publish_id;
const uploadUrl = init.data?.upload_url;

if (!publishId || !uploadUrl) {
  throw new Error(`TikTok did not return a publish_id and upload_url: ${JSON.stringify(init)}`);
}

await uploadVideo(uploadUrl, VIDEO_PATH, videoSize);
const finalStatus = await waitForPublish(token, publishId);

console.log(
  `Published TikTok Reel: ${publishId}${formatPublicPostIds(finalStatus.data?.publicaly_available_post_id)}`,
);

async function getTikTokAccessToken() {
  if (REFRESH_TOKEN) {
    if (!CLIENT_KEY || !CLIENT_SECRET) {
      throw new Error('TIKTOK_REFRESH_TOKEN requires TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.');
    }

    const refreshed = await tokenRequest({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    });

    if (refreshed.refresh_token && refreshed.refresh_token !== REFRESH_TOKEN) {
      console.warn(
        'TikTok returned a rotated refresh token. Update the TIKTOK_REFRESH_TOKEN GitHub secret before the next run.',
      );
    }

    return refreshed.access_token;
  }

  if (ACCESS_TOKEN) return ACCESS_TOKEN;

  throw new Error('Missing TIKTOK_ACCESS_TOKEN or TIKTOK_REFRESH_TOKEN environment variable.');
}

async function tokenRequest(params) {
  const response = await fetch(`${API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams(params),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(`TikTok OAuth error (${response.status}): ${payload.error_description || payload.error || response.statusText}`);
  }

  return payload;
}

async function apiPost(pathname, token, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error?.code !== 'ok') {
    const code = payload.error?.code || response.status;
    const message = payload.error?.message || response.statusText;
    throw new Error(`TikTok API error (${code}): ${message}`);
  }

  return payload;
}

async function uploadVideo(uploadUrl, videoPath, videoSize) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoSize),
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: fs.createReadStream(videoPath),
    duplex: 'half',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`TikTok video upload failed (${response.status}): ${text || response.statusText}`);
  }
}

async function waitForPublish(token, publishId) {
  let lastStatus;

  for (let attempt = 1; attempt <= STATUS_ATTEMPTS; attempt++) {
    lastStatus = await apiPost('/post/publish/status/fetch/', token, { publish_id: publishId });
    const status = lastStatus.data?.status;

    if (status === 'PUBLISH_COMPLETE') return lastStatus;
    if (status === 'FAILED') {
      throw new Error(`TikTok publish failed: ${lastStatus.data?.fail_reason || JSON.stringify(lastStatus)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, STATUS_DELAY_MS));
  }

  console.log(`TikTok Reel is still processing: ${publishId} (${lastStatus?.data?.status || 'unknown'})`);
  return lastStatus || { data: { status: 'UNKNOWN' } };
}

async function loadSocialContent() {
  if (fs.existsSync(SOCIAL_JSON_PATH)) {
    return JSON.parse(fs.readFileSync(SOCIAL_JSON_PATH, 'utf8'));
  }

  return fetchJson(`${SITE_URL}/social/today.json?ts=${Date.now()}`);
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

function choosePrivacyLevel(options) {
  if (options.includes(REQUESTED_PRIVACY_LEVEL)) return REQUESTED_PRIVACY_LEVEL;
  if (options.includes('SELF_ONLY')) return 'SELF_ONLY';
  if (options.length > 0) return options[0];
  return REQUESTED_PRIVACY_LEVEL;
}

function envBool(name, defaultValue) {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function normalizeSiteUrl(input) {
  return input.replace(/\/+$/, '');
}

function formatPublicPostIds(ids) {
  return Array.isArray(ids) && ids.length > 0 ? ` (${ids.join(', ')})` : '';
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
