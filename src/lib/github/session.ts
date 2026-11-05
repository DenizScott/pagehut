"use client";

import { create } from "zustand";
import { GitHubApi } from "./api";
import { getUser, type GitHubUser } from "./repo";

/**
 * Browser side of GitHub sign-in. The access token lives only in this module's memory: never in
 * localStorage, cookies readable by JS, URLs or logs. A reload asks the server for a fresh one
 * (the refresh token stays in an httpOnly cookie).
 */

let token: { value: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

export async function getAccessToken(): Promise<string | null> {
  if (token && token.expiresAt - Date.now() > 2 * 60_000) return token.value;
  inflight ??= (async () => {
    try {
      const res = await fetch("/api/auth/token", { method: "POST", headers: { "x-pagehut-csrf": "1" }, credentials: "same-origin" });
      if (!res.ok) {
        token = null;
        return null;
      }
      const json = (await res.json()) as { accessToken: string; expiresAt: number };
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

interface GitHubStore {
  status: GitHubStatus;
  appSlug: string | null;
  user: GitHubUser | null;
  init: () => Promise<void>;
  signIn: (returnTo: string) => void;
  signOut: () => Promise<void>;
}

export const useGitHub = create<GitHubStore>((set, get) => ({
  status: "unknown",
  appSlug: null,
  user: null,
  init: async () => {
    if (get().status !== "unknown") return;
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      const status = (await res.json()) as { configured: boolean; appSlug?: string };
      if (!status.configured) return set({ status: "unconfigured" });
      set({ appSlug: status.appSlug ?? null });
      if (!(await getAccessToken())) return set({ status: "signedOut" });
      set({ status: "signedIn", user: await getUser(githubApi()) });
    } catch {
      // Offline or server unreachable: stay usable in local mode.
      set({ status: "signedOut" });
    }
  },
  signIn: (returnTo) => {
    // A route handler that redirects to GitHub, not a page: needs a full navigation.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  },
  signOut: async () => {
    token = null;
    await fetch("/api/auth/logout", { method: "POST", headers: { "x-pagehut-csrf": "1" } }).catch(() => {});
    set({ status: "signedOut", user: null });
  },
}));
