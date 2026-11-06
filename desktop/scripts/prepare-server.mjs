// Copies the web app's standalone server (built with PAGEHUT_STANDALONE=1 pnpm build in the repo
// root) into desktop/server/, ready to ship inside the installer. Symlinks (pnpm) are replaced by
// real files, and environment files are removed: secrets must never end up in an installer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(desktop, "..");
const standalone = path.join(root, ".next", "standalone");
const out = path.join(desktop, "server");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build found. In the repo root run:  PAGEHUT_STANDALONE=1 pnpm build");
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
// Everything but node_modules as is.
fs.cpSync(standalone, out, { recursive: true, filter: (src) => !src.startsWith(path.join(standalone, "node_modules")) });

// node_modules flattened the way npm lays it out: pnpm keeps every package in .pnpm/<id>/node_modules
// next to its own dependencies and links them together with symlinks, which installers can't
// carry. Copying each package once to the top level keeps Node's module resolution working.
const pnpmStore = path.join(standalone, "node_modules", ".pnpm");
const modules = path.join(out, "node_modules");
fs.mkdirSync(modules, { recursive: true });
const hoist = (name, from) => {
  const to = path.join(modules, name);
  if (!fs.existsSync(to)) fs.cpSync(from, to, { recursive: true, dereference: true });
};
for (const id of fs.existsSync(pnpmStore) ? fs.readdirSync(pnpmStore) : []) {
  const nm = path.join(pnpmStore, id, "node_modules");
  if (!fs.existsSync(nm)) continue;
  for (const entry of fs.readdirSync(nm)) {
    if (entry.startsWith("@")) for (const sub of fs.readdirSync(path.join(nm, entry))) hoist(`${entry}/${sub}`, path.join(nm, entry, sub));
    else hoist(entry, path.join(nm, entry));
  }
}
// Top-level packages that aren't in the pnpm store (plain copies).
for (const entry of fs.readdirSync(path.join(standalone, "node_modules"))) {
  if (entry !== ".pnpm" && !entry.startsWith("@")) hoist(entry, path.join(standalone, "node_modules", entry));
}
fs.cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), { recursive: true });
const pub = path.join(root, "public");
fs.mkdirSync(path.join(out, "public"), { recursive: true });
if (fs.existsSync(pub)) fs.cpSync(pub, path.join(out, "public"), { recursive: true });

// Next copies .env files into the standalone folder; drop them and make sure none are left.
const findEnvFiles = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) findEnvFiles(p, found);
    else if (/^\.env/.test(entry.name)) found.push(p);
  }
  return found;
};
const envFiles = findEnvFiles(out);
for (const f of envFiles) fs.rmSync(f);
if (findEnvFiles(out).length) {
  console.error("Refusing to package: an .env file is still in", out);
  process.exit(1);
}

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`server ready in ${path.relative(root, out)} (${(size(out) / 1048576).toFixed(1)} MB${envFiles.length ? `, removed ${envFiles.length} env file(s)` : ""})`);
