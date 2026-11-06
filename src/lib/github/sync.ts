import { ulid } from "ulid";
import { BRAND } from "@/config/brand";
import { workspaceFileSchema, type AssetRecord, type PageRecord, type WorkspaceRecord } from "@/lib/model/schemas";
import { getDB } from "@/lib/storage/db";
import { pageFile, workspaceFile } from "@/lib/transfer/bundle";
import { pageContentFromFile } from "@/lib/page-file";
import { gitBlobSha, GitHubError, RemoteChangedError, utf8, type GitHubApi } from "./api";
import { commentChanges, commentFilesChanged, planComments, readAllComments, recordPushedComments, baseCommentSha, type CommentPlan } from "./comments-sync";
import { commentsPath } from "@/lib/comments/types";
import { commitChanges, getHead, inRepo, normalizeDir, readBlob, readTree, type FileChange, type RepoRef } from "./repo";

/**
 * Workspace <-> repository.
 *
 * A workspace lives in one folder of a repository (`repo.dir`, e.g. "GDD"), so a game's design
 * documents can sit next to its Unity/Unreal project. PageHut only ever reads and writes inside
 * that folder (plus a README.md when it initializes an empty repository).
 *
 * Pushes are one commit. Teammates' commits to other files (code, art) don't block a push; a
 * remote change to one of the workspace's own files does (RemoteChangedError), and is resolved by
 * merging in phase P3. Nothing is ever force-pushed or overwritten.
 */

export class RepoHasWorkspaceError extends Error {
  constructor() {
    super("This folder already contains a workspace");
  }
}
export class NotAWorkspaceError extends Error {
  constructor() {
    super("This repository has no workspace.json");
  }
}
export class PendingChangesError extends Error {
  constructor() {
    super("Push pending changes first");
  }
}

export const WORKSPACE_FILE = "workspace.json";
export const pagePath = (id: string) => `pages/${id}.md`;

export function pageFileText(page: PageRecord): string {
  return pageFile({ id: page.id, parentId: page.parentId, order: page.order, title: page.title, icon: page.icon, kind: page.kind, markdown: page.markdown });
}

function workspaceJsonText(ws: WorkspaceRecord, pages: PageRecord[]): string {
  const file = workspaceFile({
    name: ws.name,
    pillars: ws.pillars ?? [],
    pages: pages.map(({ id, parentId, order, title, icon, kind, markdown }) => ({ id, parentId, order, title, icon, kind, markdown })),
    assets: [],
  });
  return `${JSON.stringify(file, null, 2)}\n`;
}

const readme = (name: string) =>
  `# ${name}\n\nGame design documents written with ${BRAND.name}. Pages are Markdown files in \`pages/\`; the page tree is in \`workspace.json\`.\n`;

/**
 * Blob shas of what we last synced. Computed from the synced content when not stored (git ids are
 * content hashes), so workspaces connected by older versions keep working.
 */
export async function baseWorkspaceSha(ws: WorkspaceRecord): Promise<string | null> {
  if (ws.workspaceFileSha) return ws.workspaceFileSha;
  return ws.workspaceFileBase ? gitBlobSha(utf8.encode(ws.workspaceFileBase)) : null;
}
export async function basePageSha(page: PageRecord): Promise<string | null> {
  if (!page.base) return null;
  return page.base.sha || gitBlobSha(utf8.encode(page.base.markdown));
}

interface Plan {
  ws: WorkspaceRecord & { repo: RepoRef };
  changedPages: PageRecord[];
  deletedPages: PageRecord[];
  workspaceJson: string;
  workspaceJsonChanged: boolean;
  newAssets: AssetRecord[];
  comments: CommentPlan;
}

async function plan(workspaceId: string, exclude: ReadonlySet<string> = new Set()): Promise<Plan> {
  const db = getDB();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws?.repo) throw new Error("Workspace is not connected to a repository");
  const all = await db.pages.where("workspaceId").equals(workspaceId).toArray();
  const live = all.filter((p) => !p.deletedAt);
  const workspaceJson = workspaceJsonText(ws, live);
  const deletedPages = all.filter((p) => p.deletedAt && p.base && !p.conflict && !exclude.has(p.id));
  return {
    ws: ws as Plan["ws"],
    // Pages in conflict wait for the user's decision; everything else can still be pushed.
    changedPages: live.filter((p) => !p.conflict && !exclude.has(p.id) && p.base?.markdown !== pageFileText(p)),
    deletedPages,
    comments: await planComments(workspaceId, new Set(deletedPages.map((p) => p.id)), new Set(live.map((p) => p.id))),
    workspaceJson,
    workspaceJsonChanged: workspaceJson !== ws.workspaceFileBase,
    newAssets: (await db.assets.where("workspaceId").equals(workspaceId).toArray()).filter((a) => !a.sha),
  };
}

/** Number of files a push would send (cheap: doesn't read image data). 0 for local workspaces. */
export async function pendingCount(workspaceId: string): Promise<number> {
  const ws = await getDB().workspaces.get(workspaceId);
  if (!ws?.repo) return 0;
  const p = await plan(workspaceId);
  return p.changedPages.length + p.deletedPages.length + (p.workspaceJsonChanged ? 1 : 0) + p.newAssets.length + p.comments.changed.length + p.comments.deleted.length;
}

export interface PendingChanges {
  changes: FileChange[];
  titles: string[];
  workspaceJson: string;
  pageTexts: Map<string, string>;
  deletedPageIds: string[];
  assetPaths: string[];
  commentTexts: Map<string, string>;
  deletedCommentIds: string[];
}

/** What a push would send right now (content-based: unchanged files are skipped). */
export async function pendingChanges(workspaceId: string, exclude?: ReadonlySet<string>): Promise<PendingChanges> {
  const p = await plan(workspaceId, exclude);
  const repo = p.ws.repo;
  const changes: FileChange[] = [];
  const pageTexts = new Map<string, string>();
  for (const page of p.changedPages) {
    const text = pageFileText(page);
    pageTexts.set(page.id, text);
    changes.push({ path: inRepo(repo, pagePath(page.id)), content: utf8.encode(text), expectedSha: await basePageSha(page) });
  }
  for (const page of p.deletedPages) changes.push({ path: inRepo(repo, pagePath(page.id)), delete: true, expectedSha: await basePageSha(page) });
  if (p.workspaceJsonChanged) {
    changes.push({ path: inRepo(repo, WORKSPACE_FILE), content: utf8.encode(p.workspaceJson), expectedSha: await baseWorkspaceSha(p.ws) });
  }
  for (const a of p.newAssets) {
    changes.push({ path: inRepo(repo, a.path), content: new Uint8Array(await a.blob.arrayBuffer()), expectedSha: null });
  }
  const comments = await commentChanges(repo, p.comments);
  changes.push(...comments.changes);
  return {
    changes,
    commentTexts: comments.texts,
    deletedCommentIds: p.comments.deleted.map((r) => r.pageId),
    titles: p.changedPages.map((pg) => pg.title || "Untitled"),
    workspaceJson: p.workspaceJson,
    pageTexts,
    deletedPageIds: p.deletedPages.map((pg) => pg.id),
    assetPaths: p.newAssets.map((a) => a.path),
  };
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
export async function pushWorkspace(
  api: GitHubApi,
  workspaceId: string,
  messageOverride?: string,
  /** Pages to leave out of this push (e.g. postponed by a pull while being edited). */
  exclude?: ReadonlySet<string>,
): Promise<PushResult> {
  const db = getDB();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws?.repo) throw new Error("Workspace is not connected to a repository");
  const pending = await pendingChanges(workspaceId, exclude);
  if (!pending.changes.length) {
    // Nothing to send. Report "synced" only if no one changed the workspace's own files on GitHub.
    const head = await getHead(api, ws.repo);
    if ((head?.commit ?? null) !== (ws.headSha ?? null) && head) {
      if (await workspaceFilesChanged(api, ws as Plan["ws"], head.tree)) throw new RemoteChangedError();
      await db.workspaces.update(workspaceId, { headSha: head.commit, lastSyncedAt: Date.now() });
    }
    return { commit: null, files: 0 };
  }

  const repo = ws.repo;
  const { commit, blobShas } = await commitChanges(api, repo, {
    expectedHead: ws.headSha ?? null,
    changes: pending.changes,
    message: messageOverride ?? commitMessage(pending.titles, pending.deletedPageIds.length),
    readmeForEmptyRepo: readme(ws.name),
  });

  const now = Date.now();
  await db.transaction("rw", [db.workspaces, db.pages, db.assets, db.comments], async () => {
    await recordPushedComments(repo, pending.commentTexts, pending.deletedCommentIds, blobShas, now);
    for (const [id, text] of pending.pageTexts) {
      const page = await db.pages.get(id);
      if (!page) continue;
      // Only mark clean if nothing was edited while the push was in flight.
      const stillSame = pageFileText(page) === text;
      await db.pages.update(id, { base: { markdown: text, sha: blobShas.get(inRepo(repo, pagePath(id))) ?? "", syncedAt: now }, dirty: !stillSame });
    }
    for (const id of pending.deletedPageIds) await db.pages.update(id, { base: undefined, dirty: false });
    for (const path of pending.assetPaths) await db.assets.update(path, { sha: blobShas.get(inRepo(repo, path)) });
    const wsSha = blobShas.get(inRepo(repo, WORKSPACE_FILE));
    await db.workspaces.update(workspaceId, {
      headSha: commit,
      workspaceFileBase: pending.workspaceJson,
      ...(wsSha ? { workspaceFileSha: wsSha } : {}),
      lastSyncedAt: now,
    });
  });
  return { commit, files: pending.changes.length };
}

/** True if any file of this workspace differs on GitHub from what we last synced. */
async function workspaceFilesChanged(api: GitHubApi, ws: Plan["ws"], treeSha: string): Promise<boolean> {
  const db = getDB();
  const remote = new Map((await readTree(api, ws.repo, treeSha)).map((e) => [e.path, e.sha]));
  if ((remote.get(inRepo(ws.repo, WORKSPACE_FILE)) ?? null) !== (await baseWorkspaceSha(ws))) return true;
  const pages = await db.pages.where("workspaceId").equals(ws.id).toArray();
  for (const p of pages) {
    if (p.base && !p.conflict && remote.get(inRepo(ws.repo, pagePath(p.id))) !== (await basePageSha(p))) return true;
  }
  const prefix = inRepo(ws.repo, "pages/");
  const known = new Set(pages.filter((p) => p.base || p.conflict).map((p) => inRepo(ws.repo, pagePath(p.id))));
  for (const path of remote.keys()) if (path.startsWith(prefix) && !known.has(path)) return true; // page added remotely
  return commentFilesChanged(ws.id, ws.repo, remote);
}

/**
 * Links a local workspace to a folder of a repository and pushes everything.
 * The folder must not contain a workspace yet; other files in the repository are left alone.
 */
export async function connectWorkspace(api: GitHubApi, workspaceId: string, target: RepoRef): Promise<PushResult> {
  const db = getDB();
  const repo: RepoRef = { ...target, dir: normalizeDir(target.dir) };
  const head = await getHead(api, repo);
  if (head) {
    const tree = await readTree(api, repo, head.tree);
    if (tree.some((e) => e.path === inRepo(repo, WORKSPACE_FILE))) throw new RepoHasWorkspaceError();
  }
  const before = await db.workspaces.get(workspaceId);
  await db.transaction("rw", [db.workspaces, db.pages, db.assets, db.comments], async () => {
    await db.comments.where("workspaceId").equals(workspaceId).modify({ base: undefined });
    await db.workspaces.update(workspaceId, {
      mode: "github",
      repo,
      headSha: head?.commit ?? null,
      workspaceFileBase: undefined,
      workspaceFileSha: undefined,
    });
    // Everything counts as new for this repository.
    await db.pages.where("workspaceId").equals(workspaceId).modify({ base: undefined, dirty: true });
    await db.assets.where("workspaceId").equals(workspaceId).modify({ sha: undefined });
  });
  try {
    return await pushWorkspace(api, workspaceId, `Add ${BRAND.name} workspace${repo.dir ? ` in ${repo.dir}/` : ""}\n\nSaved with ${BRAND.name}`);
  } catch (err) {
    // Connection failed: go back to how it was, so the user isn't left half-connected.
    await db.workspaces.update(workspaceId, { mode: before?.mode ?? "local", repo: before?.repo, headSha: before?.headSha });
    throw err;
  }
}

/**
 * Moves the workspace to another folder of the same repository in one commit (e.g. from the root
 * to "GDD/"). Requires a clean state: push pending changes first.
 */
export async function moveWorkspaceDir(api: GitHubApi, workspaceId: string, newDirInput: string): Promise<PushResult> {
  const db = getDB();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws?.repo) throw new Error("Workspace is not connected to a repository");
  const newDir = normalizeDir(newDirInput);
  const oldRepo = ws.repo;
  const newRepo: RepoRef = { ...oldRepo, dir: newDir };
  if ((oldRepo.dir ?? "") === newDir) return { commit: null, files: 0 };
  if ((await pendingCount(workspaceId)) > 0) throw new PendingChangesError();

  const head = await getHead(api, oldRepo);
  if (head) {
    const tree = await readTree(api, oldRepo, head.tree);
    if (tree.some((e) => e.path === inRepo(newRepo, WORKSPACE_FILE))) throw new RepoHasWorkspaceError();
  }

  const pages = (await db.pages.where("workspaceId").equals(workspaceId).toArray()).filter((p) => p.base);
  const assets = (await db.assets.where("workspaceId").equals(workspaceId).toArray()).filter((a) => a.sha);
  const changes: FileChange[] = [];
  const move = (path: string, content: Uint8Array, sha: string | null) => {
    changes.push({ path: inRepo(oldRepo, path), delete: true, expectedSha: sha });
    changes.push({ path: inRepo(newRepo, path), content, expectedSha: null });
  };
  for (const p of pages) move(pagePath(p.id), utf8.encode(p.base!.markdown), await basePageSha(p));
  if (ws.workspaceFileBase) move(WORKSPACE_FILE, utf8.encode(ws.workspaceFileBase), await baseWorkspaceSha(ws));
  for (const a of assets) move(a.path, new Uint8Array(await a.blob.arrayBuffer()), a.sha!);
  const comments = (await db.comments.where("workspaceId").equals(workspaceId).toArray()).filter((c) => c.base);
  for (const c of comments) move(commentsPath(c.pageId), utf8.encode(c.base!.text), await baseCommentSha(c));

  const { commit, blobShas } = await commitChanges(api, oldRepo, {
    expectedHead: ws.headSha ?? null,
    changes,
    message: `Move ${BRAND.name} workspace to ${newDir ? `${newDir}/` : "the repository root"}\n\nSaved with ${BRAND.name}`,
    readmeForEmptyRepo: readme(ws.name),
  });

  await db.transaction("rw", [db.workspaces, db.pages, db.assets, db.comments], async () => {
    for (const p of pages) {
      await db.pages.update(p.id, { base: { ...p.base!, sha: blobShas.get(inRepo(newRepo, pagePath(p.id))) ?? p.base!.sha } });
    }
    for (const c of comments) await db.comments.update(c.pageId, { base: { ...c.base!, sha: blobShas.get(inRepo(newRepo, commentsPath(c.pageId))) ?? c.base!.sha } });
    for (const a of assets) await db.assets.update(a.path, { sha: blobShas.get(inRepo(newRepo, a.path)) ?? a.sha });
    await db.workspaces.update(workspaceId, {
      repo: newRepo,
      headSha: commit,
      workspaceFileSha: blobShas.get(inRepo(newRepo, WORKSPACE_FILE)) ?? ws.workspaceFileSha,
      lastSyncedAt: Date.now(),
    });
  });
  return { commit, files: changes.length };
}

/** Finds PageHut workspaces in a repository tree (root first, then shallowest folder). */
function findWorkspaceDirs(paths: string[]): string[] {
  return paths
    .filter((p) => p === WORKSPACE_FILE || p.endsWith(`/${WORKSPACE_FILE}`))
    .map((p) => p.slice(0, -WORKSPACE_FILE.length).replace(/\/$/, ""))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
}

/** Opens a workspace stored in a repo as a new local working copy (or returns the existing one). */
export async function openRepoWorkspace(api: GitHubApi, target: RepoRef): Promise<string> {
  const db = getDB();
  const head = await getHead(api, target);
  if (!head) throw new NotAWorkspaceError();
  const tree = await readTree(api, target, head.tree);

  // Use the given folder, or discover where the workspace is (e.g. "GDD").
  let parsedFile: ReturnType<typeof workspaceFileSchema.parse> | null = null;
  let wsText = "";
  let wsSha = "";
  let dir = "";
  const candidates = target.dir !== undefined ? [normalizeDir(target.dir)] : findWorkspaceDirs(tree.map((e) => e.path));
  for (const candidate of candidates) {
    const entry = tree.find((e) => e.path === inRepo({ dir: candidate }, WORKSPACE_FILE));
    if (!entry) continue;
    const text = utf8.decode(await readBlob(api, target, entry.sha));
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    const parsed = workspaceFileSchema.safeParse(json);
    if (parsed.success) {
      parsedFile = parsed.data;
      wsText = text;
      wsSha = entry.sha;
      dir = candidate;
      break;
    }
  }
  if (!parsedFile) throw new NotAWorkspaceError();
  const file = parsedFile;
  const repo: RepoRef = { owner: target.owner, name: target.name, branch: target.branch, dir };

  const existing = (await db.workspaces.toArray()).find(
    (w) => w.repo && w.repo.owner === repo.owner && w.repo.name === repo.name && w.repo.branch === repo.branch && (w.repo.dir ?? "") === dir,
  );
  if (existing) return existing.id;

  const pageIds = new Set(file.tree.map((n) => n.id));
  const clash = await db.pages.where("id").anyOf([...pageIds]).count();
  if (clash) throw new GitHubError(409, "Some pages of this repository already exist in another local workspace");

  const byPath = new Map(tree.map((e) => [e.path, e]));
  const now = Date.now();
  const workspaceId = ulid();
  const pages: PageRecord[] = [];
  for (const node of file.tree) {
    const entry = byPath.get(inRepo(repo, pagePath(node.id)));
    const text = entry ? utf8.decode(await readBlob(api, repo, entry.sha)) : "";
    const content = pageContentFromFile(text, node.title);
    pages.push({
      id: node.id,
      workspaceId,
      parentId: node.parentId,
      order: node.order,
      title: node.title,
      icon: node.icon,
      ...(content.kind || node.kind ? { kind: "database" as const, database: content.database ?? { properties: [], views: [], rows: [] } } : {}),
      doc: content.doc,
      markdown: content.markdown,
      createdAt: now,
      updatedAt: now,
      dirty: false,
      ...(entry ? { base: { markdown: text, sha: entry.sha, syncedAt: now } } : {}),
    });
  }

  const assetPrefix = inRepo(repo, "assets/");
  const assets: AssetRecord[] = [];
  for (const e of tree.filter((x) => x.path.startsWith(assetPrefix))) {
    const data = await readBlob(api, repo, e.sha);
    const ext = e.path.split(".").pop()?.toLowerCase() ?? "";
    const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" }[ext] ?? "application/octet-stream";
    const localPath = e.path.slice(assetPrefix.length - "assets/".length);
    assets.push({ path: localPath, workspaceId, blob: new Blob([data as BlobPart], { type: mime }), mime, size: data.length, createdAt: now, sha: e.sha });
  }

  const comments = await readAllComments(workspaceId, repo, new Map(tree.map((e) => [e.path, e.sha])), async (sha) => utf8.decode(await readBlob(api, repo, sha)), now);

  await db.transaction("rw", [db.workspaces, db.pages, db.assets, db.comments], async () => {
    await db.comments.bulkPut(comments);
    await db.workspaces.add({
      id: workspaceId,
      name: file.name,
      mode: "github",
      repo,
      headSha: head.commit,
      workspaceFileBase: wsText,
      workspaceFileSha: wsSha,
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

/** Files that mark a repository as a game project (Unity, Unreal, Godot). */
export function isGameProject(paths: string[]): boolean {
  return (
    paths.some((p) => p.startsWith("Assets/")) && paths.some((p) => p.startsWith("ProjectSettings/"))
  ) || paths.some((p) => /^[^/]+\.uproject$/.test(p)) || paths.includes("project.godot");
}

/**
 * Workspaces connected before folder support (repo.dir === undefined) sit at the repository root.
 * In a game repository they are moved to "GDD/" once, automatically; elsewhere the root is kept
 * and recorded as an explicit choice. New connections always set repo.dir, so this never touches
 * a folder someone picked on purpose.
 */
const migrating = new Map<string, Promise<"moved" | "kept" | "skipped">>();

export function migrateLegacyRootWorkspace(api: GitHubApi, workspaceId: string): Promise<"moved" | "kept" | "skipped"> {
  // One run per workspace at a time, even if the UI asks again while it is in flight.
  const running = migrating.get(workspaceId);
  if (running) return running.then(() => "skipped" as const);
  const run = migrateOnce(api, workspaceId).finally(() => migrating.delete(workspaceId));
  migrating.set(workspaceId, run);
  return run;
}

async function migrateOnce(api: GitHubApi, workspaceId: string): Promise<"moved" | "kept" | "skipped"> {
  const db = getDB();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws?.repo || ws.repo.dir !== undefined) return "skipped";
  const head = await getHead(api, ws.repo);
  const paths = head ? (await readTree(api, ws.repo, head.tree)).map((e) => e.path) : [];
  if (!isGameProject(paths)) {
    await db.workspaces.update(workspaceId, { repo: { ...ws.repo, dir: "" } });
    return "kept";
  }
  if ((await pendingCount(workspaceId)) > 0) await pushWorkspace(api, workspaceId);
  await moveWorkspaceDir(api, workspaceId, "GDD");
  return "moved";
}
