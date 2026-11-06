// Smoke test for the packaged desktop app (run after `electron-builder --dir`): starts the real app
// with Playwright, checks that the bundled server answers, that the editor loads with no console
// errors, that a page survives a restart, and that the templates are there. Exits non-zero on any
// failure. Used locally and by .github/workflows/desktop-smoke.yml on Windows, macOS and Linux.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { _electron: electron } = await import(pathToFileURL(path.join(desktop, "..", "node_modules", "@playwright", "test", "index.mjs")).href);

function findExecutable() {
  const dist = path.join(desktop, "dist");
  const candidates = [path.join(dist, "win-unpacked", "PageHut.exe")];
  for (const dir of fs.existsSync(dist) ? fs.readdirSync(dist) : []) {
    if (dir.startsWith("mac")) candidates.push(path.join(dist, dir, "PageHut.app", "Contents", "MacOS", "PageHut"));
    if (dir === "linux-unpacked") for (const f of fs.readdirSync(path.join(dist, dir))) if (/^(pagehut|PageHut)/.test(f) && !f.includes(".")) candidates.push(path.join(dist, dir, f));
  }
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error(`No packaged app found in ${dist}; run electron-builder --dir first`);
  return found;
}

const executablePath = findExecutable();
// Linux CI runners have no setuid sandbox helper; Chromium's own sandbox still applies to pages.
const args = process.platform === "linux" ? ["--no-sandbox"] : [];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function launch() {
  const app = await electron.launch({ executablePath, args, env: { ...process.env, LANG: "en_US.UTF-8" }, timeout: 60_000 });
  const win = await app.firstWindow({ timeout: 60_000 });
  const errors = [];
  win.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  win.on("pageerror", (e) => errors.push(String(e)));
  return { app, win, errors };
}

console.log(`App: ${executablePath}`);
let { app, win, errors } = await launch();
try {
  await win.waitForURL(/127\.0\.0\.1:47821\/[a-z]{2}\/p\//, { timeout: 60_000 });
  check("opens the bundled app on 127.0.0.1:47821", true, new URL(win.url()).pathname);
  await win.locator(".ProseMirror").first().waitFor({ timeout: 30_000 });
  check("editor loads", true);

  const status = await win.evaluate(async () => (await fetch("/api/auth/status")).json());
  check("server runs in desktop mode", status.desktop === true, JSON.stringify(status));
  check("desktop bridge for GitHub sign-in", (await win.evaluate(() => typeof window.pagehutDesktop)) === "object");
  check("no Node.js access in the page", (await win.evaluate(() => typeof window.require + typeof window.process)) === "undefinedundefined");

  // Templates gallery: general + game templates.
  await win.getByRole("button", { name: /^(Templates|Şablonlar|Vorlagen)$/ }).first().click();
  const gallery = win.getByRole("dialog");
  await gallery.waitFor();
  const count = await gallery.locator("button[aria-pressed]").count();
  check("templates gallery lists all templates", count >= 29, `${count} templates`);
  await win.keyboard.press("Escape");

  // Typing is saved and survives a restart.
  const marker = `smoke ${Date.now()}`;
  await win.locator(".ProseMirror").first().click();
  await win.keyboard.press("Control+End");
  await win.keyboard.type(` ${marker}`);
  await win.waitForTimeout(1500);
  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await app.close();

  ({ app, win, errors } = await launch());
  await win.waitForURL(/\/p\//, { timeout: 60_000 });
  await win.locator(".ProseMirror").first().waitFor({ timeout: 30_000 });
  check("text survives a restart", ((await win.locator(".ProseMirror").first().textContent()) ?? "").includes(marker));
} catch (err) {
  check("unexpected error", false, err instanceof Error ? err.message.split("\n")[0] : String(err));
  try {
    await win.screenshot({ path: path.join(desktop, "dist", "smoke-failure.png") });
  } catch {
    /* no window */
  }
} finally {
  await app.close().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed on ${process.platform}`);
process.exit(failed.length ? 1 : 0);
