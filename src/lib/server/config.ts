/**
 * GitHub App settings, read from the environment on the server only. Nothing here is ever sent to
 * the browser except `configured` and the public app slug (needed for the install link).
 * See docs/GITHUB-SETUP.md.
 */
export interface GitHubAppConfig {
  clientId: string;
  clientSecret: string;
  appSlug: string;
  sessionSecret: string;
  /** Optional fixed public URL (e.g. https://pagehut.app); otherwise the request origin is used. */
  publicUrl?: string;
}

export function readConfig(env: Record<string, string | undefined> = process.env): GitHubAppConfig | null {
  const clientId = env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = env.GITHUB_APP_CLIENT_SECRET?.trim();
  const appSlug = env.GITHUB_APP_SLUG?.trim();
  const sessionSecret = env.SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !appSlug || !sessionSecret) return null;
  if (sessionSecret.length < 32) {
    console.error("[auth] SESSION_SECRET must be at least 32 characters; GitHub sign-in is disabled.");
    return null;
  }
  return { clientId, clientSecret, appSlug, sessionSecret, publicUrl: env.PAGEHUT_PUBLIC_URL?.trim() || undefined };
}

export function callbackUrl(config: GitHubAppConfig, requestUrl: string): string {
  const base = config.publicUrl ?? new URL(requestUrl).origin;
  return new URL("/api/auth/callback", base).toString();
}
