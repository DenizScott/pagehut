/**
 * Compares every locale in /locales against the reference locale (en).
 * Fails (exit 1) on missing keys, extra keys, empty strings, or ICU placeholders
 * that differ from the reference. Run: pnpm i18n:check
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "locales");
const REFERENCE = "en";

type Json = { [key: string]: Json } | string;

function flatten(obj: Json, prefix = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof obj === "string") {
    out.set(prefix, obj);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

// ICU arguments only ({name} or {name, plural, …}); text inside plural branches is ignored.
const placeholders = (s: string) =>
  [...new Set([...s.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]))].sort().join(",");

const namespaces = readdirSync(join(ROOT, REFERENCE)).filter((f) => f.endsWith(".json"));
const locales = readdirSync(ROOT).filter((l) => l !== REFERENCE);
const problems: string[] = [];

for (const ns of namespaces) {
  const ref = flatten(JSON.parse(readFileSync(join(ROOT, REFERENCE, ns), "utf8")));
  for (const locale of locales) {
    const file = join(ROOT, locale, ns);
    if (!existsSync(file)) {
      problems.push(`${locale}/${ns}: file missing`);
      continue;
    }
    const other = flatten(JSON.parse(readFileSync(file, "utf8")));
    for (const [key, value] of ref) {
      const translated = other.get(key);
      if (translated === undefined) problems.push(`${locale}/${ns}: missing "${key}"`);
      else if (translated.trim() === "" && value.trim() !== "") problems.push(`${locale}/${ns}: empty "${key}"`);
      else if (placeholders(translated) !== placeholders(value))
        problems.push(`${locale}/${ns}: placeholders differ in "${key}" (${placeholders(value)} vs ${placeholders(translated)})`);
    }
    for (const key of other.keys()) if (!ref.has(key)) problems.push(`${locale}/${ns}: extra key "${key}"`);
  }
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`i18n check passed: ${locales.length + 1} locales × ${namespaces.length} namespaces.`);
