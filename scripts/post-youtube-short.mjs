import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || 'https://www.nevnap.app');
const VIDEO_PATH = path.resolve(process.env.YOUTUBE_VIDEO_PATH || path.join(ROOT_DIR, 'dist/social/today-reel.mp4'));
const SOCIAL_JSON_PATH = path.resolve(
  process.env.YOUTUBE_SOCIAL_JSON_PATH || path.join(ROOT_DIR, 'dist/social/today.json'),
);
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const PRIVACY_STATUS = process.env.YOUTUBE_PRIVACY_STATUS || 'public';
const CATEGORY_ID = process.env.YOUTUBE_CATEGORY_ID || '22';
const NOTIFY_SUBSCRIBERS = envBool('YOUTUBE_NOTIFY_SUBSCRIBERS', false);
const DRY_RUN = process.argv.includes('--dry-run') || process.env.YOUTUBE_DRY_RUN === '1';
const ALLOW_STALE = process.env.YOUTUBE_ALLOW_STALE === '1';

const socialContent = await loadSocialContent();
const expectedIso = getBudapestIsoDate();

if (!ALLOW_STALE && socialContent.date?.iso !== expectedIso) {
  throw new Error(
    `The social content is stale: got ${socialContent.date?.iso ?? 'unknown'}, expected ${expectedIso}.`,
  );
}

const uploadMetadata = buildUploadMetadata(socialContent);

if (DRY_RUN) {
  console.log('YouTube Shorts dry run');
  console.log(
    JSON.stringify(
      {
        hasClientId: Boolean(CLIENT_ID),
        hasClientSecret: Boolean(CLIENT_SECRET),
        hasRefreshToken: Boolean(REFRESH_TOKEN),
        videoPath: VIDEO_PATH,
        privacyStatus: PRIVACY_STATUS,
        notifySubscribers: NOTIFY_SUBSCRIBERS,
        metadata: uploadMetadata,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  throw new Error('Missing YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, or YOUTUBE_REFRESH_TOKEN environment variable.');
}

if (!fs.existsSync(VIDEO_PATH)) {
  throw new Error(`Missing YouTube Shorts video at ${VIDEO_PATH}. Run npm run build && npm run social:reel first.`);
}

const accessToken = await refreshAccessToken();
const uploadUrl = await createUploadSession(accessToken, uploadMetadata);
const uploaded = await uploadVideo(uploadUrl, VIDEO_PATH, accessToken);

console.log(`Published YouTube Short: https://youtu.be/${uploaded.id}`);

async function refreshAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    const message = payload.error_description || payload.error || response.statusText;
    throw new Error(`YouTube OAuth refresh failed (${response.status}): ${message}`);
  }

  return payload.access_token;
}

async function createUploadSession(accessToken, metadata) {
  const params = new URLSearchParams({
    part: 'snippet,status',
    notifySubscribers: String(NOTIFY_SUBSCRIBERS),
    uploadType: 'resumable',
  });
  const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(fs.statSync(VIDEO_PATH).size),
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`YouTube upload session failed (${response.status}): ${text || response.statusText}`);
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube did not return a resumable upload URL.');
  }

  return uploadUrl;
}

async function uploadVideo(uploadUrl, videoPath, accessToken) {
  const videoSize = fs.statSync(videoPath).size;
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoSize),
    },
    body: fs.createReadStream(videoPath),
    duplex: 'half',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.id) {
    const message = payload.error?.message || JSON.stringify(payload) || response.statusText;
    throw new Error(`YouTube video upload failed (${response.status}): ${message}`);
  }

  return payload;
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

function buildUploadMetadata(socialContent) {
  const names = socialContent.primaryNames?.length ? socialContent.primaryNames : ['NévnapTárX'];
  const titleBase = process.env.YOUTUBE_TITLE_OVERRIDE || `Mai névnap: ${names.join(', ')} | NévnapTárX #Shorts`;
  const description =
    process.env.YOUTUBE_DESCRIPTION_OVERRIDE ||
    `${socialContent.facebookCaption}\n\n#Shorts\n\nNapi névnapok: ${SITE_URL}/`;

  return {
    snippet: {
      title: titleBase.slice(0, 100),
      description,
      tags: buildTags(socialContent),
      categoryId: CATEGORY_ID,
      defaultLanguage: 'hu',
      defaultAudioLanguage: 'hu',
    },
    status: {
      privacyStatus: PRIVACY_STATUS,
      selfDeclaredMadeForKids: false,
    },
  };
}

function buildTags(socialContent) {
  const tags = new Set(['magyar', 'névnap', 'névnaptárx', 'nevnap', 'name day', 'shorts']);
  for (const name of socialContent.primaryNames || []) tags.add(name);
  return [...tags].slice(0, 20);
}

function envBool(name, defaultValue) {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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
