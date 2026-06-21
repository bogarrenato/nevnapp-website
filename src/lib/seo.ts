import { SITE_URL, type Lang } from '../i18n/strings';
import { BRAND, SOCIAL, STORE_LINKS } from './constants';

export const CREATOR_NAME = 'Bogár Renátó';

export const SEO_IDS = {
  organization: `${SITE_URL}/#organization`,
  creator: `${SITE_URL}/#creator`,
  website: `${SITE_URL}/#website`,
  app: `${SITE_URL}/#mobile-application`,
  namedayDataset: `${SITE_URL}/names#nameday-dataset`,
  nameTermSet: `${SITE_URL}/names#defined-term-set`,
} as const;

export function absoluteUrl(path = '/'): string {
  return new URL(path, SITE_URL).toString();
}

export function canonicalPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildIdentityGraph(lang: Lang) {
  const inLanguage = lang === 'en' ? 'en-US' : 'hu-HU';

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': SEO_IDS.creator,
        name: CREATOR_NAME,
        url: absoluteUrl('/about'),
        sameAs: [SOCIAL.instagram, SOCIAL.tiktok, SOCIAL.beacons],
      },
      {
        '@type': 'Organization',
        '@id': SEO_IDS.organization,
        name: BRAND.name,
        alternateName: [BRAND.shortName, 'Nevnap.app', 'Névnap app'],
        url: SITE_URL,
        email: BRAND.email,
        founder: { '@id': SEO_IDS.creator },
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/icons/app-icon.png'),
          width: 512,
          height: 512,
        },
        sameAs: [SOCIAL.instagram, SOCIAL.tiktok, SOCIAL.beacons],
        contactPoint: {
          '@type': 'ContactPoint',
          email: BRAND.email,
          contactType: 'customer support',
          areaServed: 'HU',
          availableLanguage: ['hu', 'en'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': SEO_IDS.website,
        name: BRAND.name,
        alternateName: 'nevnap.app',
        url: SITE_URL,
        inLanguage,
        publisher: { '@id': SEO_IDS.organization },
      },
      {
        '@type': 'MobileApplication',
        '@id': SEO_IDS.app,
        name: BRAND.name,
        operatingSystem: 'iOS, Android',
        applicationCategory: 'UtilityApplication',
        url: SITE_URL,
        inLanguage,
        publisher: { '@id': SEO_IDS.organization },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'HUF',
          availability: 'https://schema.org/InStock',
        },
        sameAs: [STORE_LINKS.appStore, STORE_LINKS.playStore],
      },
    ],
  };
}

export function buildNamedayDatasetSchema(nameCount: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': SEO_IDS.namedayDataset,
    name: 'Magyar névnap- és névjelentés adatbázis',
    description:
      'Magyar keresztnevek, névnapok és névjelentések strukturált adatbázisa a NévnapTárX weboldalhoz és alkalmazáshoz.',
    url: absoluteUrl('/names'),
    inLanguage: 'hu-HU',
    creator: { '@id': SEO_IDS.creator },
    publisher: { '@id': SEO_IDS.organization },
    temporalCoverage: '2026',
    spatialCoverage: {
      '@type': 'Country',
      name: 'Hungary',
    },
    measurementTechnique: 'Szerkesztett magyar névnap-naptár és névjelentés adatbázis',
    variableMeasured: ['keresztnév', 'névnap dátuma', 'név jelentése'],
    keywords: [
      'névnap',
      'magyar névnap',
      'név jelentése',
      'magyar keresztnév',
      'névnap naptár',
    ],
    size: `${nameCount} magyar keresztnév`,
  };
}

export function buildDefinedTermSetSchema(nameCount: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': SEO_IDS.nameTermSet,
    name: 'Magyar keresztnevek',
    description: `${nameCount} magyar keresztnév jelentése és névnapja.`,
    url: absoluteUrl('/names'),
    inLanguage: 'hu-HU',
    publisher: { '@id': SEO_IDS.organization },
  };
}

export function buildWebPageSchema({
  path,
  name,
  description,
  lang = 'hu',
  type = 'WebPage',
  mainEntity,
  about,
}: {
  path: string;
  name: string;
  description: string;
  lang?: Lang;
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage' | 'Article';
  mainEntity?: object;
  about?: object | object[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    inLanguage: lang === 'en' ? 'en-US' : 'hu-HU',
    isPartOf: { '@id': SEO_IDS.website },
    publisher: { '@id': SEO_IDS.organization },
    ...(mainEntity ? { mainEntity } : {}),
    ...(about ? { about } : {}),
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildFaqSchema(entries: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.a,
      },
    })),
  };
}

export function buildItemListSchema({
  name,
  path,
  items,
}: {
  name: string;
  path: string;
  items: Array<{ name: string; path: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${absoluteUrl(path)}#item-list`,
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}
