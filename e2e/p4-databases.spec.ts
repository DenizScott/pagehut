import { expect, test, type Page } from "@playwright/test";
import { FakeGitHub } from "../src/lib/github/fake-github";

/** Databases through the real UI: table, properties, formula, filter, board and gallery. */

const db = (page: Page) => page.getByRole("region", { name: "Database" });

async function newDatabase(page: Page, title: string) {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: "New database" }).click();
  await page.waitForURL(/\/p\//);
  const titleBox = page.getByRole("textbox", { name: "Page title" });
  await expect(titleBox).toBeFocused();
  await page.keyboard.type(title);
}

/** Types into the cell that has the given accessible label (click, type, Enter). */
async function typeCell(page: Page, label: string | RegExp, text: string) {
  await db(page).getByRole("button", { name: label }).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

test("build a weapons table with a select, numbers and a formula; filter and sort it", async ({ page }) => {
  await newDatabase(page, "Weapons");
  await expect(page.getByRole("tree").or(page.getByRole("list", { name: "Pages" })).getByRole("link", { name: "Weapons" })).toBeVisible();

  // Three rows.
  for (const name of ["Sword", "Bow", "Spear"]) {
    await db(page).getByRole("button", { name: "New", exact: true }).first().click();
    await typeCell(page, /^Name, Untitled/, name);
  }
  await expect(db(page).getByText("3 rows")).toBeVisible();

  // Properties: Damage (number), Rate (number), DPS (formula), Status (select).
  const addProp = async (type: string, name: string) => {
    await db(page).getByRole("button", { name: "Add a property" }).click();
    await page.getByRole("menuitem", { name: type, exact: true }).click();
    await db(page).getByRole("button", { name: `${type} column options` }).click();
    const nameBox = page.getByRole("textbox", { name: "Property name" });
    await nameBox.fill(name);
    await nameBox.press("Enter");
    await page.keyboard.press("Escape");
  };
  await addProp("Number", "Damage");
  await addProp("Number", "Rate");
  await addProp("Formula", "DPS");
  await db(page).getByRole("button", { name: "DPS column options" }).click();
  await page.getByRole("textbox", { name: "Formula" }).fill("{Damage} * {Rate}");
  await page.getByRole("textbox", { name: "Formula" }).press("Enter");
  await page.keyboard.press("Escape");

  const values: Record<string, [string, string]> = { Sword: ["10", "1.5"], Bow: ["6", "2"], Spear: ["8", "1"] };
  for (const [name, [dmg, rate]] of Object.entries(values)) {
    await typeCell(page, new RegExp(`^Damage, ${name}`), dmg);
    await typeCell(page, new RegExp(`^Rate, ${name}`), rate);
  }
  await expect(db(page).getByLabel("DPS, Sword")).toHaveText("15");
  await expect(db(page).getByLabel("DPS, Bow")).toHaveText("12");

  // A select with options created while typing.
  await addProp("Select", "Status");
  for (const [name, status] of [["Sword", "Done"], ["Bow", "To do"], ["Spear", "Done"]]) {
    await db(page).getByRole("button", { name: `Status, ${name}` }).click();
    await page.getByRole("textbox", { name: "Search or create an option" }).fill(status);
    await page.getByRole("textbox", { name: "Search or create an option" }).press("Enter");
    await page.keyboard.press("Escape");
  }
  await expect(db(page).getByRole("button", { name: "Status, Bow" })).toContainText("To do");

  // Sort by DPS, descending (from the column menu).
  await db(page).getByRole("button", { name: "DPS column options" }).click();
  await page.getByRole("button", { name: "Sort descending" }).click();
  const titles = db(page).locator("tbody tr td:first-child");
  await expect(titles).toHaveText(["Sword", "Bow", "Spear"]);

  // Filter: Status is Done.
  await db(page).getByRole("button", { name: "Filter" }).click();
  await page.getByRole("button", { name: "Add a filter" }).click();
  await page.getByRole("combobox", { name: "Property" }).selectOption({ label: "Status" });
  await page.getByRole("combobox", { name: "Value" }).selectOption({ label: "Done" });
  await page.keyboard.press("Escape");
  await expect(titles).toHaveText(["Sword", "Spear"]);
  await expect(db(page).getByRole("button", { name: "1 filter" })).toBeVisible();

  // Survives a reload (saved locally).
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");
  await page.reload();
  await expect(titles).toHaveText(["Sword", "Spear"]);
  await expect(db(page).getByLabel("DPS, Sword")).toHaveText("15");

  // Search finds rows by their text.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("dialog").getByRole("combobox").fill("spear");
  await expect(page.getByRole("option", { name: /Weapons/ })).toBeVisible();
});

test("a board groups rows by status and moving a card changes it", async ({ page }) => {
  await newDatabase(page, "Scope");
  await db(page).getByRole("button", { name: "New", exact: true }).first().click();
  await typeCell(page, /^Name, Untitled/, "Grappling hook");

  await db(page).getByRole("button", { name: "Add a property" }).click();
  await page.getByRole("menuitem", { name: "Select", exact: true }).click();
  for (const status of ["Must", "Could"]) {
    await db(page).getByRole("button", { name: "Select, Grappling hook" }).click();
    await page.getByRole("textbox", { name: "Search or create an option" }).fill(status);
    await page.getByRole("textbox", { name: "Search or create an option" }).press("Enter");
    await page.keyboard.press("Escape");
  }
  // Last choice wins for a single select.
  await expect(db(page).getByRole("button", { name: "Select, Grappling hook" })).toHaveText("Could");

  await db(page).getByRole("button", { name: "Add a view" }).click();
  await page.getByRole("menuitem", { name: "Board" }).click();
  await expect(db(page).getByRole("tab", { name: "Board", selected: true })).toBeVisible();
  const must = db(page).getByRole("region", { name: "Must" });
  const could = db(page).getByRole("region", { name: "Could" });
  await expect(could.getByRole("button", { name: /Grappling hook/ })).toBeVisible();

  await could.getByRole("button", { name: /Grappling hook/ }).dragTo(must);
  await expect(must.getByRole("button", { name: /Grappling hook/ })).toBeVisible();

  // New card in a column gets that column's value and opens for editing.
  await must.getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "Untitled" });
  await dialog.getByRole("button", { name: /^Name:/ }).click();
  await page.keyboard.type("Double jump");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(must.getByRole("button", { name: /Double jump/ })).toBeVisible();

  // Back in the table both are "Must".
  await db(page).getByRole("tab", { name: "Table" }).click();
  await expect(db(page).getByRole("button", { name: "Select, Double jump" })).toHaveText("Must");
});

test("a game template creates a working database that syncs with teammates", async ({ browser }) => {
  test.setTimeout(60_000);
  const gh = new FakeGitHub();
  gh.addRepo("team", "game", { files: { "Assets/Scripts/Player.cs": "class Player {}", "ProjectSettings/ProjectVersion.txt": "6000.0" } });
  const ctx = await browser.newContext();
  await ctx.route("**/api/auth/status", (r) => r.fulfill({ json: { configured: true, appSlug: "pagehut-test" } }));
  await ctx.route("**/api/auth/token", (r) => r.fulfill({ json: { accessToken: "ghu_e2e", expiresAt: Date.now() + 8 * 3600_000 } }));
  await ctx.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    const res = await gh.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
    await route.fulfill({ status: res.status, body: await res.text(), headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  });
  const page = await ctx.newPage();
  await page.goto("/en");
  await page.waitForURL(/\/p\//);

  // Template gallery → Playtest log.
  await page.getByRole("button", { name: "Templates" }).click();
  const gallery = page.getByRole("dialog", { name: "GDD templates" });
  await gallery.getByRole("button", { name: /Playtest log/ }).click();
  await expect(gallery.getByRole("complementary")).toContainText("Fun (1–5)");
  await gallery.getByRole("button", { name: "Use template" }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Playtest log");
  await expect(db(page).locator("tbody tr")).toHaveCount(2);
  // The "Open issues" view hides fixed sessions.
  await db(page).getByRole("tab", { name: "Open issues" }).click();
  await expect(db(page).locator("tbody tr")).toHaveCount(1);
  await db(page).getByRole("tab", { name: "Table" }).click();

  // Save the workspace to GitHub.
  await page.getByRole("button", { name: /Local mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save this workspace to GitHub" });
  await dialog.getByRole("radio", { name: "team/game" }).click();
  await dialog.getByRole("button", { name: "Save to repository" }).click();
  await expect(page.getByText("Workspace saved to team/game")).toBeVisible();
  const dbId = page.url().split("/p/")[1];
  const path = `GDD/pages/${dbId}.md`;
  expect(gh.files("team/game")[path]).toContain("| Session | Date | Build |");

  // A teammate adds a session on GitHub (another PageHut, same file format)…
  const file = gh.files("team/game")[path];
  const teammateRow = JSON.stringify({ row: { id: "01ZZZZZZZZZZZZZZZZZZZZZZZZ", order: 9, cells: { title: "Session 3 (Ada)", fun: 5 } } });
  gh.commit("team/game", { [path]: file.replace("\n```\n", `\n${teammateRow}\n\`\`\`\n`) }, "Ada logs a playtest");
  // …while I add one here.
  await db(page).getByRole("button", { name: "New", exact: true }).first().click();
  await typeCell(page, /^Session, Untitled/, "Session 3 (me)");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");

  // After a pause, sync merges both rows (no conflict) and pushes the result.
  await page.waitForTimeout(9_000);
  const sync = page.locator("[data-sync-state]:visible");
  await sync.click();
  await expect(sync).toHaveAttribute("data-sync-state", "synced");
  await expect(db(page).locator("tbody tr")).toHaveCount(4);
  await expect(db(page)).toContainText("Session 3 (Ada)");
  await expect(db(page)).toContainText("Session 3 (me)");
  const pushed = gh.files("team/game")[path];
  expect(pushed).toContain("Session 3 (Ada)");
  expect(pushed).toContain("Session 3 (me)");
  await ctx.close();
});

test("chart and form views; the whole workspace prints as one document", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: "Templates" }).click();
  const gallery = page.getByRole("dialog", { name: "GDD templates" });
  await gallery.getByRole("button", { name: /Scope tracker/ }).click();
  await gallery.getByRole("button", { name: "Use template" }).click();
  await db(page).getByRole("tab", { name: "Table" }).click();
  await expect(db(page).locator("tbody tr")).toHaveCount(4);

  // Chart: bars by Priority, then the sum of the estimate.
  await db(page).getByRole("button", { name: "Add a view" }).click();
  await page.getByRole("menuitem", { name: "Chart" }).click();
  const chart = db(page).getByRole("figure", { name: "Number of rows by Priority" });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole("listitem").filter({ hasText: "Must" })).toBeVisible();
  await db(page).getByRole("button", { name: "Properties" }).click();
  await page.getByRole("combobox", { name: "Value" }).selectOption({ label: "Estimate (days)" });
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("figure", { name: "Sum of Estimate (days) by Priority" })).toBeVisible();

  // Form: each send adds a row.
  await db(page).getByRole("button", { name: "Add a view" }).click();
  await page.getByRole("menuitem", { name: "Form" }).click();
  const form = db(page).getByRole("form", { name: "Form: Form" });
  await expect(form.getByRole("button", { name: "Send" })).toBeDisabled();
  await form.getByRole("button", { name: "Feature" }).click();
  await page.keyboard.type("Photo mode filters");
  await page.keyboard.press("Enter");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("status")).toHaveText("Sent. 1 entry added.");
  await db(page).getByRole("tab", { name: "Table" }).click();
  await expect(db(page).locator("tbody tr")).toHaveCount(5);
  await expect(db(page).locator("tbody")).toContainText("Photo mode filters");

  // Print everything: one document, every page on its own sheet.
  await expect(page.getByRole("status", { name: "Save status" })).toHaveAttribute("data-save-state", "saved");
  await page.evaluate(() => {
    window.print = () => {}; // no dialog in tests
  });
  await page.getByRole("button", { name: "Import and export" }).click();
  await page.getByRole("menuitem", { name: "Print or save everything as PDF" }).click();
  const doc = page.locator("iframe[srcdoc]");
  await expect(doc).toHaveCount(1);
  const srcdoc = await doc.getAttribute("srcdoc");
  expect(srcdoc).toContain("Scope tracker");
  expect(srcdoc).toContain("Photo mode filters");
  expect(srcdoc).toContain("Welcome to PageHut");
});

test("timeline and calendar place rows by their dates", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: "Templates" }).click();
  const gallery = page.getByRole("dialog", { name: "GDD templates" });
  await gallery.getByRole("button", { name: /Production schedule/ }).click();
  await gallery.getByRole("button", { name: "Use template" }).click();

  // The one-line title stays one line high (it used to be measured before layout and stay huge).
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Production schedule");
  expect((await page.getByRole("textbox", { name: "Page title" }).boundingBox())!.height).toBeLessThan(120);

  // Timeline: one bar per milestone; each bar's name carries its dates.
  const timeline = db(page).getByRole("list", { name: "Timeline: Timeline" });
  await expect(timeline.getByRole("listitem")).toHaveCount(4);
  await timeline.getByRole("button", { name: /^Prototype, .+ to .+/ }).click();
  await expect(page.getByRole("dialog", { name: "Prototype" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Calendar (by end date): add a row today from its day cell.
  await db(page).getByRole("tab", { name: "Calendar" }).click();
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  await db(page).getByRole("button", { name: `Add a row on ${label}` }).click();
  const row = page.getByRole("dialog", { name: "Untitled" });
  await row.getByRole("button", { name: "Milestone" }).click();
  await page.keyboard.type("Art lock");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("cell", { name: label })).toContainText("Art lock");
});

test("an automation fills in a date when the status changes", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await page.getByRole("button", { name: "Templates" }).click();
  const gallery = page.getByRole("dialog", { name: "GDD templates" });
  await gallery.getByRole("button", { name: /Production schedule/ }).click();
  await gallery.getByRole("button", { name: "Use template" }).click();
  await db(page).getByRole("tab", { name: "Table" }).click();

  // When Status becomes Done, set End to today.
  await db(page).getByRole("button", { name: "Automations" }).click();
  const dialog = page.getByRole("dialog", { name: "Automations" });
  await dialog.getByRole("combobox", { name: "Value that triggers it" }).selectOption({ label: "Done" });
  await dialog.getByRole("combobox", { name: "Property to set" }).selectOption({ label: "End" });
  await expect(dialog.getByRole("combobox", { name: "Value to set" })).toHaveValue("today");
  await dialog.getByRole("button", { name: "Add automation" }).click();
  await expect(dialog.getByRole("list", { name: "Automations of this database" })).toContainText("When Status becomes Done, set End to today");
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("button", { name: "1 automation" })).toBeVisible();

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  await expect(db(page).getByRole("button", { name: "End, Alpha" })).not.toHaveText(today);
  await db(page).getByRole("button", { name: "Status, Alpha" }).click();
  await page.getByRole("textbox", { name: "Search or create an option" }).fill("Done");
  await page.getByRole("textbox", { name: "Search or create an option" }).press("Enter");
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("button", { name: "Status, Alpha" })).toHaveText("Done");
  await expect(db(page).getByRole("button", { name: "End, Alpha" })).toHaveText(today);

  // Paused rules don't run.
  await db(page).getByRole("button", { name: "1 automation" }).click();
  await page.getByRole("dialog", { name: "Automations" }).getByRole("checkbox").uncheck();
  await page.keyboard.press("Escape");
  await expect(db(page).getByRole("button", { name: "Automations" })).toBeVisible();
});
