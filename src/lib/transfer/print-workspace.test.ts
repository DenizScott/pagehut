import { describe, expect, it } from "vitest";
import type { DatabaseData } from "@/lib/database/types";
import { databaseTableHtml, escapeHtml, workspaceDocument } from "./print-workspace";

describe("workspace print", () => {
  it("puts every page on its own sheet, in order, with escaped titles", () => {
    const html = workspaceDocument({
      name: "My <game>",
      lang: "tr",
      untitled: "Adsız",
      pages: [
        { title: "Pitch", icon: "🎮", depth: 0, html: "<p>One line</p>" },
        { title: "", depth: 1, html: "<p>Child</p>" },
      ],
    });
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain("<title>My &lt;game&gt;</title>");
    expect(html.indexOf("🎮 Pitch")).toBeLessThan(html.indexOf("Adsız"));
    expect(html.match(/<section class="page/g)).toHaveLength(2);
    expect(html).toContain('class="page first"');
  });

  it("prints a database's first view as a table", () => {
    const data: DatabaseData = {
      properties: [
        { id: "title", name: "Name", type: "title" },
        { id: "hp", name: "HP", type: "number" },
        { id: "secret", name: "Hidden", type: "text" },
      ],
      views: [{ id: "v", name: "All", type: "table", filters: [], sorts: [{ propertyId: "hp", dir: "desc" }], hidden: ["secret"] }],
      rows: [
        { id: "1", order: 1, cells: { title: "Slime <s>", hp: 10, secret: "x" } },
        { id: "2", order: 2, cells: { title: "Golem", hp: 200 } },
      ],
    };
    const html = databaseTableHtml(data, "en");
    expect(html).toContain("<th>Name</th><th>HP</th>");
    expect(html).not.toContain("Hidden");
    expect(html.indexOf("Golem")).toBeLessThan(html.indexOf("Slime"));
    expect(html).toContain("Slime &lt;s&gt;");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });
});
