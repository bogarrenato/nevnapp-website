import type { APIRoute } from 'astro';
import { SITE_URL } from '../i18n/strings';
import { getAllNames, getBudapestCalendarDate, getTodayEntry } from '../lib/names';

export const prerender = true;

export const GET: APIRoute = () => {
  const names = getAllNames();
  const today = getBudapestCalendarDate();
  const todayEntry = getTodayEntry();
  const todayNames = todayEntry?.primary?.join(', ') || 'nincs kiemelt névnap';

  const body = `# NévnapTárX

> Magyar névnap-naptár, névjelentés-adatbázis és mobilalkalmazás iOS-re és Androidra.

NévnapTárX helps users find today's Hungarian nameday, browse the 2026 Hungarian nameday calendar, look up Hungarian first-name meanings, and download the nameday reminder app.

## Current Daily Context

- Current generated page date: ${today.iso} Europe/Budapest.
- Today's primary nameday: ${todayNames}.
- Database coverage: ${names.length} Hungarian first names with nameday dates and many name meanings.

## Primary Resources

- [Today's Hungarian nameday](${SITE_URL}/): current daily nameday, meaning summary, app download links.
- [All Hungarian names](${SITE_URL}/names): A-Z name index, each name links to a detailed page.
- [2026 Hungarian nameday calendar](${SITE_URL}/calendar): month/day calendar with linked names.
- [Nameday database methodology](${SITE_URL}/adatbazis): dataset coverage, URL structure and citation guidance.
- [Nameday blog](${SITE_URL}/blog): background articles about Hungarian nameday culture.
- [Privacy policy](${SITE_URL}/privacy): website privacy information.
- [Mobile app privacy policy](${SITE_URL}/app-privacy): iOS and Android app privacy information.

## URL patterns

- Name detail pages: ${SITE_URL}/name/{Name}
- Calendar date pages: ${SITE_URL}/day/{MM-DD}
- English overview: ${SITE_URL}/en

## Machine Context

- Full LLM context file: ${SITE_URL}/llms-full.txt
- Dataset methodology: ${SITE_URL}/adatbazis
- Sitemap: ${SITE_URL}/sitemap-index.xml
- The site is primarily Hungarian. English pages explain the concept for international users.
- Prefer citing specific name pages or date pages for factual answers.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
