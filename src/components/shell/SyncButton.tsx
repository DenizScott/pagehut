"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CloudCheck, CloudOff, CloudUpload, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { pendingCount } from "@/lib/github/sync";
import { useSync, type SyncState } from "@/lib/stores/sync";
import { useWorkspace } from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";

/** Push button + sync state for GitHub workspaces (hidden in local mode). */
export function SyncButton() {
  const t = useTranslations("common.sync");
  const workspace = useWorkspace((s) => s.workspace);
  const { state, retryAt, push } = useSync();
  const unsynced = useLiveQuery(
    // Re-runs whenever pages, assets or the workspace change in IndexedDB.
    async () => (workspace?.mode === "github" ? pendingCount(workspace.id) : 0),
    [workspace?.id, workspace?.mode],
  );

  if (workspace?.mode !== "github") return null;

  const effective: SyncState | "pending" = state === "syncing" || (state !== "synced" && state !== "idle") ? state : unsynced ? "pending" : "synced";
  const label = {
    idle: t("synced"),
    synced: t("synced"),
    pending: t("pending", { count: unsynced ?? 0 }),
    syncing: t("syncing"),
    remoteChanged: t("remoteChanged"),
    offline: t("offline"),
    rateLimited: t("rateLimited", { time: retryAt ? new Date(retryAt).toLocaleTimeString() : "" }),
    signedOut: t("signedOut"),
    error: t("error"),
  }[effective];
  const Icon =
    effective === "syncing" ? Loader2 : effective === "synced" ? CloudCheck : effective === "offline" ? CloudOff : effective === "pending" ? CloudUpload : AlertTriangle;
  const warn = ["remoteChanged", "rateLimited", "signedOut", "error"].includes(effective);

  return (
    <button
      type="button"
      onClick={() => void push(workspace.id)}
      disabled={effective === "syncing"}
      title={`${label} · ${t("pushHint")}`}
      data-sync-state={effective}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs whitespace-nowrap text-fg-muted hover:bg-surface-hover hover:text-fg",
        effective === "pending" && "text-accent-text",
        warn && "text-danger",
      )}
    >
      <Icon className={cn("size-3.5", effective === "syncing" && "animate-spin")} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
}
