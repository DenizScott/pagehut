import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared fixture for the deep tests: every console error, failed request to our own origin and
 * uncaught exception fails the test, so a flow that "works" but logs errors is still caught.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use, info) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
      });
      page.on("pageerror", (e) => errors.push(`exception: ${String(e).slice(0, 300)}`));
      page.on("response", (r) => {
        const url = new URL(r.url());
        if (url.hostname === "localhost" && r.status() >= 500) errors.push(`server ${r.status()}: ${url.pathname}`);
      });
      await use(errors);
      if (info.status === info.expectedStatus) expect(errors, "console errors, exceptions or server errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const L = {
  en: { tpl: "Templates", use: "Use template", newPage: "New page", title: "Page title", db: "Database" },
  tr: { tpl: "Şablonlar", use: "Şablonu kullan", newPage: "Yeni sayfa", title: "Sayfa başlığı", db: "Veritabanı" },
  de: { tpl: "Vorlagen", use: "Vorlage verwenden", newPage: "Neue Seite", title: "Seitentitel", db: "Datenbank" },
} as const;
export type Lang = keyof typeof L;

export const editor = (page: Page) => page.locator(".ProseMirror:visible");

export async function open(page: Page, lang: Lang = "en") {
  await page.goto(`/${lang}`);
  await page.waitForURL(new RegExp(`/${lang}/p/`));
  await expect(editor(page)).toBeVisible();
}

/** A fresh empty page with a title; the cursor ends up in the editor. */
export async function newPage(page: Page, title: string, lang: Lang = "en") {
  const before = page.url();
  await page.getByRole("button", { name: L[lang].newPage }).first().click();
  await page.waitForURL((u) => u.toString() !== before && u.pathname.includes("/p/"));
  const t = page.getByRole("textbox", { name: L[lang].title });
  await expect(t).toBeFocused();
  await expect(t).toHaveValue("");
  await t.fill(title);
  await t.press("Enter");
  await expect(editor(page)).toBeFocused();
}

export async function saved(page: Page) {
  await expect(page.locator("[data-save-state]:visible").first()).toHaveAttribute("data-save-state", "saved");
}
