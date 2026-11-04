import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND } from "./brand";

const root = join(import.meta.dirname, "..", "..");

describe("product name", () => {
  it("each locale has an app.name key, and English matches BRAND.name", () => {
    for (const locale of readdirSync(join(root, "locales"))) {
      const common = JSON.parse(readFileSync(join(root, "locales", locale, "common.json"), "utf8"));
      expect(common.app.name, locale).toBeTruthy();
      if (locale === "en") expect(common.app.name).toBe(BRAND.name);
    }
  });

  it("package.json uses the slug", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.name).toBe(BRAND.slug);
  });
});
