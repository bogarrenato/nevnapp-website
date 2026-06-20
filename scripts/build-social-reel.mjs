import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

const rootDir = process.cwd();
const socialDir = path.join(rootDir, 'dist', 'social');
const imagePath = path.join(socialDir, 'today.png');
const jsonPath = path.join(socialDir, 'today.json');
const framePath = path.join(socialDir, 'today-reel-frame.png');
const videoPath = path.join(socialDir, 'today-reel.mp4');
const reelFps = 30;
const reelDurationSeconds = 8;
const reelFrameCount = reelFps * reelDurationSeconds;
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

const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const primaryName = meta.primaryNames?.[0] ?? 'Mai névnap';
const dateLabel = meta.date?.label ?? '';
const hashtagLabel = buildReelHashtags(meta.primaryNames ?? []);

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

const ghostCard = await sharp(imagePath)
  .resize(900, 900, { fit: 'inside' })
  .blur(10)
  .modulate({ brightness: 0.62, saturation: 1.15 })
  .png()
  .toBuffer();

const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
  </defs>
  <rect width="1080" height="1920" fill="#110f24" opacity="0.22"/>
  <rect width="1080" height="1920" fill="#020617" opacity="0.18"/>
  <circle cx="1050" cy="160" r="260" fill="#ffffff" opacity="0.10"/>
  <circle cx="-80" cy="1780" r="340" fill="#7c5cf6" opacity="0.22"/>

  <text x="90" y="190" fill="#ffffff" opacity="0.82" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="800">NévnapTárX</text>
  <text x="90" y="250" fill="#dcd7ff" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(dateLabel)}</text>
</svg>`);

await sharp(background)
  .composite([
    {
      input: ghostCard,
      left: 90,
      top: -210,
    },
    {
      input: ghostCard,
      left: 90,
      top: 1240,
    },
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

const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nevnap-reel-frames-'));
await renderAnimatedFrames(framePath, frameDir, { primaryName, dateLabel, hashtagLabel });

const ffmpegArgs = [
  '-y',
  '-framerate',
  String(reelFps),
  '-i',
  path.join(frameDir, 'frame-%04d.png'),
];

if (hasAudio) {
  ffmpegArgs.push(
    '-stream_loop',
    '-1',
    '-i',
    audioPath,
    '-filter_complex',
    '[0:v]format=yuv420p[v];[1:a]volume=0.82,afade=t=in:st=0:d=0.25,afade=t=out:st=7.4:d=0.6[a]',
    '-map',
    '[v]',
    '-map',
    '[a]',
  );
} else {
  ffmpegArgs.push(
    '-vf',
    'format=yuv420p',
  );
}

ffmpegArgs.push(
  '-frames:v',
  String(reelFrameCount),
  '-t',
  String(reelDurationSeconds),
  '-c:v',
  'libx264',
  '-profile:v',
  'high',
  '-level:v',
  '4.1',
  '-pix_fmt',
  'yuv420p',
);

if (hasAudio) {
  ffmpegArgs.push(
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-shortest',
  );
}

ffmpegArgs.push(
  '-movflags',
  '+faststart',
  videoPath,
);

try {
  execFileSync('ffmpeg', ffmpegArgs, {
    stdio: 'inherit',
  });
} finally {
  fs.rmSync(frameDir, { recursive: true, force: true });
}

const stats = fs.statSync(videoPath);
console.log(`Created ${path.relative(rootDir, videoPath)} (${Math.round(stats.size / 1024)} KB)`);
console.log(
  hasAudio
    ? `Mixed audio from ${path.relative(rootDir, audioPath)}`
    : 'No reel audio found. Add licensed audio at public/audio/reel-music.mp3 or set REEL_AUDIO_PATH.',
);

function escapeXml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function renderAnimatedFrames(baseFramePath, outputDir, { primaryName, dateLabel, hashtagLabel }) {
  const baseFrame = fs.readFileSync(baseFramePath);

  for (let frame = 0; frame < reelFrameCount; frame += 1) {
    const t = frame / reelFps;
    const overlay = Buffer.from(createMotionOverlay({ t, frame, primaryName, dateLabel, hashtagLabel }));
    const outputPath = path.join(outputDir, `frame-${String(frame + 1).padStart(4, '0')}.png`);

    await sharp(baseFrame)
      .composite([{ input: overlay, left: 0, top: 0 }])
      .png()
      .toFile(outputPath);
  }
}

function createMotionOverlay({ t, frame, primaryName, hashtagLabel }) {
  const name = escapeXml(primaryName);
  const hashtags = escapeXml(hashtagLabel);
  const lead = animatePop(t, 0.1, 0.9);
  const nameIn = animatePop(t, 0.7, 1.7);
  const siteIn = animateHoldSlide(t, 4.05, 4.85, 6.55, 7.15);
  const greetIn = animatePop(t, 3.0, 3.9);
  const tagIn = animatePop(t, 5.1, 6.0);

  const leadX = lerp(-260, 540, lead.p);
  const leadY = 342 + Math.sin(t * 8) * 7;
  const leadRotate = lerp(-28, 3, lead.p) + Math.sin(t * 10) * 2;
  const leadScale = lerp(0.78, 1, lead.p);

  const nameX = lerp(1420, 540, nameIn.p);
  const nameY = 1492 - Math.sin(nameIn.p * Math.PI) * 125 + Math.sin(t * 7) * 6;
  const nameRotate = lerp(34, -2, nameIn.p) + Math.sin(t * 9) * 2.5;
  const nameScale = lerp(0.64, 1.08, nameIn.p);

  const siteX = siteIn.leaving > 0
    ? lerp(540, 1430, siteIn.leaving)
    : lerp(-520, 540, siteIn.entering);
  const siteY = 1450 + Math.sin(t * 4.6) * 5;
  const siteRotate = lerp(-8, 1.5, siteIn.entering) + Math.sin(t * 6) * 1.2;
  const siteScale = 0.98 + Math.sin(t * Math.PI * 2) * 0.018;

  const greetX = lerp(-520, 540, greetIn.p);
  const greetY = 1698 - Math.sin(greetIn.p * Math.PI) * 58;
  const greetRotate = lerp(-18, 1, greetIn.p) + Math.sin(t * 11) * 2;

  const tagX = lerp(1320, 540, tagIn.p);
  const tagY = 1794 + Math.sin(t * 5) * 8;
  const tagRotate = lerp(16, -1, tagIn.p);

  const pulse = 1 + Math.sin(t * Math.PI * 2.4) * 0.025;
  const sweepX = -650 + ((frame * 11) % 1900);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="hotGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffda6b"/>
      <stop offset="0.38" stop-color="#ff4fc3"/>
      <stop offset="0.72" stop-color="#7c5cff"/>
      <stop offset="1" stop-color="#21f4d5"/>
    </linearGradient>
    <linearGradient id="cyanPink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#26f7d0"/>
      <stop offset="0.45" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#ff63d8"/>
    </linearGradient>
    <linearGradient id="siteGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#11142f"/>
      <stop offset="0.52" stop-color="#172047"/>
      <stop offset="1" stop-color="#102d36"/>
    </linearGradient>
    <linearGradient id="siteStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffda6b"/>
      <stop offset="0.5" stop-color="#ff4fc3"/>
      <stop offset="1" stop-color="#21f4d5"/>
    </linearGradient>
    <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#ff4fc3" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="#26f7d0" flood-opacity="0.38"/>
    </filter>
    <filter id="deepShadow" x="-70%" y="-70%" width="240%" height="240%">
      <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#030712" flood-opacity="0.60"/>
    </filter>
  </defs>

  <rect x="${sweepX}" y="-80" width="180" height="2100" rx="90" fill="#ffffff" opacity="0.11" transform="rotate(18 ${sweepX + 90} 960)"/>
  ${confettiSvg(t)}

  <g opacity="${lead.opacity}" transform="translate(${leadX} ${leadY}) rotate(${leadRotate}) scale(${leadScale})" filter="url(#glow)">
    <rect x="-248" y="-52" width="496" height="104" rx="52" fill="url(#hotGrad)" opacity="0.92"/>
    <text x="0" y="15" text-anchor="middle" fill="#ffffff" stroke="#15162d" stroke-width="6" paint-order="stroke fill" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="900" letter-spacing="3">MAI NÉVNAP</text>
  </g>

  <g opacity="${nameIn.opacity}" transform="translate(${nameX} ${nameY}) rotate(${nameRotate}) scale(${nameScale * pulse})" filter="url(#deepShadow)">
    <text x="0" y="0" text-anchor="middle" fill="url(#cyanPink)" stroke="#08091c" stroke-width="18" paint-order="stroke fill" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="900">${name}</text>
    <text x="0" y="0" text-anchor="middle" fill="url(#cyanPink)" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="900">${name}</text>
  </g>

  <g opacity="${siteIn.opacity}" transform="translate(${siteX} ${siteY}) rotate(${siteRotate}) scale(${siteScale})" filter="url(#glow)">
    <rect x="-336" y="-46" width="672" height="92" rx="46" fill="url(#siteStroke)" opacity="0.98"/>
    <rect x="-322" y="-34" width="644" height="68" rx="34" fill="url(#siteGrad)" opacity="0.95"/>
    <text x="0" y="15" text-anchor="middle" fill="#ffffff" stroke="#070817" stroke-width="8" paint-order="stroke fill" font-family="Inter, Arial, sans-serif" font-size="50" font-weight="900">www.nevnap.app</text>
  </g>

  <g opacity="${greetIn.opacity}" transform="translate(${greetX} ${greetY}) rotate(${greetRotate})" filter="url(#glow)">
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" stroke="#11142f" stroke-width="12" paint-order="stroke fill" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="900">Boldog névnapot!</text>
  </g>

  <g opacity="${tagIn.opacity}" transform="translate(${tagX} ${tagY}) rotate(${tagRotate})">
    <rect x="-355" y="-42" width="710" height="84" rx="42" fill="#0f1229" opacity="0.72"/>
    <text x="0" y="12" text-anchor="middle" fill="#dffdf8" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800">${hashtags}</text>
  </g>
</svg>`;
}

function buildReelHashtags(primaryNames) {
  const tags = ['magyar', 'névnap', 'névnaptárx', ...primaryNames.map(toHashtag).filter(Boolean)];
  return tags.map((tag) => `#${tag}`).join(' ');
}

function toHashtag(value) {
  return String(value).trim().replace(/[^\p{L}\p{N}_]/gu, '');
}

function animateHoldSlide(t, enterStart, enterEnd, exitStart, exitEnd) {
  const entering = easeOutBack(clamp((t - enterStart) / (enterEnd - enterStart), 0, 1));
  const leaving = clamp((t - exitStart) / (exitEnd - exitStart), 0, 1);
  const fadeIn = clamp((t - enterStart) / 0.28, 0, 1);
  const fadeOut = 1 - clamp((t - exitStart) / 0.35, 0, 1);

  return {
    entering,
    leaving,
    opacity: fadeIn * fadeOut,
  };
}

function confettiSvg(t) {
  const palette = ['#26f7d0', '#ff4fc3', '#ffe16b', '#7c5cff', '#ffffff', '#42a5ff'];
  const pieces = [];

  for (let index = 0; index < 38; index += 1) {
    const seed = index + 1;
    const x = (seed * 97 + Math.sin(t * 1.7 + seed) * 32) % 1080;
    const baseY = (seed * 137) % 1920;
    const y = (baseY + t * (90 + (seed % 7) * 18)) % 1920;
    const size = 6 + (seed % 5) * 3;
    const rotate = (t * 110 + seed * 31) % 360;
    const opacity = 0.18 + (seed % 5) * 0.055;
    const color = palette[seed % palette.length];

    if (seed % 3 === 0) {
      pieces.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(size / 2).toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`);
    } else {
      pieces.push(`<rect x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size}" height="${size}" rx="${size / 4}" fill="${color}" opacity="${opacity.toFixed(2)}" transform="rotate(${rotate.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
  }

  return pieces.join('\n  ');
}

function animatePop(t, start, end) {
  const raw = clamp((t - start) / (end - start), 0, 1);
  const p = easeOutBack(raw);
  const out = t > end + 2.25 ? clamp(1 - (t - end - 2.25) / 0.45, 0, 1) : 1;

  return {
    p,
    opacity: clamp(raw * 1.35, 0, 1) * out,
  };
}

function easeOutBack(value) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
