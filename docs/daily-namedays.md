# Automatic daily namedays

The Hungarian and English homepages are rendered at request time by
`functions/_middleware.js`. It updates the static Astro shell using the
`Europe/Budapest` calendar date: hero, date, primary/secondary name links,
upcoming seven days, visible FAQ, HTML title, description, Open Graph/Twitter
metadata and structured data. `/social/today.json`, `/llms.txt` and
`/llms-full.txt` also use the current request date.

These responses use `Cache-Control: no-store` and expose `X-Nameday-Date` for
operational verification. Conditional headers for the static shell are removed
so an old ETag cannot produce a stale daily response. Other pages remain static;
`public/_routes.json` limits Functions to the daily routes.

The live daily page no longer depends on GitHub scheduling. GitHub may disable
scheduled workflows in a public repository after 60 days of repository
inactivity. Re-enable the daily workflow for fresh static fallback files and
social images/videos, but this is no longer necessary for the live homepage.
The deploy, Facebook Reel and Instagram Reel workflows now also call the
GitHub workflow-enable API on every scheduled/manual run to renew their
inactivity timer. This needs only the job-scoped `actions: write` permission;
no extra personal token, dummy commits or local computer is needed.

Production deployment runs on pushes to `main`, manual dispatch and once daily
at 23:45 UTC (00:45 CET / 01:45 CEST). No public deployment hook or extra secret
is required. The existing GitHub Cloudflare secrets are used for deployment.

Verification:

```sh
npm ci
npm run build
node --test tests/daily-runtime.test.mjs
node scripts/check-daily-site.mjs
```

The runtime tests use one built HTML shell and simulated instants before/after
Budapest midnight, DST transitions and New Year. Their simulated clock exists
only in the test worker, never as a public endpoint or URL option.

## Daily social publishing

Facebook Reel: scheduled for 06:00 Budapest. Instagram Reel: 06:05 Budapest.
Facebook photos are manual-only and have no scheduled trigger.
GitHub scheduling may delay those times. Both retain manual `workflow_dispatch`
in Actions, use the existing Meta secrets, and fail visibly if credentials
are missing or the API rejects them. Future token expiry/revocation requires
renewing the affected Meta secret; it cannot be avoided by a schedule.

Before publishing, the scripts check the static `/social/build.json` manifest,
not only the dynamically current `/social/today.json`. The image date is set
by Astro and the reel date is set only after FFmpeg succeeds. If either is
stale, run `Daily rebuild & deploy` first; yesterday's media is never posted
with today's caption. Recent platform posts are checked for the same daily
nameday header and Budapest publication date to prevent normal manual retries
from creating duplicates. The workflow concurrency locks serialize retries.

```sh
node --test tests/social-publishing.test.mjs
gh workflow run facebook-daily-reel.yml
gh workflow run instagram-daily-reel.yml
```

## Daily reel video

`npm run social:reel` (`scripts/build-social-reel.mjs`) renders
`dist/social/today-reel.mp4`: 1080×1920, 30 fps, 11.5 s, H.264 + AAC. The
layout lives in `scripts/reel-template.mjs` as one HTML page with five scenes
(tear-off calendar hook, name, meaning, other names + tomorrow, share + app)
and a brand sticker. Headless Chromium (Playwright) steps the page frame by
frame and FFmpeg encodes the result, so the video is deterministic.

All copy comes from `dist/social/today.json`, `src/data/nevnapok.json`
(tomorrow's name) and `src/data/name_meanings.json`; text is auto-sized, and a
name without a usable meaning gets a greeting instead. The weekday picks the
colour theme (`THEMES`). `COVER_MS` is the cover frame sent to Instagram
(`thumb_offset`) and TikTok (`video_cover_timestamp_ms`), because frame 0 still
shows yesterday's calendar sheet.

The build manifest also records `reelVersion` and the encoded video's
`reelSha256`. Facebook and Instagram URLs include this hash, so republishing a
revised video on the same date cannot reuse the old cached MP4. The manual
`republish` input intentionally bypasses the same-day duplicate guard; it is
false by default and is never enabled by the daily schedule. Old platform posts
are not deleted when publishing a revision.

TikTok and YouTube schedules have the same inactivity keepalive as Meta. Their
existing authorization and platform approval are still required. TikTok fails
instead of silently downgrading public content to private or claiming a pending
upload was published. YouTube reports the actual visibility returned by the
API and fails if it differs from the requested visibility.

Local run, after `npm install`:

```sh
npx playwright install chromium   # once per machine
npm run build && npm run social:reel
```

The workflows that build the reel (`daily-deploy.yml`, `tiktok-daily-reel.yml`,
`youtube-daily-short.yml`) install the headless Chromium right after `npm ci`.
