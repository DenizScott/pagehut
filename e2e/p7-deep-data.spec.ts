import type { Page } from "@playwright/test";
import { editor, expect, newPage, open, saved, test } from "./deep-guard";

/** Deep tests, part 2: databases in depth, import/export, comments, trash. */

const db = (page: Page) => page.getByRole("region", { name: "Database" });

async function newDatabase(page: Page, title: string) {
  const before = page.url();
  await page.getByRole("button", { name: "New database" }).click();
  await page.waitForURL((u) => u.toString() !== before && u.pathname.includes("/p/"));
  const t = page.getByRole("textbox", { name: "Page title" });
  await expect(t).toBeFocused();
  await t.fill(title);
  await expect(db(page)).toBeVisible();
}

async function addRow(page: Page, name: string) {
  await db(page).getByRole("button", { name: "New", exact: true }).first().click();
  await db(page).getByRole("button", { name: /^Name, Untitled/ }).last().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(db(page).getByRole("button", { name: new RegExp(`^Name, ${name}`) })).toBeVisible();
}

async function addProperty(page: Page, type: string, name: string) {
  await db(page).getByRole("button", { name: "Add a property" }).click();
  await page.getByRole("menuitem", { name: type, exact: true }).click();
  await db(page).getByRole("button", { name: `${type} column options` }).click();
  const nameBox = page.getByRole("textbox", { name: "Property name" });
  await nameBox.fill(name);
  await nameBox.press("Enter");
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("button", { name: `${name} column options` })).toBeVisible();
}

async function typeCell(page: Page, label: RegExp, text: string) {
  await db(page).getByRole("button", { name: label }).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

test("every property type takes a value, survives a reload, changes type and is deleted", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await newDatabase(page, "All types");
  await addRow(page, "Alpha");
  for (const [type, name] of [["Text", "Notes"], ["Number", "Score"], ["Checkbox", "Done"], ["Date", "Due"], ["Link", "Site"], ["Person", "Owner"], ["Multi-select", "Tags"], ["Formula", "Double"]]) {
    await addProperty(page, type, name);
  }
  await typeCell(page, /^Notes, Alpha/, "first note");
  await typeCell(page, /^Score, Alpha/, "21");
  await db(page).getByRole("checkbox", { name: /Done, Alpha/ }).check();
  await db(page).getByRole("button", { name: /^Due, Alpha/ }).click();
  await db(page).locator('input[type="date"]').fill("2026-12-24");
  await db(page).locator('input[type="date"]').press("Enter");
  await typeCell(page, /^Site, Alpha/, "https://example.com");
  await typeCell(page, /^Owner, Alpha/, "octo");
  await db(page).getByRole("button", { name: /^Tags, Alpha/ }).click();
  for (const tag of ["red", "blue"]) {
    await page.getByRole("textbox", { name: "Search or create an option" }).fill(tag);
    await page.getByRole("textbox", { name: "Search or create an option" }).press("Enter");
  }
  await page.keyboard.press("Escape");
  await db(page).getByRole("button", { name: "Double column options" }).click();
  await page.getByRole("textbox", { name: "Formula" }).fill("{Score} * 2");
  await page.getByRole("textbox", { name: "Formula" }).press("Enter");
  await page.keyboard.press("Escape");
  await expect(db(page).getByLabel("Double, Alpha")).toHaveText("42");
  await saved(page);

  await page.reload();
  await expect(db(page).getByLabel("Double, Alpha")).toHaveText("42");
  await expect(db(page).getByRole("checkbox", { name: /Done, Alpha/ })).toBeChecked();
  await expect(db(page).getByRole("button", { name: /^Tags, Alpha/ })).toContainText("red");
  await expect(db(page).getByRole("button", { name: /^Due, Alpha/ })).toContainText("2026");

  // A formula referring to a missing property explains itself instead of breaking.
  await db(page).getByRole("button", { name: "Double column options" }).click();
  await page.getByRole("textbox", { name: "Formula" }).fill("{Missing} + 1");
  await page.getByRole("textbox", { name: "Formula" }).press("Enter");
  await expect(page.getByText(/This formula doesn’t work/)).toBeVisible();
  await page.keyboard.press("Escape");

  // Number → Text keeps the value as text; then delete the property.
  await db(page).getByRole("button", { name: "Score column options" }).click();
  await page.getByRole("combobox", { name: "Type" }).selectOption({ label: "Text" });
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("button", { name: /^Score, Alpha/ })).toContainText("21");
  await db(page).getByRole("button", { name: "Score column options" }).click();
  await page.getByRole("button", { name: "Delete property" }).click();
  await page.getByRole("button", { name: "Delete it and its values?" }).click();
  await expect(db(page).getByRole("button", { name: "Score column options" })).toHaveCount(0);
  await saved(page);
});

test("a relation links rows of two databases", async ({ page }) => {
  await open(page);
  await newDatabase(page, "Enemies");
  await addRow(page, "Slime");
  await addRow(page, "Golem");
  await saved(page);
  await newDatabase(page, "Levels");
  await addRow(page, "Forest");
  await addProperty(page, "Relation", "Has enemies");
  await db(page).getByRole("button", { name: "Has enemies column options" }).click();
  await page.getByRole("combobox", { name: "Links to" }).selectOption({ label: "Enemies" });
  await page.keyboard.press("Escape");
  await db(page).getByRole("button", { name: /^Has enemies, Forest/ }).click();
  await page.getByRole("listbox", { name: /Has enemies, Forest/ }).getByRole("option", { name: /Golem/ }).click();
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("button", { name: /^Has enemies, Forest/ })).toContainText("Golem");
  await saved(page);
  await page.reload();
  await expect(db(page).getByRole("button", { name: /^Has enemies, Forest/ })).toContainText("Golem");
});

test("views are renamed and deleted; rows are duplicated and deleted", async ({ page }) => {
  await open(page);
  await newDatabase(page, "Views");
  await addRow(page, "One");
  await db(page).getByRole("button", { name: "Add a view" }).click();
  await page.getByRole("menuitem", { name: "Gallery" }).click();
  await expect(db(page).getByRole("tab", { name: "Gallery", selected: true })).toBeVisible();
  await db(page).getByRole("tab", { name: "Gallery" }).dblclick();
  await page.getByRole("textbox", { name: "Rename view" }).fill("Cards");
  await page.getByRole("textbox", { name: "Rename view" }).press("Enter");
  await expect(db(page).getByRole("tab", { name: "Cards" })).toBeVisible();
  await db(page).getByRole("button", { name: "Properties" }).click();
  await page.getByRole("button", { name: "Delete view" }).click();
  await expect(db(page).getByRole("tab", { name: "Cards" })).toHaveCount(0);

  await db(page).getByRole("tab", { name: "Table" }).click();
  await db(page).locator("tbody tr").first().hover();
  await db(page).getByRole("button", { name: "Actions for One" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(db(page).locator("tbody tr")).toHaveCount(2);
  await db(page).locator("tbody tr").first().hover();
  await db(page).getByRole("button", { name: "Actions for One" }).first().click();
  await page.getByRole("menuitem", { name: "Delete row" }).click();
  await expect(db(page).locator("tbody tr")).toHaveCount(1);
  await saved(page);
});

test("JSON backup imports back; a CSV becomes a database; Markdown export has front matter", async ({ page }) => {
  await open(page);
  await newPage(page, "Backup me");
  await page.keyboard.type("content for the backup");
  await saved(page);

  await page.getByRole("button", { name: "Import and export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export as JSON (full backup)" }).click();
  const json = { name: "backup.json", mimeType: "application/json", buffer: (await import("node:fs")).readFileSync(await (await download).path()) };
  const pagesBefore = await page.getByRole("list", { name: "Pages" }).getByRole("link").count();
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles(json);
  await expect(page.getByText(/pages? imported/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Pages" }).getByRole("link")).toHaveCount(pagesBefore * 2);

  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({
    name: "Channel stats.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Video,Views,Published\nIntro,1200,2026-10-01\nTips,800,2026-10-15\n"),
  });
  await expect(page.getByText("1 page imported")).toBeVisible();
  await page.getByRole("list", { name: "Pages" }).getByRole("link", { name: "Channel stats" }).click();
  await expect(db(page).locator("tbody tr")).toHaveCount(2);

  await page.getByRole("list", { name: "Pages" }).getByRole("link", { name: "Backup me" }).first().click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Backup me");
  await page.getByRole("button", { name: "Page actions" }).click();
  const md = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export page as Markdown" }).click();
  const file = await md;
  expect(file.suggestedFilename()).toBe("backup-me.md");
  const text = (await import("node:fs")).readFileSync(await file.path(), "utf8");
  expect(text).toMatch(/^---\nid: /);
  expect(text).toContain('title: "Backup me"');
  expect(text).toContain("content for the backup");
});

test("a comment can be edited and deleted", async ({ page }) => {
  await open(page);
  await newPage(page, "Commented");
  await page.keyboard.type("Some text");
  await page.getByRole("button", { name: "Comments" }).click();
  const panel = page.getByRole("complementary", { name: "Comments" });
  await panel.getByRole("combobox", { name: "Comment on this page…" }).fill("First version");
  await page.keyboard.press("ControlOrMeta+Enter");
  const thread = panel.getByRole("article", { name: "Page comment" });
  await expect(thread).toContainText("First version");
  await thread.hover();
  await thread.getByRole("button", { name: "Comment actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const box = thread.getByRole("combobox").first();
  await box.fill("Second version");
  await thread.getByRole("button", { name: "Save" }).click();
  await expect(thread).toContainText("Second version");
  await expect(thread).toContainText("edited");
  await thread.hover();
  await thread.getByRole("button", { name: "Comment actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(panel.getByRole("article")).toHaveCount(0);
  await saved(page);
});

test("a deleted database comes back from the trash with its rows", async ({ page }) => {
  await open(page);
  await newDatabase(page, "Keep me");
  await addRow(page, "Row A");
  await saved(page);
  await page.getByRole("button", { name: "Page actions" }).click();
  await page.getByRole("menuitem", { name: /Delete page|Move to trash/ }).click();
  await expect(page.getByRole("list", { name: "Pages" }).getByRole("link", { name: "Keep me" })).toHaveCount(0);
  await page.getByRole("button", { name: "Trash" }).click();
  const trash = page.getByRole("dialog", { name: "Trash" });
  await trash.getByRole("button", { name: "Restore" }).first().click();
  await page.keyboard.press("Escape");
  await page.getByRole("list", { name: "Pages" }).getByRole("link", { name: "Keep me" }).click();
  await expect(db(page).getByRole("button", { name: /^Name, Row A/ })).toBeVisible();
  await expect(editor(page)).toHaveCount(0);
});
