"use client";

import { create } from "zustand";
import { OfflineError, RateLimitError, RemoteChangedError, SignedOutError } from "@/lib/github/api";
import { githubApi } from "@/lib/github/session";
import { pushWorkspace } from "@/lib/github/sync";

/**
 * Sync state of the active GitHub workspace (P2: manual push). P3 adds automatic sync, pulling and
 * merging; "remoteChanged" is where that work starts.
 */
export type SyncState = "idle" | "syncing" | "synced" | "remoteChanged" | "offline" | "rateLimited" | "signedOut" | "error";

interface SyncStore {
  state: SyncState;
  /** For rateLimited: when to retry (epoch ms). */
  retryAt: number | null;
  lastFiles: number;
  push: (workspaceId: string) => Promise<SyncState>;
  reset: () => void;
}

export const useSync = create<SyncStore>((set, get) => ({
  state: "idle",
  retryAt: null,
  lastFiles: 0,
  reset: () => set({ state: "idle", retryAt: null, lastFiles: 0 }),
  push: async (workspaceId) => {
    if (get().state === "syncing") return "syncing";
    set({ state: "syncing" });
    try {
      const { files } = await pushWorkspace(githubApi(), workspaceId);
      set({ state: "synced", lastFiles: files, retryAt: null });
      return "synced";
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
      if (state === "error") console.error("[sync] push failed", err instanceof Error ? err.message : err);
      set({ state, retryAt: err instanceof RateLimitError ? err.resetAt : null });
      return state;
    }
  },
}));
