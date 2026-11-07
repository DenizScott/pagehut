import { editor, expect, L, newPage, open, saved, test, type Lang } from "./deep-guard";

/** Deep tests, part 1: every template in every language, every block, shortcuts, robustness. */

for (const lang of ["en", "tr", "de"] as Lang[]) {
  test(`every template works in ${lang}`, async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, lang);
    await page.getByRole("button", { name: L[lang].tpl, exact: true }).first().click();
    const gallery = page.getByRole("dialog", { name: L[lang].tpl });
    await expect(gallery.locator("button[aria-pressed]").first()).toBeVisible();
    const count = await gallery.locator("button[aria-pressed]").count();
    expect(count).toBe(29);
    await page.keyboard.press("Escape");

    for (let i = 0; i < count; i++) {
      await page.getByRole("button", { name: L[lang].tpl, exact: true }).first().click();
      const item = gallery.locator("button[aria-pressed]").nth(i);
      const name = (await item.locator("span").nth(1).innerText()).split("\n")[0].trim();
      await item.click();
      await gallery.getByRole("button", { name: L[lang].use }).click();
      await expect(gallery).toBeHidden();
      // Wait for the new page itself before looking at its body.
      await expect(page.getByRole("textbox", { name: L[lang].title })).toHaveValue(name);
      // A database template opens a database; a page template fills the editor.
      const db = page.getByRole("region", { name: L[lang].db });
      await expect(db.or(editor(page)).first()).toBeVisible();
      if (await db.isVisible()) {
        await expect(db.getByRole("tablist")).toBeVisible();
        // Every view of the template renders.
        const tabs = db.getByRole("tab");
        for (let v = 0; v < (await tabs.count()); v++) await tabs.nth(v).click();
      } else {
        await expect(editor(page)).not.toBeEmpty();
      }
    }
    await saved(page);
  });
}

const blocks: [query: string, selector: string][] = [
  ["h1", "h1"],
  ["h2", "h2"],
  ["h3", "h3"],
  ["bullet", "ul:not([data-type]) > li"],
  ["numbered", "ol > li"],
  ["todo", 'ul[data-type="taskList"] > li'],
  ["toggle", '[data-type="details"]'],
  ["quote", "blockquote"],
  ["callout", '[data-callout="info"]'],
  ["warning", '[data-callout="warning"]'],
  ["idea", '[data-callout="idea"]'],
  ["divider", "hr"],
  ["code", "pre"],
  ["table", "table"],
];

test("every slash block inserts, takes text and survives a reload", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  for (const [query] of blocks) {
    await newPage(page, `Block ${query}`);
    await page.keyboard.type(`/${query}`);
    await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Enter");
    if (query !== "divider" && query !== "table") await page.keyboard.type(`Sample ${query}`);
    await saved(page);
  }
  await page.reload();
  const tree = page.getByRole("list", { name: "Pages" });
  for (const [query, selector] of blocks) {
    await tree.getByRole("link", { name: `Block ${query}`, exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(`Block ${query}`);
    await expect(editor(page).locator(selector).first(), `${query} after reload`).toBeVisible();
    if (query !== "divider" && query !== "table") await expect(editor(page)).toContainText(`Sample ${query}`);
  }
});

test("Markdown shortcuts, undo and redo", async ({ page }) => {
  await open(page);
  await newPage(page, "Shortcuts");
  const lines: [typed: string, selector: string][] = [
    ["# Big", "h1"],
    ["## Medium", "h2"],
    ["- item", "ul > li"],
    ["1. first", "ol > li"],
    ["> quoted", "blockquote"],
    ["[ ] task", 'ul[data-type="taskList"]'],
  ];
  for (const [typed, selector] of lines) {
    await page.keyboard.type(typed);
    await expect(editor(page).locator(selector).last()).toBeVisible();
    await page.keyboard.press("Enter");
    if (/^(- |1\. |> |\[ \] )/.test(typed)) await page.keyboard.press("Enter"); // leave the list/quote
  }
  await page.keyboard.type("undo me");
  await expect(editor(page)).toContainText("undo me");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor(page)).not.toContainText("undo me");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(editor(page)).toContainText("undo me");
  await saved(page);
});

test("images: a small one is added, an oversized one is refused with a message", async ({ page }) => {
  await open(page);
  await newPage(page, "Images");
  // 1×1 PNG.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.type("/image");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles({ name: "dot.png", mimeType: "image/png", buffer: png });
  await expect(editor(page).locator("img")).toHaveCount(1);
  await saved(page);
  await page.reload();
  await expect(editor(page).locator("img")).toHaveCount(1);
  await expect(editor(page).locator("img")).toHaveJSProperty("complete", true);

  const big = page.waitForEvent("filechooser");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/image");
  await page.keyboard.press("Enter");
  await (await big).setFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(26 * 1024 * 1024) });
  await expect(page.getByRole("status").or(page.getByRole("alert")).filter({ hasText: /MB/ }).first()).toBeVisible();
  await expect(editor(page).locator("img")).toHaveCount(1);
});

test("odd text: long title, emoji, right-to-left, Turkish and German letters, all searchable", async ({ page }) => {
  await open(page);
  const long = `${"Very long title ".repeat(30)}end`;
  await newPage(page, long);
  await page.keyboard.type("Emoji 🎮🚀 and مرحبا بالعالم and İstanbul ılık and Größe");
  await saved(page);
  // The sidebar never scrolls sideways because of a long title.
  const nav = page.getByRole("navigation").first();
  expect(await nav.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(long);
  await expect(editor(page)).toContainText("مرحبا بالعالم");
  for (const q of ["istanbul", "ILIK", "größe", "🎮"]) {
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("dialog").getByRole("combobox").fill(q);
    await expect(page.getByRole("dialog").getByRole("option").first(), `search "${q}"`).toContainText("Very long title");
    await page.keyboard.press("Escape");
  }
});

test("a large page stays fast to type in and saves", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await newPage(page, "Large page");
  const text = Array.from({ length: 1500 }, (_, i) => `Paragraph ${i}: the quick brown fox jumps over the lazy dog.`).join("\n\n");
  await page.evaluate((t) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    document.querySelector(".ProseMirror")?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
  await expect(editor(page)).toContainText("Paragraph 1499");
  await saved(page);
  const start = Date.now();
  await page.keyboard.type("typing at the end");
  await expect(editor(page)).toContainText("typing at the end");
  expect(Date.now() - start, "typing 17 characters in a 1500-paragraph page").toBeLessThan(4000);
  await saved(page);
  await page.reload();
  await expect(editor(page)).toContainText("typing at the end");
});

test("text typed just before a reload is not lost", async ({ page }) => {
  await open(page);
  await newPage(page, "Quick reload");
  await page.keyboard.type("typed right before reload");
  await page.reload(); // no wait for the debounced save
  await page.getByRole("list", { name: "Pages" }).getByRole("link", { name: "Quick reload" }).click();
  await expect(editor(page)).toContainText("typed right before reload");
});
