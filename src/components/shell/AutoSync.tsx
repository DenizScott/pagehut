"use client";

import { useEffect } from "react";
import { useGitHub } from "@/lib/github/session";
import { pendingCount } from "@/lib/github/sync";
import { useStatus } from "@/lib/stores/status";
import { useSync } from "@/lib/stores/sync";
import { useWorkspace } from "@/lib/stores/workspace";

const TICK_MS = 5_000;
const PUSH_AFTER_IDLE_MS = 5_000;
const PULL_EVERY_MS = 60_000;

/**
 * Background sync for GitHub workspaces, only while the tab is visible:
 *  - push local changes ~5 s after the last edit,
 *  - pull every minute, when the tab regains focus and when the network comes back,
 *  - pause while offline, rate limited (until the reset time) or signed out.
 * No timers run for local workspaces.
 */
export function AutoSync() {
  const workspace = useWorkspace((s) => s.workspace);
  const githubStatus = useGitHub((s) => s.status);
  // Wait for the one-time folder migration (repo.dir undefined) before syncing.
  const enabled = workspace?.mode === "github" && githubStatus === "signedIn" && workspace.repo?.dir !== undefined;
  const workspaceId = workspace?.id;

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    let lastPull = 0;

    const blocked = () => {
      const { state, retryAt } = useSync.getState();
      if (!navigator.onLine || state === "signedOut") return true;
      return state === "rateLimited" && !!retryAt && Date.now() < retryAt;
    };

    const run = async () => {
      if (document.visibilityState !== "visible" || blocked()) return;
      lastPull = Date.now();
      await useSync.getState().sync(workspaceId);
    };

    const tick = async () => {
      if (document.visibilityState !== "visible" || blocked() || useSync.getState().state === "syncing") return;
      const { pending, lastEditAt } = useStatus.getState();
      const idle = pending.size === 0 && Date.now() - lastEditAt > PUSH_AFTER_IDLE_MS;
      if (Date.now() - lastPull > PULL_EVERY_MS) return run();
      if (idle && (await pendingCount(workspaceId)) > 0) return run();
    };

    void run();
    const timer = window.setInterval(() => void tick(), TICK_MS);
    const onFocus = () => document.visibilityState === "visible" && void run();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [enabled, workspaceId]);

  return null;
}
