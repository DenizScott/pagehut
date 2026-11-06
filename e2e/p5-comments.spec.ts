import { strToU8, zipSync } from "fflate";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { FakeGitHub } from "../src/lib/github/fake-github";

/** Comments, @mentions, the mentions inbox and folder import through the real UI. */

const editor = (page: Page) => page.locator(".ProseMirror:visible");
const panel = (page: Page) => page.getByRole("complementary", { name: "Comments" });

async function fakeSignedIn(context: BrowserContext, gh: FakeGitHub) {
  await context.route("**/api/auth/status", (r) => r.fulfill({ json: { configured: true, appSlug: "pagehut-test" } }));
  await context.route("**/api/auth/token", (r) => r.fulfill({ json: { accessToken: "ghu_e2e", expiresAt: Date.now() + 8 * 3600_000 } }));
  await context.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    const res = await gh.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
    await route.fulfill({ status: res.status, body: await res.text(), headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  });
}

async function selectHeading(page: Page, name: string | RegExp) {
  await editor(page).getByRole("heading", { name }).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
}

test("comment on text: it follows edits, takes replies, resolves and survives a reload", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);

  await selectHeading(page, "Try it");
  await page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: "Comment" }).click();
  const draft = panel(page).getByRole("region", { name: "New comment" });
  await expect(draft).toContainText("Try it");
  await draft.getByRole("combobox").fill("Is this clear enough?");
  await page.keyboard.press("ControlOrMeta+Enter");

  const highlight = editor(page).locator(".lk-comment");
  await expect(highlight).toHaveText("Try it");
  const thread = panel(page).getByRole("article", { name: /Comment on “Try it”/ });
  await expect(thread).toContainText("Is this clear enough?");
  await expect(page.getByRole("button", { name: "1 open comment" })).toBeVisible();

  // Text typed before the quote doesn't move the comment off it.
  await editor(page).getByRole("heading", { name: "Try it" }).click();
  await page.keyboard.press("Home");
  await page.keyboard.type("Now ");
  await expect(editor(page).getByRole("heading", { name: "Now Try it" })).toBeVisible();
  await expect(highlight).toHaveText("Try it");

  // Clicking the highlight selects the thread.
  await highlight.click();
  await expect(thread).toHaveCSS("border-color", /.+/);

  await thread.getByRole("combobox", { name: "Reply…" }).fill("Yes, after the rename.");
  await thread.getByRole("button", { name: "Reply" }).click();
  await expect(thread).toContainText("Yes, after the rename.");

  await thread.getByRole("button", { name: "Resolve" }).click();
  await expect(highlight).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: "Show 1 resolved" })).toBeVisible();

  // Saved locally: still there after a reload.
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");
  await page.reload();
  await page.getByRole("button", { name: "Comments" }).click();
  await panel(page).getByRole("button", { name: "Show 1 resolved" }).click();
  await expect(panel(page).getByRole("article", { name: /Comment on “Try it”/ })).toContainText("Yes, after the rename.");
});

test("mention a teammate, sync comments, and see mentions in the inbox", async ({ browser }) => {
  test.setTimeout(60_000);
  const gh = new FakeGitHub();
  gh.addRepo("team", "game", { files: { "Assets/Scripts/Player.cs": "class Player {}", "ProjectSettings/ProjectVersion.txt": "6000.0" } });
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: /Local mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await dialog.getByRole("radio", { name: "team/game" }).click();
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/game")).toBeVisible();
  const pageId = page.url().split("/p/")[1];

  // A page comment that mentions the repo owner, picked from suggestions.
  await page.getByRole("button", { name: "Comments" }).click();
  const box = panel(page).getByRole("combobox", { name: "Comment on this page…" });
  await box.click();
  await page.keyboard.type("@te");
  await expect(panel(page).getByRole("listbox", { name: "People to mention" }).getByRole("option", { name: "@team", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("please review the pitch");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(panel(page).getByRole("article", { name: "Page comment" })).toContainText("@team please review the pitch");

  const sync = page.locator("[data-sync-state]:visible");
  await sync.click();
  await expect(sync).toHaveAttribute("data-sync-state", "synced");
  const path = `GDD/comments/${pageId}.json`;
  expect(gh.files("team/game")[path]).toContain("@team please review the pitch");

  // A teammate replies on GitHub and mentions me in a new thread.
  const file = JSON.parse(gh.files("team/game")[path]);
  file.threads[0].comments.push({ id: "01ZZZZZZZZZZZZZZZZZZZZZZZY", author: "team", body: "Looks good.", createdAt: Date.now() });
  file.threads.push({ id: "01ZZZZZZZZZZZZZZZZZZZZZZZZ", comments: [{ id: "01ZZZZZZZZZZZZZZZZZZZZZZZX", author: "team", body: "@octo-designer can you add the core loop?", createdAt: Date.now() }] });
  gh.commit("team/game", { [path]: `${JSON.stringify(file, null, 2)}\n` }, "Team replies");
  await sync.click();
  await expect(sync).toHaveAttribute("data-sync-state", "synced");
  await expect(panel(page)).toContainText("Looks good.");

  // The inbox lists the mention and opens its thread.
  await panel(page).getByRole("button", { name: "Close comments" }).click();
  await page.getByRole("button", { name: /Mentions/ }).click();
  const inbox = page.getByRole("dialog", { name: "Mentions" });
  await inbox.getByRole("button", { name: /can you add the core loop/ }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator("[data-thread-card='01ZZZZZZZZZZZZZZZZZZZZZZZZ']")).toHaveClass(/border-accent/);
  await ctx.close();
});

test("import a Markdown & CSV folder export: page tree, links and a database", async ({ page }) => {
  const nid = (n: number) => String(n).repeat(32);
  const gd = `Game Design ${nid(1)}`;
  const zip = zipSync({
    [`${gd}.md`]: strToU8(`# Game Design\n\nSee [Combat](${encodeURIComponent(gd)}/Combat%20${nid(2)}.md).\n`),
    [`${gd}/Combat ${nid(2)}.md`]: strToU8("# Combat\n\nBosses have phases.\n"),
    [`${gd}/Enemies ${nid(3)}_all.csv`]: strToU8("Name,HP,Type\nSlime,10,Small\nGolem,200,Boss\nBat,8,Small\n"),
  });
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.locator('input[type="file"][accept*=".zip"]').setInputFiles({ name: "Export.zip", mimeType: "application/zip", buffer: Buffer.from(zip) });
  await expect(page.getByText("3 pages imported")).toBeVisible();

  const tree = page.getByRole("list", { name: "Pages" });
  await tree.getByRole("link", { name: "Game Design" }).click();
  await editor(page).getByRole("link", { name: "Combat" }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Combat");

  await tree.getByRole("link", { name: "Enemies" }).click();
  const db = page.getByRole("region", { name: "Database" });
  await expect(db.locator("tbody tr")).toHaveCount(3);
  await expect(db.getByRole("button", { name: "Type column options" })).toBeVisible();
  await expect(db.getByRole("button", { name: "Type, Golem" })).toHaveText("Boss");
});
