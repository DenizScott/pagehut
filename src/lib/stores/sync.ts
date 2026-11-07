"use client";

import { create } from "zustand";
import { OfflineError, RateLimitError, RemoteChangedError, SignedOutError } from "@/lib/github/api";
import { syncWorkspace } from "@/lib/github/pull";
import { githubApi } from "@/lib/github/session";
import { getDB } from "@/lib/storage/db";
import { canTouchPage, useStatus } from "./status";
import { useUI } from "./ui";

/**
 * Sync state of the active GitHub workspace. One sync = pull (merge teammates' changes) + push.
 * Runs automatically (see AutoSync) and when the sync button is clicked.
 */
export type SyncState =
  | "idle"
  | "syncing"
  | "synced"
  | "conflict"
  | "remoteChanged"
  | "offline"
  | "rateLimited"
  | "signedOut"
  | "error";

interface SyncStore {
  state: SyncState;
  /** For rateLimited: when to retry (epoch ms). */
  retryAt: number | null;
  lastSyncAt: number | null;
  sync: (workspaceId: string) => Promise<SyncState>;
  /** Kept for callers from P2. */
  push: (workspaceId: string) => Promise<SyncState>;
  reset: () => void;
}

let running: Promise<SyncState> | null = null;
/** A sync asked for while one runs: it starts once that one ends (one follow-up for all such calls). */
let again: Promise<SyncState> | null = null;

export const useSync = create<SyncStore>((set, get) => ({
  state: "idle",
  retryAt: null,
  lastSyncAt: null,
  reset: () => set({ state: "idle", retryAt: null, lastSyncAt: null }),
  push: (workspaceId) => get().sync(workspaceId),
  sync: (workspaceId) => {
    // Never two syncs at once (timer + button + focus can coincide). A call during a sync still gets
    // a sync of its own afterwards: the running one may have started before the latest edit, or
    // left the open page alone because it was being edited at that moment.
    if (running) {
      again ??= running.then(
        () => {
          again = null;
          return get().sync(workspaceId);
        },
        () => {
          again = null;
          return get().sync(workspaceId);
        },
      );
      return again;
    }
    running = (async (): Promise<SyncState> => {
      set({ state: "syncing" });
      try {
        const { pull } = await syncWorkspace(githubApi(), workspaceId, { canTouchPage });
        // If the page on screen changed underneath, reload the editor (it is idle: canTouchPage).
        const active = useStatus.getState().activePageId;
        const touched = [...pull.updated, ...pull.merged, ...pull.removed];
        if (active && touched.includes(active)) useUI.getState().bumpContent();

        const conflicts = await getDB().pages.where("workspaceId").equals(workspaceId).filter((p) => !!p.conflict).count();
        const state: SyncState = conflicts > 0 ? "conflict" : "synced";
        set({ state, retryAt: null, lastSyncAt: Date.now() });
        return state;
      } catch (err) {
        const state: SyncState =
          err instanceof RemoteChangedError
            ? "remoteChanged"
            : err instanceof OfflineError
              ? "offline"
              : err instanceof RateLimitError
                ? "rateLimited"
                : err instanceof SignedOutError
                  ? "signedOut"
                  : "error";
        if (state === "error") console.error("[sync] failed", err instanceof Error ? err.message : err);
        set({ state, retryAt: err instanceof RateLimitError ? err.resetAt : null });
        return state;
      } finally {
        running = null;
      }
    })();
    return running;
  },
}));
