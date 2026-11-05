import { searchKey } from "@/lib/text";
import { evaluateFormula } from "./formula";
import type { CellValue, DatabaseData, Filter, Property, Row, SelectOption, Sort, View } from "./types";

/** Resolves a related row's title (relation cells store row ids of another database). */
export type RelationTitle = (databaseId: string, rowId: string) => string | undefined;

export interface QueryContext {
  relationTitle?: RelationTitle;
  /** For case- and accent-insensitive text filters (Turkish ı/İ). */
  locale?: string;
}

export const asList = (v: CellValue | undefined): string[] => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);

export function optionById(prop: Property, id: string | undefined): SelectOption | undefined {
  return id ? prop.options?.find((o) => o.id === id) : undefined;
}

/** Numeric value of a number or formula cell (formulas may use other formulas, up to a depth). */
export function numberValue(data: DatabaseData, row: Row, prop: Property, depth = 0): number | undefined {
  if (prop.type === "number") {
    const v = row.cells[prop.id];
    return typeof v === "number" ? v : typeof v === "string" && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  }
  if (prop.type === "formula") {
    if (!prop.formula || depth > 8) return undefined;
    try {
      const v = evaluateFormula(prop.formula, (name) => {
        const ref = data.properties.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
        if (!ref || (ref.type !== "number" && ref.type !== "formula")) return undefined;
        return numberValue(data, row, ref, depth + 1) ?? 0;
      });
      return Number.isFinite(v) ? v : undefined;
    } catch {
      return undefined;
    }
  }
  if (prop.type === "checkbox") return row.cells[prop.id] === true ? 1 : 0;
  return undefined;
}

export function formatNumber(n: number, prop: Property): string {
  if (prop.numberFormat === "percent") return `${Math.round(n * 1000) / 10}%`;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

/** Plain-text value of a cell, for display, search, filters and the readable table on GitHub. */
export function cellText(data: DatabaseData, row: Row, prop: Property, ctx: QueryContext = {}): string {
  const v = row.cells[prop.id];
  switch (prop.type) {
    case "number":
    case "formula": {
      const n = numberValue(data, row, prop);
      if (n === undefined) return prop.type === "formula" && prop.formula ? "#ERR" : "";
      return formatNumber(n, prop);
    }
    case "checkbox":
      return v === true ? "✓" : "";
    case "select":
      return optionById(prop, typeof v === "string" ? v : undefined)?.name ?? "";
    case "multiSelect":
      return asList(v)
        .map((id) => optionById(prop, id)?.name)
        .filter(Boolean)
        .join(", ");
    case "relation":
      return asList(v)
        .map((id) => (prop.relationTo ? ctx.relationTitle?.(prop.relationTo, id) : undefined) ?? "")
        .filter(Boolean)
        .join(", ");
    default:
      return typeof v === "string" ? v : v === undefined ? "" : String(v);
  }
}

export function isEmptyCell(data: DatabaseData, row: Row, prop: Property): boolean {
  if (prop.type === "checkbox") return row.cells[prop.id] !== true;
  if (prop.type === "multiSelect" || prop.type === "relation") return asList(row.cells[prop.id]).length === 0;
  return cellText(data, row, prop) === "";
}

function matches(data: DatabaseData, row: Row, prop: Property, f: Filter, ctx: QueryContext): boolean {
  const value = f.value ?? "";
  const loc = ctx.locale ?? "en";
  switch (f.op) {
    case "isEmpty":
      return isEmptyCell(data, row, prop);
    case "isNotEmpty":
      return !isEmptyCell(data, row, prop);
    case "checked":
      return row.cells[prop.id] === true;
    case "unchecked":
      return row.cells[prop.id] !== true;
    case "gt":
    case "lt": {
      const n = numberValue(data, row, prop);
      if (prop.type === "date") {
        const d = cellText(data, row, prop);
        return !!d && (f.op === "gt" ? d > value : d < value);
      }
      if (n === undefined || value.trim() === "") return false;
      return f.op === "gt" ? n > Number(value) : n < Number(value);
    }
    case "is":
    case "isNot": {
      // Select-like cells compare by option id; everything else by text.
      let hit: boolean;
      if (prop.type === "select" || prop.type === "multiSelect" || prop.type === "relation") hit = asList(row.cells[prop.id]).includes(value);
      else hit = searchKey(cellText(data, row, prop, ctx), loc) === searchKey(value, loc);
      return f.op === "is" ? hit : !hit;
    }
    case "contains":
    case "notContains": {
      const hit = searchKey(cellText(data, row, prop, ctx), loc).includes(searchKey(value, loc));
      return f.op === "contains" ? hit : !hit;
    }
  }
}

function compare(data: DatabaseData, a: Row, b: Row, prop: Property, ctx: QueryContext): number {
  if (prop.type === "number" || prop.type === "formula" || prop.type === "checkbox") {
    const x = numberValue(data, a, prop);
    const y = numberValue(data, b, prop);
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1; // empty last
    return x - y;
  }
  if (prop.type === "select") {
    // Option order, like the board columns.
    const idx = (r: Row) => {
      const i = prop.options?.findIndex((o) => o.id === r.cells[prop.id]) ?? -1;
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    return idx(a) - idx(b);
  }
  const x = cellText(data, a, prop, ctx);
  const y = cellText(data, b, prop, ctx);
  if (!x || !y) return x === y ? 0 : !x ? 1 : -1;
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
}

export function sortRows(data: DatabaseData, rows: Row[], sorts: Sort[], ctx: QueryContext = {}): Row[] {
  const props = new Map(data.properties.map((p) => [p.id, p]));
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const prop = props.get(s.propertyId);
      if (!prop) continue;
      const c = compare(data, a, b, prop, ctx);
      if (c) return s.dir === "asc" ? c : -c;
    }
    return a.order - b.order || a.id.localeCompare(b.id);
  });
}

/** Rows a view shows, filtered (all filters must match) and sorted. */
export function viewRows(data: DatabaseData, view: View, ctx: QueryContext = {}): Row[] {
  const props = new Map(data.properties.map((p) => [p.id, p]));
  const rows = data.rows.filter((row) =>
    view.filters.every((f) => {
      const prop = props.get(f.propertyId);
      return !prop || matches(data, row, prop, f, ctx);
    }),
  );
  return sortRows(data, rows, view.sorts, ctx);
}

export interface Group {
  option: SelectOption | null;
  rows: Row[];
}

/** Board columns: one per option of the group-by property, plus "no value" first. */
export function groupRows(data: DatabaseData, view: View, rows: Row[]): Group[] {
  const prop = data.properties.find((p) => p.id === view.groupBy && p.type === "select");
  if (!prop) return [{ option: null, rows }];
  const groups: Group[] = [{ option: null, rows: [] }, ...(prop.options ?? []).map((option) => ({ option, rows: [] as Row[] }))];
  const index = new Map(groups.map((g, i) => [g.option?.id ?? "", i]));
  for (const row of rows) {
    const v = row.cells[prop.id];
    groups[index.get(typeof v === "string" ? v : "") ?? 0].rows.push(row);
  }
  return groups;
}

export const visibleProperties = (data: DatabaseData, view: View): Property[] =>
  data.properties.filter((p) => p.type === "title" || !view.hidden.includes(p.id));

export const titleProperty = (data: DatabaseData): Property =>
  data.properties.find((p) => p.type === "title") ?? { id: "title", name: "Name", type: "title" };

export const rowTitle = (data: DatabaseData, row: Row): string => {
  const v = row.cells[titleProperty(data).id];
  return typeof v === "string" ? v : "";
};
