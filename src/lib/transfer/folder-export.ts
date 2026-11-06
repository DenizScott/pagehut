import { strFromU8, unzipSync } from "fflate";
import { ulid } from "ulid";
import { serializeDatabase } from "@/lib/database/file";
import { shortId } from "@/lib/database/ops";
import { optionColors, type DatabaseData, type Property, type Row } from "@/lib/database/types";
import type { BundleAsset, BundlePage, WorkspaceBundle } from "./bundle";

/**
 * "Markdown & CSV" folder export → workspace bundle (best effort).
 *
 *  - "Page <32-hex id>.md" files with a "Page <id>/" folder of subpages become a page tree; the
 *    Export ids are dropped from titles.
 *  - Links between exported pages become [[page:…]] links; images in the export become assets.
 *  - "<aside>" callouts become callouts.
 *  - "Table <id>.csv" (or "<id>_all.csv") becomes a database with inferred property types; its
 *    row pages are imported as subpages of the database.
 *  - Nested ZIPs (large exports are often split) are unpacked.
 */

const EXPORT_ID = /\s?[0-9a-f]{32}(?=(_all)?(\.(md|csv))?$)/;
const isIdName = (name: string) => /[0-9a-f]{32}(_all)?\.(md|csv)$/.test(name);

export function unzipAll(data: Uint8Array): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [name, bytes] of Object.entries(unzipSync(data))) {
    if (name.endsWith("/") || name.startsWith("__MACOSX/")) continue;
    if (name.toLowerCase().endsWith(".zip")) Object.assign(out, unzipAll(bytes));
    else out[name] = bytes;
  }
  return out;
}

export function isIdFolderExport(names: string[]): boolean {
  return names.some(isIdName);
}

export const stripExportId = (name: string) => name.replace(EXPORT_ID, "").replace(/_all$/, "").trim();
const baseName = (path: string) => path.split("/").pop()!.replace(/\.(md|csv)$/i, "");
const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");

function resolve(fromDir: string, href: string): string {
  let rel: string;
  try {
    rel = decodeURIComponent(href.split("#")[0]);
  } catch {
    rel = href;
  }
  const parts = (fromDir ? fromDir.split("/") : []).concat(rel.split("/"));
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

/* ---------- CSV ---------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function toIsoDate(v: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (!/\d{4}/.test(v)) return null;
  const t = Date.parse(v.replace(/\s*\(.*\)$/, "").split(" → ")[0]);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Infers property types from a column's values (the export stores everything as text). */
function inferType(values: string[]): Property["type"] {
  const vals = values.map((v) => v.trim()).filter(Boolean);
  if (!vals.length) return "text";
  if (vals.every((v) => /^(yes|no)$/i.test(v))) return "checkbox";
  if (vals.every((v) => /^-?\d+([.,]\d+)?%?$/.test(v))) return "number";
  if (vals.every((v) => /^https?:\/\/\S+$/.test(v))) return "url";
  if (vals.every((v) => toIsoDate(v) !== null)) return "date";
  // A few short values that repeat look like a select (comma-separated: a multi-select).
  const multi = vals.some((v) => /,\s*/.test(v));
  const parts = vals.flatMap((v) => (multi ? v.split(/,\s*/) : [v]));
  const distinct = new Set(parts);
  const short = [...distinct].every((v) => v.length <= 30);
  if (short && distinct.size <= 12 && distinct.size < parts.length) return multi ? "multiSelect" : "select";
  return "text";
}

export function databaseFromCsv(text: string): DatabaseData {
  const [header = [], ...body] = parseCsv(text);
  const props: Property[] = header.map((name, i) => {
    if (i === 0) return { id: "title", name: name || "Name", type: "title" };
    const type = inferType(body.map((r) => r[i] ?? ""));
    return { id: shortId(), name: name || `Column ${i + 1}`, type, ...(type === "select" || type === "multiSelect" ? { options: [] } : {}) };
  });
  const optionId = (prop: Property, name: string) => {
    let o = prop.options!.find((x) => x.name === name);
    if (!o) {
      o = { id: shortId(), name, color: optionColors[prop.options!.length % optionColors.length] };
      prop.options!.push(o);
    }
    return o.id;
  };
  const rows: Row[] = body.map((r, n) => {
    const cells: Row["cells"] = {};
    props.forEach((prop, i) => {
      const v = (r[i] ?? "").trim();
      if (!v) return;
      switch (prop.type) {
        case "number": {
          const pct = v.endsWith("%");
          const num = Number(v.replace("%", "").replace(",", "."));
          if (Number.isFinite(num)) {
            cells[prop.id] = pct ? num / 100 : num;
            if (pct) prop.numberFormat = "percent";
          }
          break;
        }
        case "checkbox":
          if (/^yes$/i.test(v)) cells[prop.id] = true;
          break;
        case "date":
          cells[prop.id] = toIsoDate(v) ?? v;
          break;
        case "select":
          cells[prop.id] = optionId(prop, v);
          break;
        case "multiSelect":
          cells[prop.id] = v.split(/,\s*/).filter(Boolean).map((x) => optionId(prop, x));
          break;
        default:
          cells[prop.id] = v;
      }
    });
    return { id: ulid(), order: n + 1, cells };
  });
  if (!props.length) props.push({ id: "title", name: "Name", type: "title" });
  return { properties: props, views: [{ id: "table", name: "Table", type: "table", filters: [], sorts: [], hidden: [] }], rows };
}

/* ---------- Markdown ---------- */

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
};

function slug(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${base || "file"}.${dot > 0 ? name.slice(dot + 1).toLowerCase() : "bin"}`;
}

/** <aside> callouts in the export → our callout blocks. */
function convertAsides(md: string): string {
  return md.replace(/<aside>\s*\n?([\s\S]*?)\n?\s*<\/aside>/g, (_m, inner: string) => {
    const text = inner.trim().replace(/^<img[^>]*>\s*/, "");
    const icon = /^(\p{Extended_Pictographic})\s*/u.exec(text);
    const variant = icon ? ({ "💡": "idea", "⚠️": "warning", "❗": "danger", "🚨": "danger", "✅": "success" } as Record<string, string>)[icon[1]] ?? "info" : "info";
    return `:::callout ${variant}\n${icon ? text.slice(icon[0].length) : text}\n:::`;
  });
}

export function bundleFromIdFolders(entries: Record<string, Uint8Array>, fallbackName: string): WorkspaceBundle {
  const names = Object.keys(entries).sort();
  // Prefer "<id>_all.csv" (every row, not just the default view) over "<id>.csv".
  const csvs = names.filter((n) => /_all\.csv$/i.test(n) || (/\.csv$/i.test(n) && !names.includes(n.replace(/\.csv$/i, "_all.csv"))));
  const mds = names.filter((n) => /\.md$/i.test(n));
  const keyOf = (path: string) => path.replace(/(_all)?\.(md|csv)$/i, "");

  const pages: BundlePage[] = [];
  const assets: BundleAsset[] = [];
  const idByKey = new Map<string, string>();
  const idByPath = new Map<string, string>();
  for (const path of [...csvs, ...mds]) {
    const key = keyOf(path);
    const id = idByKey.get(key) ?? ulid();
    idByKey.set(key, id);
    idByPath.set(path, id);
  }

  // Plain folders (no page of their own) still become pages, so the tree is kept.
  const folderPage = (dir: string): string | null => {
    if (!dir) return null;
    const existing = idByKey.get(dir);
    if (existing) return existing;
    const id = ulid();
    idByKey.set(dir, id);
    pages.push({ id, parentId: folderPage(dirOf(dir)), order: pages.length + 1, title: stripExportId(baseName(dir)), markdown: "" });
    return id;
  };

  const assetFor = new Map<string, string>();
  const relink = (md: string, dir: string) =>
    md
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt: string, href: string) => {
        if (/^[a-z]+:/i.test(href)) return full;
        const target = resolve(dir, href);
        const data = entries[target];
        if (!data) return full;
        let path = assetFor.get(target);
        if (!path) {
          path = `assets/${ulid().slice(-10).toLowerCase()}-${slug(target.split("/").pop()!)}`;
          assetFor.set(target, path);
          assets.push({ path, mime: MIME[target.split(".").pop()!.toLowerCase()] ?? "application/octet-stream", data });
        }
        return `![${alt}](${path})`;
      })
      .replace(/(?<!!)\[([^\]]*)\]\(([^)\s]+\.(?:md|csv))\)/g, (full, text: string, href: string) => {
        if (/^[a-z]+:/i.test(href)) return full;
        const id = idByPath.get(resolve(dir, href)) ?? idByKey.get(keyOf(resolve(dir, href)));
        return id ? `[[page:${id}|${text.replace(/[|\]]/g, " ")}]]` : full;
      });

  for (const path of csvs) {
    const id = idByPath.get(path)!;
    const data = databaseFromCsv(strFromU8(entries[path]));
    pages.push({ id, parentId: folderPage(dirOf(path)), order: pages.length + 1, title: stripExportId(baseName(path)), kind: "database", markdown: serializeDatabase(data) });
  }
  for (const path of mds) {
    const id = idByPath.get(path)!;
    if (pages.some((p) => p.id === id)) continue; // a database's .md twin
    let md = strFromU8(entries[path]).replace(/^﻿/, "");
    let title = stripExportId(baseName(path));
    const h1 = /^# +(.+?)\s*$/m.exec(md);
    if (h1 && md.slice(0, h1.index).trim() === "") {
      title = h1[1].trim();
      md = md.slice(h1.index + h1[0].length).replace(/^\s*\n/, "");
    }
    pages.push({ id, parentId: folderPage(dirOf(path)), order: pages.length + 1, title, markdown: relink(convertAsides(md), dirOf(path)) });
  }
  // Children were added before or after their parents; keep a stable order by path.
  return { name: fallbackName, pillars: [], pages, assets };
}
