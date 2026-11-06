import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseDatabase } from "@/lib/database/file";
import { cellText } from "@/lib/database/query";
import { bundleFromZip } from "./bundle";
import { parseCsv, stripExportId } from "./folder-export";

const id = (n: number) => String(n).repeat(32).slice(0, 32).replace(/[^0-9a-f]/g, "a");
const GD = `Game Design ${id(1)}`;

function idFolderExport(): Uint8Array {
  const inner = zipSync({
    [`${GD}.md`]: strToU8(
      `# Game Design\n\nSee [Combat](${encodeURIComponent(GD)}/Combat%20${id(2)}.md) and [Weapons](${encodeURIComponent(GD)}/Weapons%20${id(3)}.csv).\n\n<aside>\n💡 Keep it short\n</aside>\n\n![concept](${encodeURIComponent(GD)}/concept.png)\n`,
    ),
    [`${GD}/Combat ${id(2)}.md`]: strToU8("# Combat\n\nBosses have phases. Back to [Game Design](../Game%20Design%20" + id(1) + ".md).\n"),
    [`${GD}/Weapons ${id(3)}.csv`]: strToU8("Name,Damage\nSword,10\n"),
    [`${GD}/Weapons ${id(3)}_all.csv`]: strToU8(
      '﻿Name,Damage,Type,Tags,Done,Released,Notes\nSword,10,Melee,"sharp, heavy",Yes,"January 5, 2026","Basic, ""starter"" weapon"\nBow,6,Ranged,light,No,"February 1, 2026",Long range\nAxe,12,Melee,heavy,No,,\n',
    ),
    [`${GD}/Weapons ${id(3)}/Sword ${id(4)}.md`]: strToU8("# Sword\n\nDamage: 10\n\nA basic sword.\n"),
    [`${GD}/concept.png`]: new Uint8Array([137, 80, 78, 71]),
  });
  // Large exports come in a ZIP of ZIPs.
  return zipSync({ "Export-1234-Part-1.zip": inner });
}

describe("folder import", () => {
  it("reads CSV with quotes, commas, newlines and a BOM", () => {
    expect(parseCsv('﻿a,b\n"x, y","he said ""hi""\nok"\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"\nok']]);
    expect(stripExportId(`Combat ${id(2)}`)).toBe("Combat");
  });

  it("turns a nested export into a page tree with links, callouts, images and a database", () => {
    const bundle = bundleFromZip(idFolderExport(), "Export.zip");
    const byTitle = new Map(bundle.pages.map((p) => [p.title, p]));
    expect([...byTitle.keys()].sort()).toEqual(["Combat", "Game Design", "Sword", "Weapons"]);

    const gd = byTitle.get("Game Design")!;
    const combat = byTitle.get("Combat")!;
    const weapons = byTitle.get("Weapons")!;
    expect(gd.parentId).toBeNull();
    expect(combat.parentId).toBe(gd.id);
    expect(weapons.parentId).toBe(gd.id);
    expect(byTitle.get("Sword")!.parentId).toBe(weapons.id);

    expect(gd.markdown).toContain(`[[page:${combat.id}|Combat]]`);
    expect(gd.markdown).toContain(`[[page:${weapons.id}|Weapons]]`);
    expect(combat.markdown).toContain(`[[page:${gd.id}|Game Design]]`);
    expect(gd.markdown).toContain(":::callout idea\nKeep it short\n:::");
    expect(gd.markdown).toMatch(/!\[concept\]\(assets\/[a-z0-9]+-concept\.png\)/);
    expect(bundle.assets).toHaveLength(1);
    expect(bundle.assets[0].mime).toBe("image/png");

    // The _all.csv (every row) wins; types are inferred.
    expect(weapons.kind).toBe("database");
    const { data } = parseDatabase(weapons.markdown);
    const types = Object.fromEntries(data.properties.map((p) => [p.name, p.type]));
    expect(types).toEqual({ Name: "title", Damage: "number", Type: "select", Tags: "multiSelect", Done: "checkbox", Released: "date", Notes: "text" });
    expect(data.rows).toHaveLength(3);
    const prop = (name: string) => data.properties.find((p) => p.name === name)!;
    const sword = data.rows.find((r) => r.cells.title === "Sword")!;
    expect(cellText(data, sword, prop("Tags"))).toBe("sharp, heavy");
    expect(cellText(data, sword, prop("Released"))).toBe("2026-01-05");
    expect(cellText(data, sword, prop("Notes"))).toBe('Basic, "starter" weapon');
    expect(sword.cells[prop("Done").id]).toBe(true);
    expect(sword.cells[prop("Damage").id]).toBe(10);
  });

  it("leaves plain folders of Markdown to the normal importer", () => {
    const zip = zipSync({ "notes/Plan.md": strToU8("# Plan\n\nText\n") });
    const bundle = bundleFromZip(zip, "notes.zip");
    expect(bundle.pages.map((p) => p.title).sort()).toEqual(["Plan", "notes"]);
  });
});
