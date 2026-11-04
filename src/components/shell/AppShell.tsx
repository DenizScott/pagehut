"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BRAND } from "@/config/brand";
import { ensureWorkspace } from "@/lib/storage/local-repo";
import { useStatus } from "@/lib/stores/status";
import { useWorkspace } from "@/lib/stores/workspace";
import { Sidebar } from "./Sidebar";
import { Toasts } from "./Toasts";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const workspace = useWorkspace((s) => s.workspace);
  const setWorkspace = useWorkspace((s) => s.setWorkspace);
  const sidebarOpen = useWorkspace((s) => s.sidebarOpen);
  const setSidebarOpen = useWorkspace((s) => s.setSidebarOpen);
  const setOnline = useStatus((s) => s.setOnline);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspace) return;
    ensureWorkspace({
      title: t("welcome.title", { appName: BRAND.name }),
      markdown: t("welcome.body", { appName: BRAND.name }),
      workspaceName: t("shell.workspaceName"),
    })
      .then(setWorkspace)
      .catch((err: unknown) => {
        console.error(err);
        setError(String(err));
      });
  }, [workspace, setWorkspace, t]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setOnline]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("a11y.skipToContent")}
      </a>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
      )}
      {/* URL params are runtime-only; Suspense lets the static shell prerender. */}
      <Suspense fallback={<div className="hidden w-64 md:block" aria-hidden="true" />}>
        <Sidebar />
      </Suspense>

      <main id="main" className="relative flex min-w-0 flex-1 flex-col bg-canvas md:my-2 md:me-2 md:rounded-xl md:border md:border-hairline">
        {error ? (
          <p role="alert" className="m-auto max-w-md p-6 text-center text-danger">
            {error}
          </p>
        ) : workspace ? (
          <Suspense fallback={null}>{children}</Suspense>
        ) : (
          <p className="m-auto text-fg-muted" role="status">
            {t("shell.loading")}
          </p>
        )}
      </main>
      <Toasts />
    </div>
  );
}
