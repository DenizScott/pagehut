import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, type GitHubAppConfig } from "./config";
import { pkceChallenge, randomToken, safeEqual, safeReturnTo, seal, unseal } from "./crypto";
import { authorizeUrl, exchangeCode, OAuthError, refreshTokens, type GitHubTokens } from "./oauth";

/**
 * Sign-in with a GitHub App (web flow + PKCE + state). The server only:
 *  - exchanges the code and refreshes tokens (needs the client secret),
 *  - keeps the refresh token in an encrypted httpOnly cookie.
 * The short-lived access token is handed to the browser once and kept in memory there.
 * Documents never pass through the server.
 */

const COOKIE = { flow: "ph_oauth", session: "ph_session", handoff: "ph_handoff" } as const;
const PURPOSE = { flow: "oauth-flow", session: "session", handoff: "handoff" } as const;
const PATH = "/api/auth";
export const CSRF_HEADER = "x-pagehut-csrf";

interface FlowState {
  state: string;
  verifier: string;
  returnTo: string;
}
interface Session {
  refreshToken: string;
  refreshExpiresAt: number;
}
interface Handoff {
  accessToken: string;
  accessExpiresAt: number;
}

const noStore = { "Cache-Control": "no-store" };

function cookieOpts(req: NextRequest, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Behind a TLS-terminating proxy the request reaches the app as http; trust the proxy's header
    // here (it can only make the cookie stricter).
    secure: new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https",
    sameSite: "lax" as const,
    path: PATH,
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

function clear(res: NextResponse, ...names: string[]) {
  for (const name of names) res.cookies.set(name, "", { path: PATH, maxAge: 0 });
}

/** Rejects cross-site POSTs: requires our custom header (not settable cross-origin without CORS) and a same-origin Origin. */
function csrfOk(req: NextRequest): boolean {
  if (req.headers.get(CSRF_HEADER) !== "1") return false;
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

function redirectWithError(req: NextRequest, returnTo: string, code: string) {
  const url = new URL(returnTo, req.url);
  url.searchParams.set("github_error", code);
  return NextResponse.redirect(url);
}

export async function handleStatus(config: GitHubAppConfig | null, desktop = false) {
  return NextResponse.json(
    config ? { configured: true, appSlug: config.appSlug } : { configured: false, ...(desktop ? { desktop: true } : {}) },
    { headers: noStore },
  );
}

export async function handleLogin(req: NextRequest, config: GitHubAppConfig | null) {
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  if (!config) return redirectWithError(req, returnTo, "not_configured");
  const flow: FlowState = { state: randomToken(), verifier: randomToken(48), returnTo };
  const res = NextResponse.redirect(
    authorizeUrl(config, {
      redirectUri: callbackUrl(config, req.url),
      state: flow.state,
      codeChallenge: await pkceChallenge(flow.verifier),
    }),
  );
  res.cookies.set(COOKIE.flow, await seal(flow, config.sessionSecret, PURPOSE.flow), cookieOpts(req, 600));
  return res;
}

export async function handleCallback(req: NextRequest, config: GitHubAppConfig | null, fetchImpl: typeof fetch = fetch) {
  const flow = config ? await unseal<FlowState>(req.cookies.get(COOKIE.flow)?.value, config.sessionSecret, PURPOSE.flow) : null;
  const returnTo = flow?.returnTo ?? "/";
  if (!config) return redirectWithError(req, returnTo, "not_configured");

  const params = req.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const code = params.get("code");
  if (params.get("error")) return clearFlow(req, redirectWithError(req, returnTo, "denied"));
  if (!flow || !code || !safeEqual(flow.state, state)) return clearFlow(req, redirectWithError(req, returnTo, "invalid_state"));

  let tokens: GitHubTokens;
  try {
    tokens = await exchangeCode(config, { code, redirectUri: callbackUrl(config, req.url), codeVerifier: flow.verifier }, fetchImpl);
  } catch (err) {
    const codeName = err instanceof OAuthError ? err.code : "exchange_failed";
    return clearFlow(req, redirectWithError(req, returnTo, codeName));
  }

  const res = NextResponse.redirect(new URL(returnTo, req.url));
  clear(res, COOKIE.flow);
  await writeSession(req, res, config, tokens);
  // The fresh access token is collected once by /api/auth/token.
  res.cookies.set(
    COOKIE.handoff,
    await seal({ accessToken: tokens.accessToken, accessExpiresAt: tokens.accessExpiresAt } satisfies Handoff, config.sessionSecret, PURPOSE.handoff),
    cookieOpts(req, 120),
  );
  return res;
}

function clearFlow(_req: NextRequest, res: NextResponse) {
  clear(res, COOKIE.flow);
  return res;
}

async function writeSession(req: NextRequest, res: NextResponse, config: GitHubAppConfig, tokens: GitHubTokens) {
  const session: Session = { refreshToken: tokens.refreshToken, refreshExpiresAt: tokens.refreshExpiresAt };
  res.cookies.set(
    COOKIE.session,
    await seal(session, config.sessionSecret, PURPOSE.session),
    cookieOpts(req, (tokens.refreshExpiresAt - Date.now()) / 1000),
  );
}

/** Returns a short-lived access token for the browser (kept in memory there, never stored). */
export async function handleToken(req: NextRequest, config: GitHubAppConfig | null, fetchImpl: typeof fetch = fetch) {
  if (!config) return NextResponse.json({ error: "not_configured" }, { status: 503, headers: noStore });
  if (!csrfOk(req)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });

  const handoff = await unseal<Handoff>(req.cookies.get(COOKIE.handoff)?.value, config.sessionSecret, PURPOSE.handoff);
  if (handoff && handoff.accessExpiresAt > Date.now() + 60_000) {
    const res = NextResponse.json({ accessToken: handoff.accessToken, expiresAt: handoff.accessExpiresAt }, { headers: noStore });
    clear(res, COOKIE.handoff);
    return res;
  }

  const session = await unseal<Session>(req.cookies.get(COOKIE.session)?.value, config.sessionSecret, PURPOSE.session);
  if (!session || session.refreshExpiresAt < Date.now()) {
    // Being signed out is a normal state, not an error: 200 with no token keeps consoles clean.
    const res = NextResponse.json({ accessToken: null, error: "signed_out" }, { headers: noStore });
    clear(res, COOKIE.session, COOKIE.handoff);
    return res;
  }

  try {
    const tokens = await refreshTokens(config, session.refreshToken, fetchImpl);
    const res = NextResponse.json({ accessToken: tokens.accessToken, expiresAt: tokens.accessExpiresAt }, { headers: noStore });
    clear(res, COOKIE.handoff);
    await writeSession(req, res, config, tokens);
    return res;
  } catch (err) {
    // bad_refresh_token etc.: the user has to sign in again; local work is unaffected.
    const res = NextResponse.json({ error: err instanceof OAuthError ? err.code : "refresh_failed" }, { status: 401, headers: noStore });
    clear(res, COOKIE.session, COOKIE.handoff);
    return res;
  }
}

export async function handleLogout(req: NextRequest) {
  if (!csrfOk(req)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const res = NextResponse.json({ ok: true }, { headers: noStore });
  clear(res, COOKIE.session, COOKIE.handoff, COOKIE.flow);
  return res;
}
