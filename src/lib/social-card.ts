import { getBudapestCalendarDate, getEntryByDate, getMeaning } from './names';

const HU_MONTHS = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December',
];

export interface TodaySocialContent {
  date: {
    iso: string;
    label: string;
  };
  primaryNames: string[];
  secondaryNames: string[];
  title: string;
  meaning: string | null;
  meaningName: string | null;
  facebookCaption: string;
}

export function buildTodaySocialContent(now: Date = new Date()): TodaySocialContent {
  const date = getBudapestCalendarDate(now);
  const entry = getEntryByDate(date.month, date.day);
  const primaryNames = entry?.primary ?? [];
  const secondaryNames = entry?.secondary ?? [];
  const namesLabel = formatHungarianList(primaryNames);
  const dateLabel = `${HU_MONTHS[date.month - 1]} ${date.day}.`;
  const meaningName = primaryNames[0] ?? null;
  const meaning = meaningName ? getMeaning(meaningName) : null;
  const title = primaryNames.length
    ? `Ma ${namesLabel} névnapja van`
    : 'Mai névnap';

  return {
    date: {
      iso: date.iso,
      label: dateLabel,
    },
    primaryNames,
    secondaryNames,
    title,
    meaning,
    meaningName,
    facebookCaption: buildFacebookCaption({
      dateLabel,
      namesLabel,
      primaryNames,
      meaning,
      meaningName,
    }),
  };
}

export function createTodaySocialCardSvg(content: TodaySocialContent): string {
  const namesLabel = content.primaryNames.length
    ? formatHungarianList(content.primaryNames)
    : 'Mai névnap';
  const secondaryLabel = content.secondaryNames.length
    ? `További nevek ma: ${formatHungarianList(content.secondaryNames.slice(0, 5))}`
    : 'Magyar névnap-naptár minden napra';
  const meaningLabel = content.meaning
    ? compactMeaning(content.meaning)
    : 'Ne felejts el ma felköszönteni valakit.';

  const nameLines = wrapWords(namesLabel, 18, 3);
  const meaningLines = wrapWords(meaningLabel, 56, 4);
  const nameFontSize = namesLabel.length > 28 ? 74 : namesLabel.length > 18 ? 88 : 112;
  const nameStartY = 430 - Math.max(0, nameLines.length - 1) * 42;
  const meaningStartY = 690;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#201a38"/>
      <stop offset="0.52" stop-color="#7c5cf6"/>
      <stop offset="1" stop-color="#f7c6d9"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f8d66d"/>
      <stop offset="0.48" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#b8fff2"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#100a24" flood-opacity="0.34"/>
    </filter>
  </defs>

  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="910" cy="130" r="180" fill="#ffffff" opacity="0.16"/>
  <circle cx="145" cy="910" r="220" fill="#101225" opacity="0.24"/>

  <rect x="66" y="66" width="948" height="948" rx="54" fill="#111320" opacity="0.92" filter="url(#shadow)"/>
  <rect x="96" y="96" width="888" height="888" rx="38" fill="none" stroke="#ffffff" stroke-opacity="0.13" stroke-width="2"/>

  <text x="122" y="155" fill="#ffffff" opacity="0.74" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="0">NévnapTárX</text>
  <text x="122" y="220" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="800">Mai névnap</text>
  <text x="122" y="270" fill="#dcd7ff" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="700">${escapeXml(content.date.label)}</text>

  ${nameLines
    .map((line, index) => `<text x="122" y="${nameStartY + index * Math.round(nameFontSize * 1.05)}" fill="url(#accent)" font-family="Geist, Inter, Arial, sans-serif" font-size="${nameFontSize}" font-weight="800">${escapeXml(line)}</text>`)
    .join('\n  ')}

  <rect x="122" y="610" width="836" height="2" fill="#ffffff" opacity="0.14"/>

  ${meaningLines
    .map((line, index) => `<text x="122" y="${meaningStartY + index * 42}" fill="#f7f4ff" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="600">${escapeXml(line)}</text>`)
    .join('\n  ')}

  <text x="122" y="890" fill="#cfc8ff" font-family="Inter, Arial, sans-serif" font-size="27" font-weight="600">${escapeXml(secondaryLabel)}</text>
  <text x="122" y="946" fill="#ffffff" opacity="0.72" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700">https://www.nevnap.app</text>
  <text x="958" y="946" text-anchor="end" fill="#ffffff" opacity="0.55" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600">${escapeXml(content.date.iso)}</text>
</svg>`;
}

export function formatHungarianList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} és ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} és ${items[items.length - 1]}`;
}

function buildFacebookCaption(input: {
  dateLabel: string;
  namesLabel: string;
  primaryNames: string[];
  meaning: string | null;
  meaningName: string | null;
}): string {
  const lines = input.primaryNames.length
    ? [
        `📅 Ma, ${input.dateLabel.toLocaleLowerCase('hu-HU')} ${input.namesLabel} névnapja van.`,
        `🎉 Boldog névnapot minden ${input.namesLabel}nek!`,
      ]
    : [`📅 Ma, ${input.dateLabel.toLocaleLowerCase('hu-HU')} nincs kiemelt névnap az adatbázisban.`];

  if (input.meaning && input.meaningName) {
    lines.push('', `✨ ${input.meaningName} név: ${compactMeaning(input.meaning)}`);
  }

  lines.push(
    '',
    '💌 Mai névnapok és névjelentések:',
    'https://www.nevnap.app/',
    '',
    buildHashtags(input.primaryNames),
  );
  return lines.join('\n');
}

function buildHashtags(names: string[]): string {
  const tags = ['magyar', 'névnap', 'névnaptárx', ...names.map(toHashtag).filter(Boolean)];
  return [...new Set(tags)].map((tag) => `#${tag}`).join(' ');
}

function toHashtag(value: string): string {
  return value.normalize('NFC').replace(/[^\p{L}\p{N}_]/gu, '');
}

function compactMeaning(meaning: string): string {
  return meaning
    .replace(/^A\s+[^\s]+\s+név\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapWords(input: string, maxLineLength: number, maxLines: number): string[] {
  const words = input.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?]*$/, '')}...`;
  }
  return lines;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
