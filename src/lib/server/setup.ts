import { NextResponse, type NextRequest } from "next/server";
import { BRAND } from "@/config/brand";
import { randomToken, safeEqual } from "./crypto";

/**
 * One-click GitHub App registration for the person running PageHut (the "manifest flow").
 * GitHub creates the app after a single confirmation and hands the keys straight to this server,
 * which writes them to .env.local. Nobody has to copy keys by hand, and end users never see any.
 *
 * Deliberately limited: development mode, a request from this machine (localhost), and only while
 * sign-in is not configured yet. It can never overwrite existing keys.
 */

const STATE_COOKIE = "ph_setup";
const PATH = "/api/setup";

export interface SetupEnv {
  isDev: boolean;
  configured: boolean;
  /** Writes the new variables; refuses if keys already exist. */
  writeEnv: (vars: Record<string, string>) => Promise<void>;
  fetchImpl?: typeof fetch;
}

/**
 * The Host header the browser actually used. (nextUrl reflects the address the dev server listens
 * on, so a device on the same network would also look like "localhost" there.)
 */
function isLocal(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? req.nextUrl.host).replace(/:\d+$/, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:10vh auto;padding:0 1rem;line-height:1.6;color:#1f2229;background:#fbfaf8}
button,a.btn{display:inline-block;background:#e8793a;color:#1a1c22;border:0;border-radius:8px;padding:.6rem 1rem;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
code{background:#eee;padding:.1rem .3rem;border-radius:4px}.muted{color:#5b6170;font-size:.9rem}</style></head><body>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function guard(req: NextRequest, env: SetupEnv): NextResponse | null {
  if (!env.isDev || !isLocal(req)) return page("Not available", "<h1>Not available</h1><p>GitHub setup only runs on the developer's own machine.</p>", 404);
  if (env.configured)
    return page(
      "Already set up",
      `<h1>GitHub sign-in is already set up ✔</h1><p>Nothing to do. <a href="/?github=connect">Back to ${BRAND.name}</a></p>`,
    );
  return null;
}

export function manifestFor(origin: string) {
  return {
    name: `${BRAND.name} ${randomToken(3).replace(/[-_]/g, "x")}`,
    url: origin,
    description: `${BRAND.name}: game design documents stored in your own GitHub repositories.`,
    public: true,
    redirect_url: `${origin}/api/setup/github/callback`,
    callback_urls: [`${origin}/api/auth/callback`],
    setup_url: `${origin}/?github=connect`,
    setup_on_update: true,
    request_oauth_on_install: false,
    hook_attributes: { url: `${origin}/api/github/webhook-unused`, active: false },
    default_permissions: { contents: "write", metadata: "read" },
    default_events: [],
  };
}

/** Step 1: a page that posts the manifest to GitHub (GitHub asks the owner to confirm). */
export async function handleSetupStart(req: NextRequest, env: SetupEnv) {
  const blocked = guard(req, env);
  if (blocked) return blocked;
  const state = randomToken();
  const origin = req.nextUrl.origin;
  const manifest = JSON.stringify(manifestFor(origin));
  const res = page(
    "GitHub sign-in setup",
    `<h1>${BRAND.name}: GitHub ile giriş kurulumu</h1>
<p>Aşağıdaki düğme GitHub'da <strong>${BRAND.name}</strong> için bir uygulama kaydı oluşturur. GitHub'da yalnızca <strong>Create GitHub App</strong> düğmesine basman yeterli; anahtarlar otomatik olarak bu bilgisayara kaydedilir.</p>
<p class="muted">İzinler: yalnızca seçilen depolardaki dosyalar (Contents: read &amp; write). Webhook yok.</p>
<form method="post" action="https://github.com/settings/apps/new?state=${esc(state)}">
<input type="hidden" name="manifest" value="${esc(manifest)}"><button type="submit">GitHub'da uygulamayı oluştur</button></form>
<p class="muted">This creates a GitHub App for ${BRAND.name}. On GitHub, just click <em>Create GitHub App</em>; the keys are saved on this computer automatically.</p>`,
  );
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: PATH, maxAge: 3600 });
  return res;
}

/** Step 2: GitHub returns a one-time code; exchange it for the app's keys and save them. */
export async function handleSetupCallback(req: NextRequest, env: SetupEnv) {
  const blocked = guard(req, env);
  if (blocked) return blocked;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const expected = req.cookies.get(STATE_COOKIE)?.value ?? "";
  if (!code || !expected || !safeEqual(expected, state) || !/^[\w-]+$/.test(code)) {
    return page("Setup failed", `<h1>Kurulum doğrulanamadı</h1><p>Lütfen <a href="/api/setup/github">baştan başla</a>.</p>`, 400);
  }

  const res = await (env.fetchImpl ?? fetch)(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (!res.ok) {
    return page("Setup failed", `<h1>GitHub kurulumu tamamlanamadı (${res.status})</h1><p>Kod bir saat içinde kullanılmalı. <a href="/api/setup/github">Tekrar dene</a>.</p>`, 502);
  }
  const app = (await res.json()) as { slug: string; client_id: string; client_secret: string; html_url?: string; name?: string };
  if (!app.client_id || !app.client_secret || !app.slug) return page("Setup failed", "<h1>GitHub yanıtı eksik</h1>", 502);

  await env.writeEnv({
    GITHUB_APP_CLIENT_ID: app.client_id,
    GITHUB_APP_CLIENT_SECRET: app.client_secret,
    GITHUB_APP_SLUG: app.slug,
    SESSION_SECRET: randomToken(32),
  });

  const done = page(
    "Setup complete",
    `<h1>GitHub ile giriş hazır ✔</h1>
<p><strong>${esc(app.name ?? app.slug)}</strong> oluşturuldu ve anahtarlar bu bilgisayara kaydedildi.</p>
<p>Birkaç saniye içinde ${BRAND.name}'a döneceksin. Sonra <strong>GitHub ile giriş yap</strong> düğmesine bas.</p>
<p><a class="btn" href="/?github=connect">${BRAND.name}'a dön</a></p>
<script>setTimeout(function(){location.href="/?github=connect"},4000)</script>`,
  );
  done.cookies.set(STATE_COOKIE, "", { path: PATH, maxAge: 0 });
  return done;
}
