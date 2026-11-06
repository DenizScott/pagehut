import type { PageRecord, WorkspaceRecord } from "@/lib/model/schemas";
import { cellText, viewRows, visibleProperties } from "@/lib/database/query";
import type { DatabaseData } from "@/lib/database/types";
import { getAsset, listPages } from "@/lib/storage/local-repo";
import { buildTree, flattenVisible } from "@/lib/tree";

/**
 * The whole workspace as one printable document (Print → Save as PDF), in page-tree order: every
 * page starts on a new sheet, with its title, then its content. Databases print their first view
 * as a table.
 */

export interface PrintablePage {
  title: string;
  icon?: string;
  depth: number;
  /** Already-rendered, trusted HTML of the page body. */
  html: string;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** A database's first view as an HTML table (cell text only). */
export function databaseTableHtml(data: DatabaseData, locale: string): string {
  const view = data.views[0];
  if (!view) return "";
  const ctx = { locale };
  const props = visibleProperties(data, view);
  const rows = viewRows(data, view, ctx);
  const head = props.map((p) => `<th>${escapeHtml(p.name)}</th>`).join("");
  const body = rows.map((r) => `<tr>${props.map((p) => `<td>${escapeHtml(cellText(data, r, p, ctx))}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function workspaceDocument(opts: { name: string; lang: string; untitled: string; pages: PrintablePage[] }): string {
  const sections = opts.pages
    .map((p, i) => {
      const title = `${p.icon ? `${escapeHtml(p.icon)} ` : ""}${escapeHtml(p.title || opts.untitled)}`;
      return `<section class="page${i === 0 ? " first" : ""}" data-depth="${p.depth}"><h1 class="page-title">${title}</h1>${p.html}</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="${escapeHtml(opts.lang)}"><head><meta charset="utf-8"><title>${escapeHtml(opts.name)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font: 11pt/1.6 "Hanken Grotesk", system-ui, sans-serif; color: #1d231f; }
  .page { break-before: page; }
  .page.first { break-before: auto; }
  .page-title { font-size: 22pt; line-height: 1.2; margin: 0 0 12pt; }
  h1, h2, h3 { break-after: avoid; }
  h1:not(.page-title) { font-size: 17pt; } h2 { font-size: 14pt; } h3 { font-size: 12pt; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
  th, td { border: 1px solid #b8bdb4; padding: 3pt 5pt; text-align: start; vertical-align: top; }
  th { background: #eef0ea; }
  pre, code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9pt; }
  pre { white-space: pre-wrap; background: #f4f5f1; padding: 6pt; border-radius: 4pt; }
  blockquote { border-inline-start: 3pt solid #b8bdb4; margin-inline: 0; padding-inline-start: 8pt; color: #46514a; }
  [data-type="callout"], .lk-callout { border: 1px solid #b8bdb4; border-radius: 4pt; padding: 6pt 8pt; margin: 8pt 0; }
  ul[data-type="taskList"] { list-style: none; padding-inline-start: 0; }
  ul[data-type="taskList"] li { display: flex; gap: 6pt; }
  details > summary { font-weight: 600; }
</style></head>
<body>
${sections}
</body></html>`;
}

/** Builds the document from IndexedDB and opens the browser's print dialog for it. */
export async function printWorkspace(ws: WorkspaceRecord, opts: { locale: string; untitled: string }): Promise<void> {
  const pages = await listPages(ws.id);
  const ordered = flattenVisible(buildTree(pages), new Set(pages.map((p) => p.id)));
  // The editor schema renders the documents; it is loaded only when someone prints.
  const [{ generateHTML }, { schemaExtensions }] = await Promise.all([import("@tiptap/core"), import("@/lib/editor/extensions")]);
  const extensions = schemaExtensions();

  const printable: PrintablePage[] = ordered.map(({ item, depth }: { item: PageRecord; depth: number }) => {
    let html = "";
    try {
      html = item.kind === "database" && item.database ? databaseTableHtml(item.database, opts.locale) : generateHTML(item.doc as Parameters<typeof generateHTML>[0], extensions);
    } catch {
      html = `<pre>${escapeHtml(item.markdown)}</pre>`; // never drop a page's text
    }
    return { title: item.title, icon: item.icon, depth, html };
  });

  let html = workspaceDocument({ name: ws.name, lang: opts.locale, untitled: opts.untitled, pages: printable });

  // Images live in IndexedDB; point them at object URLs for the print.
  const urls: string[] = [];
  const paths = [...new Set([...html.matchAll(/src="(assets\/[^"]+)"/g)].map((m) => m[1]))];
  for (const path of paths) {
    const asset = await getAsset(path);
    if (!asset) continue;
    const url = URL.createObjectURL(asset.blob);
    urls.push(url);
    html = html.split(`src="${path}"`).join(`src="${url}"`);
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const cleanup = () => {
    frame.remove();
    for (const u of urls) URL.revokeObjectURL(u);
  };
  frame.addEventListener("load", () => {
    const win = frame.contentWindow;
    if (!win) return cleanup();
    win.addEventListener("afterprint", () => setTimeout(cleanup, 500));
    // Give images a moment to decode before the print snapshot.
    setTimeout(() => win.print(), 300);
  });
  frame.srcdoc = html;
}
