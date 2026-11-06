import { expect, test, type Page } from "@playwright/test";

/** Reads one page record straight from IndexedDB (what sync/export will see). */
async function storedPage(page: Page, id: string) {
  return page.evaluate(async (pageId) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("pagehut");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rec = await new Promise<{ title: string; markdown: string }>((res) => {
      const t = db.transaction("pages").objectStore("pages").get(pageId);
      t.onsuccess = () => res(t.result);
    });
    db.close();
    return rec;
  }, id);
}

const pageIdFrom = (url: string) => url.split("/p/")[1];

test("first visit creates a localized welcome page", async ({ page }) => {
  await page.goto("/tr");
  await page.waitForURL(/\/tr\/p\/[0-9A-Z]{26}$/);
  await expect(page.getByRole("textbox", { name: "Sayfa başlığı" })).toHaveValue("PageHut uygulamasına hoş geldin");
  await expect(page.locator('.ProseMirror [data-callout="idea"]')).toBeVisible();
  await expect(page.locator('.ProseMirror ul[data-type="taskList"] li')).toHaveCount(3);
});

test("write with slash menu, autosave, reload keeps everything", async ({ page }) => {
  await page.goto("/tr");
  await page.waitForURL(/\/p\//);
  const welcomeId = pageIdFrom(page.url());
  await page.getByRole("button", { name: "Yeni sayfa" }).first().click();
  await page.waitForURL((url) => url.pathname.includes("/p/") && !url.pathname.endsWith(welcomeId));

  const title = page.getByRole("textbox", { name: "Sayfa başlığı" });
  await expect(title).toBeFocused();
  await title.pressSequentially("Savaş Sistemi");
  await title.press("Enter");
  await expect(page.locator(".ProseMirror:visible")).toBeFocused();

  await page.keyboard.type("/başlık");
  const menu = page.getByRole("listbox", { name: "Blok ekle" });
  await expect(menu.getByRole("option")).toHaveCount(3);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Çekirdek döngü");
  await page.keyboard.press("Enter");
  await page.keyboard.type("[] ");
  await page.keyboard.type("Düşmanı yen");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/uyarı");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Kapsam riski");

  await expect(page.getByRole("status", { name: "Kayıt durumu" })).toHaveAttribute("data-save-state", "saved");
  const id = pageIdFrom(page.url());
  expect(await storedPage(page, id)).toMatchObject({
    title: "Savaş Sistemi",
    markdown: "## Çekirdek döngü\n\n- [ ] Düşmanı yen\n\n:::callout warning\nKapsam riski\n:::\n",
  });

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Sayfa başlığı" })).toHaveValue("Savaş Sistemi");
  await expect(page.locator(".ProseMirror h2")).toHaveText("Çekirdek döngü");
  await expect(page.locator('.ProseMirror [data-callout="warning"]')).toHaveText("Kapsam riski");
  await expect(page.getByRole("link", { name: "Savaş Sistemi" })).toBeVisible();
});

test("bubble toolbar applies bold", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  const firstId = pageIdFrom(page.url());
  await page.getByRole("button", { name: "New page" }).first().click();
  await page.waitForURL((url) => url.pathname.includes("/p/") && !url.pathname.endsWith(firstId));
  const title = page.getByRole("textbox", { name: "Page title" });
  await expect(title).toBeFocused();
  await title.press("Enter");
  await expect(page.getByRole("textbox", { name: "Page content" })).toBeFocused();
  await page.keyboard.type("make this bold");
  await page.keyboard.press("Shift+Home");
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await toolbar.getByRole("button", { name: "Bold" }).click();
  await expect(page.locator(".ProseMirror strong")).toHaveText("make this bold");
  await expect(toolbar.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
});

test("theme and language switch", async ({ page }) => {
  await page.goto("/tr");
  await page.waitForURL(/\/p\//);
  const id = pageIdFrom(page.url());

  await page.getByRole("radio", { name: "Koyu" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Açık" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByLabel("Dil").selectOption("de");
  await page.waitForURL(`**/de/p/${id}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("button", { name: "Neue Seite" }).first()).toBeVisible();
});

test("sidebar works as a drawer on phones @mobile", async ({ page }) => {
  await page.goto("/en");
  await page.waitForURL(/\/p\//);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await expect(page.getByRole("button", { name: "Close sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Close sidebar" }).click();
});
