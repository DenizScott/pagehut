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
  await page.route("**/api/auth/status", (r) => r.fulfill({ json: { configured: false } }));
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
  await expect(dialog.getByRole("textbox", { name: "Folder in the repository:" })).toHaveValue("GDD");
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/gdd")).toBeVisible();
  await expect(page.getByRole("link", { name: /team\/gdd\/GDD/ })).toBeVisible();

  let files = gh.files("team/gdd");
  expect(Object.keys(files)).toContain("GDD/workspace.json");
  const combatFile = Object.entries(files).find(([p, t]) => p.startsWith("GDD/pages/") && t.includes('title: "Combat"'));
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

  // A teammate pushes Unity code: unrelated, so the next push goes on top of it.
  gh.commit("team/gdd", { "Assets/Scripts/Player.cs": "class Player {}" }, "Teammate: player script");
  await page.locator(".ProseMirror:visible").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Arena is round.");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");
  await sync.click();
  await expect(sync).toHaveAttribute("data-sync-state", "synced");
  expect(gh.files("team/gdd")["Assets/Scripts/Player.cs"]).toBe("class Player {}");
  expect(gh.files("team/gdd")[combatFile![0]]).toContain("Arena is round.");

  // A teammate edits the SAME page: PageHut refuses to overwrite and keeps local text.
  gh.commit("team/gdd", { [combatFile![0]]: `${gh.files("team/gdd")[combatFile![0]]}\nTeammate line.\n` }, "Teammate edits Combat");
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

test("opening a repo without a workspace offers to save into it instead", async ({ browser }) => {
  const gh = new FakeGitHub();
  gh.addRepo("team", "game-code", { files: { "README.md": "# Code" } });
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  await page.goto("/en");
  await page.waitForURL(/\/p\//);

  await page.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitem", { name: "Open from GitHub…" }).click();
  const openDialog = page.getByRole("dialog", { name: "Open a workspace from GitHub" });
  await openDialog.getByRole("radio", { name: "team/game-code" }).click();
  await openDialog.getByRole("button", { name: "Open workspace" }).click();
  await openDialog.getByRole("button", { name: "Save this workspace to this repository instead" }).click();

  const saveDialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await expect(saveDialog.getByRole("radio", { name: "team/game-code" })).toHaveAttribute("aria-checked", "true");
  await expect(saveDialog).toContainText("never your Unity/Unreal project");
  await expect(saveDialog).toContainText("in GDD/");
  await saveDialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/game-code")).toBeVisible();
  expect(gh.files("team/game-code")["README.md"]).toBe("# Code");
  expect(gh.files("team/game-code")["GDD/workspace.json"]).toBeDefined();
  await ctx.close();
});

test("an existing root workspace can be moved into GDD/ of a game repo", async ({ browser }) => {
  const gh = new FakeGitHub();
  gh.addRepo("team", "game", { files: { "Assets/Scripts/Player.cs": "class Player {}" } });
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  await page.goto("/en");
  await page.waitForURL(/\/p\//);

  // Connect at the repository root (empty folder field), like the first version did.
  await page.getByRole("button", { name: /Local mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await dialog.getByRole("radio", { name: "team/game" }).click();
  await dialog.getByRole("textbox", { name: "Folder in the repository:" }).fill("");
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/game")).toBeVisible();
  expect(Object.keys(gh.files("team/game"))).toContain("workspace.json");

  await page.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitem", { name: "Folder in repository…" }).click();
  const move = page.getByRole("dialog", { name: "Move the workspace to another folder" });
  await move.getByRole("textbox", { name: "New folder:" }).fill("GDD");
  await move.getByRole("button", { name: "Move" }).click();
  await expect(page.getByText("Workspace moved to GDD/")).toBeVisible();

  const files = Object.keys(gh.files("team/game"));
  expect(files).toContain("GDD/workspace.json");
  expect(files).not.toContain("workspace.json");
  expect(files.filter((p) => p.startsWith("pages/"))).toEqual([]);
  expect(files).toContain("Assets/Scripts/Player.cs");
  await expect(page.locator("[data-sync-state]:visible")).toHaveAttribute("data-sync-state", "synced");
  await ctx.close();
});

test("an older root connection in a Unity repo moves to GDD/ by itself on reload", async ({ browser }) => {
  const gh = new FakeGitHub();
  gh.addRepo("team", "unity-game", { files: { "Assets/Scripts/Player.cs": "class Player {}", "ProjectSettings/ProjectVersion.txt": "6000.0" } });
  const ctx = await browser.newContext();
  await fakeSignedIn(ctx, gh);
  const page = await ctx.newPage();
  await page.goto("/en");
  await page.waitForURL(/\/p\//);

  await page.getByRole("button", { name: /Local mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await dialog.getByRole("radio", { name: "team/unity-game" }).click();
  await dialog.getByRole("textbox", { name: "Folder in the repository:" }).fill("");
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/unity-game")).toBeVisible();
  expect(Object.keys(gh.files("team/unity-game"))).toContain("workspace.json");

  // Turn it into a connection made by the older version (no folder recorded).
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open("pagehut");
      r.onsuccess = () => res(r.result);
    });
    await new Promise<void>((res) => {
      const store = db.transaction("workspaces", "readwrite").objectStore("workspaces");
      const all = store.getAll();
      all.onsuccess = () => {
        for (const ws of all.result) if (ws.repo) store.put({ ...ws, repo: { owner: ws.repo.owner, name: ws.repo.name, branch: ws.repo.branch }, workspaceFileSha: undefined });
        res();
      };
    });
    db.close();
  });

  await page.reload();
  await expect(page.getByText("now lives in the GDD/ folder")).toBeVisible();
  const files = Object.keys(gh.files("team/unity-game"));
  expect(files).toContain("GDD/workspace.json");
  expect(files).not.toContain("workspace.json");
  expect(files).toContain("Assets/Scripts/Player.cs");
  await expect(page.getByRole("link", { name: /team\/unity-game\/GDD/ })).toBeVisible();
  await ctx.close();
});
