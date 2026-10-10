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
