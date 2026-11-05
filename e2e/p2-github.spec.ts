import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { FakeGitHub } from "../src/lib/github/fake-github";

/**
 * GitHub flows through the real UI, with GitHub itself replaced by an in-memory fake:
 * /api/auth/* is answered as "signed in" and api.github.com is routed to FakeGitHub.
 * The real OAuth exchange is covered by unit tests (src/lib/server/auth-handlers.test.ts).
 */

async function fakeSignedIn(context: BrowserContext, gh: FakeGitHub) {
  await context.route("**/api/auth/status", (r) => r.fulfill({ json: { configured: true, appSlug: "pagehut-test" } }));
  await context.route("**/api/auth/token", (r) => r.fulfill({ json: { accessToken: "ghu_e2e", expiresAt: Date.now() + 8 * 3600_000 } }));
  await context.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    const res = await gh.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
    await route.fulfill({
      status: res.status,
      body: await res.text(),
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  });
}

async function newPage(page: Page, title: string, body: string) {
  const before = page.url();
  await page.getByRole("button", { name: "New page" }).first().click();
  await page.waitForURL((u) => u.toString() !== before && u.pathname.includes("/p/"));
  const t = page.getByRole("textbox", { name: "Page title" });
  await t.fill(title);
  await t.press("Enter");
  await page.keyboard.type(body);
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");
}

test("without server configuration, GitHub explains setup and local mode keeps working", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: /Local mode/ }).click();
  await expect(page.getByRole("dialog", { name: "Save this workspace to GitHub" })).toContainText("not set up on this server");
});

test("a sign-in error from the OAuth redirect is explained", async ({ page }) => {
  await page.goto("/en?github_error=denied");
  await expect(page.getByText("GitHub sign-in was cancelled.")).toBeVisible();
  await expect(page).not.toHaveURL(/github_error/);
});

test("connect, push, conflict guard, and open on a second device", async ({ browser }) => {
  const gh = new FakeGitHub();
  gh.addRepo("team", "gdd");

  // Device 1: connect a local workspace to an empty repository.
  const ctx1 = await browser.newContext();
  await fakeSignedIn(ctx1, gh);
  const page = await ctx1.newPage();
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await newPage(page, "Combat", "Every fight is a puzzle.");

  await page.getByRole("button", { name: /Local mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await expect(dialog).toContainText("Signed in as octo-designer");
  await dialog.getByRole("radio", { name: "team/gdd" }).click();
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/gdd")).toBeVisible();
  await expect(page.getByRole("link", { name: /team\/gdd/ })).toBeVisible();

  let files = gh.files("team/gdd");
  expect(Object.keys(files)).toContain("workspace.json");
  const combatFile = Object.entries(files).find(([p, t]) => p.startsWith("pages/") && t.includes('title: "Combat"'));
  expect(combatFile?.[1]).toContain("Every fight is a puzzle.");

  // Edit, then push with the sync button.
  await page.locator(".ProseMirror:visible").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Bosses have three phases.");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");
  const sync = page.locator("[data-sync-state]:visible");
  await expect(sync).toHaveAttribute("data-sync-state", "pending");
  await sync.click();
  await expect(sync).toHaveAttribute("data-sync-state", "synced");
  files = gh.files("team/gdd");
  expect(files[combatFile![0]]).toContain("Bosses have three phases.");
  expect(gh.lastCommitMessage("team/gdd")).toMatch(/^Update "Combat"/);

  // A teammate pushes first: PageHut refuses to overwrite and keeps local text.
  gh.commit("team/gdd", { "notes.md": "teammate" }, "Teammate change");
  await page.locator(".ProseMirror:visible").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Local only.");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");
  await sync.click();
  await expect(sync).toHaveAttribute("data-sync-state", "remoteChanged");
  expect(gh.files("team/gdd")[combatFile![0]]).not.toContain("Local only.");
  await expect(page.locator(".ProseMirror:visible")).toContainText("Local only.");

  // Device 2: fresh browser profile opens the workspace from the repository.
  const ctx2 = await browser.newContext();
  await fakeSignedIn(ctx2, gh);
  const page2 = await ctx2.newPage();
  await page2.goto("/en");
  await page2.waitForURL(/\/p\//);
  await page2.getByRole("button", { name: /Switch workspace/ }).click();
  await page2.getByRole("menuitem", { name: "Open from GitHub…" }).click();
  const openDialog = page2.getByRole("dialog", { name: "Open a workspace from GitHub" });
  await openDialog.getByRole("radio", { name: "team/gdd" }).click();
  await openDialog.getByRole("button", { name: "Open workspace" }).click();
  await expect(page2.getByText("Opened workspace from team/gdd")).toBeVisible();
  const tree = page2.getByRole("list", { name: "Pages" });
  await expect(tree.getByRole("link", { name: "Combat" })).toBeVisible();
  await tree.getByRole("link", { name: "Combat" }).click();
  await expect(page2.locator(".ProseMirror:visible")).toContainText("Bosses have three phases.");

  // Share explains collaborator access.
  await page2.getByRole("button", { name: /Switch workspace/ }).click();
  await page2.getByRole("menuitem", { name: "Share with your team" }).click();
  await expect(page2.getByRole("link", { name: /collaborator settings/ })).toHaveAttribute("href", "https://github.com/team/gdd/settings/access");

  await ctx1.close();
  await ctx2.close();
});
