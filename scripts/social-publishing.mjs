export function getBudapestIsoDate(now = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Content fetch failed (${response.status}): ${new URL(url).pathname}`);
  }
  return response.json();
}

export async function requireCurrentMedia(siteUrl, kind, expectedIso) {
  const manifest = await fetchJson(`${siteUrl}/social/build.json?ts=${Date.now()}`);
  if (manifest[`${kind}Date`] !== expectedIso) {
    throw new Error(`The deployed ${kind} is stale: got ${manifest[`${kind}Date`] ?? 'unknown'}, expected ${expectedIso}. Run Daily rebuild & deploy before posting.`);
  }
}

export function findDailyPost(posts, caption, iso, platform) {
  const firstLine = caption.split('\n')[0].trim();
  return posts.find((post) => {
    const text = platform === 'facebook' ? post.message
      : platform === 'facebook-reel' ? post.description : post.caption;
    const timestamp = platform === 'instagram' ? post.timestamp : post.created_time;
    if (!text || !timestamp) { return false; }
    const date = new Date(timestamp);
    return !Number.isNaN(date.valueOf()) && getBudapestIsoDate(date) === iso
      && text.split('\n')[0].trim() === firstLine;
  });
}

export async function waitForFacebookReel(version, token, videoId, { attempts = 30, delayMs = 10000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { status } = await graphRequest(version, token, `/${videoId}`, { fields: 'status' });
    if (status?.publishing_phase?.status === 'complete') { return; }
    const phases = ['uploading_phase', 'processing_phase', 'publishing_phase'];
    if (status?.video_status === 'error' || phases.some((phase) => ['error', 'failed'].includes(status?.[phase]?.status))) {
      throw new Error(`Facebook Reel ${videoId} failed during processing/publishing.`);
    }
    if (attempt < attempts) { await new Promise((resolve) => setTimeout(resolve, delayMs)); }
  }
  throw new Error(`Facebook Reel ${videoId} did not confirm publication in time. Check its status before retrying.`);
}

export async function graphRequest(version, token, path, params, method = 'GET') {
  const url = new URL(`https://graph.facebook.com/${version}${path}`);
  const options = { method, headers: { Authorization: `Bearer ${token}` } };
  if (method === 'GET') {
    url.search = new URLSearchParams(params).toString();
  } else {
    options.body = new URLSearchParams(params);
  }
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    // Never log URLs containing tokens, or raw API bodies that may echo them.
    const message = String(payload.error?.message || response.statusText).replaceAll(token, '[REDACTED]');
    throw new Error(`Meta API error (${response.status}, code ${payload.error?.code ?? 'unknown'}): ${message}`);
  }
  return payload;
}
