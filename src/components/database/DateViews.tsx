"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { dayNumber, isoFromDay, monthGrid, rowsByDay, timeline, todayIso, weekStartsOn } from "@/lib/database/dates";
import { rowTitle } from "@/lib/database/query";
import type { DatabaseData } from "@/lib/database/types";
import { cn } from "@/lib/utils";
import type { Api } from "./DatabaseView";

const DAY_MS = 86_400_000;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** The view's date property, if it still exists and is a date. */
function dateProp(data: DatabaseData, id: string | undefined) {
  return data.properties.find((p) => p.id === id && p.type === "date");
}

/* ---------------- Calendar ---------------- */

/**
 * Month calendar: every row on the day of its date property. A table with one column per weekday,
 * so screen readers announce the weekday and the date of each cell.
 */
export function CalendarView({ api }: { api: Api }) {
  const t = useTranslations("database");
  const locale = useLocale();
  const headingId = useId();
  const { data, view, rows } = api;
  const prop = dateProp(data, view.dateProperty);
  const today = todayIso();
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));

  const weekStart = weekStartsOn(locale);
  const weeks = useMemo(() => monthGrid(month.y, month.m, weekStart), [month, weekStart]);
  const byDay = useMemo(() => rowsByDay(rows, prop?.id), [rows, prop?.id]);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(month.y, month.m, 1));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  if (!prop) return <p className="rounded-lg border border-hairline bg-canvas p-4 text-sm text-fg-muted">{t("calendar.needDate")}</p>;

  return (
    <div className="rounded-lg border border-hairline bg-canvas">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
        <h3 id={headingId} className="me-auto text-sm font-semibold capitalize" aria-live="polite">
          {monthLabel}
        </h3>
        <Button size="sm" variant="subtle" onClick={() => setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })}>
          {t("calendar.today")}
        </Button>
        <Button size="icon-sm" onClick={() => shift(-1)} aria-label={t("calendar.previous")}>
          <ChevronLeft className="rtl:rotate-180" />
        </Button>
        <Button size="icon-sm" onClick={() => shift(1)} aria-label={t("calendar.next")}>
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table aria-labelledby={headingId} className="w-full min-w-[42rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {weeks[0].map((iso) => (
                <th key={iso} scope="col" abbr={weekdayLong.format(utc(iso))} className="border-b border-hairline px-2 py-1 text-start text-xs font-medium text-fg-muted">
                  {weekday.format(utc(iso))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((iso) => {
                  const inMonth = Number(iso.slice(5, 7)) - 1 === month.m;
                  const items = byDay.get(iso) ?? [];
                  return (
                    <td
                      key={iso}
                      aria-label={longDate.format(utc(iso))}
                      className={cn("group h-24 border border-hairline p-1 align-top", !inMonth && "bg-surface-hover/50")}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          aria-current={iso === today ? "date" : undefined}
                          className={cn(
                            "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                            iso === today ? "bg-accent font-semibold text-accent-fg" : inMonth ? "text-fg" : "text-fg-subtle",
                          )}
                        >
                          {Number(iso.slice(8))}
                        </span>
                        <button
                          type="button"
                          onClick={() => api.addRow({ [prop.id]: iso })}
                          aria-label={t("calendar.addOn", { date: longDate.format(utc(iso)) })}
                          className="grid size-6 place-items-center rounded text-fg-muted opacity-0 group-hover:opacity-100 hover:bg-surface-hover focus-visible:opacity-100"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <ul className="space-y-0.5">
                        {items.map((row) => (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => api.openRow(row.id)}
                              className="block min-h-6 w-full truncate rounded bg-accent-soft px-1.5 text-start text-xs text-accent-text hover:bg-surface-active"
                            >
                              {rowTitle(data, row) || t("cell.untitledRow")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Timeline ---------------- */

const DAY_W = 28; // px per day

/**
 * Timeline (Gantt): one line per row, a bar from its start to its end date. Each bar is a button
 * whose name includes the dates, so the schedule reads well without seeing it.
 */
export function TimelineView({ api }: { api: Api }) {
  const t = useTranslations("database");
  const locale = useLocale();
  const { data, view, rows } = api;
  const start = dateProp(data, view.dateProperty);
  const end = dateProp(data, view.endProperty);
  const today = dayNumber(todayIso())!;
  const tl = useMemo(() => timeline(rows, start?.id, end?.id, weekStartsOn(locale), today), [rows, start?.id, end?.id, locale, today]);

  if (!start) return <p className="rounded-lg border border-hairline bg-canvas p-4 text-sm text-fg-muted">{t("timeline.needDate")}</p>;

  const days = tl.to - tl.from + 1;
  const width = days * DAY_W;
  const short = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const fmt = (day: number, f = long) => f.format(new Date(day * DAY_MS));
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => tl.from + i * 7);

  return (
    <div className="rounded-lg border border-hairline bg-canvas">
      <div className="overflow-x-auto">
        <div style={{ width: `calc(12rem + ${width}px)` }} className="relative">
          {/* Week scale */}
          <div className="flex border-b border-hairline text-xs text-fg-muted" aria-hidden="true">
            <div className="sticky start-0 z-10 w-48 shrink-0 bg-canvas" />
            {weeks.map((w) => (
              <div key={w} style={{ width: 7 * DAY_W }} className="shrink-0 border-s border-hairline px-1.5 py-1">
                {fmt(w, short)}
              </div>
            ))}
          </div>
          <ul aria-label={t("timeline.label", { name: view.name })}>
            {tl.items.map(({ row, start: s, end: e }) => {
              const title = rowTitle(data, row) || t("cell.untitledRow");
              const range = s === e ? fmt(s) : t("timeline.range", { start: fmt(s), end: fmt(e) });
              return (
                <li key={row.id} className="flex h-9 items-center border-b border-hairline/60">
                  <span className="sticky start-0 z-10 w-48 shrink-0 truncate bg-canvas px-2 text-sm">{title}</span>
                  <span className="relative h-full" style={{ width }}>
                    <button
                      type="button"
                      onClick={() => api.openRow(row.id)}
                      aria-label={`${title}, ${range}`}
                      title={range}
                      style={{ insetInlineStart: (s - tl.from) * DAY_W + 2, width: (e - s + 1) * DAY_W - 4 }}
                      className="absolute top-1.5 h-6 truncate rounded bg-accent px-2 text-start text-xs font-medium text-accent-fg hover:opacity-90"
                    >
                      {title}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          {/* Today */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-danger"
            style={{ insetInlineStart: `calc(12rem + ${(today - tl.from) * DAY_W + DAY_W / 2}px)` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-3 py-2 text-sm">
        <Button size="sm" variant="subtle" onClick={() => api.addRow({ [start.id]: isoFromDay(today) })}>
          <Plus /> {t("timeline.addToday")}
        </Button>
        {tl.undated.length > 0 && (
          <span className="text-fg-muted">
            {t("timeline.undated", { count: tl.undated.length })}{" "}
            {tl.undated.map((row, i) => (
              <span key={row.id}>
                {i > 0 && ", "}
                <button type="button" onClick={() => api.openRow(row.id)} className="underline underline-offset-2 hover:text-fg">
                  {rowTitle(data, row) || t("cell.untitledRow")}
                </button>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
