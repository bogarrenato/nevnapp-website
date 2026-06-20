import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const rootDir = process.cwd();
const socialDir = path.join(rootDir, 'dist', 'social');
const imagePath = path.join(socialDir, 'today.png');
const jsonPath = path.join(socialDir, 'today.json');
const framePath = path.join(socialDir, 'today-reel-frame.png');
const videoPath = path.join(socialDir, 'today-reel.mp4');

if (!fs.existsSync(imagePath) || !fs.existsSync(jsonPath)) {
  throw new Error('Run npm run build before npm run social:reel.');
}

const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const primaryName = meta.primaryNames?.[0] ?? 'Mai névnap';
const dateLabel = meta.date?.label ?? '';

const background = await sharp(imagePath)
  .resize(1080, 1920, { fit: 'cover' })
  .blur(30)
  .modulate({ brightness: 0.58, saturation: 1.1 })
  .png()
  .toBuffer();

const card = await sharp(imagePath)
  .resize(900, 900, { fit: 'inside' })
  .png()
  .toBuffer();

const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#c9fff5" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#090716" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="1080" height="1920" fill="#110f24" opacity="0.22"/>
  <circle cx="1050" cy="160" r="260" fill="#ffffff" opacity="0.10"/>
  <circle cx="-80" cy="1780" r="340" fill="#7c5cf6" opacity="0.22"/>

  <text x="90" y="190" fill="#ffffff" opacity="0.82" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="800">NévnapTárX</text>
  <text x="90" y="250" fill="#dcd7ff" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(dateLabel)}</text>

  <g transform="translate(1010 1460) rotate(-90)" filter="url(#softShadow)">
    <rect x="-20" y="-40" width="465" height="74" rx="37" fill="#101225" opacity="0.58"/>
    <text x="0" y="8" fill="url(#shine)" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800" letter-spacing="0">www.nevnap.app</text>
  </g>

  <text x="540" y="1590" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800">Boldog névnapot!</text>
  <text x="540" y="1645" text-anchor="middle" fill="#dcd7ff" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(primaryName)}</text>
</svg>`);

await sharp(background)
  .composite([
    {
      input: card,
      left: 90,
      top: 440,
    },
    {
      input: overlay,
      left: 0,
      top: 0,
    },
  ])
  .png()
  .toFile(framePath);

execFileSync('ffmpeg', [
  '-y',
  '-i',
  framePath,
  '-vf',
  'scale=1080:1920,zoompan=z=1+0.0009*on:d=240:s=1080x1920:fps=30,format=yuv420p',
  '-frames:v',
  '240',
  '-c:v',
  'libx264',
  '-profile:v',
  'high',
  '-level:v',
  '4.1',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  videoPath,
], {
  stdio: 'inherit',
});

const stats = fs.statSync(videoPath);
console.log(`Created ${path.relative(rootDir, videoPath)} (${Math.round(stats.size / 1024)} KB)`);

function escapeXml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
