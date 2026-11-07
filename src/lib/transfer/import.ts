import { ulid } from "ulid";
import { loadMarkdown } from "@/lib/markdown/runtime";
import { ASSET_MAX_BYTES, type PageRecord } from "@/lib/model/schemas";
import { getDB } from "@/lib/storage/db";
import { isDatabaseBody, parseDatabase, serializeDatabase } from "@/lib/database/file";
import { EMPTY_DOC } from "@/lib/page-file";
import { bundleFromJson, bundleFromZip, remapIds, titleFromMarkdown, type WorkspaceBundle } from "./bundle";
import { databaseFromCsv } from "./folder-export";
import { parseFrontMatter } from "./frontmatter";

export interface ImportResult {
  pages: number;
  firstPageId: string | null;
  skipped: string[];
}

/**
 * Adds a bundle to an existing workspace. Imported pages get fresh ids (links rewritten), land at
 * the end of the top level, and keep their own hierarchy. Existing pages are never changed.
 */
export async function importBundle(workspaceId: string, source: WorkspaceBundle): Promise<ImportResult> {
  const db = getDB();
  const { markdownToDoc, docToMarkdown } = await loadMarkdown();
  const bundle = remapIds(source, ulid);
  const existingRoots = (await db.pages.where("workspaceId").equals(workspaceId).toArray()).filter((p) => !p.parentId && !p.deletedAt);
  const offset = Math.max(0, ...existingRoots.map((p) => p.order));
  const now = Date.now();

  const records: PageRecord[] = bundle.pages.map((p) => {
    if (p.kind === "database" || isDatabaseBody(p.markdown)) {
      const { data } = parseDatabase(p.markdown);
      return {
        id: p.id,
        workspaceId,
        parentId: p.parentId,
        order: p.parentId ? p.order : offset + p.order,
        title: p.title,
        icon: p.icon,
        kind: "database" as const,
        database: data,
        doc: EMPTY_DOC,
        markdown: serializeDatabase(data),
        createdAt: now,
        updatedAt: now,
        dirty: true,
      };
    }
    // Parse + re-serialize: the stored Markdown is always in canonical form.
    const doc = markdownToDoc(p.markdown);
    return {
      id: p.id,
      workspaceId,
      parentId: p.parentId,
      order: p.parentId ? p.order : offset + p.order,
      title: p.title,
      icon: p.icon,
      doc,
      markdown: docToMarkdown(doc),
      createdAt: now,
      updatedAt: now,
      dirty: true,
    };
  });

  const skipped = bundle.assets.filter((a) => a.data.byteLength > ASSET_MAX_BYTES).map((a) => a.path);
  const assets = bundle.assets
    .filter((a) => a.data.byteLength <= ASSET_MAX_BYTES)
    .map((a) => ({ path: a.path, workspaceId, blob: new Blob([a.data as BlobPart], { type: a.mime }), mime: a.mime, size: a.data.byteLength, createdAt: now }));

  await db.transaction("rw", [db.pages, db.assets, db.workspaces], async () => {
    await db.pages.bulkAdd(records);
    await db.assets.bulkPut(assets);
    const ws = await db.workspaces.get(workspaceId);
    if (ws && !(ws.pillars?.length) && bundle.pillars.length) await db.workspaces.update(workspaceId, { pillars: bundle.pillars });
  });

  const firstRoot = records.find((r) => !r.parentId) ?? records[0];
  return { pages: records.length, firstPageId: firstRoot?.id ?? null, skipped };
}

/** Accepts .md/.markdown/.txt files, .csv tables, a .zip (export or folder of Markdown) or a .json workspace export. */
export async function importFiles(workspaceId: string, files: File[]): Promise<ImportResult> {
  const total: ImportResult = { pages: 0, firstPageId: null, skipped: [] };
  const loose: WorkspaceBundle = { name: "", pillars: [], pages: [], assets: [] };

  for (const file of files) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      merge(total, await importBundle(workspaceId, bundleFromZip(new Uint8Array(await file.arrayBuffer()), file.name)));
    } else if (name.endsWith(".json")) {
      merge(total, await importBundle(workspaceId, bundleFromJson(await file.text())));
    } else if (name.endsWith(".csv")) {
      // A spreadsheet export becomes a database: first column = row titles, column types inferred.
      const data = databaseFromCsv(await file.text());
      loose.pages.push({ id: ulid(), parentId: null, order: loose.pages.length + 1, title: file.name.replace(/\.csv$/i, ""), kind: "database", markdown: serializeDatabase(data) });
    } else if (/\.(md|markdown|txt)$/.test(name)) {
      const { meta, body } = parseFrontMatter(await file.text());
      const derived = typeof meta.title === "string" ? { title: meta.title, markdown: body } : titleFromMarkdown(body, file.name);
      loose.pages.push({ id: ulid(), parentId: null, order: loose.pages.length + 1, title: derived.title, markdown: derived.markdown });
    } else {
      total.skipped.push(file.name);
    }
  }
  if (loose.pages.length) merge(total, await importBundle(workspaceId, loose));
  return total;
}

function merge(into: ImportResult, r: ImportResult) {
  into.pages += r.pages;
  into.firstPageId ??= r.firstPageId;
  into.skipped.push(...r.skipped);
}
