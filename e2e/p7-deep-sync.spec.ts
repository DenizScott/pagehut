import type { BrowserContext, Page } from "@playwright/test";
import { FakeGitHub } from "../src/lib/github/fake-github";
import { editor, expect, newPage, saved, test } from "./deep-guard";

/**
 * Deep tests, part 4: GitHub sync when things go wrong. Nothing typed may ever be lost, and the
 * sync button must say what happened. The browser logs failed requests (offline, 403, 500) as
 * console errors; those are expected here and checked separately.
 */

type Mode = "ok" | "offline" | "rate-limited" | "server-error";

async function setup(context: BrowserContext, gh: FakeGitHub, mode: { current: Mode }) {
  await context.route("**/api/auth/status", (r) => r.fulfill({ json: { configured: true, appSlug: "pagehut-test" } }));
  await context.route("**/api/auth/token", (r) => r.fulfill({ json: { accessToken: "ghu_e2e", expiresAt: Date.now() + 8 * 3600_000 } }));
  await context.route("https://api.github.com/**", async (route) => {
    if (mode.current === "offline") return route.abort("internetdisconnected");
    const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "x-ratelimit-remaining, x-ratelimit-reset" };
    if (mode.current === "rate-limited")
      return route.fulfill({ status: 403, body: JSON.stringify({ message: "API rate limit exceeded" }), headers: { ...cors, "content-type": "application/json", "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600) } });
    if (mode.current === "server-error") return route.fulfill({ status: 502, body: "Bad gateway", headers: cors });
    const req = route.request();
    const res = await gh.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
    await route.fulfill({ status: res.status, body: await res.text(), headers: { ...cors, "content-type": "application/json" } });
  });
}

async function connect(page: Page) {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: /Local mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await dialog.getByRole("radio", { name: "team/notes" }).click();
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/notes")).toBeVisible();
}

const sync = (page: Page) => page.locator("[data-sync-state]:visible");

for (const [mode, label] of [
  ["offline", /Offline/],
  ["rate-limited", /Paused until/],
  ["server-error", /Sync failed/],
] as [Mode, RegExp][]) {
  test(`sync ${mode}: says so, keeps the text, and catches up afterwards`, async ({ page, context, errors }) => {
    test.setTimeout(90_000);
    const gh = new FakeGitHub();
    gh.addRepo("team", "notes");
    const state = { current: "ok" as Mode };
    await setup(context, gh, state);
    await connect(page);

    state.current = mode;
    await newPage(page, `Written while ${mode}`);
    await page.keyboard.type("must not be lost");
    await saved(page);
    await sync(page).click();
    await expect(sync(page)).toContainText(label);
    await expect(editor(page)).toContainText("must not be lost");

    // Back to normal: the next sync sends everything.
    state.current = "ok";
    errors.length = 0; // the failed requests above were logged by the browser on purpose
    await page.waitForTimeout(500);
    await sync(page).click();
    await expect(sync(page)).toHaveAttribute("data-sync-state", "synced", { timeout: 20_000 });
    expect(Object.values(gh.files("team/notes")).some((t) => t.includes("must not be lost"))).toBe(true);
  });
}
