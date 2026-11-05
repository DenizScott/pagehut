import { cellText, sortRows } from "./query";
import { propertySchema, rowSchema, viewSchema, type DatabaseData } from "./types";

/**
 * Database file body (inside pages/<id>.md, after front matter with `type: "database"`):
 *
 *   | Name | Status |            <- readable table, generated (GitHub renders it)
 *   | --- | --- |
 *   | Dash | Done |
 *
 *   <!-- ... -->
 *   ```pagehut-database          <- the data: one JSON line per property, view and row
 *   {"format":"pagehut-database","version":1}
 *   {"property":{...}}
 *   {"view":{...}}
 *   {"row":{...}}
 *   ```
 *
 * Only the data block is read back; the table is regenerated on every save. One line per item
 * (rows sorted by id, not by display order) keeps diffs small, and merges work on items and
 * cells, not on lines (see merge.ts).
 */

export const DATABASE_FENCE = "pagehut-database";
const HEADER = { format: "pagehut-database", version: 1 } as const;
const NOTE = "<!-- PageHut database. The table above is generated; the data below is what PageHut reads (one line per property, view and row). -->";

const escapeCell = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

function readableTable(data: DatabaseData): string {
  const props = data.properties.filter((p) => p.type !== "relation");
  if (!props.length) return "";
  const head = `| ${props.map((p) => escapeCell(p.name) || " ").join(" | ")} |`;
  const sep = `| ${props.map(() => "---").join(" | ")} |`;
  const rows = sortRows(data, data.rows, []).map((row) => `| ${props.map((p) => escapeCell(cellText(data, row, p))).join(" | ")} |`);
  return [head, sep, ...rows].join("\n");
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function serializeDatabase(data: DatabaseData): string {
  const lines = [
    JSON.stringify(HEADER),
    ...data.properties.map((p) => JSON.stringify({ property: p })),
    ...data.views.map((v) => JSON.stringify({ view: v })),
    ...[...data.rows].sort(byId).map((r) => JSON.stringify({ row: r })),
  ];
  const table = readableTable(data);
  return `${table ? `${table}\n\n` : ""}${NOTE}\n\n\`\`\`${DATABASE_FENCE}\n${lines.join("\n")}\n\`\`\`\n`;
}

/** Reads the data block of a database body. Unreadable lines are skipped and reported. */
export function parseDatabase(body: string): { data: DatabaseData; skipped: number } {
  const data: DatabaseData = { properties: [], views: [], rows: [] };
  let skipped = 0;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `\`\`\`${DATABASE_FENCE}`);
  if (start < 0) return { data, skipped };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "```") break;
    if (!line) continue;
    try {
      const item = JSON.parse(line) as Record<string, unknown>;
      if ("format" in item) continue;
      if ("property" in item) data.properties.push(propertySchema.parse(item.property));
      else if ("view" in item) data.views.push(viewSchema.parse(item.view));
      else if ("row" in item) data.rows.push(rowSchema.parse(item.row));
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { data, skipped };
}

export const isDatabaseBody = (body: string) => body.split(/\r?\n/).some((l) => l.trim() === `\`\`\`${DATABASE_FENCE}`);
