import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { CSRF_HEADER, handleCallback, handleLogin, handleLogout, handleStatus, handleToken } from "./auth-handlers";
import type { GitHubAppConfig } from "./config";
import { readConfig } from "./config";
import { pkceChallenge, safeReturnTo, seal, unseal } from "./crypto";

const config: GitHubAppConfig = {
  clientId: "Iv1.test",
  clientSecret: "shh-secret",
  appSlug: "pagehut-test",
  sessionSecret: "x".repeat(40),
};
const ORIGIN = "http://localhost:3000";

/** Collects Set-Cookie values from a response into a Cookie header for the next request. */
function cookieJar(res: Response, prev: Record<string, string> = {}) {
  const jar = { ...prev };
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const [name, ...rest] = pair.split("=");
    const value = rest.join("=");
    if (/max-age=0/i.test(c) || value === "") delete jar[name];
    else jar[name] = value;
  }
  return jar;
}
const cookieHeader = (jar: Record<string, string>) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

function req(path: string, init: { method?: string; jar?: Record<string, string>; headers?: Record<string, string> } = {}) {
  return new NextRequest(new URL(path, ORIGIN), {
    method: init.method ?? "GET",
    headers: { ...(init.jar ? { cookie: cookieHeader(init.jar) } : {}), ...init.headers },
  });
}

let tokenCounter = 0;
const fakeGitHub = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
  const body = new URLSearchParams(String(init?.body));
  if (body.get("client_secret") !== config.clientSecret) return Response.json({ error: "incorrect_client_credentials" });
  if (body.get("grant_type") === "refresh_token" && !body.get("refresh_token")?.startsWith("ghr_")) return Response.json({ error: "bad_refresh_token" });
  tokenCounter++;
  return Response.json({
    access_token: `ghu_access_${tokenCounter}`,
    expires_in: 28800,
    refresh_token: `ghr_refresh_${tokenCounter}`,
    refresh_token_expires_in: 15897600,
  });
}) as unknown as typeof fetch;

async function signIn() {
  const login = await handleLogin(req("/api/auth/login?returnTo=/tr/p/123"), config);
  const authUrl = new URL(login.headers.get("location")!);
  const jar = cookieJar(login);
  const cb = await handleCallback(req(`/api/auth/callback?code=abc&state=${authUrl.searchParams.get("state")}`, { jar }), config, fakeGitHub);
  return { login, authUrl, cb, jar: cookieJar(cb, jar) };
}

describe("config", () => {
  it("is disabled unless every variable is set and the session secret is long enough", () => {
    expect(readConfig({})).toBeNull();
    const env = { GITHUB_APP_CLIENT_ID: "a", GITHUB_APP_CLIENT_SECRET: "b", GITHUB_APP_SLUG: "c", SESSION_SECRET: "short" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readConfig(env)).toBeNull();
    expect(readConfig({ ...env, SESSION_SECRET: "y".repeat(32) })).toMatchObject({ clientId: "a", appSlug: "c" });
  });

  it("status exposes only whether sign-in is configured and the public app slug", async () => {
    expect(await (await handleStatus(config)).json()).toEqual({ configured: true, appSlug: "pagehut-test" });
    expect(await (await handleStatus(null)).json()).toEqual({ configured: false });
    expect(await (await handleStatus(null, true)).json()).toEqual({ configured: false, desktop: true });
  });
});

describe("sealed cookies and redirects", () => {
  it("round-trips, and rejects tampering or another purpose", async () => {
    const sealed = await seal({ a: 1 }, config.sessionSecret, "session");
    expect(await unseal(sealed, config.sessionSecret, "session")).toEqual({ a: 1 });
    expect(await unseal(sealed, config.sessionSecret, "handoff")).toBeNull();
    expect(await unseal(sealed.slice(0, -2) + "AA", config.sessionSecret, "session")).toBeNull();
    expect(await unseal(sealed, "z".repeat(40), "session")).toBeNull();
  });

  it("only allows relative return paths", () => {
    expect(safeReturnTo("/tr/p/1")).toBe("/tr/p/1");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
  });
});

describe("GitHub sign-in flow", () => {
  it("login redirects to GitHub with state and a PKCE S256 challenge", async () => {
    const { login, authUrl, jar } = await signIn();
    expect(login.status).toBe(307);
    expect(authUrl.origin + authUrl.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(authUrl.searchParams.get("client_id")).toBe("Iv1.test");
    expect(authUrl.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback`);
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl.searchParams.get("code_challenge")).toHaveLength(43);
    expect(authUrl.toString()).not.toContain("shh-secret");
    expect(Object.keys(jar)).toContain("ph_session");
  });

  it("flow cookie is httpOnly, scoped to /api/auth and short-lived", async () => {
    const login = await handleLogin(req("/api/auth/login"), config);
    const cookie = login.headers.getSetCookie()[0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=600/);
  });

  it("marks cookies Secure behind an HTTPS proxy", async () => {
    const plain = await handleLogin(req("/api/auth/login"), config);
    const proxied = await handleLogin(req("/api/auth/login", { headers: { "x-forwarded-proto": "https" } }), config);
    expect(ORIGIN.startsWith("http:") ? plain.headers.getSetCookie()[0] : "").not.toMatch(/Secure/i);
    expect(proxied.headers.getSetCookie()[0]).toMatch(/Secure/i);
  });

  it("callback sends the matching PKCE verifier and redirects back without tokens in the URL", async () => {
    const { authUrl, cb, jar } = await signIn();
    const location = cb.headers.get("location")!;
    expect(location).toBe(`${ORIGIN}/tr/p/123`);
    expect(location).not.toMatch(/ghu_|ghr_/);
    expect(jar.ph_oauth).toBeUndefined();
    const sent = new URLSearchParams(String((fakeGitHub as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1].body));
    expect(await pkceChallenge(sent.get("code_verifier")!)).toBe(authUrl.searchParams.get("code_challenge"));
  });

  it("rejects a callback whose state does not match", async () => {
    const login = await handleLogin(req("/api/auth/login?returnTo=/en"), config);
    const cb = await handleCallback(req("/api/auth/callback?code=abc&state=forged", { jar: cookieJar(login) }), config, fakeGitHub);
    expect(cb.headers.get("location")).toBe(`${ORIGIN}/en?github_error=invalid_state`);
  });

  it("hands the first access token over once, then refreshes with rotation", async () => {
    const { jar } = await signIn();
    const headers = { [CSRF_HEADER]: "1", origin: ORIGIN };

    const first = await handleToken(req("/api/auth/token", { method: "POST", jar, headers }), config, fakeGitHub);
    const firstBody = await first.json();
    expect(firstBody.accessToken).toMatch(/^ghu_access_/);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const jar2 = cookieJar(first, jar);
    expect(jar2.ph_handoff).toBeUndefined();

    const second = await handleToken(req("/api/auth/token", { method: "POST", jar: jar2, headers }), config, fakeGitHub);
    const secondBody = await second.json();
    expect(secondBody.accessToken).not.toBe(firstBody.accessToken);
    expect(cookieJar(second, jar2).ph_session).not.toBe(jar2.ph_session);
  });

  it("refuses token requests without the CSRF header or from another origin", async () => {
    const { jar } = await signIn();
    expect((await handleToken(req("/api/auth/token", { method: "POST", jar }), config, fakeGitHub)).status).toBe(403);
    const cross = req("/api/auth/token", { method: "POST", jar, headers: { [CSRF_HEADER]: "1", origin: "https://evil.example" } });
    expect((await handleToken(cross, config, fakeGitHub)).status).toBe(403);
  });

  it("signed-out and tampered sessions get no token and the cookies are cleared", async () => {
    const headers = { [CSRF_HEADER]: "1" };
    const signedOut = await handleToken(req("/api/auth/token", { method: "POST", headers }), config, fakeGitHub);
    expect(signedOut.status).toBe(200);
    expect(await signedOut.json()).toMatchObject({ accessToken: null });
    const tampered = await handleToken(req("/api/auth/token", { method: "POST", jar: { ph_session: "garbage" }, headers }), config, fakeGitHub);
    expect(await tampered.json()).toMatchObject({ accessToken: null });
    expect(tampered.headers.get("set-cookie")).toContain("ph_session=;");
  });

  it("logout clears the session cookies", async () => {
    const { jar } = await signIn();
    const res = await handleLogout(req("/api/auth/logout", { method: "POST", jar, headers: { [CSRF_HEADER]: "1" } }));
    expect(cookieJar(res, jar)).toEqual({});
  });
});
