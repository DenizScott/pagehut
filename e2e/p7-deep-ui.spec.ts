import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import type { Page } from "@playwright/test";
import { editor, expect, L, newPage, open, saved, test, type Lang } from "./deep-guard";

/** Deep tests, part 3: phone layout, themes, languages, accessibility, keyboard. */

/** Fails when the page can be scrolled sideways (content wider than the screen). */
async function noSidewaysScroll(page: Page, where: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `${where}: page is ${over}px wider than the screen`).toBeLessThanOrEqual(1);
}

test("phone: no screen scrolls sideways @mobile", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await noSidewaysScroll(page, "page");
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await noSidewaysScroll(page, "sidebar");
  await page.getByRole("button", { name: "Templates" }).click();
  const gallery = page.getByRole("dialog", { name: "Templates" });
  await expect(gallery).toBeVisible();
  await noSidewaysScroll(page, "templates");
  await gallery.getByRole("button", { name: /Task tracker/ }).click();
  await gallery.getByRole("button", { name: "Use template" }).click();
  const db = page.getByRole("region", { name: "Database" });
  await expect(db).toBeVisible();
  for (let i = 0; i < (await db.getByRole("tab").count()); i++) {
    await db.getByRole("tab").nth(i).click();
    await noSidewaysScroll(page, `database view ${i}`);
  }
  await db.getByRole("button", { name: /automation/i }).click();
  await expect(page.getByRole("dialog", { name: "Automations" })).toBeVisible();
  await noSidewaysScroll(page, "automations");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await noSidewaysScroll(page, "comments");
  await page.getByRole("button", { name: "Close comments" }).click();
  await page.keyboard.press("ControlOrMeta+k");
  await noSidewaysScroll(page, "search");
});

test("the theme choice survives a reload", async ({ page }) => {
  await open(page);
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

function flatten(obj: Record<string, unknown>, out: string[] = []): string[] {
  for (const v of Object.values(obj)) {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") flatten(v as Record<string, unknown>, out);
  }
  return out;
}
const strings = (lang: Lang) =>
  new Set(["common", "editor", "slash", "database"].flatMap((n) => flatten(JSON.parse(fs.readFileSync(`locales/${lang}/${n}.json`, "utf8")))));

for (const [from, to] of [["en", "de"], ["tr", "en"]] as [Lang, Lang][]) {
  test(`switching ${from} → ${to} leaves no ${from} interface text`, async ({ page }) => {
    const old = strings(from);
    const now = strings(to);
    const only = [...old].filter((s) => !now.has(s) && !/[{}<>]/.test(s) && s.length >= 4);
    await open(page, from);
    await page.getByRole("button", { name: L[from].tpl, exact: true }).first().click();
    const gallery = page.getByRole("dialog", { name: L[from].tpl });
    await gallery.locator("button[aria-pressed]").nth(6).click(); // first database template
    await gallery.getByRole("button", { name: L[from].use }).click();
    await expect(page.getByRole("region", { name: L[from].db })).toBeVisible();
    await page.getByRole("combobox", { name: /^(Language|Dil|Sprache)$/ }).selectOption(to);
    await page.waitForURL(new RegExp(`/${to}/p/`));
    await expect(page.getByRole("button", { name: L[to].tpl, exact: true }).first()).toBeVisible();
    await page.waitForTimeout(500);
    const text = await page.evaluate(() => {
      const skip = (el: Element) => el.closest(".ProseMirror, textarea, input, .lk-database > :not(:first-child)");
      const out: string[] = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const el = (w.currentNode as Text).parentElement;
        if (el && !skip(el) && el.checkVisibility()) out.push((w.currentNode as Text).data.trim());
      }
      for (const el of document.querySelectorAll("[aria-label],[title],[placeholder]"))
        if (!skip(el) && el.checkVisibility()) for (const a of ["aria-label", "title", "placeholder"]) out.push(el.getAttribute(a) ?? "");
      return out.filter(Boolean);
    });
    // Whole lines, or the start of a line for phrases (a single word like "Import" may begin a
    // legitimate line in the new language, e.g. German "Import und Export").
    expect(only.filter((s) => text.some((line) => line === s || (s.includes(" ") && line.startsWith(`${s} `))))).toEqual([]);
  });
}

test("accessibility of the deeper screens (axe)", async ({ page }) => {
  test.setTimeout(120_000);
  const scan = async (label: string) => {
    await page.waitForTimeout(200);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`), label).toEqual([]);
  };
  await open(page);
  await newPage(page, "A11y");
  await page.keyboard.type("Text to comment on");
  await page.getByRole("button", { name: "Comments" }).click();
  await page.getByRole("complementary", { name: "Comments" }).getByRole("combobox", { name: "Comment on this page…" }).fill("A thread");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("article", { name: "Page comment" })).toBeVisible();
  await scan("comment thread");
  await page.getByRole("button", { name: "Close comments" }).click();

  await page.getByRole("button", { name: "Templates" }).click();
  await page.getByRole("dialog", { name: "Templates" }).getByRole("button", { name: /Task tracker/ }).click();
  await page.getByRole("dialog", { name: "Templates" }).getByRole("button", { name: "Use template" }).click();
  const db = page.getByRole("region", { name: "Database" });
  await db.getByRole("button", { name: /automation/i }).click();
  await scan("automations dialog with a rule");
  await page.keyboard.press("Escape");
  await db.getByRole("tab", { name: "Table" }).click();
  await db.locator("tbody tr").first().hover();
  await db.getByRole("button", { name: /^Open / }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan("row dialog");
  await page.keyboard.press("Escape");
  await db.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("button", { name: "Add a filter" }).click();
  await scan("filter popover");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Import and export" }).click();
  await scan("import/export menu");
  await page.keyboard.press("Escape");
});

test("keyboard only: skip link, menus, dialogs return focus", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  // Templates dialog opens from the keyboard and gives focus back when closed.
  const trigger = page.getByRole("button", { name: "Templates" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Templates" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  // The import/export menu works with arrow keys and Escape.
  const menu = page.getByRole("button", { name: "Import and export" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();

  // A page in the tree opens with Enter.
  await newPage(page, "Keyboard page");
  await saved(page);
  const link = page.getByRole("list", { name: "Pages" }).getByRole("link").first();
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(editor(page)).toBeVisible();
});
