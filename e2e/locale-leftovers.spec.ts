import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Switching the language must not leave interface text in the old language. Collects every English
 * UI string (from locales/en) that differs from its Turkish counterpart, switches en → tr, opens the
 * main screens, and fails if any of those English strings is still on screen outside user content.
 */

function flatten(obj: Record<string, unknown>, out: string[] = []): string[] {
  for (const v of Object.values(obj)) {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") flatten(v as Record<string, unknown>, out);
  }
  return out;
}

const namespaces = ["common", "editor", "slash", "database"];
const en = new Set(namespaces.flatMap((n) => flatten(JSON.parse(fs.readFileSync(`locales/en/${n}.json`, "utf8")))));
const tr = new Set(namespaces.flatMap((n) => flatten(JSON.parse(fs.readFileSync(`locales/tr/${n}.json`, "utf8")))));
// Only plain, distinctive UI strings: no placeholders, not shared with Turkish, not too short.
const englishOnly = [...en].filter((s) => !tr.has(s) && !/[{}<>]/.test(s) && s.length >= 4 && !/^[A-Z0-9 .:/-]+$/.test(s));

/** Visible text of the interface, without user content (page text, titles, database cells). */
async function chromeText(page: Page): Promise<string> {
  return page.evaluate(() => {
    // User content: page text, titles, and the database body (rows, cards); its toolbar and view tabs are interface.
    const skip = (el: Element) => el.closest(".ProseMirror, textarea, input, [data-user-content], .lk-database > :not(:first-child)");
    const parts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode as Text;
      const el = n.parentElement;
      if (!el || skip(el) || !el.checkVisibility?.()) continue;
      const t = n.data.trim();
      if (t) parts.push(t);
    }
    for (const el of document.querySelectorAll("[aria-label], [title], [placeholder]")) {
      if (skip(el) || !el.checkVisibility?.()) continue;
      for (const a of ["aria-label", "title", "placeholder"]) {
        const v = el.getAttribute(a);
        if (v) parts.push(v);
      }
    }
    return parts.join("\n");
  });
}

const leftovers = (text: string) => englishOnly.filter((s) => text.split("\n").some((line) => line === s || line.startsWith(`${s} `)));

test("switching to Turkish leaves no English interface text", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/en\/p\//);
  await expect(page.locator(".ProseMirror:visible")).toBeVisible();

  // Use the app a little in English first (dialogs and a database load their code).
  await page.getByRole("button", { name: "Templates" }).click();
  await page.getByRole("dialog", { name: "Templates" }).getByRole("button", { name: /Task tracker/ }).click();
  await page.getByRole("dialog", { name: "Templates" }).getByRole("button", { name: "Use template" }).click();
  await expect(page.getByRole("region", { name: "Database" })).toBeVisible();

  await page.getByRole("combobox", { name: "Language" }).selectOption("tr");
  await page.waitForURL(/\/tr\/p\//);
  await expect(page.getByRole("button", { name: "Şablonlar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Çalışma alanım/ }).first()).toBeVisible();

  const found = new Set<string>(leftovers(await chromeText(page)));
  await page.getByRole("button", { name: "Şablonlar" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (const s of leftovers(await chromeText(page))) found.add(s);
  await page.keyboard.press("Escape");

  // The untouched welcome page and workspace name follow the language.
  const welcome = page.getByRole("list", { name: "Sayfalar" }).getByRole("link", { name: "PageHut uygulamasına hoş geldin" });
  await expect(welcome).toBeVisible();
  await welcome.click();
  await expect(page.locator(".ProseMirror:visible")).toContainText("yazdığın ve planladığın her şey");
  await expect(page.getByRole("button", { name: /Çalışma alanım/ }).first()).toBeVisible();

  expect(found ? [...found] : []).toEqual([]);
});
