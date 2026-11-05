import { ulid } from "ulid";
import { BRAND } from "@/config/brand";
import { docToMarkdown } from "@/lib/markdown/serialize";
import { markdownToDoc } from "@/lib/markdown/parse";
import { workspaceFileSchema, type AssetRecord, type PageRecord, type WorkspaceRecord } from "@/lib/model/schemas";
import { getDB } from "@/lib/storage/db";
import { pageFile, workspaceFile } from "@/lib/transfer/bundle";
import { parseFrontMatter } from "@/lib/transfer/frontmatter";
import { GitHubError, RemoteChangedError, utf8, type GitHubApi } from "./api";
import { commitChanges, getHead, readBlob, readTree, type FileChange, type RepoRef } from "./repo";

/**
 * Workspace <-> repository. P2 scope: connect a local workspace to a repo, open a workspace from a
 * repo, and push local changes as one fast-forward commit. If the branch moved in the meantime,
 * the push stops with RemoteChangedError and nothing is lost locally; merging is phase P3.
 */

export class RepoHasWorkspaceError extends Error {
  constructor() {
    super("This repository already contains a workspace");
  }
}
export class NotAWorkspaceError extends Error {
  constructor() {
    super("This repository has no workspace.json");
  }
}

const WORKSPACE_FILE = "workspace.json";
const pagePath = (id: string) => `pages/${id}.md`;

export function pageFileText(page: PageRecord): string {
  return pageFile({ id: page.id, parentId: page.parentId, order: page.order, title: page.title, icon: page.icon, markdown: page.markdown });
}

function workspaceJsonText(ws: WorkspaceRecord, pages: PageRecord[]): string {
  const file = workspaceFile({
    name: ws.name,
    pillars: ws.pillars ?? [],
    pages: pages.map(({ id, parentId, order, title, icon, markdown }) => ({ id, parentId, order, title, icon, markdown })),
    assets: [],
  });
  return `${JSON.stringify(file, null, 2)}\n`;
}

const readme = (name: string) =>
  `# ${name}\n\nGame design documents written with ${BRAND.name}. Pages are Markdown files in \`pages/\`; the page tree is in \`workspace.json\`.\n`;

export interface PendingChanges {
  changes: FileChange[];
  /** Titles of changed pages, for the commit message and the UI. */
  titles: string[];
  workspaceJson: string;
  pageTexts: Map<string, string>;
  deletedPageIds: string[];
  assetPaths: string[];
}

/** What a push would send right now (content-based: unchanged files are skipped). */
export async function pendingChanges(workspaceId: string): Promise<PendingChanges> {
  const db = getDB();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws) throw new Error("Workspace not found");
  const all = await db.pages.where("workspaceId").equals(workspaceId).toArray();
  const live = all.filter((p) => !p.deletedAt);

  const changes: FileChange[] = [];
  const titles: string[] = [];
  const pageTexts = new Map<string, string>();
  for (const page of live) {
    const text = pageFileText(page);
    if (page.base?.markdown === text) continue;
    pageTexts.set(page.id, text);
    changes.push({ path: pagePath(page.id), content: utf8.encode(text) });
    titles.push(page.title || "Untitled");
  }

  const deletedPageIds = all.filter((p) => p.deletedAt && p.base).map((p) => p.id);
  for (const id of deletedPageIds) changes.push({ path: pagePath(id), delete: true });

  const workspaceJson = workspaceJsonText(ws, live);
  if (workspaceJson !== ws.workspaceFileBase) changes.push({ path: WORKSPACE_FILE, content: utf8.encode(workspaceJson) });

  const assets = await db.assets.where("workspaceId").equals(workspaceId).toArray();
  const assetPaths: string[] = [];
  for (const a of assets.filter((x) => !x.sha)) {
    changes.push({ path: a.path, content: new Uint8Array(await a.blob.arrayBuffer()) });
    assetPaths.push(a.path);
  }
  return { changes, titles, workspaceJson, pageTexts, deletedPageIds, assetPaths };
}

export function commitMessage(titles: string[], deleted: number, fallback = "Update workspace"): string {
  const quoted = titles.slice(0, 3).map((t) => `"${t}"`);
  const more = titles.length > 3 ? ` and ${titles.length - 3} more` : "";
  const head = quoted.length ? `Update ${quoted.join(", ")}${more}` : deleted ? `Delete ${deleted} page${deleted > 1 ? "s" : ""}` : fallback;
  return `${head}\n\nSaved with ${BRAND.name}`;
}

export interface PushResult {
  commit: string | null;
  files: number;
}

/** Pushes all pending changes as one commit, then records the new sync base locally. */
export async function pushWorkspace(api: GitHubApi, workspaceId: string, messageOverride?: string): Promise<PushResult> {
  const db = getDB();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws?.repo) throw new Error("Workspace is not connected to a repository");
  const pending = await pendingChanges(workspaceId);
  if (!pending.changes.length) {
    // Nothing to send, but only report "synced" if GitHub has no newer commits either.
    const head = await getHead(api, ws.repo);
    if ((head?.commit ?? null) !== (ws.headSha ?? null)) throw new RemoteChangedError();
    return { commit: null, files: 0 };
  }

  const { commit, blobShas } = await commitChanges(api, ws.repo, {
    expectedHead: ws.headSha ?? null,
    changes: pending.changes,
    message: messageOverride ?? commitMessage(pending.titles, pending.deletedPageIds.length),
    readmeForEmptyRepo: readme(ws.name),
  });

  const now = Date.now();
  await db.transaction("rw", [db.workspaces, db.pages, db.assets], async () => {
    for (const [id, text] of pending.pageTexts) {
      const page = await db.pages.get(id);
      if (!page) continue;
      // Only mark clean if nothing was edited while the push was in flight.
      const stillSame = pageFileText(page) === text;
      await db.pages.update(id, { base: { markdown: text, sha: blobShas.get(pagePath(id)) ?? "", syncedAt: now }, dirty: !stillSame });
    }
    for (const id of pending.deletedPageIds) await db.pages.update(id, { base: undefined, dirty: false });
    for (const path of pending.assetPaths) await db.assets.update(path, { sha: blobShas.get(path) });
    await db.workspaces.update(workspaceId, { headSha: commit, workspaceFileBase: pending.workspaceJson, lastSyncedAt: now });
  });
  return { commit, files: pending.changes.length };
}

/** Links a local workspace to an (empty or non-workspace) repository and pushes everything. */
export async function connectWorkspace(api: GitHubApi, workspaceId: string, repo: RepoRef): Promise<PushResult> {
  const db = getDB();
  const head = await getHead(api, repo);
  if (head) {
    const tree = await readTree(api, repo, head.tree);
    if (tree.some((e) => e.path === WORKSPACE_FILE)) throw new RepoHasWorkspaceError();
  }
  await db.transaction("rw", [db.workspaces, db.pages, db.assets], async () => {
    await db.workspaces.update(workspaceId, { mode: "github", repo, headSha: head?.commit ?? null, workspaceFileBase: undefined });
    // Everything counts as new for this repo.
    await db.pages.where("workspaceId").equals(workspaceId).modify({ base: undefined, dirty: true });
    await db.assets.where("workspaceId").equals(workspaceId).modify({ sha: undefined });
  });
  try {
    return await pushWorkspace(api, workspaceId, `Add ${BRAND.name} workspace\n\nSaved with ${BRAND.name}`);
  } catch (err) {
    // Connection failed: go back to local mode so the user isn't left half-connected.
    await db.workspaces.update(workspaceId, { mode: "local", repo: undefined, headSha: undefined });
    throw err;
  }
}

/** Opens a workspace stored in a repo as a new local working copy (or returns the existing one). */
export async function openRepoWorkspace(api: GitHubApi, repo: RepoRef): Promise<string> {
  const db = getDB();
  const existing = (await db.workspaces.toArray()).find(
    (w) => w.repo && w.repo.owner === repo.owner && w.repo.name === repo.name && w.repo.branch === repo.branch,
  );
  if (existing) return existing.id;

  const head = await getHead(api, repo);
  if (!head) throw new NotAWorkspaceError();
  const tree = await readTree(api, repo, head.tree);
  const wsEntry = tree.find((e) => e.path === WORKSPACE_FILE);
  if (!wsEntry) throw new NotAWorkspaceError();
  const wsText = utf8.decode(await readBlob(api, repo, wsEntry.sha));
  const parsed = workspaceFileSchema.safeParse(JSON.parse(wsText));
  if (!parsed.success) throw new GitHubError(422, "workspace.json is not valid");
  const file = parsed.data;

  const pageIds = new Set(file.tree.map((n) => n.id));
  const clash = await db.pages.where("id").anyOf([...pageIds]).count();
  if (clash) throw new GitHubError(409, "Some pages of this repository already exist in another local workspace");

  const byPath = new Map(tree.map((e) => [e.path, e]));
  const now = Date.now();
  const workspaceId = ulid();
  const pages: PageRecord[] = [];
  for (const node of file.tree) {
    const entry = byPath.get(pagePath(node.id));
    const text = entry ? utf8.decode(await readBlob(api, repo, entry.sha)) : "";
    const { body } = parseFrontMatter(text);
    const doc = markdownToDoc(body);
    pages.push({
      id: node.id,
      workspaceId,
      parentId: node.parentId,
      order: node.order,
      title: node.title,
      icon: node.icon,
      doc,
      markdown: docToMarkdown(doc),
      createdAt: now,
      updatedAt: now,
      dirty: false,
      ...(entry ? { base: { markdown: text, sha: entry.sha, syncedAt: now } } : {}),
    });
  }

  const assetEntries = tree.filter((e) => e.path.startsWith("assets/"));
  const assets: AssetRecord[] = [];
  for (const e of assetEntries) {
    const data = await readBlob(api, repo, e.sha);
    const ext = e.path.split(".").pop()?.toLowerCase() ?? "";
    const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" }[ext] ?? "application/octet-stream";
    assets.push({ path: e.path, workspaceId, blob: new Blob([data as BlobPart], { type: mime }), mime, size: data.length, createdAt: now, sha: e.sha });
  }

  await db.transaction("rw", [db.workspaces, db.pages, db.assets], async () => {
    await db.workspaces.add({
      id: workspaceId,
      name: file.name,
      mode: "github",
      repo,
      headSha: head.commit,
      workspaceFileBase: wsText,
      pillars: file.pillars,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
    });
    await db.pages.bulkAdd(pages);
    await db.assets.bulkPut(assets);
  });
  return workspaceId;
}
