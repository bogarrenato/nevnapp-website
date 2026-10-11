import { strings, interpolate, localizedPath } from '../src/i18n/strings';
import { getDailyPage } from '../src/lib/daily-page';
import { dateKey } from '../src/lib/names';
import { buildTodaySocialContent } from '../src/lib/social-card';
import { GET as llms } from '../src/pages/llms.txt.ts';
import { GET as llmsFull } from '../src/pages/llms-full.txt.ts';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

const nameHref = (name, lang) => escapeHtml(localizedPath(lang, `/name/${encodeURIComponent(name)}`));

// These two builders must emit exactly the markup of src/components/Hero.astro.
/** Today's name(s) inside the H1: each one links to its own page. */
function heroNameLinks(names, lang) {
  return names
    .map((name) => `<a class="hero-name" href="${nameHref(name, lang)}">${escapeHtml(name)}</a>`)
    .join(lang === 'hu' ? ' és ' : ' &amp; ');
}

/** "Other names today" chips under the hero copy. */
function secondaryChips(names, lang) {
  return names
    .map((name) => `<li><a href="${nameHref(name, lang)}" class="nx-chip">${escapeHtml(name)}</a></li>`)
    .join('');
}

/** Rewrites the prebuilt shell on the edge; no browser JS or daily build needed. */
export function renderDailyResponse(response, lang, now = new Date()) {
  const daily = getDailyPage(lang, now);
  const t = strings[lang];
  const links = heroNameLinks(daily.primaryNames, lang);
  const hero = daily.primaryNames.length
    ? (lang === 'hu' ? `Ma ${links} névnapja van` : `Today is ${links}'s nameday`)
    : escapeHtml(t.hero.titleEmpty);
  const noNameday = lang === 'hu' ? 'Nincs névnap' : 'No nameday';
  const texts = {
    'hero-date': daily.hero.kicker,
    answer: daily.todayAnswer,
    iso: daily.today.iso,
    'year-days': String(daily.daysInCurrentYear),
    // Hero illustration (phone, notification, calendar leaf)
    'phone-date': daily.hero.phoneDate,
    'phone-name': daily.hero.phoneName,
    'phone-notif': daily.hero.phoneNotif,
    'tile-month': daily.hero.tileMonth,
    'tile-day': daily.hero.tileDay,
  };
  const html = {
    'hero-title': hero,
    'secondary-links': secondaryChips(daily.secondaryNames, lang),
  };
  const rewriter = new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(daily.pageTitle); } })
    .on('meta', { element(e) {
      const key = e.getAttribute('name') || e.getAttribute('property');
      if (['og:title', 'twitter:title'].includes(key)) e.setAttribute('content', daily.pageTitle);
      if (['description', 'og:description', 'twitter:description'].includes(key)) e.setAttribute('content', daily.pageDescription);
    } })
    .on('[data-daily]', { element(e) {
      const key = e.getAttribute('data-daily');
      if (key in texts) e.setInnerContent(texts[key]);
      if (key in html) e.setInnerContent(html[key], { html: true });
      if (key === 'hero-date') e.setAttribute('datetime', daily.today.iso);
      if (key === 'secondary-section') {
        if (daily.secondaryNames.length) e.removeAttribute('hidden'); else e.setAttribute('hidden', '');
      }
    } })
    .on('[data-upcoming-link]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-link')) - 1];
      if (!u) return;
      const names = u.entry?.primary ?? [];
      const href = names[0] ? `/name/${encodeURIComponent(names[0])}` : `/day/${dateKey(u.date.month, u.date.day)}`;
      const label = u.daysAhead === 1 ? t.upcoming.tomorrow : interpolate(t.upcoming.inDays, { n: u.daysAhead });
      e.setAttribute('href', localizedPath(lang, href));
      e.setAttribute('aria-label', `${label}, ${t.monthsShort[u.date.month - 1]} ${u.date.day}. — ${names.join(', ') || noNameday}`);
    } })
    .on('[data-upcoming-date]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-date')) - 1];
      if (!u) return;
      // Only the attribute: the visible day and month are separate child hooks below.
      e.setAttribute('datetime', u.date.iso);
    } })
    .on('[data-upcoming-day]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-day')) - 1];
      if (u) e.setInnerContent(String(u.date.day));
    } })
    .on('[data-upcoming-mon]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-mon')) - 1];
      if (u) e.setInnerContent(t.monthsShort[u.date.month - 1]);
    } })
    .on('[data-upcoming-names]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-names')) - 1];
      if (u) e.setInnerContent(u.entry?.primary.join(', ') || noNameday);
    } })
    .on('script[data-schema-type]', { element(e) {
      const type = e.getAttribute('data-schema-type');
      const schema = type === 'WebPage' ? daily.webPageSchema : type === 'FAQPage' ? daily.faqSchema : null;
      if (schema) e.setInnerContent(JSON.stringify(schema).replace(/</g, '\\u003c'), { html: true });
    } });
  return rewriter.transform(response);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const isHome = path === '/' || path === '/en';
  const isText = path === '/llms.txt' || path === '/llms-full.txt';
  const isSocial = path === '/social/today.json';
  if (!isHome && !isText && !isSocial) return context.next();
  if (!['GET', 'HEAD'].includes(context.request.method)) return context.next();

  const now = new Date();
  let response;
  if (isSocial) {
    response = Response.json(buildTodaySocialContent(now));
  } else if (isText) {
    response = path === '/llms.txt' ? llms() : llmsFull();
  } else {
    // An asset ETag identifies the static shell, not today's rendered page.
    const request = new Request(context.request, { method: 'GET' });
    request.headers.delete('if-none-match');
    request.headers.delete('if-modified-since');
    response = await context.next(request);
    if (response.status !== 200) return response;
    response = renderDailyResponse(response, path === '/en' ? 'en' : 'hu', now);
  }
  response = new Response(context.request.method === 'HEAD' ? null : response.body, response);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Nameday-Date', getDailyPage('hu', now).today.iso);
  response.headers.delete('ETag');
  response.headers.delete('Last-Modified');
  response.headers.delete('Content-Length');
  if (url.hostname !== 'nevnap.app' || isText) {
    response.headers.set('X-Robots-Tag', url.hostname.endsWith('.pages.dev') ? 'noindex, nofollow' : 'noindex, follow');
  }
  return response;
}
