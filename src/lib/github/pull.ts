import { loadMarkdown } from "@/lib/markdown/runtime";
import { mergePageFile, pageContentFromFile } from "@/lib/page-file";
import { workspaceFileSchema, type AssetRecord, type PageRecord, type WorkspaceFile, type WorkspaceRecord } from "@/lib/model/schemas";
import { getDB } from "@/lib/storage/db";
import { RemoteChangedError, utf8, type GitHubApi } from "./api";
import { getHead, inRepo, readBlob, readTree, type RepoRef } from "./repo";
import { pullComments } from "./comments-sync";
import { basePageSha, baseWorkspaceSha, pageFileText, pagePath, pushWorkspace, WORKSPACE_FILE, type PushResult } from "./sync";

/**
 * Pull: bring teammates' changes from GitHub into the local working copy.
 *
 * Per page file (compared by blob sha against what we last synced):
 *  - changed only remotely        -> take theirs
 *  - changed on both sides        -> three-way merge; clean merges apply, overlapping edits
 *                                    become a conflict (local text untouched, theirs kept aside)
 *  - added remotely               -> new local page
 *  - deleted remotely             -> removed locally if untouched; kept (as new) if edited here
 *  - deleted here, edited there   -> restored with their edit (an edit beats a delete)
 * The page tree (parent/order), pillars and name merge field by field against the last synced
 * workspace.json. Pages being edited right now are postponed to the next pull.
 */

export interface PullOptions {
  /** False for pages that must not change right now (open in the editor with recent typing). */
  canTouchPage?: (pageId: string) => boolean;
}

export interface PullResult {
  pulled: boolean;
  updated: string[];
  added: string[];
  removed: string[];
  merged: string[];
  conflicts: string[];
  deferred: string[];
  /** Pages whose comments changed. */
  comments: string[];
}

interface Remote {
  repo: RepoRef;
  head: { commit: string; tree: string };
  files: Map<string, string>; // path -> sha
}

const emptyResult = (): PullResult => ({ pulled: false, updated: [], added: [], removed: [], merged: [], conflicts: [], deferred: [], comments: [] });

const pageFromFile = (text: string, fallbackTitle: string) => pageContentFromFile(text, fallbackTitle);

function parseWorkspaceFile(text: string | undefined): WorkspaceFile | null {
  if (!text) return null;
  try {
    const parsed = workspaceFileSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function pullWorkspace(api: GitHubApi, workspaceId: string, opts: PullOptions = {}): Promise<PullResult> {
  await loadMarkdown(); // pageFromFile below runs inside a transaction
  const db = getDB();
  const canTouch = opts.canTouchPage ?? (() => true);
  const result = emptyResult();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws?.repo) throw new Error("Workspace is not connected to a repository");

  const head = await getHead(api, ws.repo);
  if (!head) return result; // repository emptied: nothing to pull
  if (head.commit === ws.headSha && !ws.pullDeferred) return result;

  const tree = await readTree(api, ws.repo, head.tree);
  const remote: Remote = { repo: ws.repo, head, files: new Map(tree.map((e) => [e.path, e.sha])) };
  const read = async (sha: string) => utf8.decode(await readBlob(api, ws.repo!, sha));
  const now = Date.now();

  // ---- workspace.json (tree positions, pillars, name) ----
  const remoteWsSha = remote.files.get(inRepo(ws.repo, WORKSPACE_FILE));
  const remoteWsText = remoteWsSha && remoteWsSha !== (await baseWorkspaceSha(ws)) ? await read(remoteWsSha) : undefined;
  const baseFile = parseWorkspaceFile(ws.workspaceFileBase);
  const remoteFile = remoteWsText !== undefined ? parseWorkspaceFile(remoteWsText) : baseFile;

  const pages = await db.pages.where("workspaceId").equals(workspaceId).toArray();
  const byId = new Map(pages.map((p) => [p.id, p]));
  const baseNodes = new Map((baseFile?.tree ?? []).map((n) => [n.id, n]));
  const remoteNodes = new Map((remoteFile?.tree ?? []).map((n) => [n.id, n]));

  const pageUpdates = new Map<string, Partial<PageRecord>>();
  const newPages: PageRecord[] = [];
  const update = (id: string, patch: Partial<PageRecord>) => pageUpdates.set(id, { ...pageUpdates.get(id), ...patch });

  // ---- page files ----
  for (const page of pages) {
    const path = inRepo(ws.repo, pagePath(page.id));
    const remoteSha = remote.files.get(path);
    const baseSha = await basePageSha(page);
    if (!page.base && !page.conflict) continue; // local-only page: nothing remote to compare with
    if (remoteSha === baseSha && !page.conflict) continue; // unchanged on GitHub

    if (!canTouch(page.id)) {
      result.deferred.push(page.id);
      continue;
    }

    const localText = pageFileText(page);
    const localChanged = !page.base || localText !== page.base.markdown;

    // Deleted on GitHub.
    if (!remoteSha) {
      if (page.deletedAt || !localChanged) {
        update(page.id, { deletedAt: page.deletedAt ?? now, base: undefined, dirty: false, conflict: undefined });
        result.removed.push(page.id);
      } else {
        // Edited here, deleted there: keep the text; it will be pushed again as a new file.
        update(page.id, { base: undefined, dirty: true, conflict: undefined });
      }
      continue;
    }

    const theirs = await read(remoteSha);
    const remoteBase = { markdown: theirs, sha: remoteSha, syncedAt: now };

    // Deleted here, edited there: their edit wins over the delete, so no text is lost.
    if (page.deletedAt) {
      update(page.id, { ...pageFromFile(theirs, page.title), deletedAt: undefined, base: remoteBase, dirty: false });
      result.updated.push(page.id);
      continue;
    }

    if (!localChanged) {
      update(page.id, { ...pageFromFile(theirs, page.title), base: remoteBase, dirty: false, conflict: undefined });
      result.updated.push(page.id);
      continue;
    }

    const merged = mergePageFile(page.id, page.base!.markdown, localText, theirs);
    if (merged.clean) {
      // Base becomes theirs, so the merged text is what the next push sends.
      update(page.id, { ...pageFromFile(merged.text, page.title), base: remoteBase, dirty: merged.text !== theirs, conflict: undefined });
      result.merged.push(page.id);
    } else {
      update(page.id, { conflict: { remoteText: theirs, remoteSha, detectedAt: now } });
      result.conflicts.push(page.id);
    }
  }

  // ---- pages added on GitHub ----
  const prefix = inRepo(ws.repo, "pages/");
  for (const [path, sha] of remote.files) {
    if (!path.startsWith(prefix) || !path.endsWith(".md")) continue;
    const id = path.slice(prefix.length, -3);
    if (byId.has(id)) continue;
    const text = await read(sha);
    const node = remoteNodes.get(id);
    newPages.push({
      id,
      workspaceId,
      parentId: node?.parentId ?? null,
      order: node?.order ?? Date.now(),
      ...pageFromFile(text, node?.title ?? ""),
      createdAt: now,
      updatedAt: now,
      dirty: false,
      base: { markdown: text, sha, syncedAt: now },
    });
    result.added.push(id);
  }

  // ---- tree positions: take the remote position unless it was also moved here ----
  if (remoteWsText !== undefined && remoteFile) {
    for (const [id, node] of remoteNodes) {
      const page = byId.get(id);
      if (!page || result.deferred.includes(id)) continue;
      const base = baseNodes.get(id);
      const movedHere = !base || base.parentId !== page.parentId || base.order !== page.order;
      if (!movedHere && (node.parentId !== page.parentId || node.order !== page.order)) {
        update(id, { parentId: node.parentId, order: node.order });
      }
    }
  }

  // ---- assets added on GitHub ----
  const assetPrefix = inRepo(ws.repo, "assets/");
  const assets: AssetRecord[] = [];
  for (const [path, sha] of remote.files) {
    if (!path.startsWith(assetPrefix)) continue;
    const local = path.slice(assetPrefix.length - "assets/".length);
    if (await db.assets.get(local)) continue;
    const data = await readBlob(api, ws.repo, sha);
    const ext = local.split(".").pop()?.toLowerCase() ?? "";
    const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" }[ext] ?? "application/octet-stream";
    assets.push({ path: local, workspaceId, blob: new Blob([data as BlobPart], { type: mime }), mime, size: data.length, createdAt: now, sha });
  }

  // ---- workspace fields ----
  const wsPatch: Partial<WorkspaceRecord> = {
    headSha: head.commit,
    pullDeferred: result.deferred.length > 0,
    lastSyncedAt: now,
  };
  if (remoteWsText !== undefined && remoteFile) {
    const localPillars = JSON.stringify(ws.pillars ?? []);
    if (localPillars === JSON.stringify(baseFile?.pillars ?? [])) wsPatch.pillars = remoteFile.pillars;
    if (ws.name === (baseFile?.name ?? ws.name)) wsPatch.name = remoteFile.name;
    wsPatch.workspaceFileBase = remoteWsText;
    wsPatch.workspaceFileSha = remoteWsSha;
  }

  // ---- comments (never deferred: they don't touch the editor) ----
  const comments = await pullComments(workspaceId, ws.repo, remote.files, read, now);
  result.comments = comments.changed;

  await db.transaction("rw", [db.workspaces, db.pages, db.assets, db.comments], async () => {
    if (comments.records.length) await db.comments.bulkPut(comments.records);
    if (comments.removed.length) await db.comments.bulkDelete(comments.removed);
    for (const [id, patch] of pageUpdates) await db.pages.update(id, { ...patch, updatedAt: now });
    if (newPages.length) await db.pages.bulkPut(newPages);
    if (assets.length) await db.assets.bulkPut(assets);
    await db.workspaces.update(workspaceId, wsPatch);
  });
  result.pulled = true;
  return result;
}

export interface SyncResult {
  pull: PullResult;
  push: PushResult;
}

/** Pull, then push whatever is left (conflicted pages wait for the user). */
export async function syncWorkspace(api: GitHubApi, workspaceId: string, opts: PullOptions = {}): Promise<SyncResult> {
  const pull = await pullWorkspace(api, workspaceId, opts);
  try {
    return { pull, push: await pushWorkspace(api, workspaceId, undefined, new Set(pull.deferred)) };
  } catch (err) {
    // Postponed pages (being edited) and open conflicts are expected to differ from GitHub;
    // they are handled on the next round or by the user, not reported as a sync failure.
    const waiting = pull.deferred.length > 0 || (await getDB().pages.where("workspaceId").equals(workspaceId).filter((p) => !!p.conflict).count()) > 0;
    if (err instanceof RemoteChangedError && waiting) return { pull, push: { commit: null, files: 0 } };
    throw err;
  }
}

/** The user's choice for a page in conflict. */
export async function resolveConflict(pageId: string, choice: "mine" | "theirs"): Promise<void> {
  await loadMarkdown();
  const db = getDB();
  const page = await db.pages.get(pageId);
  if (!page?.conflict) return;
  const remoteBase = { markdown: page.conflict.remoteText, sha: page.conflict.remoteSha, syncedAt: Date.now() };
  if (choice === "mine") {
    // Their version becomes the base, so the next push replaces it with mine (no force needed).
    await db.pages.update(pageId, { base: remoteBase, conflict: undefined, dirty: true });
  } else {
    await db.pages.update(pageId, {
      ...pageFromFile(page.conflict.remoteText, page.title),
      base: remoteBase,
      conflict: undefined,
      dirty: false,
      updatedAt: Date.now(),
    });
  }
}

/** Puts an older version (from the page history) back as a normal local edit; the next sync commits it. */
export async function restorePageVersion(pageId: string, fileText: string): Promise<void> {
  await loadMarkdown();
  const db = getDB();
  const page = await db.pages.get(pageId);
  if (!page) return;
  await db.pages.update(pageId, { ...pageFromFile(fileText, page.title), dirty: true, updatedAt: Date.now() });
}
