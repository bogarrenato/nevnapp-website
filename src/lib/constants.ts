/**
 * Centralised constants — every external link, store URL, social handle and
 * brand value lives here. Single source of truth so nothing drifts when the
 * brand updates (e.g. new App Store ID).
 */

export const BRAND = {
  name: 'NévnapTárX',
  shortName: 'Névnap',
  domain: 'nevnap.app',
  email: 'bogarrenato@gmail.com',
  /** ISO country code for hreflang/OG metadata. */
  country: 'HU',
} as const;

export const STORE_LINKS = {
  appStore:
    'https://apps.apple.com/hu/app/n%C3%A9vnap-n%C3%A9vnapt%C3%A1rx/id6743980160?l=hu',
  playStore:
    'https://play.google.com/store/apps/details?id=com.bogarrenato.namedayapp',
} as const;

export const SOCIAL = {
  tiktok: 'https://www.tiktok.com/@nvnaptrx',
  instagram: 'https://www.instagram.com/nevnaptarx',
  beacons: 'https://beacons.ai/nevnaptarx',
} as const;

/**
 * Gradient palette for the upcoming-strip cards. Cycled with `% length`,
 * extracted here so designers can reorder/replace without touching React/Astro.
 */
export const UPCOMING_GRADIENTS = [
  'from-teal-500 to-emerald-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-indigo-500',
  'from-rose-500 to-pink-500',
  'from-lime-500 to-emerald-500',
  'from-blue-500 to-purple-500',
] as const;

/** How many days the upcoming-strip shows (excluding today). */
export const UPCOMING_DAYS_COUNT = 7;
