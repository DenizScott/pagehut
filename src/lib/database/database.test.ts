import { describe, expect, it } from "vitest";
import { mergePageFile, pageContentFromFile } from "@/lib/page-file";
import { pageFile } from "@/lib/transfer/bundle";
import { plainText } from "@/lib/search";
import { parseDatabase, serializeDatabase } from "./file";
import { evaluateFormula, FormulaError } from "./formula";
import { mergeDatabase } from "./merge";
import * as ops from "./ops";
import { cellText, groupRows, viewRows } from "./query";
import type { DatabaseData, View } from "./types";

const base = (): DatabaseData => ({
  properties: [
    { id: "title", name: "Name", type: "title" },
    { id: "status", name: "Status", type: "select", options: [{ id: "todo", name: "To do", color: "gray" }, { id: "done", name: "Done", color: "moss" }] },
    { id: "dmg", name: "Damage", type: "number" },
    { id: "rate", name: "Hits per second", type: "number" },
    { id: "dps", name: "DPS", type: "formula", formula: "{Damage} * {Hits per second}" },
    { id: "tags", name: "Tags", type: "multiSelect", options: [{ id: "a", name: "Melee", color: "red" }, { id: "b", name: "Ranged", color: "blue" }] },
    { id: "ok", name: "Tested", type: "checkbox" },
  ],
  views: [{ id: "table", name: "Table", type: "table", filters: [], sorts: [], hidden: [] }],
  rows: [
    { id: "01J0000000000000000000000A", order: 1, cells: { title: "Sword", status: "done", dmg: 10, rate: 1.5, tags: ["a"], ok: true } },
    { id: "01J0000000000000000000000B", order: 2, cells: { title: "Bow | long", status: "todo", dmg: 6, rate: 2 } },
    { id: "01J0000000000000000000000C", order: 3, cells: { title: "Spear", dmg: 8 } },
  ],
});

const view = (patch: Partial<View>): View => ({ id: "v", name: "v", type: "table", filters: [], sorts: [], hidden: [], ...patch });

describe("formula", () => {
  const vars: Record<string, number> = { damage: 10, "hits per second": 1.5 };
  const look = (n: string) => vars[n.toLowerCase()];
  it("computes arithmetic with references and functions", () => {
    expect(evaluateFormula("{Damage} * {Hits per second}", look)).toBe(15);
    expect(evaluateFormula("round(10 / 3, 2) + max(1, 2) - -1", look)).toBe(6.33);
    expect(evaluateFormula("(1 + 2) * 3 % 5", look)).toBe(4);
  });
  it("rejects anything that isn't a formula", () => {
    expect(() => evaluateFormula("alert(1)", look)).toThrow(FormulaError);
    expect(() => evaluateFormula("{Nope} + 1", look)).toThrow(FormulaError);
    expect(() => evaluateFormula("1 +", look)).toThrow(FormulaError);
    expect(() => evaluateFormula("1; 2", look)).toThrow(FormulaError);
  });
});

describe("query", () => {
  const data = base();
  it("shows cell text by type", () => {
    const [sword] = data.rows;
    const p = (id: string) => data.properties.find((x) => x.id === id)!;
    expect(cellText(data, sword, p("status"))).toBe("Done");
    expect(cellText(data, sword, p("dps"))).toBe("15");
    expect(cellText(data, sword, p("tags"))).toBe("Melee");
    expect(cellText(data, sword, p("ok"))).toBe("✓");
    expect(cellText(data, data.rows[2], p("dps"))).toBe("0"); // empty reference counts as 0
  });
  it("filters and sorts", () => {
    const names = (v: View) => viewRows(data, v, { locale: "tr" }).map((r) => r.cells.title);
    expect(names(view({ sorts: [{ propertyId: "dps", dir: "desc" }] }))).toEqual(["Sword", "Bow | long", "Spear"]);
    expect(names(view({ filters: [{ propertyId: "status", op: "is", value: "done" }] }))).toEqual(["Sword"]);
    expect(names(view({ filters: [{ propertyId: "status", op: "isEmpty" }] }))).toEqual(["Spear"]);
    expect(names(view({ filters: [{ propertyId: "dmg", op: "gt", value: "7" }] }))).toEqual(["Sword", "Spear"]);
    expect(names(view({ filters: [{ propertyId: "title", op: "contains", value: "SPE" }] }))).toEqual(["Spear"]);
    expect(names(view({ filters: [{ propertyId: "ok", op: "unchecked" }] }))).toEqual(["Bow | long", "Spear"]);
    expect(names(view({ sorts: [{ propertyId: "status", dir: "asc" }] }))).toEqual(["Bow | long", "Sword", "Spear"]);
  });
  it("groups a board by a select property, no-value column first", () => {
    const groups = groupRows(data, view({ groupBy: "status" }), data.rows);
    expect(groups.map((g) => [g.option?.name ?? null, g.rows.map((r) => r.cells.title)])).toEqual([
      [null, ["Spear"]],
      ["To do", ["Bow | long"]],
      ["Done", ["Sword"]],
    ]);
  });
});

describe("file format", () => {
  it("round-trips and writes a readable table GitHub can render", () => {
    const data = base();
    const body = serializeDatabase(data);
    expect(body).toContain("| Name | Status | Damage |");
    expect(body).toContain("| Bow \\| long | To do | 6 |");
    expect(parseDatabase(body)).toEqual({ data, skipped: 0 });
    // Search sees the table, not the JSON.
    expect(plainText(body)).toContain("Sword");
    expect(plainText(body)).not.toContain("property");
  });
  it("is recognized as a database page from its file", () => {
    const text = pageFile({ id: "01J0000000000000000000000Z", parentId: null, order: 1, title: "Weapons", kind: "database", markdown: serializeDatabase(base()) });
    expect(text).toContain('type: "database"');
    const content = pageContentFromFile(text, "");
    expect(content.kind).toBe("database");
    expect(content.title).toBe("Weapons");
    expect(content.database?.rows).toHaveLength(3);
  });
  it("skips unreadable lines instead of failing", () => {
    const body = serializeDatabase(base()).replace('{"row":{"id":"01J0000000000000000000000C"', "{oops");
    const { data, skipped } = parseDatabase(body);
    expect(skipped).toBe(1);
    expect(data.rows).toHaveLength(2);
  });
});

describe("merge", () => {
  const edit = (d: DatabaseData, f: (d: DatabaseData) => void) => {
    const c = structuredClone(d);
    f(c);
    return c;
  };
  it("merges different cells of the same row and rows added on both sides", () => {
    const b = base();
    const mine = edit(b, (d) => {
      d.rows[0].cells.dmg = 12;
      d.rows.push({ id: "01J0000000000000000000000D", order: 4, cells: { title: "Axe" } });
    });
    const theirs = edit(b, (d) => {
      d.rows[0].cells.status = "todo";
      d.rows.push({ id: "01J0000000000000000000000E", order: 4, cells: { title: "Mace" } });
    });
    const r = mergeDatabase(b, mine, theirs);
    expect(r.clean).toBe(true);
    if (!r.clean) return;
    expect(r.data.rows[0].cells).toMatchObject({ dmg: 12, status: "todo" });
    expect(r.data.rows.map((x) => x.cells.title)).toEqual(["Sword", "Bow | long", "Spear", "Axe", "Mace"]);
  });
  it("merges multi-select values and select options as sets", () => {
    const b = base();
    const mine = edit(b, (d) => {
      d.rows[0].cells.tags = ["a", "b"];
      d.properties[1].options!.push({ id: "wip", name: "Doing", color: "amber" });
    });
    const theirs = edit(b, (d) => {
      d.rows[0].cells.tags = [];
      d.properties[1].options!.push({ id: "cut", name: "Cut", color: "red" });
    });
    const r = mergeDatabase(b, mine, theirs);
    expect(r.clean && r.data.rows[0].cells.tags).toEqual(["b"]);
    expect(r.clean && r.data.properties[1].options!.map((o) => o.id)).toEqual(["todo", "done", "wip", "cut"]);
  });
  it("conflicts only when the same cell changed differently", () => {
    const b = base();
    const r = mergeDatabase(b, edit(b, (d) => (d.rows[0].cells.dmg = 11)), edit(b, (d) => (d.rows[0].cells.dmg = 13)));
    expect(r.clean).toBe(false);
  });
  it("an edit beats a delete", () => {
    const b = base();
    const r = mergeDatabase(b, edit(b, (d) => d.rows.splice(1, 1)), edit(b, (d) => (d.rows[1].cells.dmg = 7)));
    expect(r.clean && r.data.rows.find((x) => x.id.endsWith("B"))?.cells.dmg).toBe(7);
    const gone = mergeDatabase(b, edit(b, (d) => d.rows.splice(1, 1)), b);
    expect(gone.clean && gone.data.rows).toHaveLength(2);
  });
  it("merges whole page files, including the title", () => {
    const id = "01J0000000000000000000000Z";
    const file = (d: DatabaseData, title = "Weapons") => pageFile({ id, parentId: null, order: 1, title, kind: "database", markdown: serializeDatabase(d) });
    const b = base();
    const r = mergePageFile(id, file(b), file(edit(b, (d) => (d.rows[2].cells.dmg = 9)), "Arsenal"), file(edit(b, (d) => (d.rows[1].cells.dmg = 5))));
    expect(r.clean).toBe(true);
    if (!r.clean) return;
    const merged = pageContentFromFile(r.text, "");
    expect(merged.title).toBe("Arsenal");
    expect(merged.database!.rows.map((x) => x.cells.dmg)).toEqual([10, 5, 9]);
  });
});

describe("ops", () => {
  it("keeps formulas working when a property is renamed", () => {
    const next = ops.updateProperty(base(), "dmg", { name: "Power" });
    expect(next.properties.find((p) => p.id === "dps")?.formula).toBe("{Power} * {Hits per second}");
    expect(cellText(next, next.rows[0], next.properties.find((p) => p.id === "dps")!)).toBe("15");
  });
  it("converts values when a property's type changes", () => {
    let d = ops.changePropertyType(base(), "status", "text");
    expect(d.rows[0].cells.status).toBe("Done");
    d = ops.changePropertyType(d, "status", "multiSelect");
    const prop = d.properties.find((p) => p.id === "status")!;
    expect(prop.options?.map((o) => o.name)).toEqual(["Done", "To do"]);
    expect(cellText(d, d.rows[1], prop)).toBe("To do");
    d = ops.changePropertyType(d, "dmg", "text");
    expect(d.rows[0].cells.dmg).toBe("10");
    d = ops.changePropertyType(d, "dmg", "number");
    expect(d.rows[0].cells.dmg).toBe(10);
  });
  it("deleting a property cleans up views and cells; the title can't be deleted", () => {
    let d = ops.updateView(base(), "table", { sorts: [{ propertyId: "dmg", dir: "asc" }], filters: [{ propertyId: "dmg", op: "gt", value: "1" }] });
    d = ops.deleteProperty(d, "dmg");
    expect(d.views[0].sorts).toEqual([]);
    expect(d.views[0].filters).toEqual([]);
    expect(d.rows.every((r) => !("dmg" in r.cells))).toBe(true);
    expect(ops.deleteProperty(d, "title")).toBe(d);
  });
  it("adds rows in order and moves one row between two others", () => {
    const { data, row } = ops.addRow(base(), { title: "Axe" });
    expect(row.order).toBe(4);
    const moved = ops.moveRow(data, row.id, { after: data.rows[0].id, before: data.rows[1].id });
    expect(viewRows(moved, view({})).map((r) => r.cells.title)).toEqual(["Sword", "Axe", "Bow | long", "Spear"]);
  });
});
