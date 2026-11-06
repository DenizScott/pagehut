import type { DatabaseData, Property, Row } from "./types";

/**
 * Date helpers for the calendar and timeline views. Date cells hold "YYYY-MM-DD" strings (no time,
 * no time zone), so all arithmetic is done on UTC days: a date never shifts with the viewer's
 * time zone or daylight saving.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86_400_000;

/** Days since 1970-01-01 for a "YYYY-MM-DD" string, or undefined if it isn't one. */
export function dayNumber(iso: unknown): number | undefined {
  if (typeof iso !== "string") return undefined;
  const m = ISO.exec(iso);
  if (!m) return undefined;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // Reject impossible dates such as 2026-02-31.
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return undefined;
  return Math.round(t / DAY);
}

export const isoFromDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

/** Today in the viewer's own calendar, as "YYYY-MM-DD". */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Monday-first for most locales; Sunday-first for English (US) and a few others. */
export function weekStartsOn(locale: string): 0 | 1 {
  return /^(en(-US)?|he|ja|ko|pt-BR|zh-TW)$/i.test(locale) ? 0 : 1;
}

/**
 * The weeks shown for a month: full weeks from the week containing the 1st to the week containing
 * the last day. Each entry is "YYYY-MM-DD".
 */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): string[][] {
  const first = Math.round(Date.UTC(year, month, 1) / DAY);
  const last = Math.round(Date.UTC(year, month + 1, 0) / DAY);
  const weekday = (day: number) => new Date(day * DAY).getUTCDay();
  const start = first - ((weekday(first) - weekStart + 7) % 7);
  const end = last + ((weekStart + 6 - weekday(last) + 7) % 7);
  const weeks: string[][] = [];
  for (let d = start; d <= end; d += 7) weeks.push(Array.from({ length: 7 }, (_, i) => isoFromDay(d + i)));
  return weeks;
}

export const dateProperties = (data: DatabaseData): Property[] => data.properties.filter((p) => p.type === "date");

/** Calendar: rows by their date, in view order. Rows without a valid date are left out. */
export function rowsByDay(rows: Row[], propId: string | undefined): Map<string, Row[]> {
  const map = new Map<string, Row[]>();
  if (!propId) return map;
  for (const row of rows) {
    const v = row.cells[propId];
    if (dayNumber(v) === undefined) continue;
    const key = v as string;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

export interface TimelineItem {
  row: Row;
  /** First and last day (inclusive), as day numbers. */
  start: number;
  end: number;
}

export interface Timeline {
  items: TimelineItem[];
  /** Rows the view shows that have no usable start date (listed separately). */
  undated: Row[];
  /** First and last day of the visible range (inclusive), padded to whole weeks. */
  from: number;
  to: number;
}

/**
 * Timeline: each row from its start date to its end date (or a single day). An end before the
 * start is treated as the same day, so a typo never hides a row.
 */
export function timeline(rows: Row[], startId: string | undefined, endId: string | undefined, weekStart: 0 | 1, today: number): Timeline {
  const items: TimelineItem[] = [];
  const undated: Row[] = [];
  for (const row of rows) {
    const start = startId ? dayNumber(row.cells[startId]) : undefined;
    if (start === undefined) {
      undated.push(row);
      continue;
    }
    const end = endId ? dayNumber(row.cells[endId]) : undefined;
    items.push({ row, start, end: end !== undefined && end >= start ? end : start });
  }
  const min = Math.min(today, ...items.map((i) => i.start));
  const max = Math.max(today, ...items.map((i) => i.end));
  const weekday = (day: number) => new Date(day * DAY).getUTCDay();
  const from = min - ((weekday(min) - weekStart + 7) % 7);
  const to = Math.max(max + ((weekStart + 6 - weekday(max) + 7) % 7), from + 27); // at least 4 weeks
  return { items, undated, from, to };
}
