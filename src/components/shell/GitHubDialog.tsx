"use client";

import { ExternalLink, Lock, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GitHubMark } from "@/components/ui/github-mark";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePathname, useRouter } from "@/i18n/navigation";
import { GitHubError, OfflineError, RateLimitError, SignedOutError } from "@/lib/github/api";
import { installUrl, listRepos, type RepoSummary } from "@/lib/github/repo";
import { githubApi, useGitHub } from "@/lib/github/session";
import { connectWorkspace, NotAWorkspaceError, openRepoWorkspace, RepoHasWorkspaceError } from "@/lib/github/sync";
import { getWorkspace, setActiveWorkspace } from "@/lib/storage/local-repo";
import { useStatus } from "@/lib/stores/status";
import { useSync } from "@/lib/stores/sync";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";

/** Connect the current workspace to a repo, or open a workspace stored in a repo. */
export function GitHubDialog() {
  const t = useTranslations("common.github");
  const open = useUI((s) => s.dialog === "github");
  const mode = useUI((s) => s.githubMode);
  const close = useUI((s) => s.close);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent
          title={mode === "connect" ? t("connectTitle") : t("openTitle")}
          description={mode === "connect" ? t("connectDescription") : t("openDescription")}
          className="max-w-xl"
        >
          <Body mode={mode} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function Body({ mode }: { mode: "connect" | "open" }) {
  const t = useTranslations("common.github");
  const github = useGitHub();
  const pathname = usePathname();

  if (github.status === "unknown") return <p className="p-4 text-sm text-fg-muted">{t("checking")}</p>;
  if (github.status === "unconfigured" && github.desktop)
    return (
      <div className="space-y-3 p-4 text-sm">
        <p>{t("desktopLocal")}</p>
        <p className="text-fg-muted">{t("desktopLocalHint")}</p>
        <a href="https://pagehut.vercel.app" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg">
          <GitHubMark /> {t("desktopOpenWeb")}
        </a>
      </div>
    );
  if (github.status === "unconfigured")
    return (
      <div className="space-y-3 p-4 text-sm">
        <p>{t("unconfigured")}</p>
        <p className="text-fg-muted">{t("unconfiguredHint")}</p>
        {/* Works only on the developer's own machine (the route refuses everywhere else). */}
        {["localhost", "127.0.0.1"].includes(window.location.hostname) && (
          // A route handler that renders its own page and posts to GitHub: needs a full navigation, not <Link>.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="/api/setup/github" className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg">
            <GitHubMark /> {t("setupAction")}
          </a>
        )}
      </div>
    );
  if (github.status === "signedOut" && github.device) return <DeviceCode code={github.device.userCode} uri={github.device.verificationUri} onCancel={github.cancelSignIn} />;
  if (github.status === "signedOut")
    return (
      <div className="space-y-3 p-4 text-sm">
        <p className="text-fg-muted">{t("signInWhy")}</p>
        <ul className="list-disc space-y-1 ps-5 text-fg-muted">
          <li>{t("privacy1")}</li>
          <li>{t("privacy2")}</li>
          {github.desktop && <li>{t("deviceSessionNote")}</li>}
        </ul>
        {github.deviceError && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger">
            {github.deviceError === "device_flow_disabled"
              ? t("deviceErrors.disabled")
              : github.deviceError === "access_denied"
                ? t("deviceErrors.denied")
                : github.deviceError === "expired_token"
                  ? t("deviceErrors.expired")
                  : t("deviceErrors.failed")}
          </p>
        )}
        <Button variant="primary" onClick={() => github.signIn(`${window.location.pathname}?github=${mode}`)}>
          <GitHubMark /> {t("signIn")}
        </Button>
      </div>
    );
  return <RepoPicker mode={mode} key={pathname} />;
}

/** Desktop sign-in: GitHub is open in the browser; the person types this code there. */
function DeviceCode({ code, uri, onCancel }: { code: string; uri: string; onCancel: () => void }) {
  const t = useTranslations("common.github");
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4 p-4 text-sm">
      <p>{t("deviceHint")}</p>
      <p className="flex flex-wrap items-center gap-3">
        <output aria-label={t("deviceCodeLabel")} className="rounded-lg border border-border-control bg-canvas px-4 py-2 font-mono text-2xl font-semibold tracking-[0.2em] select-all">
          {code}
        </output>
        <Button
          variant="subtle"
          onClick={() =>
            void navigator.clipboard
              .writeText(code)
              .then(() => setCopied(true))
              .catch(() => {})
          }
        >
          {copied ? t("deviceCopied") : t("deviceCopy")}
        </Button>
      </p>
      <p role="status" className="text-fg-muted">
        {t("deviceWaiting")}
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg">
          <ExternalLink className="size-4" aria-hidden="true" /> {t("deviceOpen")}
        </a>
        <Button variant="subtle" onClick={onCancel}>
          {t("deviceCancel")}
        </Button>
      </div>
    </div>
  );
}

function RepoPicker({ mode }: { mode: "connect" | "open" }) {
  const t = useTranslations("common.github");
  const router = useRouter();
  const { appSlug, user } = useGitHub();
  const workspace = useWorkspace((s) => s.workspace);
  const setWorkspace = useWorkspace((s) => s.setWorkspace);
  const close = useUI((s) => s.close);
  const toast = useStatus((s) => s.toast);
  const resetSync = useSync((s) => s.reset);
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Folder inside the repository for the workspace (connect only). "GDD" keeps game repos tidy. */
  const [folder, setFolder] = useState("GDD");
  const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, "");
  const [error, setError] = useState<string | null>(null);
  /** Offered when the other action fits the chosen repo (open <-> save). */
  const [suggest, setSuggest] = useState<"connect" | "open" | null>(null);
  const openDialog = useUI((s) => s.open);

  useEffect(() => {
    let cancelled = false;
    listRepos(githubApi())
      .then((r) => !cancelled && setRepos(r))
      .catch((err: unknown) => !cancelled && setLoadError(describe(err)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function describe(err: unknown): string {
    if (err instanceof RepoHasWorkspaceError) return t("errors.hasWorkspace");
    if (err instanceof NotAWorkspaceError) return t("errors.notWorkspace");
    if (err instanceof OfflineError) return t("errors.offline");
    if (err instanceof RateLimitError) return t("errors.rateLimited", { time: new Date(err.resetAt).toLocaleTimeString() });
    if (err instanceof SignedOutError) return t("errors.signedOut");
    if (err instanceof GitHubError && (err.status === 403 || err.status === 404)) return t("errors.noAccess");
    return t("errors.generic");
  }

  const shown = useMemo(
    () => (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(filter.trim().toLowerCase())),
    [repos, filter],
  );
  const chosen = repos?.find((r) => r.fullName === selected);

  async function run() {
    if (!chosen || !workspace) return;
    setBusy(true);
    setError(null);
    setSuggest(null);
    const ref = { owner: chosen.owner, name: chosen.name, branch: chosen.defaultBranch };
    try {
      if (mode === "connect") {
        await connectWorkspace(githubApi(), workspace.id, { ...ref, dir: folder });
        const updated = await getWorkspace(workspace.id);
        if (updated) setWorkspace(updated);
        resetSync();
        toast(t("connected", { repo: chosen.fullName }));
      } else {
        const id = await openRepoWorkspace(githubApi(), ref);
        const { workspace: ws, firstPageId } = await setActiveWorkspace(id);
        setWorkspace(ws);
        resetSync();
        router.push(firstPageId ? `/p/${firstPageId}` : "/");
        toast(t("opened", { repo: chosen.fullName }));
      }
      close();
    } catch (err) {
      setError(describe(err));
      if (err instanceof NotAWorkspaceError && mode === "open" && workspace?.mode !== "github") setSuggest("connect");
      if (err instanceof RepoHasWorkspaceError && mode === "connect") setSuggest("open");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pt-3 text-xs text-fg-muted">
        <GitHubMark className="size-3.5" />
        {t("signedInAs", { login: user?.login ?? "" })}
      </div>
      <label className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-border-control bg-canvas px-2">
        <Search className="size-4 text-fg-subtle" aria-hidden="true" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("filterRepos")}
          aria-label={t("filterRepos")}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
        />
      </label>
      <div role="radiogroup" aria-label={t("repositories")} className="min-h-24 overflow-y-auto p-2">
        {!repos && !loadError && <p className="p-3 text-sm text-fg-muted">{t("loadingRepos")}</p>}
        {loadError && <p role="alert" className="p-3 text-sm text-danger">{loadError}</p>}
        {repos && repos.length === 0 && appSlug && (
          <div className="space-y-3 p-3 text-sm">
            <p className="text-fg-muted">{t("chooseReposHint")}</p>
            {/* Same tab: after choosing, GitHub sends the user back here (the app's setup URL). */}
            <a href={installUrl(appSlug)} className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg">
              <GitHubMark /> {t("chooseRepos")}
            </a>
          </div>
        )}
        {repos && repos.length > 0 && shown.length === 0 && <p className="p-3 text-sm text-fg-muted">{t("noRepos")}</p>}
        {shown.map((r) => (
          <button
            key={r.fullName}
            type="button"
            role="radio"
            aria-checked={selected === r.fullName}
            disabled={mode === "connect" && !r.canPush}
            onClick={() => setSelected(r.fullName)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-surface-hover disabled:opacity-50",
              selected === r.fullName && "bg-accent-soft",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{r.fullName}</span>
            {r.private && <Lock className="size-3.5 text-fg-subtle" aria-label={t("private")} />}
          </button>
        ))}
      </div>
      {appSlug && repos && repos.length > 0 && (
        <a href={installUrl(appSlug)} className="mx-4 mb-2 inline-flex items-center gap-1 text-xs text-accent-text underline underline-offset-2">
          {t("missingRepo")} <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
      {mode === "connect" && (
        <label className="mx-4 mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-muted">{t("folderLabel")}</span>
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder={t("repoRoot")}
            className="w-32 rounded-md border border-border-control bg-canvas px-2 py-1 font-mono text-xs"
          />
          <span className="w-full text-xs text-fg-subtle">{t("folderHint")}</span>
        </label>
      )}
      {error && (
        <div role="alert" className="mx-4 mb-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          <p>{error}</p>
          {suggest && (
            <Button
              size="sm"
              variant="subtle"
              className="mt-2"
              onClick={() => {
                setError(null);
                setSuggest(null);
                openDialog("github", { githubMode: suggest });
              }}
            >
              {suggest === "connect" ? t("saveHereInstead") : t("openHereInstead")}
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 border-t border-hairline p-3">
        {chosen && mode === "connect" && (
          <p className="me-auto text-xs text-fg-muted">
            {t("connectWarning", { repo: chosen.fullName, folder: cleanFolder ? `${cleanFolder}/` : t("repoRoot") })}
          </p>
        )}
        <Button variant="primary" disabled={!chosen || busy} onClick={() => void run()}>
          {busy ? t("working") : mode === "connect" ? t("connectAction") : t("openAction")}
        </Button>
      </div>
    </div>
  );
}
