/**
 * Data layer for the nevnap.app site.
 *
 * Reads the bundled `nevnapok.json` (1500 names indexed by date) and
 * `name_meanings.json` (name → meaning string). Exposes helpers used by both
 * the static pages and the dynamic [name]/[date] routes.
 *
 * All lookups are diacritic- and case-insensitive — the user types "anna"
 * and we find "Anna". The slug builder preserves diacritics for SEO-friendly
 * URLs (`/nev/Anna`), since modern search engines handle them fine.
 */

import nameDaysData from '../data/nevnapok.json';
import meaningsData from '../data/name_meanings.json';

export interface NameDayEntry {
  month: number;
  day: number;
  primary: string[];
  secondary: string[];
}

interface NameDaysFile {
  namedays: NameDayEntry[];
}

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

/** Today's entry, with the system clock. */
export function getTodayEntry(now: Date = new Date()): NameDayEntry | undefined {
  return getEntryByDate(now.getMonth() + 1, now.getDate());
}

/** Get the next N entries from today (inclusive). */
export function getUpcoming(n: number, now: Date = new Date()): {
  date: Date;
  entry: NameDayEntry | undefined;
  daysAhead: number;
}[] {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      date: d,
      entry: getEntryByDate(d.getMonth() + 1, d.getDate()),
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
