import { ulid } from "ulid";
import { getDB } from "./db";
import { migrateLegacyDatabases } from "./migrate";
import { docToMarkdown } from "@/lib/markdown/serialize";
import { markdownToDoc } from "@/lib/markdown/parse";
import {
  ASSET_MAX_BYTES,
  type AssetRecord,
  type PageRecord,
  type WorkspaceRecord,
} from "@/lib/model/schemas";

/**
 * Local working copy (IndexedDB). Every write goes here first; the GitHub sync engine (P3)
 * reads dirty pages from this layer. UI code never talks to Dexie directly.
 */

const ACTIVE_WS_KEY = "activeWorkspaceId";

export interface WelcomeContent {
  title: string;
  markdown: string;
  workspaceName: string;
}

/** Returns the active workspace, creating a local one with a welcome page on first run. */
export async function ensureWorkspace(welcome: WelcomeContent): Promise<WorkspaceRecord> {
  const db = getDB();
  // Bring over data saved under an earlier product name before deciding this is a first run.
  await migrateLegacyDatabases(db);
  return db.transaction("rw", db.workspaces, db.pages, db.kv, async () => {
    const activeId = (await db.kv.get(ACTIVE_WS_KEY))?.value as string | undefined;
    const existing = activeId ? await db.workspaces.get(activeId) : await db.workspaces.orderBy("updatedAt").last();
    if (existing) return existing;

    const now = Date.now();
    const ws: WorkspaceRecord = { id: ulid(), name: welcome.workspaceName, mode: "local", createdAt: now, updatedAt: now };
    await db.workspaces.add(ws);
    await db.kv.put({ key: ACTIVE_WS_KEY, value: ws.id });
    const doc = markdownToDoc(welcome.markdown);
    await db.pages.add({
      id: ulid(),
      workspaceId: ws.id,
      parentId: null,
      order: 1,
      title: welcome.title,
      doc,
      markdown: docToMarkdown(doc),
      createdAt: now,
      updatedAt: now,
      dirty: true,
    });
    return ws;
  });
}

/** Live pages of a workspace in sidebar order (trash excluded). */
export async function listPages(workspaceId: string): Promise<PageRecord[]> {
  const pages = await getDB().pages.where("workspaceId").equals(workspaceId).toArray();
  return pages.filter((p) => !p.deletedAt).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function getPage(id: string): Promise<PageRecord | undefined> {
  return getDB().pages.get(id);
}

export async function createPage(
  workspaceId: string,
  opts: { title?: string; parentId?: string | null; markdown?: string } = {},
): Promise<PageRecord> {
  const db = getDB();
  const siblings = await listPages(workspaceId);
  const parentId = opts.parentId ?? null;
  const maxOrder = Math.max(0, ...siblings.filter((p) => p.parentId === parentId).map((p) => p.order));
  const doc = markdownToDoc(opts.markdown ?? "");
  const now = Date.now();
  const page: PageRecord = {
    id: ulid(),
    workspaceId,
    parentId,
    order: maxOrder + 1,
    title: opts.title ?? "",
    doc,
    markdown: docToMarkdown(doc),
    createdAt: now,
    updatedAt: now,
    dirty: true,
  };
  await db.pages.add(page);
  await touchWorkspace(workspaceId, now);
  return page;
}

/**
 * Save editor content. `doc` is the lossless working copy; Markdown is regenerated for sync/export.
 * If serialization ever throws, the doc is still saved so no text is lost.
 */
export async function savePageContent(id: string, doc: unknown): Promise<PageRecord> {
  const db = getDB();
  let markdown: string | undefined;
  try {
    markdown = docToMarkdown(doc);
  } catch (err) {
    console.error("[storage] markdown serialization failed; saving doc only", err);
  }
  const now = Date.now();
  await db.pages.update(id, { doc, ...(markdown !== undefined ? { markdown } : {}), updatedAt: now, dirty: true });
  const page = await db.pages.get(id);
  if (!page) throw new Error(`Page ${id} not found`);
  await touchWorkspace(page.workspaceId, now);
  return page;
}

export async function savePageTitle(id: string, title: string): Promise<void> {
  const now = Date.now();
  await getDB().pages.update(id, { title, updatedAt: now, dirty: true });
}

/** Soft delete: the page moves to trash (restorable in P1). */
export async function trashPage(id: string): Promise<void> {
  await getDB().pages.update(id, { deletedAt: Date.now(), dirty: true });
}

async function touchWorkspace(id: string, at: number) {
  await getDB().workspaces.update(id, { updatedAt: at });
}

/* ---------- Assets ---------- */

export class AssetTooLargeError extends Error {
  constructor(public size: number) {
    super(`Asset is ${size} bytes; limit is ${ASSET_MAX_BYTES}`);
  }
}

function slugifyFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
  return `${base || "file"}.${ext}`;
}

/** Stores a file under assets/<id>-<name>; returns the repo-relative path used in Markdown. */
export async function putAsset(workspaceId: string, file: File): Promise<AssetRecord> {
  if (file.size > ASSET_MAX_BYTES) throw new AssetTooLargeError(file.size);
  const record: AssetRecord = {
    path: `assets/${ulid().slice(-10).toLowerCase()}-${slugifyFileName(file.name)}`,
    workspaceId,
    blob: file,
    mime: file.type || "application/octet-stream",
    size: file.size,
    createdAt: Date.now(),
  };
  await getDB().assets.add(record);
  return record;
}

export async function getAsset(path: string): Promise<AssetRecord | undefined> {
  return getDB().assets.get(path);
}
