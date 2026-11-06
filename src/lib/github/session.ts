"use client";

import { create } from "zustand";
import { GitHubApi } from "./api";
import { getUser, type GitHubUser } from "./repo";

/**
 * Browser side of GitHub sign-in. The access token lives only in this module's memory: never in
 * localStorage, cookies readable by JS, URLs or logs.
 *
 * - Web: a reload asks the server for a fresh token (the refresh token stays in an httpOnly cookie).
 * - Desktop app: the app signs in itself with GitHub's device flow (no secret on the computer) and
 *   hands the token over through a small bridge (desktop/preload.js).
 */

/** The desktop app's bridge (desktop/preload.js); undefined in a normal browser. */
interface DesktopBridge {
  startSignIn: () => Promise<{ userCode: string; verificationUri: string; expiresIn: number }>;
  finishSignIn: () => Promise<{ ok: true } | { ok: false; error: string }>;
  cancelSignIn: () => Promise<void>;
  getToken: () => Promise<{ accessToken: string; expiresAt: number } | null>;
  signOut: () => Promise<void>;
}
const desktopBridge = (): DesktopBridge | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { pagehutDesktop?: DesktopBridge }).pagehutDesktop;

let token: { value: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchToken(): Promise<{ accessToken: string | null; expiresAt?: number } | null> {
  const bridge = desktopBridge();
  if (bridge) return bridge.getToken();
  const res = await fetch("/api/auth/token", { method: "POST", headers: { "x-pagehut-csrf": "1" }, credentials: "same-origin" });
  return res.ok ? ((await res.json()) as { accessToken: string | null; expiresAt?: number }) : null;
}

export async function getAccessToken(): Promise<string | null> {
  if (token && token.expiresAt - Date.now() > 2 * 60_000) return token.value;
  inflight ??= (async () => {
    try {
      const json = await fetchToken();
      if (!json?.accessToken || !json.expiresAt) {
        token = null;
        return null;
      }
      token = { value: json.accessToken, expiresAt: json.expiresAt };
      return token.value;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

let api: GitHubApi | null = null;
export function githubApi(): GitHubApi {
  api ??= new GitHubApi(getAccessToken);
  return api;
}

export type GitHubStatus = "unknown" | "unconfigured" | "signedOut" | "signedIn";

/** Desktop sign-in in progress: the code to enter on GitHub. */
export interface DeviceSignIn {
  userCode: string;
  verificationUri: string;
}

interface GitHubStore {
  status: GitHubStatus;
  appSlug: string | null;
  /** Running in the desktop app (the server is on this computer). */
  desktop: boolean;
  user: GitHubUser | null;
  /** Desktop: the code being entered on GitHub right now. */
  device: DeviceSignIn | null;
  /** Desktop: why the last sign-in didn't finish (device_flow_disabled, access_denied, expired_token, …). */
  deviceError: string | null;
  init: () => Promise<void>;
  signIn: (returnTo: string) => void;
  cancelSignIn: () => void;
  signOut: () => Promise<void>;
}

export const useGitHub = create<GitHubStore>((set, get) => ({
  status: "unknown",
  appSlug: null,
  desktop: false,
  user: null,
  device: null,
  deviceError: null,
  init: async () => {
    if (get().status !== "unknown") return;
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      const status = (await res.json()) as { configured: boolean; appSlug?: string; desktop?: boolean };
      const desktop = status.desktop === true;
      // The desktop server can say "configured" only for the app's own bridge.
      if (!status.configured || (desktop && !desktopBridge())) return set({ status: "unconfigured", desktop });
      set({ appSlug: status.appSlug ?? null, desktop });
      if (!(await getAccessToken())) return set({ status: "signedOut" });
      set({ status: "signedIn", user: await getUser(githubApi()) });
    } catch {
      // Offline or server unreachable: stay usable in local mode.
      set({ status: "signedOut" });
    }
  },
  signIn: (returnTo) => {
    const bridge = desktopBridge();
    if (!bridge) {
      // A route handler that redirects to GitHub, not a page: needs a full navigation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    // Desktop: show a code, the person enters it on github.com, the app gets the token.
    set({ device: null, deviceError: null });
    void (async () => {
      try {
        const { userCode, verificationUri } = await bridge.startSignIn();
        set({ device: { userCode, verificationUri } });
        const result = await bridge.finishSignIn();
        if (!result.ok) return set({ device: null, deviceError: result.error === "cancelled" ? null : result.error });
        token = null;
        if (!(await getAccessToken())) return set({ device: null, deviceError: "failed" });
        set({ device: null, status: "signedIn", user: await getUser(githubApi()) });
      } catch (err) {
        // Electron prefixes errors thrown in the main process; keep GitHub's code.
        const code = err instanceof Error ? (err.message.match(/(device_flow_disabled|not_configured)/)?.[1] ?? "failed") : "failed";
        set({ device: null, deviceError: code });
      }
    })();
  },
  cancelSignIn: () => {
    void desktopBridge()?.cancelSignIn();
    set({ device: null, deviceError: null });
  },
  signOut: async () => {
    token = null;
    const bridge = desktopBridge();
    if (bridge) await bridge.signOut();
    else await fetch("/api/auth/logout", { method: "POST", headers: { "x-pagehut-csrf": "1" } }).catch(() => {});
    set({ status: "signedOut", user: null });
  },
}));
