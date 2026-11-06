import { z } from "zod";

/**
 * Databases (P4). A database is a page (`PageRecord.kind === "database"`) whose content is a
 * table of typed properties and rows, shown through one or more views (table, board, gallery).
 * It is stored in the same file as any page (pages/<id>.md) so sync, merge and history work
 * unchanged; see src/lib/database/file.ts for the format.
 */

export const propertyTypes = [
  "title",
  "text",
  "number",
  "select",
  "multiSelect",
  "checkbox",
  "date",
  "url",
  "person",
  "relation",
  "formula",
] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const optionColors = ["gray", "moss", "blue", "amber", "red", "purple", "teal", "brown"] as const;
export type OptionColor = (typeof optionColors)[number];

export const selectOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.enum(optionColors).default("gray"),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

export const propertySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(propertyTypes),
  /** select / multiSelect */
  options: z.array(selectOptionSchema).optional(),
  /** relation: the database page the cells point into */
  relationTo: z.string().optional(),
  /** formula: arithmetic over number properties, e.g. `{Damage} * {Rate}` */
  formula: z.string().optional(),
  /** number: how values are shown */
  numberFormat: z.enum(["plain", "percent"]).optional(),
});
export type Property = z.infer<typeof propertySchema>;

export const filterOps = ["contains", "notContains", "is", "isNot", "isEmpty", "isNotEmpty", "gt", "lt", "checked", "unchecked"] as const;
export type FilterOp = (typeof filterOps)[number];

export const filterSchema = z.object({
  propertyId: z.string(),
  op: z.enum(filterOps),
  value: z.string().optional(),
});
export type Filter = z.infer<typeof filterSchema>;

export const sortSchema = z.object({
  propertyId: z.string(),
  dir: z.enum(["asc", "desc"]),
});
export type Sort = z.infer<typeof sortSchema>;

export const viewTypes = ["table", "board", "gallery", "calendar", "timeline", "chart", "form"] as const;
export type ViewType = (typeof viewTypes)[number];

export const viewSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(viewTypes),
  filters: z.array(filterSchema).default([]),
  sorts: z.array(sortSchema).default([]),
  /** Properties not shown in this view. */
  hidden: z.array(z.string()).default([]),
  /** board: select property that makes the columns */
  groupBy: z.string().optional(),
  /** gallery: url property shown as the card image */
  coverProperty: z.string().optional(),
  /** chart: number or formula property to add up; none = count rows */
  chartValue: z.string().optional(),
  /** chart: how bar values are computed */
  chartAgg: z.enum(["count", "sum", "avg"]).optional(),
  /** calendar: the date a row is shown on; timeline: its start date */
  dateProperty: z.string().optional(),
  /** timeline: end date (optional; a row without one is a single day) */
  endProperty: z.string().optional(),
  /** table: column widths in px by property id */
  widths: z.record(z.string(), z.number()).optional(),
});
export type View = z.infer<typeof viewSchema>;

/** title/text/url/person/date/select: string. multiSelect/relation: string[]. number: number. checkbox: boolean. */
export type CellValue = string | number | boolean | string[];

export const rowSchema = z.object({
  id: z.string().min(1),
  /** Display order when no sort is set; fractional so a move changes one row. */
  order: z.number(),
  cells: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).default({}),
});
export type Row = z.infer<typeof rowSchema>;

export interface DatabaseData {
  properties: Property[];
  views: View[];
  rows: Row[];
}

export const TITLE_PROPERTY_ID = "title";

export function emptyDatabase(labels: { name: string; table: string }): DatabaseData {
  return {
    properties: [{ id: TITLE_PROPERTY_ID, name: labels.name, type: "title" }],
    views: [{ id: "table", name: labels.table, type: "table", filters: [], sorts: [], hidden: [] }],
    rows: [],
  };
}
