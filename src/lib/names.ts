/**
 * Data layer for the nevnap.app site.
 *
 * Reads the bundled `nevnapok.json` (1500 names indexed by date) and
 * `name_meanings.json` (name → meaning string). Exposes helpers used by both
 * the static pages and the dynamic [name]/[date] routes.
 *
 * All lookups are diacritic- and case-insensitive — the user types "anna"
 * and we find "Anna". The slug builder preserves diacritics for SEO-friendly
 * URLs (`/name/Anna`), since modern search engines handle them fine.
 */

import nameDaysData from '../data/nevnapok.json';
import meaningsData from '../data/name_meanings.json';

export interface NameDayEntry {
  month: number;
  day: number;
  primary: string[];
  secondary: string[];
}

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  iso: string;
}

interface NameDaysFile {
  namedays: NameDayEntry[];
}

const BUDAPEST_TIME_ZONE = 'Europe/Budapest';
const NAME_DAYS = (nameDaysData as NameDaysFile).namedays;
const MEANINGS = meaningsData as Record<string, string>;

/** All entries indexed by 'MM-DD'. */
const ENTRIES_BY_DATE: Map<string, NameDayEntry> = new Map();
for (const entry of NAME_DAYS) {
  ENTRIES_BY_DATE.set(dateKey(entry.month, entry.day), entry);
}

/** name → list of dates (in calendar order). */
const DATES_BY_NAME: Map<string, NameDayEntry[]> = new Map();
for (const entry of NAME_DAYS) {
  for (const list of [entry.primary, entry.secondary]) {
    for (const name of list) {
      const key = normalize(name);
      if (!DATES_BY_NAME.has(key)) DATES_BY_NAME.set(key, []);
      DATES_BY_NAME.get(key)!.push(entry);
    }
  }
}

/** Sorted set of unique names (capitalized canonical form). */
const ALL_NAMES_CANONICAL: string[] = [];
{
  const seen = new Map<string, string>();
  for (const entry of NAME_DAYS) {
    for (const list of [entry.primary, entry.secondary]) {
      for (const name of list) {
        const key = normalize(name);
        if (!seen.has(key)) seen.set(key, name);
      }
    }
  }
  ALL_NAMES_CANONICAL.push(...Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'hu')
  ));
}

/**
 * Strip diacritics + lowercase, used as a lookup key.
 * "Áron" → "aron", "Mirkó" → "mirko"
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áÁ]/g, 'a')
    .replace(/[éÉ]/g, 'e')
    .replace(/[íÍ]/g, 'i')
    .replace(/[óÓöÖőŐ]/g, 'o')
    .replace(/[úÚüÜűŰ]/g, 'u')
    .trim();
}

/** "MM-DD" format used as map key. */
export function dateKey(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whole list of canonical name strings, sorted Hungarian-locale-aware. */
export function getAllNames(): string[] {
  return ALL_NAMES_CANONICAL;
}

/** Get nameday entry for a given month/day (1-indexed). */
export function getEntryByDate(month: number, day: number): NameDayEntry | undefined {
  return ENTRIES_BY_DATE.get(dateKey(month, day));
}

/** Hungarian calendar day for a given instant, independent of the build machine timezone. */
export function getBudapestCalendarDate(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUDAPEST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day', string>;

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return {
    year,
    month,
    day,
    iso: `${values.year}-${values.month}-${values.day}`,
  };
}

/** Add days to a plain calendar date without depending on local timezone getters. */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  const year = next.getUTCFullYear();
  const month = next.getUTCMonth() + 1;
  const day = next.getUTCDate();

  return {
    year,
    month,
    day,
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/** Today's entry, based on the Hungarian calendar day. */
export function getTodayEntry(now: Date = new Date()): NameDayEntry | undefined {
  const today = getBudapestCalendarDate(now);
  return getEntryByDate(today.month, today.day);
}

/** Get the next N entries from today (inclusive). */
export function getUpcoming(n: number, now: Date = new Date()): {
  date: CalendarDate;
  entry: NameDayEntry | undefined;
  daysAhead: number;
}[] {
  const out = [];
  const today = getBudapestCalendarDate(now);
  for (let i = 0; i < n; i++) {
    const d = addCalendarDays(today, i);
    out.push({
      date: d,
      entry: getEntryByDate(d.month, d.day),
      daysAhead: i,
    });
  }
  return out;
}

/** All dates a name appears on (any form). */
export function getDatesForName(name: string): NameDayEntry[] {
  return DATES_BY_NAME.get(normalize(name)) ?? [];
}

/** Resolve the meaning text (case-insensitive). */
export function getMeaning(name: string): string | null {
  const upper = name.toUpperCase();
  // Direct match first
  if (MEANINGS[upper]) return MEANINGS[upper];
  // Fall back to a normalized scan (slower but robust)
  const norm = normalize(name);
  for (const [key, value] of Object.entries(MEANINGS)) {
    if (normalize(key) === norm) return value;
  }
  return null;
}

/** A few related names — same letter group, deterministic. */
export function getRelatedNames(name: string, max = 8): string[] {
  const target = normalize(name);
  const firstLetter = target[0];
  const candidates = ALL_NAMES_CANONICAL.filter(
    (n) => normalize(n)[0] === firstLetter && normalize(n) !== target,
  );
  return candidates.slice(0, max);
}

/** True when a name is primary on its date (used for emphasis). */
export function isPrimary(name: string, entry: NameDayEntry): boolean {
  const norm = normalize(name);
  return entry.primary.some((n) => normalize(n) === norm);
}
