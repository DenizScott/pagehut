import { asList } from "./query";
import { shortId, updateCell } from "./ops";
import type { Automation, AutomationAction, AutomationTrigger, CellValue, DatabaseData, Property, Row } from "./types";

/**
 * Database automations: "when <trigger>, set <property> to <value>".
 *
 * They run in the browser of the person who made the edit, right after it, once. Their changes
 * are part of that edit, so they sync and merge like any other change; teammates' clients don't
 * run them again on pull. Actions never trigger other rules, so rules can't loop.
 */

export interface AutomationContext {
  /** Today as "YYYY-MM-DD" in the editor's calendar. */
  today: string;
  /** GitHub login of the person editing, if signed in. */
  me?: string;
}

const same = (a: CellValue | undefined, b: CellValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Whether a value matches a "becomes" trigger for this property. */
function matches(prop: Property, value: CellValue | undefined, target: string | boolean): boolean {
  if (prop.type === "checkbox") return (value === true) === (target === true);
  if (prop.type === "multiSelect") return asList(value).includes(String(target));
  return value === target;
}

export function triggered(data: DatabaseData, trigger: AutomationTrigger, before: Row | undefined, after: Row): boolean {
  if (trigger.kind === "rowAdded") return before === undefined;
  if (!before) return false; // a new row only fires "row added"
  const prop = data.properties.find((p) => p.id === trigger.propertyId);
  if (!prop) return false;
  const was = before.cells[prop.id];
  const now = after.cells[prop.id];
  if (same(was, now)) return false;
  if (trigger.kind === "changed") return true;
  return matches(prop, now, trigger.value) && !matches(prop, was, trigger.value);
}

/** The value an action writes, or undefined to clear the cell. Null = action can't run here. */
export function actionValue(prop: Property, action: AutomationAction, ctx: AutomationContext): CellValue | undefined | null {
  switch (action.set) {
    case "clear":
      return undefined;
    case "today":
      return prop.type === "date" ? ctx.today : null;
    case "me":
      return prop.type === "person" && ctx.me ? ctx.me : null;
    case "value":
      return action.value ?? null;
  }
}

/** Properties an action may write (formulas are computed; relations need picking). */
export const writableByAutomation = (p: Property) => p.type !== "formula" && p.type !== "relation";

/**
 * Applies every enabled rule that fires for this edit of one row (`before` is undefined for a new
 * row). Returns the data with the rule changes applied and the ids of the rules that ran.
 */
export function runAutomations(data: DatabaseData, rowId: string, before: Row | undefined, ctx: AutomationContext): { data: DatabaseData; ran: string[] } {
  const rules = (data.automations ?? []).filter((a) => a.enabled);
  const after = data.rows.find((r) => r.id === rowId);
  if (!rules.length || !after) return { data, ran: [] };
  let next = data;
  const ran: string[] = [];
  for (const rule of rules) {
    if (!triggered(data, rule.trigger, before, after)) continue;
    let changed = false;
    for (const action of rule.actions) {
      const prop = data.properties.find((p) => p.id === action.propertyId);
      if (!prop || !writableByAutomation(prop)) continue;
      const value = actionValue(prop, action, ctx);
      if (value === null) continue;
      next = updateCell(next, rowId, prop.id, value);
      changed = true;
    }
    if (changed) ran.push(rule.id);
  }
  return { data: next, ran };
}

export function addAutomation(data: DatabaseData, rule: Omit<Automation, "id">): { data: DatabaseData; automation: Automation } {
  const automation: Automation = { ...rule, id: shortId() };
  return { data: { ...data, automations: [...(data.automations ?? []), automation] }, automation };
}

export function updateAutomation(data: DatabaseData, id: string, patch: Partial<Omit<Automation, "id">>): DatabaseData {
  return { ...data, automations: (data.automations ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

export function deleteAutomation(data: DatabaseData, id: string): DatabaseData {
  const automations = (data.automations ?? []).filter((a) => a.id !== id);
  // With no rules left, drop the key so the database file looks as it did before.
  const rest: DatabaseData = { properties: data.properties, views: data.views, rows: data.rows };
  return automations.length ? { ...rest, automations } : rest;
}
