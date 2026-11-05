"use client";

import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  AtSign,
  Calendar,
  CheckSquare,
  CircleDot,
  EyeOff,
  Hash,
  Link2,
  List,
  Sigma,
  Tags,
  Trash2,
  Type,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useState, type ReactNode } from "react";
import { evaluateFormula } from "@/lib/database/formula";
import { propertyTypes, type Property, type PropertyType } from "@/lib/database/types";
import { cn } from "@/lib/utils";

export const typeIcon: Record<PropertyType, typeof Type> = {
  title: Type,
  text: AlignLeft,
  number: Hash,
  select: CircleDot,
  multiSelect: Tags,
  checkbox: CheckSquare,
  date: Calendar,
  url: Link2,
  person: AtSign,
  relation: List,
  formula: Sigma,
};

export interface PropertyMenuProps {
  prop: Property;
  numberProps: Property[];
  databases: { id: string; title: string }[];
  onRename: (name: string) => void;
  onChangeType: (type: PropertyType) => void;
  onPatch: (patch: Partial<Property>) => void;
  onSort?: (dir: "asc" | "desc") => void;
  onHide?: () => void;
  onDelete: () => void;
  children: ReactNode;
  triggerLabel: string;
  className?: string;
}

/** Column header menu: rename, type, type settings (formula, relation, number format), sort, hide, delete. */
export function PropertyMenu(p: PropertyMenuProps) {
  const t = useTranslations("database");
  const [name, setName] = useState(p.prop.name);
  const [formula, setFormula] = useState(p.prop.formula ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  let formulaError = "";
  if (p.prop.type === "formula" && formula.trim()) {
    try {
      const known = new Set(p.numberProps.map((x) => x.name.trim().toLowerCase()));
      evaluateFormula(formula, (n) => (known.has(n.toLowerCase()) ? 1 : undefined));
    } catch (err) {
      formulaError = (err as Error).message;
    }
  }
  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-surface-hover [&_svg]:size-4 [&_svg]:text-fg-muted";

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) {
          setName(p.prop.name);
          setFormula(p.prop.formula ?? "");
          setConfirmDelete(false);
        } else if (name.trim() && name !== p.prop.name) p.onRename(name.trim());
      }}
    >
      <Popover.Trigger aria-label={p.triggerLabel} className={p.className}>
        {p.children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} className="z-50 w-72 rounded-lg border border-hairline bg-surface-glass p-1 text-sm shadow-float backdrop-blur-xl">
          <input
            autoFocus
            value={name}
            aria-label={t("property.name")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) p.onRename(name.trim());
            }}
            className="mb-1 w-full rounded-md border border-border-control bg-canvas px-2 py-1"
          />

          {p.prop.type !== "title" && (
            <label className="flex items-center gap-2 px-2 py-1">
              <span className="w-16 shrink-0 text-fg-muted">{t("property.type")}</span>
              <select
                value={p.prop.type}
                onChange={(e) => p.onChangeType(e.target.value as PropertyType)}
                className="min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1 py-1"
              >
                {propertyTypes
                  .filter((x) => x !== "title")
                  .map((x) => (
                    <option key={x} value={x}>
                      {t(`types.${x}`)}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {p.prop.type === "formula" && (
            <div className="px-2 py-1">
              <label className="mb-1 block text-xs text-fg-muted" htmlFor={`f-${p.prop.id}`}>
                {t("property.formula")}
              </label>
              <input
                id={`f-${p.prop.id}`}
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                onBlur={() => !formulaError && formula !== (p.prop.formula ?? "") && p.onPatch({ formula })}
                onKeyDown={(e) => e.key === "Enter" && !formulaError && p.onPatch({ formula })}
                placeholder="{Damage} * {Rate}"
                aria-invalid={!!formulaError}
                aria-describedby={`fh-${p.prop.id}`}
                className={cn("w-full rounded-md border bg-canvas px-2 py-1 font-mono text-xs", formulaError ? "border-danger" : "border-border-control")}
              />
              <p id={`fh-${p.prop.id}`} className={cn("mt-1 text-xs", formulaError ? "text-danger" : "text-fg-subtle")}>
                {formulaError ? t("property.formulaError", { message: formulaError }) : t("property.formulaHelp")}
              </p>
              {p.numberProps.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.numberProps.map((np) => (
                    <button key={np.id} type="button" onClick={() => setFormula((f) => `${f}${f && !f.endsWith(" ") ? " " : ""}{${np.name}}`)} className="rounded bg-surface-active px-1.5 font-mono text-xs hover:bg-surface-hover">
                      {`{${np.name}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {p.prop.type === "relation" && (
            <label className="flex items-center gap-2 px-2 py-1">
              <span className="w-16 shrink-0 text-fg-muted">{t("property.relationTo")}</span>
              <select
                value={p.prop.relationTo ?? ""}
                onChange={(e) => p.onPatch({ relationTo: e.target.value || undefined })}
                className="min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1 py-1"
              >
                <option value="">{t("property.chooseDatabase")}</option>
                {p.databases.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || t("untitled")}
                  </option>
                ))}
              </select>
            </label>
          )}

          {p.prop.type === "number" && (
            <label className="flex items-center gap-2 px-2 py-1">
              <span className="w-16 shrink-0 text-fg-muted">{t("property.format")}</span>
              <select
                value={p.prop.numberFormat ?? "plain"}
                onChange={(e) => p.onPatch({ numberFormat: e.target.value === "percent" ? "percent" : undefined })}
                className="min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1 py-1"
              >
                <option value="plain">{t("property.formatPlain")}</option>
                <option value="percent">{t("property.formatPercent")}</option>
              </select>
            </label>
          )}

          <div className="my-1 h-px bg-hairline" />
          {p.onSort && (
            <>
              <Popover.Close className={item} onClick={() => p.onSort!("asc")}>
                <ArrowUp /> {t("property.sortAsc")}
              </Popover.Close>
              <Popover.Close className={item} onClick={() => p.onSort!("desc")}>
                <ArrowDown /> {t("property.sortDesc")}
              </Popover.Close>
            </>
          )}
          {p.onHide && p.prop.type !== "title" && (
            <Popover.Close className={item} onClick={p.onHide}>
              <EyeOff /> {t("property.hide")}
            </Popover.Close>
          )}
          {p.prop.type !== "title" &&
            (confirmDelete ? (
              <Popover.Close className={cn(item, "text-danger [&_svg]:!text-danger")} onClick={p.onDelete}>
                <Trash2 /> {t("property.deleteConfirm")}
              </Popover.Close>
            ) : (
              <button type="button" className={cn(item, "text-danger [&_svg]:!text-danger")} onClick={() => setConfirmDelete(true)}>
                <Trash2 /> {t("property.delete")}
              </button>
            ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
