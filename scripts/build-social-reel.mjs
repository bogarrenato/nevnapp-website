/**
 * Builds dist/social/today-reel.mp4 — the daily 9:16 nameday video posted as a
 * Facebook/Instagram Reel, TikTok and YouTube Short.
 *
 * Pipeline: scripts/reel-template.mjs renders one HTML page → headless Chromium
 * (Playwright) steps it frame by frame → FFmpeg encodes H.264 + AAC.
 *
 * Requires: `npm run build` first (dist/social/today.json + today.png), FFmpeg on
 * PATH, and Playwright's Chromium (`npx playwright install chromium`, once).
 * Optional: REEL_AUDIO_PATH overrides public/audio/reel-music.mp3.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DURATION, FPS, REEL_VERSION, pickTheme, prepareReelData, renderReelHtml } from './reel-template.mjs';

const rootDir = process.cwd();
const socialDir = path.join(rootDir, 'dist', 'social');
const imagePath = path.join(socialDir, 'today.png');
const jsonPath = path.join(socialDir, 'today.json');
const videoPath = path.join(socialDir, 'today-reel.mp4');
const modulesDir = path.join(rootDir, 'node_modules');
const iconPath = path.join(rootDir, 'public', 'icons', 'app-icon.png');
const frameCount = Math.round(DURATION * FPS);
const defaultAudioPath = path.join(rootDir, 'public', 'audio', 'reel-music.mp3');
const audioPath = process.env.REEL_AUDIO_PATH
  ? path.resolve(rootDir, process.env.REEL_AUDIO_PATH)
  : defaultAudioPath;
const hasAudio = fs.existsSync(audioPath);

if (!fs.existsSync(imagePath) || !fs.existsSync(jsonPath)) {
  throw new Error('Run npm run build before npm run social:reel.');
}

if (process.env.REEL_AUDIO_PATH && !hasAudio) {
  throw new Error(`REEL_AUDIO_PATH points to a missing file: ${audioPath}`);
}

const fontProbe = path.join(modulesDir, '@fontsource-variable', 'bricolage-grotesque', 'files', 'bricolage-grotesque-latin-standard-normal.woff2');
if (!fs.existsSync(fontProbe)) {
  throw new Error('Reel fonts are missing from node_modules. Run npm ci (or npm install) first.');
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const meta = readJson(jsonPath);
const data = prepareReelData(meta, {
  namedays: readJson(path.join(rootDir, 'src', 'data', 'nevnapok.json')).namedays,
  meanings: readJson(path.join(rootDir, 'src', 'data', 'name_meanings.json')),
});
const theme = pickTheme(meta.date.iso);
const html = renderReelHtml({
  data,
  theme,
  fontsDir: pathToFileURL(modulesDir).href,
  iconSrc: pathToFileURL(iconPath).href,
});

// The page must be a file:// document so it may load the local font files.
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nevnap-reel-'));
const htmlPath = path.join(workDir, 'reel.html');
fs.writeFileSync(htmlPath, html);

const { chromium } = await import('playwright');
let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  fs.rmSync(workDir, { recursive: true, force: true });
  throw new Error(
    `Headless Chromium could not start. Run "npx playwright install chromium" once (CI: add --with-deps).\n${error.message}`,
  );
}

try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(() => window.__ready);
  if (pageErrors.length > 0) {
    throw new Error(`The reel template failed to initialise: ${pageErrors[0].message}`);
  }

  const ffmpeg = spawn('ffmpeg', buildFfmpegArgs(), { stdio: ['pipe', 'inherit', 'inherit'] });
  const encoded = new Promise((resolve, reject) => {
    ffmpeg.on('error', (error) => reject(new Error(`FFmpeg could not start: ${error.message}`)));
    ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}.`))));
  });
  // A dead FFmpeg surfaces through `encoded`; without this handler EPIPE would crash first.
  ffmpeg.stdin.on('error', () => {});

  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate((ms) => window.__seek(ms), (frame / FPS) * 1000);
    const png = await page.screenshot({ type: 'png' });
    if (ffmpeg.exitCode !== null) { break; }
    if (!ffmpeg.stdin.write(png)) {
      await Promise.race([new Promise((resolve) => ffmpeg.stdin.once('drain', resolve)), encoded.catch(() => {})]);
    }
  }
  ffmpeg.stdin.end();
  await encoded;
} finally {
  await browser.close();
  fs.rmSync(workDir, { recursive: true, force: true });
}

const stats = fs.statSync(videoPath);
fs.writeFileSync(path.join(socialDir, 'build.json'), JSON.stringify({
  imageDate: meta.date.iso,
  reelDate: meta.date.iso,
  reelVersion: REEL_VERSION,
  reelSha256: createHash('sha256').update(fs.readFileSync(videoPath)).digest('hex'),
}));
console.log(`Created ${path.relative(rootDir, videoPath)} (${Math.round(stats.size / 1024)} KB, ${frameCount} frames, theme: ${theme.key})`);
console.log(
  hasAudio
    ? `Mixed audio from ${path.relative(rootDir, audioPath)}`
    : 'No reel audio found. Add licensed audio at public/audio/reel-music.mp3 or set REEL_AUDIO_PATH.',
);

function buildFfmpegArgs() {
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'];

  if (hasAudio) {
    args.push(
      '-stream_loop', '-1',
      '-i', audioPath,
      '-filter_complex',
      `[1:a]volume=0.82,afade=t=in:st=0:d=0.25,afade=t=out:st=${DURATION - 0.7}:d=0.7[a]`,
      '-map', '0:v',
      '-map', '[a]',
      '-c:a', 'aac',
      '-b:a', '160k',
    );
  }

  args.push(
    '-frames:v', String(frameCount),
    '-t', String(DURATION),
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level:v', '4.1',
    '-pix_fmt', 'yuv420p',
    '-crf', '18',
    '-movflags', '+faststart',
    videoPath,
  );

  return args;
}
