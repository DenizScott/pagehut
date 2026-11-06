import { ulid } from "ulid";
import type { Anchor, CommentsRecord, Thread } from "@/lib/comments/types";
import { getDB } from "./db";

/**
 * Local comment threads (one record per page). Every change is a read-modify-write in one
 * transaction, so two quick edits never overwrite each other. Sync reads these records like pages.
 */

export async function getThreads(pageId: string): Promise<Thread[]> {
  return (await getDB().comments.get(pageId))?.threads ?? [];
}

export async function listCommentRecords(workspaceId: string): Promise<CommentsRecord[]> {
  return getDB().comments.where("workspaceId").equals(workspaceId).toArray();
}

async function change(pageId: string, workspaceId: string, fn: (threads: Thread[]) => Thread[]): Promise<Thread[]> {
  const db = getDB();
  return db.transaction("rw", db.comments, async () => {
    const rec = await db.comments.get(pageId);
    const threads = fn(rec?.threads ?? []);
    await db.comments.put({ ...(rec ?? { pageId, workspaceId }), threads, updatedAt: Date.now() });
    return threads;
  });
}

export async function addThread(pageId: string, workspaceId: string, opts: { anchor?: Anchor; author: string; body: string }): Promise<Thread> {
  const now = Date.now();
  const thread: Thread = {
    id: ulid(),
    ...(opts.anchor ? { anchor: opts.anchor } : {}),
    comments: [{ id: ulid(), author: opts.author, body: opts.body, createdAt: now }],
  };
  await change(pageId, workspaceId, (threads) => [...threads, thread]);
  return thread;
}

export async function addReply(pageId: string, workspaceId: string, threadId: string, opts: { author: string; body: string }): Promise<void> {
  await change(pageId, workspaceId, (threads) =>
    threads.map((t) => (t.id === threadId ? { ...t, resolved: false, comments: [...t.comments, { id: ulid(), author: opts.author, body: opts.body, createdAt: Date.now() }] } : t)),
  );
}

export async function editComment(pageId: string, workspaceId: string, threadId: string, commentId: string, body: string): Promise<void> {
  await change(pageId, workspaceId, (threads) =>
    threads.map((t) => (t.id === threadId ? { ...t, comments: t.comments.map((c) => (c.id === commentId ? { ...c, body, editedAt: Date.now() } : c)) } : t)),
  );
}

/** Deletes one comment; a thread without comments is removed. */
export async function deleteComment(pageId: string, workspaceId: string, threadId: string, commentId: string): Promise<void> {
  await change(pageId, workspaceId, (threads) =>
    threads
      .map((t) => (t.id === threadId ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) } : t))
      .filter((t) => t.comments.length > 0),
  );
}

export async function setResolved(pageId: string, workspaceId: string, threadId: string, resolved: boolean): Promise<void> {
  await change(pageId, workspaceId, (threads) => threads.map((t) => (t.id === threadId ? { ...t, resolved } : t)));
}
