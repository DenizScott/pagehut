import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { FakeGitHub } from "../src/lib/github/fake-github";

/**
 * Team sync through the real UI against an in-memory GitHub (see p2-github.spec.ts for the setup).
 * A "teammate" is simulated by committing straight to the fake repository.
 */

async function fakeSignedIn(context: BrowserContext, gh: FakeGitHub) {
  await context.route("**/api/auth/status", (r) => r.fulfill({ json: { configured: true, appSlug: "pagehut-test" } }));
  await context.route("**/api/auth/token", (r) => r.fulfill({ json: { accessToken: "ghu_e2e", expiresAt: Date.now() + 8 * 3600_000 } }));
  await context.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    const res = await gh.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
    await route.fulfill({ status: res.status, body: await res.text(), headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  });
}

/** Opens the app, connects the starter workspace to team/game in GDD/, returns the welcome page file path. */
async function connected(page: Page, gh: FakeGitHub) {
  gh.addRepo("team", "game", { files: { "Assets/Scripts/Player.cs": "class Player {}", "ProjectSettings/ProjectVersion.txt": "6000.0" } });
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: /Local mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await dialog.getByRole("radio", { name: "team/game" }).click();
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/game")).toBeVisible();
  const pageId = page.url().split("/p/")[1];
  return `GDD/pages/${pageId}.md`;
}

const syncButton = (page: Page) => page.locator("[data-sync-state]:visible");
const editor = (page: Page) => page.locator(".ProseMirror:visible");

test("a teammate's edit shows up in the open page", async ({ browser }) => {
  const gh = new FakeGitHub();
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  const path = await connected(page, gh);

  const before = gh.files("team/game")[path];
  gh.commit("team/game", { [path]: before.replace("Try it", "Try it now") }, "Teammate renames a heading");
  await syncButton(page).click();

  await expect(editor(page).getByRole("heading", { name: "Try it now" })).toBeVisible();
  await expect(syncButton(page)).toHaveAttribute("data-sync-state", "synced");
  await ctx.close();
});

test("same-line edits show a conflict that can be compared and resolved", async ({ browser }) => {
  test.setTimeout(60_000);
  const gh = new FakeGitHub();
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  const path = await connected(page, gh);

  // I change the "Try it" heading here…
  await editor(page).getByRole("heading", { name: "Try it" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" (mine)");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");

  // …while a teammate changes the same line on GitHub.
  const remote = gh.files("team/game")[path];
  gh.commit("team/game", { [path]: remote.replace("## Try it", "## Try it (theirs)") }, "Teammate edits the heading");

  // Sync leaves the page alone while I'm typing; after a short pause it notices the conflict.
  await page.waitForTimeout(9_000);
  await syncButton(page).click();
  const banner = page.getByRole("alert").filter({ hasText: /also changed on GitHub|Keep your version\?/ });
  await expect(banner).toBeVisible();
  await expect(syncButton(page)).toHaveAttribute("data-sync-state", "conflict");
  await expect(editor(page)).toContainText("Try it (mine)"); // my text is untouched
  expect(gh.files("team/game")[path]).toContain("Try it (theirs)"); // theirs too

  // Keeping one side without comparing asks first; Cancel changes nothing.
  await banner.getByRole("button", { name: "Keep mine" }).click();
  await expect(banner).toContainText("Keep your version?");
  await banner.getByRole("button", { name: "Cancel" }).click();
  await expect(banner).toContainText("also changed on GitHub");

  await banner.getByRole("button", { name: "Compare" }).click();
  const compare = page.getByRole("dialog", { name: "Your version and the GitHub version" });
  await expect(compare).toContainText("## Try it (mine)");
  await expect(compare).toContainText("## Try it (theirs)");
  await expect(compare.getByText("## Try it (mine)").locator("xpath=preceding-sibling::span")).toHaveText(/^\d+$/);
  await compare.getByRole("button", { name: "Keep theirs" }).click();

  await expect(banner).toBeHidden();
  await expect(editor(page).getByRole("heading", { name: "Try it (theirs)" })).toBeVisible();
  await expect(syncButton(page)).toHaveAttribute("data-sync-state", "synced");
  await ctx.close();
});

test("page history lists versions and restores an older one", async ({ browser }) => {
  const gh = new FakeGitHub();
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  const path = await connected(page, gh);

  const original = gh.files("team/game")[path];
  gh.commit("team/game", { [path]: original.replace("## Try it", "## Changed by teammate") }, "Teammate edit");
  await syncButton(page).click();
  await expect(editor(page).getByRole("heading", { name: "Changed by teammate" })).toBeVisible();

  await page.getByRole("button", { name: "Page actions" }).click();
  await page.getByRole("menuitem", { name: "Page history" }).click();
  const history = page.getByRole("dialog", { name: "Page history" });
  const versions = history.getByRole("list", { name: "Versions" });
  await expect(versions.getByRole("button")).toHaveCount(2);
  await expect(versions.getByRole("button").first()).toContainText("teammate");
  await versions.getByRole("button").nth(1).click();
  await expect(history.locator("pre")).toContainText("## Try it");
  await history.getByRole("button", { name: "Restore this version" }).click();

  await expect(editor(page).getByRole("heading", { name: "Try it" })).toBeVisible();
  await syncButton(page).click();
  await expect(syncButton(page)).toHaveAttribute("data-sync-state", "synced");
  expect(gh.files("team/game")[path]).toContain("## Try it\n");
  await ctx.close();
});

test("typing is never interrupted: a teammate's edit elsewhere on the page merges in after a pause", async ({ browser }) => {
  test.setTimeout(60_000);
  const gh = new FakeGitHub();
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  const path = await connected(page, gh);

  await editor(page).getByRole("heading", { name: "Try it" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" (my words)");
  const remote = gh.files("team/game")[path];
  gh.commit("team/game", { [path]: remote.replace("Where is my work stored?", "Where is our work stored?") }, "Teammate edits the toggle");

  // While I'm typing, sync must not touch this page.
  await syncButton(page).click();
  await editor(page).getByRole("heading", { name: /Try it/ }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" still typing");
  await expect(editor(page)).toContainText("Try it (my words) still typing");

  // After a pause it merges both edits, and pushes the result.
  await page.waitForTimeout(9_000);
  await syncButton(page).click();
  await expect(editor(page)).toContainText("Where is our work stored?");
  await expect(editor(page)).toContainText("Try it (my words) still typing");
  await expect(syncButton(page)).toHaveAttribute("data-sync-state", "synced");
  const merged = gh.files("team/game")[path];
  expect(merged).toContain("Try it (my words) still typing");
  expect(merged).toContain("Where is our work stored?");
  await ctx.close();
});
