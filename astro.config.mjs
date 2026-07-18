// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://nevnap.app',
  integrations: [
    sitemap({
      // The name and day detail routes remain useful inside the app, but most
      // currently share a programmatic template and do not yet meet our
      // editorial index-quality threshold. Keep them out of the sitemap until
      // each route family has substantial, independently reviewed content.
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return ![
          '/tiktok/callback',
          '/name/',
          '/day/',
        ].some((prefix) => pathname.startsWith(prefix));
      },
      i18n: {
        defaultLocale: 'hu',
        locales: { hu: 'hu-HU', en: 'en-US' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: 'hu',
    locales: ['hu', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
