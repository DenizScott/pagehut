import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const pageIdFrom = (url: string) => url.split("/p/")[1];

async function newPageFromSidebar(page: Page) {
  const before = pageIdFrom(page.url());
  await page.getByRole("button", { name: "New page" }).first().click();
  await page.waitForURL((u) => u.pathname.includes("/p/") && !u.pathname.endsWith(before));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
});

test("template gallery fills an empty page", async ({ page }) => {
  await newPageFromSidebar(page);
  await page.getByRole("button", { name: "Start with a template" }).click();
  const dialog = page.getByRole("dialog", { name: "Templates" });
  await dialog.locator('[data-template="mechanic-spec"]').click();
  await dialog.getByRole("button", { name: "Use template" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Mechanic spec");
  await expect(page.locator(".ProseMirror:visible h2").first()).toHaveText("Summary");
});

test("subpages, [[page links]] and backlinks", async ({ page }) => {
  await newPageFromSidebar(page);
  const parentTitle = page.getByRole("textbox", { name: "Page title" });
  await parentTitle.fill("Levels");
  const parentId = pageIdFrom(page.url());

  await page.getByRole("button", { name: "Add a subpage to “Levels”" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith(parentId));
  await expect(page.getByRole("navigation", { name: "Page path" })).toContainText("Levels");

  const title = page.getByRole("textbox", { name: "Page title" });
  await expect(title).toHaveValue("");
  await title.fill("Forest");
  await title.press("Enter");
  await expect(page.locator(".ProseMirror:visible")).toBeFocused();
  await page.keyboard.type("See [[Lev");
  await expect(page.getByRole("listbox", { name: "Link to page" }).getByRole("option").first()).toContainText("Levels");
  await page.keyboard.press("Enter");

  const link = page.locator(".ProseMirror:visible a[data-page-link]");
  await expect(link).toHaveText(/Levels/);
  await link.click();
  await page.waitForURL(`**/p/${parentId}`);
  await expect(page.getByRole("complementary", { name: /links? here/ })).toContainText("Forest");
});

test("Ctrl+K search finds text inside pages", async ({ page }) => {
  await newPageFromSidebar(page);
  const title = page.getByRole("textbox", { name: "Page title" });
  await expect(title).toHaveValue("");
  await title.fill("Bestiary");
  await title.press("Enter");
  await expect(page.locator(".ProseMirror:visible")).toBeFocused();
  await page.keyboard.type("The frost wyrm guards the northern pass.");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");

  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "Search pages" });
  await search.fill("wyrm");
  const first = page.getByRole("option").first();
  await expect(first).toContainText("Bestiary");
  await expect(first).toContainText("frost wyrm");
});

test("principles appear above every page", async ({ page }) => {
  await page.getByRole("button", { name: "Edit principles" }).click();
  const dialog = page.getByRole("dialog", { name: "Principles" });
  await dialog.getByRole("button", { name: "Add principle" }).click();
  await dialog.getByRole("textbox", { name: "Principle 1 name" }).fill("Every video teaches one thing");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Principles" })).toContainText("Every video teaches one thing");
  await newPageFromSidebar(page);
  await expect(page.getByRole("region", { name: "Principles" })).toContainText("Every video teaches one thing");
});

test("trash and restore a page with its subpage", async ({ page }) => {
  await newPageFromSidebar(page);
  await page.getByRole("textbox", { name: "Page title" }).fill("Doomed");
  const doomedId = pageIdFrom(page.url());
  await page.getByRole("button", { name: "Add a subpage to “Doomed”" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith(doomedId));
  await page.getByRole("textbox", { name: "Page title" }).fill("Child");
  const tree = page.getByRole("list", { name: "Pages" });
  await expect(tree.getByRole("link", { name: "Child" })).toBeVisible();

  await page.getByRole("button", { name: "Actions for “Doomed”" }).click();
  await page.getByRole("menuitem", { name: "Delete page" }).click();
  await expect(tree.getByRole("link", { name: "Doomed" })).toHaveCount(0);

  await page.getByRole("button", { name: "Trash" }).click();
  const dialog = page.getByRole("dialog", { name: "Trash" });
  await dialog.getByRole("button", { name: "Restore" }).first().click();
  await page.keyboard.press("Escape");
  await expect(tree.getByRole("link", { name: "Doomed" })).toBeVisible();
});

test("workspace ZIP export imports back as new pages", async ({ page }) => {
  await newPageFromSidebar(page);
  await page.getByRole("textbox", { name: "Page title" }).fill("Export me");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");

  await page.getByRole("button", { name: "Import and export" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Export as ZIP (Markdown files)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^pagehut-.*\.zip$/);
  const zipPath = await download.path();

  await page.getByTestId("import-input").setInputFiles({ name: "backup.zip", mimeType: "application/zip", buffer: readFileSync(zipPath) });
  await expect(page.getByText(/pages? imported/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Pages" }).getByRole("link", { name: "Export me" })).toHaveCount(2);
});

test("Markdown import uses the first heading as title", async ({ page }) => {
  await page.getByTestId("import-input").setInputFiles({
    name: "pitch.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Imported pitch\n\nA cozy farming game with **ghosts**.\n"),
  });
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Imported pitch");
  await expect(page.locator(".ProseMirror:visible strong")).toHaveText("ghosts");
});

test("drag a page onto another to nest it", async ({ page }) => {
  await newPageFromSidebar(page);
  await page.getByRole("textbox", { name: "Page title" }).fill("Act One");
  await newPageFromSidebar(page);
  await page.getByRole("textbox", { name: "Page title" }).fill("Opening scene");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");

  const tree = page.getByRole("list", { name: "Pages" });
  const source = tree.locator("li", { has: page.getByRole("link", { name: "Opening scene" }) });
  const target = tree.locator("li", { has: page.getByRole("link", { name: "Act One" }) });
  await source.dragTo(target);

  await expect(page.getByRole("navigation", { name: "Page path" })).toContainText("Act One");
  await expect(tree.getByRole("button", { name: "Collapse" })).toBeVisible();
});

test("general templates: a video script page and a content calendar database", async ({ page }) => {
  await page.getByRole("button", { name: "Templates" }).click();
  const gallery = page.getByRole("dialog", { name: "Templates" });
  await expect(gallery.getByRole("heading", { name: "Content and writing" })).toBeVisible();
  await gallery.getByRole("button", { name: /Video script/ }).click();
  await gallery.getByRole("button", { name: "Use template" }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Video script");
  await expect(page.locator(".ProseMirror:visible").getByRole("heading", { name: "Hook (first 15 seconds)" })).toBeVisible();

  await page.getByRole("button", { name: "Templates" }).click();
  await gallery.getByRole("button", { name: /Content calendar/ }).click();
  await gallery.getByRole("button", { name: "Use template" }).click();
  const db = page.getByRole("region", { name: "Database" });
  await expect(db.getByRole("tab", { name: "Pipeline", selected: true })).toBeVisible();
  await expect(db.getByRole("region", { name: "Scripting" })).toContainText("5 tips for beginners");
});
