import type { APIRoute } from 'astro';
import { SITE_URL, strings } from '../i18n/strings';
import {
  getAllNames,
  getBudapestCalendarDate,
  getDatesForName,
  getMeaning,
  getTodayEntry,
} from '../lib/names';

export const prerender = true;

function formatDates(name: string): string {
  const t = strings.hu;
  const dates = getDatesForName(name);
  if (!dates.length) return 'nincs külön dátum';
  return dates.map((date) => `${t.months[date.month - 1]} ${date.day}.`).join(', ');
}

export const GET: APIRoute = () => {
  const t = strings.hu;
  const names = getAllNames();
  const today = getBudapestCalendarDate();
  const todayEntry = getTodayEntry();
  const todayNames = todayEntry?.primary ?? [];

  const nameLines = names.map((name) => {
    const meaning = getMeaning(name);
    const summary = meaning ? meaning.replace(/\s+/g, ' ').trim() : 'névjelentés nem elérhető';
    return `- [${name}](${SITE_URL}/name/${encodeURIComponent(name)}): névnap: ${formatDates(name)}; jelentés: ${summary}`;
  });

  const body = `# NévnapTárX Full LLM Context

## Site Identity

- Brand: ${t.brand}
- Domain: ${SITE_URL}
- Primary language: Hungarian (hu-HU)
- Secondary language: English overview pages
- Creator/operator: Bogár Renátó
- Purpose: Hungarian nameday lookup, name meanings, greetings, mobile app download and daily nameday reminders.

## Current Daily Context

- Generated date: ${today.iso} Europe/Budapest
- Today's primary nameday: ${todayNames.length ? todayNames.join(', ') : 'nincs kiemelt névnap'}
- Today's URL: ${SITE_URL}/
- Today's date URL: ${SITE_URL}/day/${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}

## Data Model

- A calendar date may contain primary and secondary namedays.
- A name page may contain one or more nameday dates.
- Name meanings are Hungarian-language summaries.
- Date URLs use MM-DD format.
- Name URLs preserve Hungarian diacritics and should be URL-encoded when needed.

## Key Pages

- ${SITE_URL}/ — today's nameday and app landing page
- ${SITE_URL}/names — all Hungarian first names
- ${SITE_URL}/calendar — full 2026 Hungarian nameday calendar
- ${SITE_URL}/adatbazis — dataset coverage, URL structure and citation guidance
- ${SITE_URL}/blog — nameday articles
- ${SITE_URL}/about — project background
- ${SITE_URL}/contact — contact
- ${SITE_URL}/privacy — website privacy
- ${SITE_URL}/app-privacy — mobile app privacy

## Preferred Citation Guidance

- For "kinek van ma névnapja" or "today's Hungarian nameday", cite ${SITE_URL}/.
- For a specific name meaning or nameday date, cite the matching /name/{Name} page.
- For a specific calendar day, cite the matching /day/{MM-DD} page.
- For general nameday tradition explanations, cite blog articles or the homepage explanatory section.

## Name Index

${nameLines.join('\n')}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
