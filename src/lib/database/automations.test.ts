import { describe, expect, it } from "vitest";
import { addAutomation, deleteAutomation, runAutomations, updateAutomation } from "./automations";
import { parseDatabase, serializeDatabase } from "./file";
import { mergeDatabase } from "./merge";
import * as ops from "./ops";
import type { DatabaseData, Row } from "./types";

const ctx = { today: "2026-11-06", me: "octo-designer" };

const base = (): DatabaseData => ({
  properties: [
    { id: "title", name: "Name", type: "title" },
    { id: "status", name: "Status", type: "select", options: [{ id: "todo", name: "To do", color: "gray" }, { id: "done", name: "Done", color: "moss" }] },
    { id: "tags", name: "Tags", type: "multiSelect", options: [{ id: "bug", name: "Bug", color: "red" }] },
    { id: "ok", name: "Tested", type: "checkbox" },
    { id: "finished", name: "Finished", type: "date" },
    { id: "owner", name: "Owner", type: "person" },
    { id: "notes", name: "Notes", type: "text" },
    { id: "dps", name: "DPS", type: "formula", formula: "1" },
  ],
  views: [{ id: "v", name: "Table", type: "table", filters: [], sorts: [], hidden: [] }],
  rows: [{ id: "r1", order: 1, cells: { title: "Dash", status: "todo" } }],
});

/** Edits a cell the way the UI does: change, then run the rules for that row. */
function edit(data: DatabaseData, rowId: string, propId: string, value: Row["cells"][string] | undefined) {
  const before = data.rows.find((r) => r.id === rowId);
  return runAutomations(ops.updateCell(data, rowId, propId, value), rowId, before, ctx);
}

describe("automations", () => {
  it("sets a date when a select becomes a value, only on the change into it", () => {
    let data = addAutomation(base(), {
      enabled: true,
      trigger: { kind: "becomes", propertyId: "status", value: "done" },
      actions: [{ propertyId: "finished", set: "today" }],
    }).data;
    let r = edit(data, "r1", "notes", "x");
    expect(r.ran).toEqual([]);
    r = edit(r.data, "r1", "status", "done");
    expect(r.ran).toHaveLength(1);
    expect(r.data.rows[0].cells.finished).toBe("2026-11-06");
    // Editing the date by hand afterwards doesn't fire it again.
    r = edit(r.data, "r1", "finished", "2026-10-01");
    expect(r.data.rows[0].cells.finished).toBe("2026-10-01");
    data = r.data;
    expect(edit(data, "r1", "status", "done").ran).toEqual([]); // no change, no run
  });

  it("handles checkbox, multi-select, row added, any change, me and clear", () => {
    let data = base();
    data = addAutomation(data, { enabled: true, trigger: { kind: "rowAdded" }, actions: [{ propertyId: "owner", set: "me" }, { propertyId: "status", set: "value", value: "todo" }] }).data;
    data = addAutomation(data, { enabled: true, trigger: { kind: "becomes", propertyId: "ok", value: true }, actions: [{ propertyId: "tags", set: "clear" }] }).data;
    data = addAutomation(data, { enabled: true, trigger: { kind: "becomes", propertyId: "tags", value: "bug" }, actions: [{ propertyId: "ok", set: "value", value: false }] }).data;
    data = addAutomation(data, { enabled: true, trigger: { kind: "changed", propertyId: "notes" }, actions: [{ propertyId: "finished", set: "clear" }, { propertyId: "dps", set: "value", value: 5 }] }).data;

    const added = ops.addRow(data, {});
    let r = runAutomations(added.data, added.row.id, undefined, ctx);
    const row = () => r.data.rows.find((x) => x.id === added.row.id)!;
    expect(row().cells).toMatchObject({ owner: "octo-designer", status: "todo" });

    r = edit(r.data, added.row.id, "ok", true);
    expect(row().cells.ok).toBe(true);
    r = edit(r.data, added.row.id, "tags", ["bug"]);
    expect(row().cells.ok ?? false).toBe(false); // unchecked boxes are stored as empty
    expect(row().cells.tags).toEqual(["bug"]);
    r = edit(r.data, added.row.id, "ok", true);
    expect(row().cells.tags).toBeUndefined();

    r = edit(r.data, added.row.id, "finished", "2026-01-01");
    r = edit(r.data, added.row.id, "notes", "changed");
    expect(row().cells.finished).toBeUndefined();
    expect(row().cells.dps).toBeUndefined(); // formulas are never written
  });

  it("skips disabled rules and 'me' when signed out", () => {
    let data = addAutomation(base(), { enabled: true, trigger: { kind: "changed", propertyId: "notes" }, actions: [{ propertyId: "owner", set: "me" }] }).data;
    const id = data.automations![0].id;
    const before = data.rows[0];
    expect(runAutomations(ops.updateCell(data, "r1", "notes", "a"), "r1", before, { today: ctx.today }).ran).toEqual([]);
    data = updateAutomation(data, id, { enabled: false });
    expect(runAutomations(ops.updateCell(data, "r1", "notes", "a"), "r1", before, ctx).ran).toEqual([]);
    expect(deleteAutomation(data, id).automations).toBeUndefined();
  });

  it("are saved in the database file and merge by rule", () => {
    const b = base();
    const mine = addAutomation(b, { enabled: true, trigger: { kind: "rowAdded" }, actions: [{ propertyId: "owner", set: "me" }] }).data;
    expect(parseDatabase(serializeDatabase(mine)).data.automations).toEqual(mine.automations);
    expect(serializeDatabase(b)).not.toContain("automation");

    const theirs = addAutomation(b, { enabled: true, trigger: { kind: "changed", propertyId: "notes" }, actions: [{ propertyId: "finished", set: "today" }] }).data;
    const merged = mergeDatabase(b, mine, theirs);
    expect(merged.clean).toBe(true);
    if (merged.clean) expect(merged.data.automations).toHaveLength(2);
  });
});
