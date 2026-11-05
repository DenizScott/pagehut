"use client";

import { Check, ExternalLink, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { asList, cellText, optionById, type QueryContext } from "@/lib/database/query";
import type { CellValue, DatabaseData, OptionColor, Property, Row, SelectOption } from "@/lib/database/types";
import { cn } from "@/lib/utils";

/** Soft background + readable text per option color (both themes; see globals.css). */
export const optionClass: Record<OptionColor, string> = {
  gray: "bg-surface-active text-fg",
  moss: "bg-accent-soft text-accent-text",
  blue: "bg-info-soft text-info",
  amber: "bg-warning-soft text-warning",
  red: "bg-danger-soft text-danger",
  purple: "bg-[color-mix(in_srgb,var(--info-soft)_60%,var(--danger-soft))] text-fg",
  teal: "bg-success-soft text-success",
  brown: "bg-idea-soft text-idea",
};

export function OptionChip({ option }: { option: SelectOption }) {
  return <span className={cn("inline-block max-w-full truncate rounded px-1.5 py-px text-xs leading-5", optionClass[option.color])}>{option.name}</span>;
}

export interface RelationSource {
  /** Database pages that relations can point into: id -> title and data. */
  databases: Map<string, { title: string; data: DatabaseData }>;
}

export interface CellProps {
  data: DatabaseData;
  row: Row;
  prop: Property;
  ctx: QueryContext;
  relations: RelationSource;
  onChange: (value: CellValue | undefined) => void;
  onAddOption: (name: string) => string;
  /** Larger editors in the row dialog; compact in table cells. */
  variant?: "cell" | "field";
  label: string;
}

/** Shows a cell and edits it in place, by property type. */
export function Cell({ data, row, prop, ctx, relations, onChange, onAddOption, variant = "cell", label }: CellProps) {
  const t = useTranslations("database");
  const value = row.cells[prop.id];
  const base = cn("w-full min-w-0 text-start", variant === "cell" ? "min-h-8 px-2 py-1" : "min-h-8 rounded-md px-2 py-1 hover:bg-surface-hover");

  switch (prop.type) {
    case "checkbox":
      return (
        <label className={cn(base, "flex items-center")}>
          <input
            type="checkbox"
            aria-label={label}
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 accent-(--accent)"
          />
        </label>
      );
    case "formula":
      return (
        <div className={cn(base, "font-mono text-sm tabular-nums text-fg-muted")} aria-label={label}>
          {cellText(data, row, prop, ctx)}
        </div>
      );
    case "select":
    case "multiSelect":
      return (
        <OptionPicker
          prop={prop}
          selected={asList(value)}
          multi={prop.type === "multiSelect"}
          onChange={(ids) => onChange(prop.type === "select" ? ids[0] : ids)}
          onAddOption={onAddOption}
          label={label}
          className={base}
        />
      );
    case "relation": {
      const target = prop.relationTo ? relations.databases.get(prop.relationTo) : undefined;
      return (
        <RelationPicker
          target={target}
          selected={asList(value)}
          onChange={onChange}
          label={label}
          className={base}
          emptyLabel={prop.relationTo ? t("cell.noRows") : t("cell.pickDatabase")}
        />
      );
    }
    default:
      return <TextCell prop={prop} value={value} onChange={onChange} label={label} className={base} variant={variant} />;
  }
}

function TextCell({
  prop,
  value,
  onChange,
  label,
  className,
  variant,
}: {
  prop: Property;
  value: CellValue | undefined;
  onChange: (v: CellValue | undefined) => void;
  label: string;
  className: string;
  variant: "cell" | "field";
}) {
  const t = useTranslations("database");
  const [editing, setEditing] = useState(false);
  const text = value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(text);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft === text) return;
    if (prop.type === "number") {
      const n = Number(draft.replace(",", "."));
      onChange(draft.trim() === "" || !Number.isFinite(n) ? undefined : n);
    } else onChange(draft.trim() === "" ? undefined : draft);
  };

  if (editing) {
    return (
      <input
        ref={input}
        aria-label={label}
        type={prop.type === "date" ? "date" : prop.type === "number" ? "text" : prop.type === "url" ? "url" : "text"}
        inputMode={prop.type === "number" ? "decimal" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(text);
            setEditing(false);
          }
        }}
        className={cn(className, "rounded-sm bg-canvas outline-2 outline-(--ring)", prop.type === "number" && "text-end tabular-nums")}
      />
    );
  }

  let shown: ReactNode = text;
  if (prop.type === "url" && text) {
    shown = (
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-accent-text underline underline-offset-2">{text.replace(/^https?:\/\//, "")}</span>
        <a href={text} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} aria-label={t("cell.openLink")} className="shrink-0 rounded p-0.5 text-fg-muted hover:bg-surface-active">
          <ExternalLink className="size-3.5" />
        </a>
      </span>
    );
  } else if (prop.type === "person" && text) {
    shown = <span className="truncate">@{text.replace(/^@/, "")}</span>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${text || t("cell.empty")}`}
      onClick={() => {
        setDraft(text);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          setDraft(text);
          setEditing(true);
        }
      }}
      className={cn(className, "cursor-text truncate", prop.type === "number" && "text-end tabular-nums", prop.type === "title" && "font-medium", variant === "field" && !text && "text-fg-subtle")}
    >
      {shown || (variant === "field" ? t("cell.empty") : " ")}
    </div>
  );
}

function OptionPicker({
  prop,
  selected,
  multi,
  onChange,
  onAddOption,
  label,
  className,
}: {
  prop: Property;
  selected: string[];
  multi: boolean;
  onChange: (ids: string[]) => void;
  onAddOption: (name: string) => string;
  label: string;
  className: string;
}) {
  const t = useTranslations("database");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = prop.options ?? [];
  const q = query.trim().toLowerCase();
  const shown = options.filter((o) => o.name.toLowerCase().includes(q));
  const exact = options.some((o) => o.name.toLowerCase() === q);

  const toggle = (id: string) => {
    if (multi) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else {
      onChange(selected[0] === id ? [] : [id]);
      setOpen(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), setQuery(""))}>
      <Popover.Trigger aria-label={label} className={cn(className, "flex flex-wrap items-center gap-1")}>
        {selected.map((id) => optionById(prop, id)).filter(Boolean).map((o) => <OptionChip key={o!.id} option={o!} />)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={2} collisionPadding={8} className="z-50 w-64 rounded-lg border border-hairline bg-surface-glass p-1 text-sm shadow-float backdrop-blur-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q) {
                e.preventDefault();
                const match = options.find((o) => o.name.toLowerCase() === q) ?? shown[0];
                toggle(match && (exact || shown.length === 1) ? match.id : onAddOption(query));
                setQuery("");
              }
            }}
            placeholder={t("cell.searchOrCreate")}
            aria-label={t("cell.searchOrCreate")}
            className="mb-1 w-full rounded-md border border-border-control bg-canvas px-2 py-1"
          />
          <div role="listbox" aria-label={label} aria-multiselectable={multi} className="max-h-60 overflow-y-auto">
            {shown.map((o) => (
              <div
                key={o.id}
                role="option"
                tabIndex={0}
                aria-selected={selected.includes(o.id)}
                onClick={() => toggle(o.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(o.id))}
                className="flex cursor-default items-center gap-2 rounded-md px-2 py-1 outline-none hover:bg-surface-hover focus-visible:bg-surface-active"
              >
                <span className="min-w-0 flex-1">
                  <OptionChip option={o} />
                </span>
                {selected.includes(o.id) && <Check className="size-4 text-accent-text" aria-hidden="true" />}
              </div>
            ))}
            {q && !exact && (
              <button
                type="button"
                onClick={() => {
                  toggle(onAddOption(query));
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-start hover:bg-surface-hover"
              >
                <Plus className="size-4 text-fg-muted" aria-hidden="true" />
                {t("cell.createOption", { name: query.trim() })}
              </button>
            )}
            {!q && !options.length && <p className="px-2 py-1 text-fg-subtle">{t("cell.typeToCreate")}</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RelationPicker({
  target,
  selected,
  onChange,
  label,
  className,
  emptyLabel,
}: {
  target: { title: string; data: DatabaseData } | undefined;
  selected: string[];
  onChange: (v: CellValue | undefined) => void;
  label: string;
  className: string;
  emptyLabel: string;
}) {
  const t = useTranslations("database");
  const [query, setQuery] = useState("");
  const titleOf = (id: string) => {
    const row = target?.data.rows.find((r) => r.id === id);
    const titleProp = target?.data.properties.find((p) => p.type === "title");
    const v = row && titleProp ? row.cells[titleProp.id] : undefined;
    return typeof v === "string" && v ? v : t("cell.untitledRow");
  };
  const rows = (target?.data.rows ?? []).filter((r) => titleOf(r.id).toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Popover.Root onOpenChange={() => setQuery("")}>
      <Popover.Trigger aria-label={label} className={cn(className, "flex flex-wrap items-center gap-1")}>
        {selected.filter((id) => target?.data.rows.some((r) => r.id === id)).map((id) => (
          <span key={id} className="max-w-full truncate rounded bg-surface-active px-1.5 text-xs leading-5 underline decoration-hairline underline-offset-2">
            {titleOf(id)}
          </span>
        ))}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={2} collisionPadding={8} className="z-50 w-72 rounded-lg border border-hairline bg-surface-glass p-1 text-sm shadow-float backdrop-blur-xl">
          {!target ? (
            <p className="px-2 py-1 text-fg-subtle">{emptyLabel}</p>
          ) : (
            <>
              <p className="px-2 pt-1 pb-1 text-xs font-medium text-fg-subtle">{target.title}</p>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("cell.search")}
                aria-label={t("cell.search")}
                className="mb-1 w-full rounded-md border border-border-control bg-canvas px-2 py-1"
              />
              <div role="listbox" aria-label={label} aria-multiselectable className="max-h-60 overflow-y-auto">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    role="option"
                    tabIndex={0}
                    aria-selected={selected.includes(r.id)}
                    onClick={() => toggle(r.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(r.id))}
                    className="flex cursor-default items-center gap-2 rounded-md px-2 py-1 outline-none hover:bg-surface-hover focus-visible:bg-surface-active"
                  >
                    <span className="min-w-0 flex-1 truncate">{titleOf(r.id)}</span>
                    {selected.includes(r.id) && <Check className="size-4 text-accent-text" aria-hidden="true" />}
                  </div>
                ))}
                {!rows.length && <p className="px-2 py-1 text-fg-subtle">{emptyLabel}</p>}
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
