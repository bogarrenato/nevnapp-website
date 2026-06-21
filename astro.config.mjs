// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://nevnap.app',
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/tiktok/callback'),
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
