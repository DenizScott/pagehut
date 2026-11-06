import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility: axe (WCAG 2.2 A/AA) over the main screens, in light and dark themes.
 * Each screen is opened through the real UI, then the whole page is scanned.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page, label: string) {
  // Let theme and dialog transitions settle so colors are final.
  await page.waitForTimeout(250);
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 6).map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n").slice(1).join(" ").trim() ?? ""}`),
  }));
  expect(summary, `${label}: axe violations`).toEqual([]);
}

async function openApp(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  await expect(page.locator(".ProseMirror:visible")).toBeVisible();
}

async function useTemplate(page: Page, name: string) {
  await page.getByRole("button", { name: "Templates" }).click();
  const gallery = page.getByRole("dialog", { name: "GDD templates" });
  await gallery.getByRole("button", { name: new RegExp(name) }).click();
  await gallery.getByRole("button", { name: "Use template" }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(name);
}

for (const theme of ["light", "dark"] as const) {
  test(`axe: main screens (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await openApp(page, theme);
    await scan(page, "page");

    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.type("core");
    await scan(page, "search");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Templates" }).click();
    await expect(page.getByRole("dialog", { name: "GDD templates" })).toBeVisible();
    await scan(page, "templates");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Comments" }).click();
    await expect(page.getByRole("complementary", { name: "Comments" })).toBeVisible();
    await scan(page, "comments");
    await page.getByRole("button", { name: "Close comments" }).click();

    await useTemplate(page, "Scope tracker");
    const db = page.getByRole("region", { name: "Database" });
    await scan(page, "database table");
    await db.getByRole("tab", { name: "By status" }).click();
    await scan(page, "database board");
    for (const type of ["Chart", "Form"]) {
      await db.getByRole("button", { name: "Add a view" }).click();
      await page.getByRole("menuitem", { name: type }).click();
      await scan(page, `database ${type.toLowerCase()}`);
    }

    await useTemplate(page, "Mood board");
    await scan(page, "database gallery");

    await useTemplate(page, "Production schedule");
    await scan(page, "database timeline");
    await page.getByRole("region", { name: "Database" }).getByRole("tab", { name: "Calendar" }).click();
    await scan(page, "database calendar");
    await page.getByRole("region", { name: "Database" }).getByRole("button", { name: "Automations" }).click();
    await expect(page.getByRole("dialog", { name: "Automations" })).toBeVisible();
    await scan(page, "automations dialog");
    await page.keyboard.press("Escape");
  });
}

test("axe: GitHub and trash dialogs", async ({ page }) => {
  await openApp(page, "light");
  await page.getByRole("button", { name: /Local mode/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan(page, "github dialog");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Trash" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan(page, "trash");
  await page.keyboard.press("Escape");
});

test("axe: mobile layout @mobile", async ({ page }) => {
  await openApp(page, "light");
  await scan(page, "mobile page");
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await scan(page, "mobile sidebar");
});

test("typing right after Ctrl+K goes into search, not the page", async ({ page }) => {
  await openApp(page, "light");
  await page.locator(".ProseMirror:visible").click();
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("zqxv");
  await expect(page.getByRole("dialog").getByRole("combobox")).toHaveValue("zqxv");
  await expect(page.locator(".ProseMirror:visible")).not.toContainText("zqxv");
});
