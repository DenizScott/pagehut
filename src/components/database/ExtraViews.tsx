"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { chartData, chartGroupable, visibleProperties } from "@/lib/database/query";
import type { OptionColor, Row } from "@/lib/database/types";
import { cn } from "@/lib/utils";
import { Cell } from "./Cell";
import type { Api } from "./DatabaseView";
import { viewDisplayName } from "./view-name";

/** Solid bar colors with at least 3:1 contrast against the track in both themes. */
const barClass: Record<OptionColor, string> = {
  gray: "bg-border-control",
  moss: "bg-accent",
  blue: "bg-info",
  amber: "bg-warning",
  red: "bg-danger",
  purple: "bg-[color-mix(in_srgb,var(--info)_55%,var(--danger))]",
  teal: "bg-success",
  brown: "bg-idea",
};

/**
 * Chart view: horizontal bars, one per option of the group-by property. Every bar is a list item
 * with its label and value as text, so screen readers and printouts get the numbers too.
 */
export function ChartView({ api }: { api: Api }) {
  const t = useTranslations("database");
  const locale = useLocale();
  const captionId = useId();
  const { data, view, rows } = api;
  const group = data.properties.find((p) => p.id === view.groupBy && chartGroupable(p));
  const valueProp = data.properties.find((p) => p.id === view.chartValue && (p.type === "number" || p.type === "formula"));
  const agg = valueProp ? (view.chartAgg === "avg" ? "avg" : "sum") : "count";
  const bars = chartData(data, view, rows, { none: t("chart.none"), all: t("chart.all"), checked: t("chart.checked"), unchecked: t("chart.unchecked") });
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 0) || 1;
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const caption =
    agg === "count"
      ? t("chart.captionCount", { group: group?.name ?? t("chart.all") })
      : t(agg === "avg" ? "chart.captionAvg" : "chart.captionSum", { value: valueProp!.name, group: group?.name ?? t("chart.all") });

  return (
    <figure aria-labelledby={captionId} className="rounded-lg border border-hairline bg-canvas p-4">
      <figcaption id={captionId} className="mb-3 text-sm font-medium">
        {caption}
      </figcaption>
      {!group && <p className="mb-3 text-sm text-fg-muted">{t("chart.needGroup")}</p>}
      <ul className="space-y-2">
        {bars.map((b) => (
          <li key={b.key} className="grid grid-cols-[minmax(5rem,10rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate" title={b.label}>
              {b.label}
            </span>
            <span className="h-6 overflow-hidden rounded bg-surface-hover" aria-hidden="true">
              <span
                className={cn("block h-full rounded transition-[width] duration-200", b.color ? barClass[b.color] : "bg-accent")}
                style={{ width: `${b.value > 0 ? Math.max(2, (Math.abs(b.value) / max) * 100) : 0}%` }}
              />
            </span>
            <span className="min-w-10 text-end font-medium tabular-nums">
              {fmt.format(b.value)}
              {agg !== "count" && <span className="sr-only"> ({t("chart.rows", { count: b.rows })})</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Form view: one field per shown property; submitting adds a row. Useful for sign-ups, requests,
 * bug reports or feedback collected on a shared screen.
 */
export function FormView({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view } = api;
  const [draft, setDraft] = useState<Row["cells"]>({});
  const [sent, setSent] = useState(0);
  const fields = visibleProperties(data, view).filter((p) => p.type !== "formula");
  const row: Row = { id: "form-draft", order: 0, cells: draft };
  const empty = Object.values(draft).every((v) => v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0));

  return (
    <form
      aria-label={t("form.label", { name: viewDisplayName(view, t) })}
      className="max-w-xl rounded-lg border border-hairline bg-canvas p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (empty) return;
        api.addRow(Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== undefined)));
        setDraft({});
        setSent((n) => n + 1);
      }}
    >
      <p className="mb-3 text-sm text-fg-muted">{t("form.hint")}</p>
      {/* Keyed by the number of entries sent, so every field starts empty again after a send. */}
      <dl key={sent} className="grid grid-cols-[minmax(7rem,auto)_1fr] items-start gap-x-3 gap-y-1 text-sm">
        {fields.map((p) => (
          <div key={p.id} className="contents">
            <dt className="flex h-8 items-center text-fg-muted">{p.name}</dt>
            <dd className="min-w-0">
              <Cell
                variant="field"
                data={data}
                row={row}
                prop={p}
                ctx={api.ctx}
                relations={api.relations}
                label={p.name}
                onChange={(v) => setDraft((d) => ({ ...d, [p.id]: v }) as Row["cells"])}
                onAddOption={(n) => api.addOption(p.id, n)}
              />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={empty}>
          {t("form.submit")}
        </Button>
        <p role="status" className="text-sm text-success">
          {sent > 0 ? t("form.sent", { count: sent }) : ""}
        </p>
      </div>
    </form>
  );
}
