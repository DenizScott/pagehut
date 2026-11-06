// GitHub sign-in for the desktop app, with GitHub's device flow: the app shows a short code, the
// person enters it on github.com in their browser, and GitHub hands this app a user token. It
// needs only the GitHub App's public client id, never its secret, so it is safe in an installer.
//
// GitHub's sign-in endpoints don't allow browser (CORS) requests, so this runs in the main process.
// The token is kept in memory and, where the system offers encryption (Windows, macOS, most Linux
// desktops), in an encrypted file so a restart doesn't sign you out. Without the secret a token
// can't be refreshed: after it expires (8 hours) the person signs in again.
"use strict";

const { app, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

/** { clientId, appSlug } written at build time by scripts/prepare-server.mjs; absent = no sign-in. */
function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, "github.json"), "utf8"));
    return c.clientId && c.appSlug ? c : null;
  } catch {
    return null;
  }
}
const config = loadConfig();

let token = null; // { accessToken, expiresAt }
let pending = null; // the sign-in in progress: { deviceCode, interval, expiresAt }

const tokenFile = () => path.join(app.getPath("userData"), "github-session.bin");

function loadToken() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return;
    const saved = JSON.parse(safeStorage.decryptString(fs.readFileSync(tokenFile())));
    if (saved.accessToken && saved.expiresAt > Date.now() + 60_000) token = saved;
  } catch {
    /* no saved session */
  }
}
function saveToken() {
  try {
    if (token && safeStorage.isEncryptionAvailable()) fs.writeFileSync(tokenFile(), safeStorage.encryptString(JSON.stringify(token)));
  } catch {
    /* memory only */
  }
}
function clearToken() {
  token = null;
  fs.rmSync(tokenFile(), { force: true });
}

async function post(url, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "PageHut-Desktop" },
    body: new URLSearchParams(params),
  });
  return res.json();
}

/** Starts a sign-in: opens GitHub's code page in the browser and returns the code to show. */
async function startSignIn() {
  if (!config) throw new Error("not_configured");
  const r = await post("https://github.com/login/device/code", { client_id: config.clientId });
  if (r.error) throw new Error(r.error); // e.g. device_flow_disabled
  pending = { deviceCode: r.device_code, interval: (r.interval || 5) * 1000, expiresAt: Date.now() + r.expires_in * 1000 };
  if (typeof r.verification_uri === "string" && r.verification_uri.startsWith("https://github.com/")) void shell.openExternal(r.verification_uri);
  return { userCode: r.user_code, verificationUri: r.verification_uri, expiresIn: r.expires_in };
}

/** Waits until the person approves (or denies) on GitHub. Resolves { ok } or { ok: false, error }. */
async function finishSignIn() {
  const mine = pending;
  if (!mine) return { ok: false, error: "no_sign_in" };
  let interval = mine.interval;
  while (pending === mine && Date.now() < mine.expiresAt) {
    await new Promise((r) => setTimeout(r, interval));
    if (pending !== mine) break;
    let r;
    try {
      r = await post("https://github.com/login/oauth/access_token", {
        client_id: config.clientId,
        device_code: mine.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
    } catch {
      continue; // a network blip: keep waiting
    }
    if (r.access_token) {
      pending = null;
      token = { accessToken: r.access_token, expiresAt: Date.now() + (r.expires_in ? r.expires_in * 1000 : 8 * 3600_000) };
      saveToken();
      return { ok: true };
    }
    if (r.error === "authorization_pending") continue;
    if (r.error === "slow_down") {
      interval += 5000;
      continue;
    }
    pending = null;
    return { ok: false, error: r.error || "failed" }; // access_denied, expired_token, …
  }
  const cancelled = pending !== mine; // cancelSignIn() or a newer sign-in replaced this one
  if (!cancelled) pending = null;
  return { ok: false, error: cancelled ? "cancelled" : "expired_token" };
}

function cancelSignIn() {
  pending = null;
}

/** The current token if it is still good for a few minutes, else null. */
function getToken() {
  if (token && token.expiresAt - Date.now() > 2 * 60_000) return { ...token };
  if (token) clearToken();
  return null;
}

function signOut() {
  pending = null;
  clearToken();
}

module.exports = { config, loadToken, startSignIn, finishSignIn, cancelSignIn, getToken, signOut };
