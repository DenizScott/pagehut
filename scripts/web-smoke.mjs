// Smoke test of a deployed PageHut (default: the live site) in Chromium, Firefox and WebKit, on a
// desktop and a phone viewport, in all three languages. Run: node scripts/web-smoke.mjs [url]
// Set ENGINES=firefox to test one engine. Exits non-zero on any failure.
import { chromium, devices, firefox, webkit } from "@playwright/test";

const BASE = process.argv[2] || "https://pagehut.vercel.app";
const results = [];
const check = (where, name, ok, detail = "") => {
  results.push({ where, name, ok, detail });
  if (!ok) console.log(`FAIL [${where}] ${name}${detail ? ` (${detail})` : ""}`);
};

const all = { chromium, firefox, webkit };
const engines = Object.fromEntries(Object.entries(all).filter(([n]) => !process.env.ENGINES || process.env.ENGINES.split(",").includes(n)));
const forms = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { ...devices["iPhone 13"], defaultBrowserType: undefined },
};

for (const [engineName, engine] of Object.entries(engines)) {
  let browser;
  try {
    browser = await engine.launch();
  } catch (err) {
    check(engineName, "browser starts on this computer", false, String(err).slice(0, 80));
    continue;
  }
  for (const [formName, form] of Object.entries(forms)) {
    const opts = { ...form };
    delete opts.defaultBrowserType;
    if (engineName === "firefox") delete opts.isMobile; // Firefox has no mobile emulation
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    // Firefox logs a font load that a navigation cancelled (NS_BINDING_ABORTED = 2152398850) as an
    // error; the test navigates fast on purpose, so that one is not a fault of the page.
    const aborted = (t) => /downloadable font: download failed/.test(t) && /status=2152398850/.test(t);
    page.on("console", (m) => m.type() === "error" && !aborted(m.text()) && errors.push(m.text().slice(0, 160)));
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const where = `${engineName}/${formName}`;
    try {
      for (const lang of ["tr", "en", "de"]) {
        await page.goto(`${BASE}/${lang}`);
        await page.waitForURL(/\/p\//, { timeout: 30_000 });
        await page.locator(".ProseMirror:visible").first().waitFor({ timeout: 30_000 });
        const title = await page.getByRole("textbox", { name: /Page title|Sayfa başlığı|Seitentitel/ }).inputValue();
        check(where, `${lang}: welcome page`, /PageHut/.test(title), title);
        const h = (await page.getByRole("textbox", { name: /Page title|Sayfa başlığı|Seitentitel/ }).boundingBox())?.height ?? 999;
        check(where, `${lang}: title box height`, h < 220, `${Math.round(h)}px`);
      }

      // English: templates, a page template, a database template, search.
      await page.goto(`${BASE}/en`);
      await page.waitForURL(/\/p\//);
      await page.locator(".ProseMirror:visible").first().waitFor();
      if (formName === "phone") await page.getByRole("button", { name: "Open sidebar" }).click();
      await page.getByRole("button", { name: "Templates", exact: true }).click();
      const gallery = page.getByRole("dialog", { name: "Templates" });
      await gallery.waitFor();
      check(where, "templates: 29 in the gallery", (await gallery.locator("button[aria-pressed]").count()) === 29);
      await gallery.getByRole("button", { name: /Video script/ }).click();
      await gallery.getByRole("button", { name: "Use template" }).click();
      await page.getByRole("textbox", { name: "Page title" }).filter({ hasText: "" }).first().waitFor();
      const vs = page.locator(".ProseMirror:visible").getByRole("heading", { name: "Hook (first 15 seconds)" });
      await vs.waitFor({ timeout: 15_000 });
      check(where, "video script template", true);

      if (formName === "phone") await page.getByRole("button", { name: "Open sidebar" }).click();
      await page.getByRole("button", { name: "Templates", exact: true }).click();
      await gallery.getByRole("button", { name: /Content calendar/ }).click();
      await gallery.getByRole("button", { name: "Use template" }).click();
      const db = page.getByRole("region", { name: "Database" });
      await db.getByRole("tab", { name: "Pipeline", selected: true }).waitFor({ timeout: 15_000 });
      await db.getByRole("tab", { name: "Calendar" }).click();
      await db.getByRole("table").waitFor({ timeout: 10_000 });
      check(where, "content calendar: board and calendar", true);

      await page.keyboard.press(engineName === "webkit" ? "Meta+k" : "Control+k");
      const search = page.getByRole("dialog").getByRole("combobox");
      if (await search.isVisible().catch(() => false)) {
        await search.fill("hook");
        await page.getByRole("option", { name: /Video script/ }).first().waitFor({ timeout: 10_000 });
        check(where, "search finds the new page", true);
        await page.keyboard.press("Escape");
      } else check(where, "search opens with the keyboard", false, "dialog not shown");

      check(where, "no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));
    } catch (err) {
      check(where, "unexpected error", false, String(err).split("\n")[0].slice(0, 200));
      await page.screenshot({ path: `C:/Users/DENIZS~1/AppData/Local/Temp/smoke-${engineName}-${formName}.png` }).catch(() => {});
    }
    await ctx.close();
  }
  await browser.close();
}

const byWhere = {};
for (const r of results) (byWhere[r.where] ??= []).push(r);
for (const [w, rs] of Object.entries(byWhere)) console.log(`${w}: ${rs.filter((r) => r.ok).length}/${rs.length}`);
console.log(`TOTAL ${results.filter((r) => r.ok).length}/${results.length}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
