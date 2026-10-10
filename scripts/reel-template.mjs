/**
 * Daily nameday Reel — template and data preparation (1080×1920).
 *
 * `renderReelHtml()` returns one self-contained HTML page holding all five
 * scenes as stacked "calendar sheets". `scripts/build-social-reel.mjs` loads it
 * in headless Chromium and steps it frame by frame with `window.__seek(ms)`;
 * every animation is a paused Web Animation, so each frame is deterministic.
 *
 * Scenes: 1 hook (tear-off calendar) → 2 name → 3 meaning → 4 other names +
 * tomorrow → 5 share + app. A brand sticker sits above scenes 1–4.
 * Open the generated HTML with `#play` appended to preview it in a browser.
 */

export const DURATION = 11.5; // seconds
export const FPS = 30;
/** Frame used as the cover on platforms that accept a timestamp (name scene). */
export const COVER_MS = 3600;
export const REEL_VERSION = 'calendar-sheets-v1';

const INK = '#0E0F1C';
const PAPER = '#F6F4FF';
const LAV = '#B9AAFF';
const RULE = '#2C2F4A';
const MUTED = '#4A4960';

// Daily colour theme, picked by weekday (0 = Sunday). All values are brand
// tokens from src/styles/global.css; `on` is the text colour on `ground`.
export const THEMES = [
  { key: 'vasarnap', ground: '#FFA94D', deep: '#E88A26', on: INK, accent: '#5240E0' },
  { key: 'hetfo', ground: '#4131B8', deep: '#322794', on: '#FFFFFF', accent: '#FFC857' },
  { key: 'kedd', ground: '#1FB2A0', deep: '#17968A', on: INK, accent: '#FFC857' },
  { key: 'szerda', ground: '#FF6A6E', deep: '#F04A58', on: INK, accent: '#FFC857' },
  { key: 'csutortok', ground: '#FFC857', deep: '#E0A93D', on: INK, accent: '#5240E0' },
  { key: 'pentek', ground: '#B45BFF', deep: '#9A3FEA', on: INK, accent: '#FFC857' },
  { key: 'szombat', ground: '#5240E0', deep: '#4131B8', on: '#FFFFFF', accent: '#FFC857' },
];

const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const HU_WEEKDAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const DAY_MS = 86_400_000;
const FALLBACK_WISH = 'Sok boldogságot, egészséget és örömöt kívánunk!';

/** Calendar date at noon UTC, so weekday/day maths never crosses a DST edge. */
const calendarDate = (iso) => new Date(`${iso}T12:00:00Z`);

export function pickTheme(iso) {
  return THEMES[calendarDate(iso).getUTCDay()];
}

/**
 * Turn the site's `social/today.json` content into the copy the template shows.
 * `namedays` is `src/data/nevnapok.json`'s list (for tomorrow's teaser) and
 * `meanings` is `src/data/name_meanings.json`.
 */
export function prepareReelData(meta, { namedays, meanings }) {
  const date = calendarDate(meta.date.iso);
  const yesterday = new Date(date.getTime() - DAY_MS);
  const tomorrow = new Date(date.getTime() + DAY_MS);
  // One data entry holds two names in a single string ("Belián, Noel").
  const splitNames = (list) => (list ?? []).flatMap((name) => String(name).split(/\s*,\s*/)).filter(Boolean);

  const primary = splitNames(meta.primaryNames);
  const tomorrowEntry = namedays.find((entry) => entry.month === tomorrow.getUTCMonth() + 1 && entry.day === tomorrow.getUTCDate());
  const tomorrowNames = splitNames(tomorrowEntry?.primary);

  // The first primary name with a usable dictionary entry gets the meaning scene.
  let meaning = null;
  for (const name of primary) {
    const parsed = parseMeaning(meanings[name.toLocaleUpperCase('hu')]);
    if (parsed) { meaning = { name, ...parsed }; break; }
  }
  const meaningText = meaning?.text ?? FALLBACK_WISH;
  const parts = meaningText.split(', ');
  const stacked = Boolean(meaning) && parts.length <= 4 && parts.every((part) => part.length <= 14);

  return {
    // A day without a primary name (29 February) still gets a generic greeting.
    displayNames: primary.length ? primary : ['mindenkinek'],
    secondaryNames: splitNames(meta.secondaryNames),
    dateLabel: `${HU_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}.`,
    monthUpper: HU_MONTHS[date.getUTCMonth()].toLocaleUpperCase('hu'),
    day: date.getUTCDate(),
    weekday: HU_WEEKDAYS[date.getUTCDay()],
    yesterdayDay: yesterday.getUTCDate(),
    yesterdayWeekday: HU_WEEKDAYS[yesterday.getUTCDay()],
    originLabel: meaning?.origin ?? null,
    meaningLabel: meaning ? `${hungarianArticle(meaning.name)} ${meaning.name} név jelentése` : 'Boldog névnapot!',
    meaningLines: stacked ? parts.map((part, index) => (index < parts.length - 1 ? `${part},` : part)) : null,
    meaningText,
    tomorrow: tomorrowNames.slice(0, 2).join(' és '),
    sendTo: sendToLines(primary),
  };
}

/** "A GEDEON név héber eredetű; jelentése: harcos, vágó, romboló" → origin + text. */
function parseMeaning(raw) {
  if (!raw) return null;
  const match = /jelentése:\s*(.+)$/u.exec(raw);
  if (!match) return null;
  const text = match[1].split(/;\s|\.\s/u)[0].replace(/\s*\([^)]*\)\s*$/u, '').replace(/\.$/u, '').trim();
  if (!text) return null; // "(ismeretlen)", "(bizonytalan)"
  const origin = /név\s+(.+?)[;.]\s*jelentése:/u.exec(raw)?.[1].replace(/\s*\([^)]*\)/gu, '').trim();
  return { text, origin: origin && origin.length <= 34 ? origin : null };
}

function hungarianArticle(name) {
  return /^[aáeéiíoóöőuúüű]/iu.test(name) ? 'Az' : 'A';
}

/** Same vowel-harmony rule as formatHungarianDativeName in src/lib/social-card.ts. */
function dative(name) {
  const last = name.at(-1)?.toLocaleLowerCase('hu') ?? '';
  const stem = last === 'a' ? `${name.slice(0, -1)}á` : last === 'e' ? `${name.slice(0, -1)}é` : name;
  const vowels = name.toLocaleLowerCase('hu').match(/[aáeéiíoóöőuúüű]/gu) ?? [];
  let back = false;
  for (let index = vowels.length - 1; index >= 0; index -= 1) {
    if ('aáoóuú'.includes(vowels[index])) { back = true; break; }
    if ('öőüűe'.includes(vowels[index])) break;
  }
  return `${stem}${back ? 'nak' : 'nek'}`;
}

/** Closing call to action: "Küldd el" + these lines. */
function sendToLines(names) {
  const forms = names.map(dative);
  if (forms.length === 0) return ['egy barátodnak!'];
  if (forms.length === 1) return [`egy ${forms[0]}!`];
  if (forms.length <= 3) return [forms.slice(0, -1).join(', '), `vagy ${forms.at(-1)}!`];
  return [`${forms.slice(0, -2).join(', ')},`, `${forms.at(-2)} vagy ${forms.at(-1)}!`];
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const flower = (size, petal, center) => `
<svg aria-hidden="true" width="${size}" height="${size}" viewBox="-100 -100 200 200" style="display:block">
  ${[0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<ellipse cx="0" cy="-56" rx="27" ry="42" fill="${petal}" transform="rotate(${r})"/>`).join('')}
  <circle r="26" fill="${center}"/>
</svg>`;

const calGlyph = (color) => `
<svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block">
  <rect x="3" y="5" width="18" height="16" rx="4"/><path d="M3 10.5h18M8 3v4M16 3v4"/>
</svg>`;

const chrome = (color, right = '') => `
<div style="position:absolute; left:80px; top:250px; width:868px; display:flex; justify-content:space-between; align-items:center; font-family:'Geist',system-ui,sans-serif; font-size:38px; color:${color}">
  <div style="display:flex; align-items:center; gap:14px; font-weight:650; letter-spacing:-0.01em">${calGlyph(color)}<span>NévnapTárX</span></div>
  <div style="font-weight:500">${esc(right)}</div>
</div>`;

/**
 * @param data     result of prepareReelData()
 * @param theme    one of THEMES
 * @param fontsDir URL of the node_modules folder holding the @fontsource packages
 * @param iconSrc  URL of the app icon
 */
export function renderReelHtml({ data, theme, fontsDir, iconSrc }) {
  // `spark` is the highlight colour on the dark scenes.
  const T = { ...theme, spark: theme.on === INK ? theme.ground : theme.accent };
  const names = data.displayNames;
  const letters = (s) => [...s].map((ch) => `<span class="ch" style="display:inline-block">${esc(ch)}</span>`).join('');
  const nameLines = names.map((n, i) => {
    const last = i === names.length - 1;
    const joiner = names.length > 1 && last
      ? `<span style="font-family:'Instrument Serif',serif; font-style:italic; font-weight:400; font-size:0.62em; letter-spacing:0; margin-right:0.14em">és</span>`
      : '';
    return `<div class="mask nameline" style="white-space:nowrap">${joiner}${letters(n)}${last ? `<span class="ch bang" style="display:inline-block; color:${T.accent}">!</span>` : (i < names.length - 2 ? `<span class="ch" style="display:inline-block">,</span>` : '')}</div>`;
  }).join('');

  const meaningLines = data.meaningLines
    ? data.meaningLines.map((l) => `<div class="mask"><div class="mline">${esc(l)}</div></div>`).join('')
    : `<div class="mpara" style="text-wrap:balance">${esc(data.meaningText)}</div>`;

  const rows = data.secondaryNames.slice(0, 5).map((n) => `
      <div class="row" style="height:124px; display:flex; align-items:center; border-bottom:2px solid ${RULE}; font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:92px; letter-spacing:-0.02em; color:${PAPER}">${esc(n)}</div>`).join('');

  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<title>NévnapTárX napi Reel – ${esc(data.dateLabel)}</title>
<style>
@font-face{font-family:'Bricolage Grotesque';src:url('${fontsDir}/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2') format('woff2');font-weight:200 800;font-stretch:75% 100%;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';src:url('${fontsDir}/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-standard-normal.woff2') format('woff2');font-weight:200 800;font-stretch:75% 100%;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url('${fontsDir}/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+FEFF,U+FFFD}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url('${fontsDir}/@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-italic.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF}
@font-face{font-family:'Geist';src:url('${fontsDir}/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2') format('woff2');font-weight:100 900;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Geist';src:url('${fontsDir}/@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2') format('woff2');font-weight:100 900;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF}
html,body{margin:0;background:#000}
#stage{position:relative;width:1080px;height:1920px;overflow:hidden;background:${INK}}
.sheet{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;transform-origin:0 0;box-shadow:0 40px 120px rgba(0,0,0,.5)}
.mask{overflow:hidden;padding:0.26em 0.06em 0.16em;margin:-0.26em -0.06em -0.16em}
</style>
</head>
<body>
<div id="stage">

<!-- 5 · CLOSING: share + app -->
<section class="sheet" id="s5" style="background:${T.ground}">
  <div class="spin-b" style="position:absolute; left:470px; top:1330px">${flower(980, T.deep, T.ground)}</div>
  ${chrome(T.on, data.dateLabel)}
  <div id="s5-icon" style="position:absolute; left:80px; top:440px; width:190px; height:190px; border-radius:50%; background:${T.accent}; display:flex; align-items:center; justify-content:center">
    <svg aria-hidden="true" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${T.accent === '#FFC857' ? INK : '#FFFFFF'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2.5 10.5 13.5M21.5 2.5l-7 19-4-8-8-4 19-7Z"/></svg>
  </div>
  <div id="s5-head" style="position:absolute; left:80px; top:690px; width:868px">
    <div class="mask"><div id="s5-l1" style="font-family:'Instrument Serif',serif; font-style:italic; font-size:150px; line-height:1.02; color:${T.on}">Küldd el</div></div>
    <div id="s5-l2" data-fit="868,210,1250" style="font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-stretch:78%; font-size:150px; line-height:1.0; letter-spacing:-0.012em; white-space:nowrap; color:${T.on}">${data.sendTo.map((l) => `<div class="mask"><div class="s5-line" style="display:inline-block">${esc(l)}</div></div>`).join('')}</div>
  </div>
  <div id="s5-card" style="position:absolute; left:80px; top:1170px; width:868px; height:236px">
    <div style="position:absolute; left:0; top:0; width:868px; height:236px; box-sizing:border-box; padding:0 40px 0 34px; border:5px solid ${INK}; border-radius:56px; background:#FFFFFF; display:flex; align-items:center; gap:34px; rotate:-3deg">
      <img src="${iconSrc}" alt="" style="width:158px; height:158px; border-radius:36px; display:block">
      <div style="display:flex; flex-direction:column; gap:12px">
        <div style="font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:66px; line-height:1; letter-spacing:-0.02em; color:${INK}">NévnapTárX</div>
        <div style="font-family:'Geist',system-ui,sans-serif; font-weight:500; font-size:40px; line-height:1.1; color:${MUTED}">Letölthető: iOS + Android</div>
      </div>
    </div>
    <div style="position:absolute; right:26px; top:196px; height:104px; box-sizing:border-box; padding:0 40px; border:5px solid ${INK}; border-radius:52px; background:${T.accent}; color:${T.accent === '#FFC857' ? INK : '#FFFFFF'}; display:flex; align-items:center; font-family:'Geist',system-ui,sans-serif; font-weight:650; font-size:50px; letter-spacing:-0.01em; rotate:3deg">www.nevnap.app</div>
  </div>
</section>

<!-- 4 · OTHER NAMES TODAY + TOMORROW -->
<section class="sheet" id="s4" style="background:${INK}">
  ${chrome(PAPER, data.dateLabel)}
  <div class="mask" style="position:absolute; left:80px; top:400px; width:868px"><div id="s4-label" style="font-family:'Instrument Serif',serif; font-style:italic; font-size:84px; line-height:1.05; color:${LAV}">Ma még ünnepel</div></div>
  <div style="position:absolute; left:80px; top:530px; width:868px; display:flex; flex-direction:column; border-top:2px solid ${RULE}">${rows}
  </div>
  ${data.tomorrow ? `<div id="s4-tomorrow" style="position:absolute; left:80px; top:1240px; width:868px; height:170px; box-sizing:border-box; padding:0 28px 0 44px; border-radius:44px; background:${T.ground}; color:${T.on}; display:flex; align-items:center; justify-content:space-between">
    <div style="display:flex; align-items:baseline; gap:28px">
      <div style="font-family:'Geist',system-ui,sans-serif; font-weight:600; font-size:42px">Holnap</div>
      <div data-fit="480,78" style="font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:78px; letter-spacing:-0.02em; line-height:1; white-space:nowrap">${esc(data.tomorrow)}</div>
    </div>
    <div style="width:114px; height:114px; flex:none; border-radius:50%; background:${T.on}; display:flex; align-items:center; justify-content:center">
      <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="${T.ground}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </div>
  </div>` : ''}
</section>

<!-- 3 · MEANING -->
<section class="sheet" id="s3" style="background:${PAPER}">
  <div class="spin-b" style="position:absolute; left:640px; top:1300px">${flower(620, T.ground, PAPER)}</div>
  ${chrome(INK, data.dateLabel)}
  ${data.originLabel ? `<div id="s3-pill" style="position:absolute; left:80px; top:420px; height:84px; box-sizing:border-box; padding:0 36px; border:3px solid ${INK}; border-radius:42px; display:flex; align-items:center; white-space:nowrap; font-family:'Geist',system-ui,sans-serif; font-weight:600; font-size:40px; color:${INK}; transform-origin:0 50%">${esc(data.originLabel)}</div>` : ''}
  <div class="mask" style="position:absolute; left:80px; top:${data.originLabel ? 548 : 430}px; width:868px"><div id="s3-label" style="font-family:'Instrument Serif',serif; font-style:italic; font-size:84px; line-height:1.05; color:${INK}">${esc(data.meaningLabel)}</div></div>
  <div id="s3-meaning" data-lines="${data.meaningLines ? 1 : 0}" style="position:absolute; left:80px; top:${data.originLabel ? 690 : 572}px; width:868px; font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-stretch:82%; font-size:190px; line-height:0.98; letter-spacing:-0.018em; color:${INK}">${meaningLines}</div>
</section>

<!-- 2 · NAME (cover frame) -->
<section class="sheet" id="s2" style="background:${T.ground}">
  <div class="spin-b" style="position:absolute; left:-330px; top:1180px">${flower(1120, T.deep, T.ground)}</div>
  ${chrome(T.on, data.dateLabel)}
  <div id="s2-flower" style="position:absolute; left:632px; top:372px"><div class="spin-a">${flower(316, T.accent, T.accent === '#FFC857' ? INK : PAPER)}</div></div>
  <div style="position:absolute; left:80px; top:724px; width:868px">
    <div class="mask"><div id="s2-greet" style="font-family:'Instrument Serif',serif; font-style:italic; font-size:132px; line-height:1.02; white-space:nowrap; color:${T.on}">Boldog névnapot,</div></div>
    <div id="s2-name" data-fit="868,330,1420" style="font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-stretch:78%; font-size:240px; line-height:0.94; letter-spacing:-0.012em; color:${T.on}">${nameLines}</div>
  </div>
</section>

<!-- 1 · HOOK: yesterday's sheet tears off the calendar -->
<section class="sheet" id="s1" style="background:${INK}">
  ${chrome(PAPER)}
  <div id="s1-cal" style="position:absolute; left:210px; top:344px; width:660px; height:740px; transform:rotate(-4deg)">
    <div style="position:absolute; left:0; top:0; width:660px; height:740px; border-radius:52px; background:${LAV}; transform:rotate(7deg) translate(22px,6px)"></div>
    <div style="position:absolute; left:0; top:0; width:660px; height:740px; border-radius:52px; background:${PAPER}; overflow:hidden; display:flex; flex-direction:column">
      <div style="height:170px; flex:none; background:${T.ground}; color:${T.on}; display:flex; align-items:flex-end; justify-content:center; padding-bottom:34px; box-sizing:border-box; font-family:'Geist',system-ui,sans-serif; font-weight:700; font-size:54px; letter-spacing:0.1em">${esc(data.monthUpper)}</div>
      <div style="position:relative; flex:1">
        <div id="s1-today" style="position:absolute; left:0; top:0; width:660px; height:570px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px">
          <div style="font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:390px; line-height:0.86; letter-spacing:-0.04em; color:${INK}">${esc(data.day)}</div>
          <div style="font-family:'Geist',system-ui,sans-serif; font-weight:600; font-size:56px; color:${MUTED}">${esc(data.weekday)}</div>
        </div>
      </div>
    </div>
    <div id="s1-tear" style="position:absolute; left:0; top:170px; width:660px; height:570px; border-radius:0 0 52px 52px; background:#ECE8FF; transform-origin:0 0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; box-shadow:0 18px 40px rgba(14,15,28,.28)">
      <div style="font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:390px; line-height:0.86; letter-spacing:-0.04em; color:${INK}">${esc(data.yesterdayDay)}</div>
      <div style="font-family:'Geist',system-ui,sans-serif; font-weight:600; font-size:56px; color:${MUTED}">${esc(data.yesterdayWeekday)}</div>
    </div>
    <div style="position:absolute; left:150px; top:-34px; width:32px; height:96px; border-radius:16px; background:${PAPER}"></div>
    <div style="position:absolute; left:478px; top:-34px; width:32px; height:96px; border-radius:16px; background:${PAPER}"></div>
  </div>
  <div style="position:absolute; left:80px; top:1128px; width:868px; font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-stretch:88%; font-size:128px; line-height:1.0; letter-spacing:-0.018em; color:${PAPER}">
    <div class="mask"><div class="s1-q">Kinek van ma</div></div>
    <div class="mask"><div class="s1-q" style="color:${T.spark}">névnapja?</div></div>
  </div>
</section>

<!-- BRAND STICKER: above every sheet during scenes 1–4. Its bottom edge (~1620px)
     stays clear of the lower ~300px that Reels/TikTok cover with the caption. -->
<div id="stk" style="position:absolute; left:80px; top:1470px; display:inline-flex">
  <div id="stk-a" style="height:128px; box-sizing:border-box; padding:0 36px 0 16px; border:4px solid ${INK}; border-radius:38px; background:#FFFFFF; display:flex; align-items:center; gap:22px; rotate:-4deg">
    <img src="${iconSrc}" alt="" style="width:92px; height:92px; border-radius:22px; display:block">
    <div style="display:flex; flex-direction:column; gap:8px">
      <div style="font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:48px; line-height:1; letter-spacing:-0.02em; color:${INK}">NévnapTárX</div>
      <div style="font-family:'Geist',system-ui,sans-serif; font-weight:500; font-size:32px; line-height:1; white-space:nowrap; color:${MUTED}">Letölthető: iOS + Android</div>
    </div>
  </div>
  <div id="stk-b" style="position:absolute; left:calc(100% - 150px); top:-34px; height:72px; box-sizing:border-box; padding:0 28px; border:4px solid ${INK}; border-radius:36px; background:${T.accent}; color:${T.accent === '#FFC857' ? INK : '#FFFFFF'}; display:flex; align-items:center; white-space:nowrap; font-family:'Geist',system-ui,sans-serif; font-weight:650; font-size:36px; letter-spacing:-0.01em; rotate:3deg">www.nevnap.app</div>
</div>

</div>
<script>
const TOTAL = ${DURATION * 1000};
const OUT = 'cubic-bezier(.16,1,.3,1)';      // fast in, soft landing
const BACK = 'cubic-bezier(.34,1.56,.64,1)'; // slight overshoot
const TEAR = 'cubic-bezier(.6,.02,.9,.4)';   // tear-off: accelerates away
const anims = [];
const $$ = (sel) => [...document.querySelectorAll(sel)];
function an(sel, frames, at, dur, easing = OUT, stagger = 0, fill = 'both') {
  $$(sel).forEach((el, i) => {
    const a = el.animate(frames, { delay: (at + i * stagger) * 1000, duration: dur * 1000, easing, fill });
    a.pause(); anims.push(a);
  });
}
const up = [{ transform: 'translateY(112%)' }, { transform: 'translateY(0)' }];
const pop = [{ transform: 'scale(0)' }, { transform: 'scale(1)' }];
const tear = [{ transform: 'translate(0,0) rotate(0deg)' }, { transform: 'translate(-70px,-2200px) rotate(-9deg)' }];

// Size every data-driven text block to its box, so any name or meaning fits.
function fit() {
  const textW = (c) => { const r = document.createRange(); r.selectNodeContents(c); return r.getBoundingClientRect().width; };
  // data-fit="maxWidth,maxFontSize[,maxBottom]": the widest line (each child is a
  // line; no children = the element itself) must fit maxWidth, and the block
  // must end above the stage y-coordinate maxBottom (several names stack up).
  for (const el of $$('[data-fit]')) {
    const [maxW, maxSize, maxBottom] = el.dataset.fit.split(',').map(Number);
    const lines = el.children.length ? [...el.children] : [el];
    let size = Math.min(100, maxSize);
    for (let pass = 0; pass < 4; pass += 1) { // the optical-size axis makes width non-linear in font-size, so iterate
      el.style.fontSize = size + 'px';
      const w = Math.max(...lines.map(textW));
      size = Math.min(maxSize, Math.floor((maxW / w) * size));
    }
    el.style.fontSize = size + 'px';
    while (maxBottom && size > 40 && el.getBoundingClientRect().bottom > maxBottom) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
  }
  const g = document.querySelector('#s2-greet');
  { const w = textW(g); if (w > 868) g.style.fontSize = Math.floor(132 * 868 / w) + 'px'; }
  // the closing sticker sits below the (possibly two-line) headline
  document.querySelector('#s5-card').style.top = Math.max(1170, Math.round(document.querySelector('#s5-head').getBoundingClientRect().bottom + 64)) + 'px';
  const m = document.querySelector('#s3-meaning');
  const maxH = 640;
  if (m.dataset.lines === '1') { // short meanings: one word per line
    const lines = $$('#s3-meaning .mline');
    const cap = Math.floor(Math.min(230, maxH / (lines.length * 0.98)));
    let size = Math.min(100, cap);
    for (let pass = 0; pass < 4; pass += 1) {
      m.style.fontSize = size + 'px';
      size = Math.min(cap, Math.floor((868 / Math.max(...lines.map(textW))) * size));
    }
    m.style.fontSize = size + 'px';
  } else { // longer meanings: a wrapped paragraph, as large as fits
    let size = 214; m.style.lineHeight = '1.0';
    do { size -= 4; m.style.fontSize = size + 'px'; } while ((m.scrollHeight > maxH || m.scrollWidth > m.clientWidth) && size > 56);
  }
}

function build() {
  fit();
  // 1 · hook
  an('#s1-cal', [{ transform: 'rotate(-9deg) scale(1.1)' }, { transform: 'rotate(-4deg) scale(1)' }], 0, 0.9);
  an('.s1-q', up, -0.3, 0.6, OUT, 0.06);
  an('#s1-tear', [{ transform: 'translate(0,0) rotate(0deg)', offset: 0 }, { transform: 'translate(0,0) rotate(7deg)', offset: 0.3, easing: 'cubic-bezier(.5,0,.9,.5)' }, { transform: 'translate(420px,-1500px) rotate(34deg)', offset: 1 }], 0.3, 0.75, 'ease-out', 0, 'forwards');
  an('#s1-today', [{ transform: 'scale(.86)' }, { transform: 'scale(1)' }], 0.62, 0.6, BACK);
  an('#s1', tear, 1.85, 0.55, TEAR, 0, 'forwards');
  // 2 · name
  an('#s2-greet', up, 2.0, 0.7);
  an('#s2-name .ch', up, 2.12, 0.75, OUT, 0.035);
  an('#s2-flower', [{ transform: 'scale(0) rotate(-120deg)' }, { transform: 'scale(1) rotate(0deg)' }], 2.3, 0.9, BACK);
  an('#s2', tear, 4.75, 0.55, TEAR, 0, 'forwards');
  // 3 · meaning
  an('#s3-pill', pop, 4.95, 0.5, BACK);
  an('#s3-label', up, 5.0, 0.65);
  an('#s3-meaning .mline', up, 5.15, 0.7, OUT, 0.11);
  an('#s3-meaning .mpara', [{ transform: 'translateY(60px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], 5.15, 0.7);
  an('#s3', tear, 7.15, 0.55, TEAR, 0, 'forwards');
  // 4 · other names + tomorrow
  an('#s4-label', up, 7.35, 0.6);
  an('#s4 .row', [{ transform: 'translateX(-60px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], 7.45, 0.55, OUT, 0.07);
  an('#s4-tomorrow', [{ transform: 'translateY(90px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], 7.95, 0.6);
  an('#s4', tear, 9.35, 0.55, TEAR, 0, 'forwards');
  // 5 · closing
  an('#s5-icon', pop, 9.55, 0.6, BACK);
  an('#s5-l1', up, 9.6, 0.65);
  an('.s5-line', up, 9.72, 0.7, OUT, 0.1);
  an('#s5-card', [{ transform: 'translateY(110px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], 9.95, 0.65);
  // brand sticker: pops in after the hook, hands over to its large version on the closing scene
  an('#stk-a', pop, 0.6, 0.55, BACK);
  an('#stk-b', pop, 0.78, 0.55, BACK);
  an('#stk', [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.7)', opacity: 0 }], 9.3, 0.28, 'ease-in', 0, 'forwards');
  // slow continuous rotation of the flowers
  an('.spin-a', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(70deg)' }], 0, TOTAL / 1000, 'linear');
  an('.spin-b', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-28deg)' }], 0, TOTAL / 1000, 'linear');
}

window.__ready = document.fonts.ready.then(() => Promise.all([...document.fonts].map((f) => f.load()))).then(() => { build(); return true; });
window.__seek = (ms) => { for (const a of anims) a.currentTime = ms; };
if (location.hash === '#play') window.__ready.then(() => { const t0 = performance.now(); (function loop() { window.__seek((performance.now() - t0) % TOTAL); requestAnimationFrame(loop); })(); });
</script>
</body>
</html>`;
}
