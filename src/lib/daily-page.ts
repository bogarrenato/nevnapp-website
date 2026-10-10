import { strings, type Lang } from '../i18n/strings';
import { getAllNames, getBudapestCalendarDate, getTodayEntry, getUpcoming } from './names';
import { buildFaqSchema, buildWebPageSchema, SEO_IDS } from './seo';

/** Shared by the static fallback and the request-time Cloudflare renderer. */
export function getDailyPage(lang: Lang, now = new Date()) {
  const t = strings[lang];
  const today = getBudapestCalendarDate(now);
  const entry = getTodayEntry(now);
  const primaryNames = entry?.primary ?? [];
  const secondaryNames = entry?.secondary ?? [];
  const allNames = getAllNames();
  const daysInCurrentYear = new Date(Date.UTC(today.year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const pageTitle = lang === 'hu'
    ? (primaryNames.length
      ? `Mai névnap: ${primaryNames.join(' és ')} — ${t.months[today.month - 1]} ${today.day}. | ${t.brand}`
      : `Mai névnap — ${t.months[today.month - 1]} ${today.day}. | ${t.brand}`)
    : (primaryNames.length
      ? `Today's Hungarian nameday: ${primaryNames.join(' & ')} | ${t.brand}`
      : `Hungarian nameday today | ${t.brand}`);
  const pageDescription = lang === 'hu' && primaryNames.length
    ? `Ma ${primaryNames.join(' és ')} névnapja van. Jelentés, eredet, köszöntők és napi névnap értesítések a NévnapTárX modern névnap-naptár appal.`
    : t.description;
  const todayAnswer = lang === 'hu'
    ? (primaryNames.length
      ? `Ma, ${t.months[today.month - 1].toLocaleLowerCase('hu')} ${today.day}-án ${primaryNames.join(' és ')} névnapja van a magyar névnap-naptár szerint.`
      : `Ma, ${t.months[today.month - 1].toLocaleLowerCase('hu')} ${today.day}-án nincs kiemelt névnap az adatbázisban.`)
    : (primaryNames.length
      ? `Today in Hungary, ${primaryNames.join(' and ')} celebrate their nameday.`
      : 'Today has no highlighted nameday in the NévnapTárX database.');
  const faqEntries = lang === 'hu' ? [
    { q: 'Kinek van ma névnapja?', a: todayAnswer },
    { q: 'Hány magyar név szerepel a NévnapTárX adatbázisában?', a: `A NévnapTárX adatbázisa ${allNames.length} magyar keresztnevet tartalmaz névnapokkal és sok esetben névjelentéssel.` },
    { q: 'Hol található a teljes magyar névnap-naptár?', a: 'A teljes, napokra bontott magyar névnap-naptár a /calendar oldalon érhető el, a név szerinti kereséshez pedig a /names oldal használható.' },
  ] : [
    { q: "Who celebrates today's Hungarian nameday?", a: todayAnswer },
    { q: 'How many Hungarian names are in NévnapTárX?', a: `The NévnapTárX database includes ${allNames.length} Hungarian first names with nameday dates and many name meanings.` },
    { q: 'What is a Hungarian nameday?', a: 'A Hungarian nameday is a calendar tradition where given names are associated with specific days of the year and celebrated socially, often similarly to a small birthday greeting.' },
  ];
  const webPageSchema = buildWebPageSchema({
    path: lang === 'hu' ? '/' : '/en', name: pageTitle,
    description: pageDescription, lang,
    about: [{ '@id': SEO_IDS.namedayDataset }, { '@id': SEO_IDS.app }],
  });
  return {
    today, primaryNames, secondaryNames, allNames, daysInCurrentYear,
    pageTitle, pageDescription, todayAnswer, faqEntries, webPageSchema,
    faqSchema: buildFaqSchema(faqEntries),
    upcoming: getUpcoming(8, now).slice(1),
  };
}
