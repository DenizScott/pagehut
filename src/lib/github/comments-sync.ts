import { commentsFileText, commentsPath, mergeThreads, parseCommentsFile, type CommentsRecord } from "@/lib/comments/types";
import { getDB } from "@/lib/storage/db";
import { gitBlobSha, utf8 } from "./api";
import { inRepo, type FileChange, type RepoRef } from "./repo";

/**
 * comments/<pageId>.json <-> local comment records. Same rules as pages: push what changed since
 * the last synced base, never overwrite a newer remote file (expectedSha), and merge by thread and
 * comment id when both sides changed. Comment merges never conflict (see mergeThreads).
 */

export const commentText = (rec: CommentsRecord) => commentsFileText(rec.pageId, rec.threads);

export async function baseCommentSha(rec: CommentsRecord): Promise<string | null> {
  if (!rec.base) return null;
  return rec.base.sha || gitBlobSha(utf8.encode(rec.base.text));
}

export interface CommentPlan {
  changed: CommentsRecord[];
  deleted: CommentsRecord[];
}

/** Comment files to push. Comments of deleted pages are deleted with them. */
export async function planComments(workspaceId: string, deletedPageIds: ReadonlySet<string>, livePageIds: ReadonlySet<string>): Promise<CommentPlan> {
  const recs = await getDB().comments.where("workspaceId").equals(workspaceId).toArray();
  return {
    changed: recs.filter((r) => livePageIds.has(r.pageId) && (r.threads.length > 0 || r.base) && r.base?.text !== commentText(r)),
    deleted: recs.filter((r) => deletedPageIds.has(r.pageId) && r.base),
  };
}

export async function commentChanges(repo: RepoRef, plan: CommentPlan): Promise<{ changes: FileChange[]; texts: Map<string, string> }> {
  const changes: FileChange[] = [];
  const texts = new Map<string, string>();
  for (const rec of plan.changed) {
    const text = commentText(rec);
    texts.set(rec.pageId, text);
    changes.push({ path: inRepo(repo, commentsPath(rec.pageId)), content: utf8.encode(text), expectedSha: await baseCommentSha(rec) });
  }
  for (const rec of plan.deleted) changes.push({ path: inRepo(repo, commentsPath(rec.pageId)), delete: true, expectedSha: await baseCommentSha(rec) });
  return { changes, texts };
}

/** After a successful push: what was sent becomes the base. */
export async function recordPushedComments(repo: RepoRef, texts: Map<string, string>, deleted: string[], blobShas: Map<string, string>, now: number) {
  const db = getDB();
  for (const [pageId, text] of texts) {
    await db.comments.update(pageId, { base: { text, sha: blobShas.get(inRepo(repo, commentsPath(pageId))) ?? "", syncedAt: now } });
  }
  for (const pageId of deleted) await db.comments.delete(pageId);
}

/** True if any comment file differs on GitHub from what we last synced. */
export async function commentFilesChanged(workspaceId: string, repo: RepoRef, remote: Map<string, string>): Promise<boolean> {
  const recs = await getDB().comments.where("workspaceId").equals(workspaceId).toArray();
  for (const r of recs) if (r.base && remote.get(inRepo(repo, commentsPath(r.pageId))) !== (await baseCommentSha(r))) return true;
  const known = new Set(recs.filter((r) => r.base).map((r) => inRepo(repo, commentsPath(r.pageId))));
  const prefix = inRepo(repo, "comments/");
  for (const path of remote.keys()) if (path.startsWith(prefix) && !known.has(path)) return true;
  return false;
}

const pageIdOf = (path: string, prefix: string) => (path.startsWith(prefix) && path.endsWith(".json") ? path.slice(prefix.length, -5) : null);

/** Pull: merge comment files changed on GitHub into local records. Returns page ids that changed. */
export async function pullComments(
  workspaceId: string,
  repo: RepoRef,
  remote: Map<string, string>,
  read: (sha: string) => Promise<string>,
  now: number,
): Promise<{ records: CommentsRecord[]; removed: string[]; changed: string[] }> {
  const db = getDB();
  const prefix = inRepo(repo, "comments/");
  const local = new Map((await db.comments.where("workspaceId").equals(workspaceId).toArray()).map((r) => [r.pageId, r]));
  const records: CommentsRecord[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [path, sha] of remote) {
    const pageId = pageIdOf(path, prefix);
    if (!pageId) continue;
    const rec = local.get(pageId);
    if (rec && (await baseCommentSha(rec)) === sha) continue;
    const text = await read(sha);
    const theirs = parseCommentsFile(text);
    const base = { text, sha, syncedAt: now };
    const localChanged = rec && rec.base?.text !== commentText(rec) && (rec.threads.length > 0 || rec.base);
    const threads = rec && localChanged ? mergeThreads(rec.base ? parseCommentsFile(rec.base.text) : [], rec.threads, theirs) : theirs;
    records.push({ pageId, workspaceId, threads, base, updatedAt: now });
    changed.push(pageId);
  }
  // Deleted on GitHub: drop untouched local copies; keep (and re-push) local edits.
  for (const rec of local.values()) {
    if (!rec.base || remote.has(inRepo(repo, commentsPath(rec.pageId)))) continue;
    if (rec.base.text === commentText(rec)) removed.push(rec.pageId);
    else records.push({ ...rec, base: undefined });
    changed.push(rec.pageId);
  }
  return { records, removed, changed };
}

/** Comment files of a repository folder, for opening a workspace on a new device. */
export async function readAllComments(
  workspaceId: string,
  repo: RepoRef,
  remote: Map<string, string>,
  read: (sha: string) => Promise<string>,
  now: number,
): Promise<CommentsRecord[]> {
  const prefix = inRepo(repo, "comments/");
  const out: CommentsRecord[] = [];
  for (const [path, sha] of remote) {
    const pageId = pageIdOf(path, prefix);
    if (!pageId) continue;
    const text = await read(sha);
    out.push({ pageId, workspaceId, threads: parseCommentsFile(text), base: { text, sha, syncedAt: now }, updatedAt: now });
  }
  return out;
}
