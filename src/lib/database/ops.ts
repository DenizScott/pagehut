import { ulid } from "ulid";
import { TITLE_PROPERTY_ID, type CellValue, type DatabaseData, type OptionColor, type Property, type PropertyType, type Row, type View, type ViewType } from "./types";
import { optionColors } from "./types";

/**
 * Pure edits on database data. Each returns a new object (the UI keeps it in state and saves it);
 * nothing here touches storage. Ids are random, so two people adding things at once never clash.
 */

export const shortId = () => ulid().slice(-10).toLowerCase();

const sortedOrders = (rows: Row[]) => rows.map((r) => r.order).sort((a, b) => a - b);

export function addRow(data: DatabaseData, cells: Row["cells"] = {}, at?: { before?: string }): { data: DatabaseData; row: Row } {
  const orders = sortedOrders(data.rows);
  let order = (orders.at(-1) ?? 0) + 1;
  if (at?.before) {
    const target = data.rows.find((r) => r.id === at.before);
    if (target) {
      const prev = orders.filter((o) => o < target.order).at(-1) ?? target.order - 1;
      order = (prev + target.order) / 2;
    }
  }
  const row: Row = { id: ulid(), order, cells };
  return { data: { ...data, rows: [...data.rows, row] }, row };
}

export function updateCell(data: DatabaseData, rowId: string, propertyId: string, value: CellValue | undefined): DatabaseData {
  return {
    ...data,
    rows: data.rows.map((r) => {
      if (r.id !== rowId) return r;
      const cells = { ...r.cells };
      const empty = value === undefined || value === "" || value === false || (Array.isArray(value) && !value.length);
      if (empty) delete cells[propertyId];
      else cells[propertyId] = value;
      return { ...r, cells };
    }),
  };
}

export function deleteRow(data: DatabaseData, rowId: string): DatabaseData {
  return { ...data, rows: data.rows.filter((r) => r.id !== rowId) };
}

/** Moves a row to sit between two neighbors in manual order (one row changes). */
export function moveRow(data: DatabaseData, rowId: string, between: { after?: string; before?: string }): DatabaseData {
  const order = (id?: string) => data.rows.find((r) => r.id === id)?.order;
  const a = order(between.after);
  const b = order(between.before);
  const next = a !== undefined && b !== undefined ? (a + b) / 2 : a !== undefined ? a + 1 : b !== undefined ? b - 1 : 0;
  return { ...data, rows: data.rows.map((r) => (r.id === rowId ? { ...r, order: next } : r)) };
}

export function addProperty(data: DatabaseData, name: string, type: PropertyType): { data: DatabaseData; property: Property } {
  const property: Property = { id: shortId(), name, type, ...(type === "select" || type === "multiSelect" ? { options: [] } : {}) };
  return { data: { ...data, properties: [...data.properties, property] }, property };
}

export function updateProperty(data: DatabaseData, id: string, patch: Partial<Omit<Property, "id">>): DatabaseData {
  const old = data.properties.find((p) => p.id === id);
  const renamed = old && patch.name !== undefined && patch.name !== old.name;
  // Formulas refer to properties by name: keep them working after a rename.
  const escaped = old ? old.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
  const ref = renamed ? new RegExp(`\\{\\s*${escaped}\\s*\\}`, "gi") : null;
  return {
    ...data,
    properties: data.properties.map((p) => {
      const next = p.id === id ? { ...p, ...patch } : p;
      return ref && next.type === "formula" && next.formula ? { ...next, formula: next.formula.replace(ref, `{${patch.name}}`) } : next;
    }),
  };
}

/**
 * Changes a property's type. Values that still make sense are converted (text <-> number,
 * select <-> multi-select, text -> select creates options); others are kept as text.
 */
export function changePropertyType(data: DatabaseData, id: string, type: PropertyType): DatabaseData {
  const prop = data.properties.find((p) => p.id === id);
  if (!prop || prop.type === type || prop.type === "title" || type === "title") return data;
  let options = prop.options ?? [];
  const optionFor = (name: string) => {
    let o = options.find((x) => x.name === name);
    if (!o) {
      o = { id: shortId(), name, color: optionColors[options.length % optionColors.length] };
      options = [...options, o];
    }
    return o.id;
  };
  const nameOf = (optId: string) => prop.options?.find((o) => o.id === optId)?.name ?? optId;
  const convert = (v: CellValue | undefined): CellValue | undefined => {
    if (v === undefined) return undefined;
    const asText = Array.isArray(v) ? v.map((x) => (prop.type === "multiSelect" ? nameOf(x) : x)).join(", ") : prop.type === "select" ? nameOf(String(v)) : String(v);
    switch (type) {
      case "number": {
        const n = Number(String(asText).replace(",", "."));
        return asText.trim() && Number.isFinite(n) ? n : undefined;
      }
      case "checkbox":
        return v === true || ["true", "yes", "✓", "1", "x"].includes(asText.trim().toLowerCase());
      case "select":
        if (prop.type === "multiSelect" && Array.isArray(v)) return v[0];
        return asText.trim() ? optionFor(asText.trim()) : undefined;
      case "multiSelect":
        if (prop.type === "select") return [String(v)];
        return asText.split(",").map((s) => s.trim()).filter(Boolean).map(optionFor);
      case "relation":
      case "formula":
        return undefined;
      default:
        return asText;
    }
  };
  const rows = data.rows.map((r) => {
    const cells = { ...r.cells };
    const next = convert(cells[id]);
    if (next === undefined || next === "" || next === false) delete cells[id];
    else cells[id] = next;
    return { ...r, cells };
  });
  const keepsOptions = type === "select" || type === "multiSelect";
  const properties = data.properties.map((p) =>
    p.id === id
      ? {
          id: p.id,
          name: p.name,
          type,
          ...(keepsOptions ? { options } : {}),
          ...(type === "formula" ? { formula: "" } : {}),
          ...(type === "relation" && p.relationTo ? { relationTo: p.relationTo } : {}),
        }
      : p,
  );
  // Views grouped by this property fall back to no grouping if it is no longer a select.
  const views = data.views.map((v) => (v.groupBy === id && type !== "select" ? { ...v, groupBy: undefined } : v));
  return { properties, views, rows };
}

export function deleteProperty(data: DatabaseData, id: string): DatabaseData {
  if (id === TITLE_PROPERTY_ID || data.properties.find((p) => p.id === id)?.type === "title") return data;
  return {
    properties: data.properties.filter((p) => p.id !== id),
    views: data.views.map((v) => ({
      ...v,
      filters: v.filters.filter((f) => f.propertyId !== id),
      sorts: v.sorts.filter((s) => s.propertyId !== id),
      hidden: v.hidden.filter((h) => h !== id),
      ...(v.groupBy === id ? { groupBy: undefined } : {}),
      ...(v.coverProperty === id ? { coverProperty: undefined } : {}),
    })),
    rows: data.rows.map((r) => {
      if (!(id in r.cells)) return r;
      const cells = { ...r.cells };
      delete cells[id];
      return { ...r, cells };
    }),
  };
}

export function addOption(data: DatabaseData, propertyId: string, name: string, color?: OptionColor): { data: DatabaseData; optionId: string } {
  const prop = data.properties.find((p) => p.id === propertyId);
  const existing = prop?.options?.find((o) => o.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) return { data, optionId: existing.id };
  const options = prop?.options ?? [];
  const option = { id: shortId(), name: name.trim(), color: color ?? optionColors[(options.length + 1) % optionColors.length] };
  return { data: updateProperty(data, propertyId, { options: [...options, option] }), optionId: option.id };
}

export function addView(data: DatabaseData, name: string, type: ViewType): { data: DatabaseData; view: View } {
  const groupBy =
    type === "board"
      ? data.properties.find((p) => p.type === "select")?.id
      : type === "chart"
        ? data.properties.find((p) => p.type === "select" || p.type === "multiSelect" || p.type === "checkbox")?.id
        : undefined;
  const coverProperty = type === "gallery" ? data.properties.find((p) => p.type === "url")?.id : undefined;
  const view: View = { id: shortId(), name, type, filters: [], sorts: [], hidden: [], ...(groupBy ? { groupBy } : {}), ...(coverProperty ? { coverProperty } : {}) };
  return { data: { ...data, views: [...data.views, view] }, view };
}

export function updateView(data: DatabaseData, id: string, patch: Partial<Omit<View, "id">>): DatabaseData {
  return { ...data, views: data.views.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
}

export function deleteView(data: DatabaseData, id: string): DatabaseData {
  if (data.views.length <= 1) return data;
  return { ...data, views: data.views.filter((v) => v.id !== id) };
}
