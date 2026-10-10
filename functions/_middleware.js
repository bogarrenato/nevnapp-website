import { strings, interpolate, localizedPath } from '../src/i18n/strings';
import { getDailyPage } from '../src/lib/daily-page';
import { dateKey } from '../src/lib/names';
import { buildTodaySocialContent } from '../src/lib/social-card';
import { GET as llms } from '../src/pages/llms.txt.ts';
import { GET as llmsFull } from '../src/pages/llms-full.txt.ts';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

function nameLinks(names, lang, primary) {
  return names.map((name) => {
    const href = escapeHtml(localizedPath(lang, `/name/${encodeURIComponent(name)}`));
    if (!primary) return `<li><a href="${href}" class="px-3 py-1 rounded-full text-sm bg-white/10 hover:bg-white/20 transition">${escapeHtml(name)}</a></li>`;
    const label = lang === 'hu' ? `${name} névnap részletei` : `Details for ${name}`;
    return `<li><a href="${href}" aria-label="${escapeHtml(label)}" class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-sm font-semibold transition">${escapeHtml(name)}<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a></li>`;
  }).join('');
}

/** Rewrites the prebuilt shell on the edge; no browser JS or daily build needed. */
export function renderDailyResponse(response, lang, now = new Date()) {
  const daily = getDailyPage(lang, now);
  const t = strings[lang];
  const dateLabel = `${t.months[daily.today.month - 1]} ${daily.today.day}${lang === 'hu' ? '.' : ''}`;
  const names = escapeHtml(daily.primaryNames.join(lang === 'hu' ? ' és ' : ' & '));
  const hero = daily.primaryNames.length
    ? (lang === 'hu' ? `Ma <span class="gradient-text">${names}</span> névnapja van` : `Today is <span class="gradient-text">${names}</span>'s nameday`)
    : `<span class="gradient-text">${escapeHtml(t.hero.titleEmpty)}</span>`;
  const texts = {
    'hero-date': interpolate(t.hero.kicker, { date: dateLabel }),
    'today-date': dateLabel,
    primary: daily.primaryNames.length ? daily.primaryNames.join(lang === 'hu' ? ' és ' : ' and ') : t.today.noNameday,
    answer: daily.todayAnswer,
    iso: daily.today.iso,
    'year-days': String(daily.daysInCurrentYear),
  };
  const html = {
    'hero-title': hero,
    'primary-links': nameLinks(daily.primaryNames, lang, true),
    'secondary-links': nameLinks(daily.secondaryNames, lang, false),
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
      if (['hero-date', 'today-date'].includes(key)) e.setAttribute('datetime', daily.today.iso);
      if (key === 'primary-links' || key === 'secondary-section') {
        const visible = key === 'primary-links' ? daily.primaryNames.length : daily.secondaryNames.length;
        if (visible) e.removeAttribute('hidden'); else e.setAttribute('hidden', '');
      }
    } })
    .on('[data-upcoming-link]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-link')) - 1];
      if (!u) return;
      const names = u.entry?.primary ?? [];
      const href = names[0] ? `/name/${encodeURIComponent(names[0])}` : `/day/${dateKey(u.date.month, u.date.day)}`;
      const label = u.daysAhead === 1 ? t.upcoming.tomorrow : interpolate(t.upcoming.inDays, { n: u.daysAhead });
      e.setAttribute('href', localizedPath(lang, href));
      e.setAttribute('aria-label', `${label}, ${t.monthsShort[u.date.month - 1]} ${u.date.day}. — ${names.join(', ') || (lang === 'hu' ? 'Nincs névnap' : 'No nameday')}`);
    } })
    .on('[data-upcoming-date]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-date')) - 1];
      if (!u) return;
      e.setAttribute('datetime', u.date.iso);
      e.setInnerContent(`${t.monthsShort[u.date.month - 1]} ${u.date.day}.`);
    } })
    .on('[data-upcoming-names]', { element(e) {
      const u = daily.upcoming[Number(e.getAttribute('data-upcoming-names')) - 1];
      if (u) e.setInnerContent(u.entry?.primary.join(', ') || (lang === 'hu' ? 'Nincs névnap' : 'No nameday'));
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
