import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { appendEnvLocal } from "./env-file";
import { handleSetupCallback, handleSetupStart, manifestFor, type SetupEnv } from "./setup";

const env = (over: Partial<SetupEnv> = {}): SetupEnv => ({ isDev: true, configured: false, writeEnv: vi.fn(async () => {}), ...over });
const req = (url: string, cookie?: string) => new NextRequest(url, { headers: cookie ? { cookie } : {} });

describe("one-click GitHub App setup", () => {
  it("only runs in development, on localhost, before sign-in is configured", async () => {
    expect((await handleSetupStart(req("http://localhost:3000/api/setup/github"), env({ isDev: false }))).status).toBe(404);
    expect((await handleSetupStart(req("https://pagehut.example/api/setup/github"), env())).status).toBe(404);
    const lan = new NextRequest("http://localhost:3000/api/setup/github", { headers: { host: "172.20.10.7:3000" } });
    expect((await handleSetupStart(lan, env())).status).toBe(404);
    const done = await handleSetupStart(req("http://localhost:3000/api/setup/github"), env({ configured: true }));
    expect(await done.text()).toContain("already set up");
  });

  it("posts a minimal-permission manifest to GitHub with a state cookie", async () => {
    const res = await handleSetupStart(req("http://localhost:3000/api/setup/github"), env());
    const html = await res.text();
    expect(html).toMatch(/action="https:\/\/github.com\/settings\/apps\/new\?state=[\w-]+"/);
    expect(res.headers.getSetCookie()[0]).toMatch(/ph_setup=.*HttpOnly/i);

    const m = manifestFor("http://localhost:3000");
    expect(m.default_permissions).toEqual({ contents: "write", metadata: "read" });
    expect(m.callback_urls).toEqual(["http://localhost:3000/api/auth/callback"]);
    expect(m.redirect_url).toBe("http://localhost:3000/api/setup/github/callback");
    expect(m.hook_attributes.active).toBe(false);
  });

  it("exchanges the code and writes the keys; rejects a wrong state", async () => {
    const start = await handleSetupStart(req("http://localhost:3000/api/setup/github"), env());
    const state = /state=([\w-]+)/.exec(await start.text())![1];
    const cookie = `ph_setup=${state}`;

    const bad = await handleSetupCallback(req(`http://localhost:3000/api/setup/github/callback?code=abc&state=forged`, cookie), env());
    expect(bad.status).toBe(400);

    const fetchImpl = vi.fn(async () => Response.json({ slug: "pagehut-x1", client_id: "Iv23test", client_secret: "s3cr3t", name: "PageHut x1" }));
    const e = env({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const ok = await handleSetupCallback(req(`http://localhost:3000/api/setup/github/callback?code=abc&state=${state}`, cookie), e);
    expect(ok.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.github.com/app-manifests/abc/conversions", expect.objectContaining({ method: "POST" }));
    const written = (e.writeEnv as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written).toMatchObject({ GITHUB_APP_CLIENT_ID: "Iv23test", GITHUB_APP_CLIENT_SECRET: "s3cr3t", GITHUB_APP_SLUG: "pagehut-x1" });
    expect(written.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    // The secret is never echoed back to the browser.
    expect(await ok.text()).not.toContain("s3cr3t");
  });
});

describe(".env.local writer", () => {
  it("appends new keys and never overwrites existing ones", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pagehut-env-"));
    await writeFile(join(dir, ".env.local"), "OTHER=1\n");
    await appendEnvLocal({ GITHUB_APP_CLIENT_ID: "a" }, dir);
    const text = await readFile(join(dir, ".env.local"), "utf8");
    expect(text).toContain("OTHER=1");
    expect(text).toContain("GITHUB_APP_CLIENT_ID=a");
    await expect(appendEnvLocal({ GITHUB_APP_CLIENT_ID: "b" }, dir)).rejects.toThrow(/already set/);
  });
});
