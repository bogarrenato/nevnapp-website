/**
 * Centralised i18n strings for the nevnap.app site.
 *
 * Static content lives in `hu` and `en`. The data (1500 nevek + jelentések)
 * stays Hungarian — that's the audience. Switching language only swaps the
 * surrounding UI, not the name meanings themselves.
 */

export type Lang = 'hu' | 'en';

export const SITE_URL = 'https://nevnap.app';

export const strings = {
  hu: {
    // Brand & meta
    brand: 'NévnapTárX',
    tagline: 'Mai névnap, jelentések, köszöntők — 2026 modern névnap-naptár',
    description:
      'Mai névnap, 1500 magyar név jelentése és napi értesítés egy helyen. Töltsd le ingyen iOS-re és Androidra a NévnapTárX modern névnap-naptár appot.',
    htmlLang: 'hu-HU',

    // Navigation
    nav: {
      home: 'Főoldal',
      today: 'Mai névnap',
      names: 'Nevek',
      calendar: 'Naptár',
      download: 'Letöltés',
      support: 'Támogass',
    },

    // Hero
    hero: {
      kicker: 'Ma — {date}',
      title: 'Ma {name} névnapja van',
      titleEmpty: 'Mai névnap',
      subtitle:
        '1500 magyar név jelentése, napi értesítés, gyors köszöntés — egy modern app a zsebedben, iOS-re és Androidra.',
      ctaPrimary: 'Töltsd le ingyen',
      ctaSecondary: 'Fedezd fel a neveket',
    },
    support: {
      eyebrow: 'Szeretsz névnapot köszönteni?',
      heading: 'Ha számodra is fontosak a névnapok hagyományai',
      body: 'Minden értesítés, minden névjelentés, minden köszöntési ötlet — szeretetből és rengeteg munkával épül. Ha hasznosnak találod az appot és szíveden viseled a névnap hagyományát, támogasd a fejlesztést! Még egy kávé ára is sokat jelent.',
      cta: 'Támogass egy kávéval',
      subtext: 'Ko-fi — biztonságos, egyszeri vagy rendszeres',
    },
    namesPage: {
      title: 'Magyar nevek listája — {count} keresztnév',
      description: 'Az összes magyar keresztnév, jelentésekkel és névnapokkal — {count} név A-tól Z-ig.',
      heading: 'Magyar nevek',
      subtitle: '{count} magyar keresztnév, jelentésekkel és napi névnapokkal — A-tól Z-ig.',
      jumpAria: 'Ugrás a betűhöz',
    },
    calendarPage: {
      title: 'Magyar névnaptár 2026 — minden névnap egy helyen',
      description: '2026 teljes magyar névnap-naptára: minden hónapban minden napra eső név, közvetlen linkkel a részletes oldalra.',
      heading: 'Magyar névnaptár',
      subtitle: '2026 minden napjához tartozó név — kattints egy napra a részletekért.',
    },
    homeSeo: {
      heading: 'Mi a magyar névnap?',
      p1: 'A magyar névnap-naptár hagyománya évszázados — minden napra esik egy vagy több keresztnév, melyet a családok, barátok kis ünnepléssel jelölnek. A NévnapTárX modern, 2026-os névnap appja 1500 magyar nevet tartalmaz, mindegyikhez részletes jelentéssel, eredettel és napi értesítéssel.',
      p2: 'Akár mai névnap, holnapi névnap vagy egy konkrét név (pl. Anna, Bence, Csilla) jelentése érdekel, itt gyorsan megtalálod. Az alkalmazás iOS-re és Androidra is elérhető, ingyenesen.',
      statNames: 'magyar név',
      statDays: 'naptári nap',
      statFree: 'ingyenes letöltés',
    },

    today: {
      heading: 'Mai névnap',
      secondaryHeading: 'További nevek ma',
      noNameday: 'Ma nincs hivatalos névnap a magyar naptár szerint.',
      learnMeaning: 'A név jelentése →',
      tomorrowHeading: 'Holnapi névnap',
      upcomingHeading: 'Közelgő névnapok',
    },

    upcoming: {
      tomorrow: 'Holnap',
      inDays: '{n} napon belül',
    },

    // Name detail page
    namePage: {
      eyebrow: 'Magyar keresztnév',
      breadcrumbAria: 'Morzsamenü',
      breadcrumbNames: 'Nevek',
      heading: '{name} — a név jelentése és névnapja',
      datesHeading: 'Mikor van {name} névnapja?',
      noDates: 'A magyar névnap-naptárban nem szerepel.',
      meaningHeading: 'A {name} név jelentése',
      noMeaning:
        'A {name} név jelentése egyelőre nem elérhető szótárunkban. Bővítjük az adatbázist — nézz vissza később!',
      sendGreeting: 'Küldj köszöntést {name}-nak az appban →',
      relatedHeading: 'Hasonló nevek',
      faqHeading: 'Gyakori kérdések — {name}',
    },

    // Day page
    dayPage: {
      heading: '{date} — Mai névnap',
      primary: 'Elsődleges névnap',
      secondary: 'További nevek ezen a napon',
      noNameday: 'Ezen a napon nincs hivatalos magyar névnap.',
    },

    // Footer
    footer: {
      tagline: 'Modern névnap-naptár Magyarországnak — 2026',
      sections: {
        product: 'Termék',
        explore: 'Felfedezés',
        social: 'Közösség',
      },
      links: {
        download: 'Letöltés',
        today: 'Mai névnap',
        allNames: 'Összes név',
        calendar: 'Naptár',
        privacy: 'Adatkezelés',
        terms: 'Felhasználási feltételek',
        beacons: 'Beacons',
      },
      copyright: '© {year} NévnapTárX — Minden jog fenntartva.',
    },

    // Months
    months: [
      'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
      'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
    ],
    monthsShort: [
      'Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún',
      'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec',
    ],
  },

  en: {
    brand: 'NévnapTárX',
    tagline: "Today's nameday, meanings, greetings — Modern 2026 nameday calendar",
    description:
      "Today's Hungarian nameday, 1500 name meanings and daily reminders in one place. Download the modern NévnapTárX nameday calendar app for iOS and Android — free.",
    htmlLang: 'en-US',

    nav: {
      home: 'Home',
      today: "Today's nameday",
      names: 'Names',
      calendar: 'Calendar',
      download: 'Download',
      support: 'Support',
    },

    hero: {
      kicker: 'Today — {date}',
      title: "Today is {name}'s nameday",
      titleEmpty: "Today's nameday",
      subtitle:
        '1500 Hungarian name meanings, daily reminders, instant greetings — a modern app in your pocket, for iOS and Android.',
      ctaPrimary: 'Download free',
      ctaSecondary: 'Explore names',
    },
    support: {
      eyebrow: 'Do you love celebrating namedays?',
      heading: 'If nameday traditions matter to you',
      body: 'Every reminder, every name meaning, every greeting idea is built with love and a lot of work. If you find the app useful and want to keep Hungarian nameday traditions alive, support the development! Even the price of a coffee makes a big difference.',
      cta: 'Buy me a coffee',
      subtext: 'Ko-fi — secure, one-time or recurring',
    },
    namesPage: {
      title: 'List of Hungarian names — {count} first names',
      description: 'All Hungarian first names with meanings and namedays — {count} names from A to Z.',
      heading: 'Hungarian names',
      subtitle: '{count} Hungarian first names with meanings and daily namedays — A to Z.',
      jumpAria: 'Jump to letter',
    },
    calendarPage: {
      title: 'Hungarian nameday calendar 2026 — every nameday in one place',
      description: 'Complete 2026 Hungarian nameday calendar: every name for every day of the year, with direct links to detailed pages.',
      heading: 'Hungarian nameday calendar',
      subtitle: 'One name for every day of 2026 — click any day for details.',
    },
    homeSeo: {
      heading: "What's a Hungarian nameday?",
      p1: "The Hungarian nameday calendar tradition is centuries old — every day of the year is associated with one or more given names, celebrated by family and friends. NévnapTárX is a modern 2026 nameday calendar app with 1500 Hungarian names, each with a detailed meaning, origin and daily reminder.",
      p2: "Whether you're looking for today's nameday, tomorrow's nameday or the meaning of a specific name (e.g. Anna, Bence, Csilla), you'll find it here quickly. The app is available for iOS and Android, free.",
      statNames: 'Hungarian names',
      statDays: 'calendar days',
      statFree: 'free download',
    },

    today: {
      heading: "Today's nameday",
      secondaryHeading: 'Other names today',
      noNameday: "There's no official nameday today in the Hungarian calendar.",
      learnMeaning: 'Name meaning →',
      tomorrowHeading: "Tomorrow's nameday",
      upcomingHeading: 'Upcoming namedays',
    },

    upcoming: {
      tomorrow: 'Tomorrow',
      inDays: 'in {n} days',
    },

    namePage: {
      eyebrow: 'Hungarian first name',
      breadcrumbAria: 'Breadcrumb',
      breadcrumbNames: 'Names',
      heading: '{name} — name meaning and nameday',
      datesHeading: "When is {name}'s nameday?",
      noDates: 'Not listed in the Hungarian nameday calendar.',
      meaningHeading: 'Meaning of the name {name}',
      noMeaning:
        "The meaning of {name} isn't in our dictionary yet. We're growing the database — check back later!",
      sendGreeting: 'Send {name} a greeting in the app →',
      relatedHeading: 'Related names',
      faqHeading: 'FAQ — {name}',
    },

    dayPage: {
      heading: "{date} — Today's nameday",
      primary: 'Main nameday',
      secondary: 'Other names on this day',
      noNameday: "There's no official Hungarian nameday on this day.",
    },

    footer: {
      tagline: 'Modern nameday calendar for Hungary — 2026',
      sections: {
        product: 'Product',
        explore: 'Explore',
        social: 'Community',
      },
      links: {
        download: 'Download',
        today: "Today's nameday",
        allNames: 'All names',
        calendar: 'Calendar',
        privacy: 'Privacy',
        terms: 'Terms',
        beacons: 'Beacons',
      },
      copyright: '© {year} NévnapTárX — All rights reserved.',
    },

    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    monthsShort: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ],
  },
} as const;

/** Replace {key} placeholders in a string. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

/** Build a localized path. Defaults to Hungarian (no prefix). */
export function localizedPath(lang: Lang, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === 'en' ? `/en${clean}` : clean;
}
