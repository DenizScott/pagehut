import type { GitHubAppConfig } from "./config";

/** Token exchange and refresh with GitHub (server side; needs the client secret). */

export interface GitHubTokens {
  accessToken: string;
  /** epoch ms */
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export class OAuthError extends Error {
  constructor(public code: string) {
    // Never include token values in errors; they can end up in logs.
    super(`GitHub OAuth error: ${code}`);
  }
}

const TOKEN_URL = "https://github.com/login/oauth/access_token";

async function tokenRequest(params: Record<string, string>, fetchImpl: typeof fetch): Promise<GitHubTokens> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
  if (!res.ok) throw new OAuthError(`http_${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  if (typeof json.error === "string") throw new OAuthError(json.error);
  if (typeof json.access_token !== "string" || typeof json.refresh_token !== "string") {
    // The app must use expiring user tokens (the default for GitHub Apps).
    throw new OAuthError("expiring_tokens_disabled");
  }
  const now = Date.now();
  return {
    accessToken: json.access_token,
    accessExpiresAt: now + Number(json.expires_in ?? 28800) * 1000,
    refreshToken: json.refresh_token,
    refreshExpiresAt: now + Number(json.refresh_token_expires_in ?? 15_552_000) * 1000,
  };
}

export function exchangeCode(
  config: GitHubAppConfig,
  input: { code: string; redirectUri: string; codeVerifier: string },
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubTokens> {
  return tokenRequest(
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    },
    fetchImpl,
  );
}

/** Refresh tokens rotate: the old refresh token stops working once used. */
export function refreshTokens(config: GitHubAppConfig, refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<GitHubTokens> {
  return tokenRequest(
    { client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken },
    fetchImpl,
  );
}

export function authorizeUrl(config: GitHubAppConfig, input: { redirectUri: string; state: string; codeChallenge: string }): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}
