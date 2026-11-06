import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const script = layout.match(/<script is:inline>\s*(window\.dataLayer[\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'The shared layout must include the consent-gated Analytics bootstrap');
const measurementId = 'G-WLY040XS2L';

function bootstrap(savedConsent = null) {
  const scripts = [];
  const listeners = new Map();
  let reloads = 0;
  const browser = {
    document: {
      createElement: () => ({}),
      head: { appendChild: element => scripts.push(element) },
    },
    localStorage: { getItem: () => savedConsent },
    location: { reload: () => reloads++ },
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  browser.window = browser;
  runInNewContext(script, browser);
  return {
    scripts,
    commands: () => browser.dataLayer.map(args => Array.from(args)),
    consent: analytics => listeners.get('consent-updated')({ detail: { analytics } }),
    reloads: () => reloads,
  };
}

test('Analytics makes no script request before consent, on rejection, or with invalid stored consent', () => {
  for (const stored of [null, JSON.stringify({ analytics: false }), 'invalid-json']) {
    const page = bootstrap(stored);
    assert.equal(page.scripts.length, 0);
    assert.equal(page.commands().filter(([command]) => command === 'config').length, 0);
    assert.equal(page.commands()[0][2].analytics_storage, 'denied');
  }
});

test('granting consent loads and configures only the bogarrenato NévNapTárX destination, once', () => {
  const page = bootstrap();
  page.consent(false);
  page.consent(true);
  page.consent(true);
  assert.equal(page.scripts.length, 1);
  assert.equal(page.scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  const configs = page.commands().filter(([command]) => command === 'config');
  assert.equal(configs.length, 1);
  assert.equal(configs[0][1], measurementId);
  assert.ok(page.commands().findIndex(([command, type, value]) =>
    command === 'consent' && type === 'update' && value.analytics_storage === 'granted') <
    page.commands().findIndex(([command]) => command === 'config'));
});

test('a returning consenting visitor uses the same destination and can revoke consent', () => {
  const page = bootstrap(JSON.stringify({ analytics: true }));
  assert.equal(page.scripts.length, 1);
  assert.equal(page.commands().find(([command]) => command === 'config')[1], measurementId);
  page.consent(false);
  assert.equal(page.commands().at(-1)[2].analytics_storage, 'denied');
  assert.equal(page.reloads(), 1);
});
