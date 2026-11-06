"use client";

import { Trash2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { addAutomation, deleteAutomation, updateAutomation, writableByAutomation } from "@/lib/database/automations";
import type { Automation, AutomationAction, AutomationTrigger, DatabaseData, Property } from "@/lib/database/types";
import type { Api } from "./DatabaseView";

/**
 * Automations editor: rules read as sentences ("When Status becomes Done, set Finished to
 * today"), each can be paused or deleted, and a small builder adds one trigger → one action.
 */

const selectClass = "h-8 min-w-0 rounded-md border border-border-control bg-canvas px-2 text-sm";
const becomesTypes: Property["type"][] = ["select", "multiSelect", "checkbox"];

/** One string per choice in the "set to" list: today, me, clear, true, false, opt:<id>, text. */
type SetChoice = string;

function setChoices(prop: Property | undefined): SetChoice[] {
  if (!prop) return [];
  switch (prop.type) {
    case "date":
      return ["today", "clear"];
    case "person":
      return ["me", "clear"];
    case "checkbox":
      return ["true", "false"];
    case "select":
    case "multiSelect":
      return [...(prop.options ?? []).map((o) => `opt:${o.id}`), "clear"];
    default:
      return ["text", "clear"];
  }
}

function toAction(prop: Property, choice: SetChoice, text: string): AutomationAction {
  if (choice === "today" || choice === "me" || choice === "clear") return { propertyId: prop.id, set: choice };
  if (choice === "true" || choice === "false") return { propertyId: prop.id, set: "value", value: choice === "true" };
  if (choice.startsWith("opt:")) {
    const id = choice.slice(4);
    return { propertyId: prop.id, set: "value", value: prop.type === "multiSelect" ? [id] : id };
  }
  const n = Number(text.replace(",", "."));
  return { propertyId: prop.id, set: "value", value: prop.type === "number" && text.trim() && Number.isFinite(n) ? n : text };
}

export function AutomationsButton({ api }: { api: Api }) {
  const t = useTranslations("database");
  const [open, setOpen] = useState(false);
  const count = (api.data.automations ?? []).filter((a) => a.enabled).length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-fg-muted hover:bg-surface-hover"
      >
        <Zap className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{count ? t("automations.buttonCount", { count }) : t("automations.button")}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogContent title={t("automations.title")} description={t("automations.description")} className="max-w-2xl">
            <AutomationsBody api={api} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function AutomationsBody({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, set } = api;
  const rules = data.automations ?? [];
  const props = data.properties;
  const byId = (id: string) => props.find((p) => p.id === id);

  const describeValue = (prop: Property | undefined, value: unknown): string => {
    if (!prop) return "?";
    if (prop.type === "checkbox") return value === true ? t("automations.checked") : t("automations.unchecked");
    const ids = Array.isArray(value) ? value : [value];
    if (prop.type === "select" || prop.type === "multiSelect") return ids.map((id) => prop.options?.find((o) => o.id === id)?.name ?? "?").join(", ");
    return String(value ?? "");
  };
  const name = (id: string) => byId(id)?.name ?? t("automations.deletedProperty");

  const describe = (rule: Automation): string => {
    const tr = rule.trigger;
    const when =
      tr.kind === "rowAdded"
        ? t("automations.whenAdded")
        : tr.kind === "changed"
          ? t("automations.whenChanged", { property: name(tr.propertyId) })
          : t("automations.whenBecomes", { property: name(tr.propertyId), value: describeValue(byId(tr.propertyId), tr.value) });
    const then = rule.actions
      .map((a) => {
        const p = byId(a.propertyId);
        const what =
          a.set === "today" ? t("automations.today") : a.set === "me" ? t("automations.me") : a.set === "clear" ? null : describeValue(p, a.value);
        return what === null ? t("automations.thenClear", { property: name(a.propertyId) }) : t("automations.thenSet", { property: name(a.propertyId), value: what });
      })
      .join(", ");
    return `${when}, ${then}`;
  };

  return (
    <div className="min-h-0 overflow-y-auto px-4 pt-2 pb-4 text-sm">
      {rules.length === 0 ? (
        <p className="mb-4 text-fg-muted">{t("automations.empty")}</p>
      ) : (
        <ul className="mb-4 space-y-2" aria-label={t("automations.list")}>
          {rules.map((rule) => {
            const text = describe(rule);
            return (
              <li key={rule.id} className="flex items-center gap-2 rounded-md border border-hairline px-3 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => set(updateAutomation(data, rule.id, { enabled: e.target.checked }))}
                    className="size-4 shrink-0 accent-(--accent)"
                  />
                  <span className={rule.enabled ? "" : "text-fg-subtle line-through"}>{text}</span>
                </label>
                <Button size="icon-sm" onClick={() => set(deleteAutomation(data, rule.id))} aria-label={t("automations.delete", { rule: text })}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Builder data={data} onAdd={(rule) => set(addAutomation(data, rule).data)} />
    </div>
  );
}

function Builder({ data, onAdd }: { data: DatabaseData; onAdd: (rule: Omit<Automation, "id">) => void }) {
  const t = useTranslations("database");
  const props = data.properties;
  const [kind, setKind] = useState<AutomationTrigger["kind"]>("becomes");
  const triggerProps = kind === "becomes" ? props.filter((p) => becomesTypes.includes(p.type)) : props.filter((p) => p.type !== "formula");
  const [triggerId, setTriggerId] = useState("");
  const triggerProp = triggerProps.find((p) => p.id === triggerId) ?? triggerProps[0];
  const becomesChoices = triggerProp?.type === "checkbox" ? ["true", "false"] : (triggerProp?.options ?? []).map((o) => o.id);
  const [becomes, setBecomes] = useState("");
  const becomesValue = becomesChoices.includes(becomes) ? becomes : becomesChoices[0];

  const targets = props.filter(writableByAutomation);
  const [targetId, setTargetId] = useState("");
  const target = targets.find((p) => p.id === targetId) ?? targets.find((p) => p.type === "date") ?? targets[0];
  const choices = setChoices(target);
  const [choice, setChoice] = useState("");
  const setValue = choices.includes(choice) ? choice : choices[0];
  const [text, setText] = useState("");

  const choiceLabel = (c: SetChoice) => {
    if (c === "today") return t("automations.today");
    if (c === "me") return t("automations.me");
    if (c === "clear") return t("automations.clear");
    if (c === "true") return t("automations.checked");
    if (c === "false") return t("automations.unchecked");
    if (c === "text") return t("automations.textValue");
    return target?.options?.find((o) => `opt:${o.id}` === c)?.name ?? c;
  };

  const ready = target && setValue && (kind === "rowAdded" || (triggerProp && (kind === "changed" || becomesValue !== undefined)));

  return (
    <fieldset className="rounded-md border border-hairline p-3">
      <legend className="px-1 text-xs font-medium text-fg-subtle uppercase">{t("automations.new")}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <span>{t("automations.when")}</span>
        <select aria-label={t("automations.trigger")} value={kind} onChange={(e) => setKind(e.target.value as AutomationTrigger["kind"])} className={selectClass}>
          <option value="becomes">{t("automations.kindBecomes")}</option>
          <option value="changed">{t("automations.kindChanged")}</option>
          <option value="rowAdded">{t("automations.kindAdded")}</option>
        </select>
        {kind !== "rowAdded" && (
          <select aria-label={t("automations.triggerProperty")} value={triggerProp?.id ?? ""} onChange={(e) => setTriggerId(e.target.value)} className={selectClass}>
            {triggerProps.length === 0 && <option value="">{t("automations.noProperty")}</option>}
            {triggerProps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {kind === "becomes" && triggerProp && (
          <select aria-label={t("automations.triggerValue")} value={becomesValue ?? ""} onChange={(e) => setBecomes(e.target.value)} className={selectClass}>
            {becomesChoices.map((c) => (
              <option key={c} value={c}>
                {c === "true" ? t("automations.checked") : c === "false" ? t("automations.unchecked") : (triggerProp.options?.find((o) => o.id === c)?.name ?? c)}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span>{t("automations.then")}</span>
        <select aria-label={t("automations.actionProperty")} value={target?.id ?? ""} onChange={(e) => setTargetId(e.target.value)} className={selectClass}>
          {targets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label={t("automations.actionValue")} value={setValue ?? ""} onChange={(e) => setChoice(e.target.value)} className={selectClass}>
          {choices.map((c) => (
            <option key={c} value={c}>
              {choiceLabel(c)}
            </option>
          ))}
        </select>
        {setValue === "text" && (
          <input aria-label={t("automations.textValue")} value={text} onChange={(e) => setText(e.target.value)} className={`${selectClass} w-40`} />
        )}
      </div>
      <Button
        variant="primary"
        size="sm"
        className="mt-3"
        disabled={!ready}
        onClick={() => {
          if (!ready || !target) return;
          const trigger: AutomationTrigger =
            kind === "rowAdded"
              ? { kind }
              : kind === "changed"
                ? { kind, propertyId: triggerProp!.id }
                : { kind, propertyId: triggerProp!.id, value: becomesValue === "true" ? true : becomesValue === "false" ? false : becomesValue! };
          onAdd({ enabled: true, trigger, actions: [toAction(target, setValue!, text)] });
          setText("");
        }}
      >
        {t("automations.add")}
      </Button>
    </fieldset>
  );
}
