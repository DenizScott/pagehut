import { describe, expect, it } from "vitest";
import { dayNumber, isoFromDay, monthGrid, rowsByDay, timeline, todayIso, weekStartsOn } from "./dates";
import type { Row } from "./types";

const row = (id: string, cells: Row["cells"]): Row => ({ id, order: 0, cells });

describe("dates", () => {
  it("parses only real YYYY-MM-DD dates and round-trips them", () => {
    expect(isoFromDay(dayNumber("2026-02-28")!)).toBe("2026-02-28");
    expect(dayNumber("2026-02-31")).toBeUndefined();
    expect(dayNumber("26-1-5")).toBeUndefined();
    expect(dayNumber(5)).toBeUndefined();
    expect(dayNumber("2026-03-01")! - dayNumber("2026-02-28")!).toBe(1);
    expect(todayIso(new Date(2026, 10, 6, 23, 59))).toBe("2026-11-06");
  });

  it("lays out a month in whole weeks, Monday- or Sunday-first", () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    const mon = monthGrid(2026, 10, 1);
    expect(mon[0][0]).toBe("2026-10-26");
    expect(mon[0][6]).toBe("2026-11-01");
    expect(mon.at(-1)![0]).toBe("2026-11-30");
    expect(mon.every((w) => w.length === 7)).toBe(true);
    const sun = monthGrid(2026, 10, 0);
    expect(sun[0][0]).toBe("2026-11-01");
    expect(sun.at(-1)!.at(-1)).toBe("2026-12-05");
    expect(weekStartsOn("tr")).toBe(1);
    expect(weekStartsOn("en")).toBe(0);
  });

  it("groups rows by day and skips rows without a date", () => {
    const map = rowsByDay([row("a", { d: "2026-11-06" }), row("b", { d: "2026-11-06" }), row("c", {}), row("e", { d: "nope" })], "d");
    expect([...map.keys()]).toEqual(["2026-11-06"]);
    expect(map.get("2026-11-06")!.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("places rows on a timeline padded to whole weeks", () => {
    const today = dayNumber("2026-11-06")!;
    const t = timeline(
      [
        row("a", { s: "2026-11-10", e: "2026-11-20" }),
        row("b", { s: "2026-11-12" }),
        row("c", { s: "2026-11-15", e: "2026-11-01" }), // end before start: one day
        row("d", {}),
      ],
      "s",
      "e",
      1,
      today,
    );
    expect(t.items.map((i) => [i.row.id, isoFromDay(i.start), isoFromDay(i.end)])).toEqual([
      ["a", "2026-11-10", "2026-11-20"],
      ["b", "2026-11-12", "2026-11-12"],
      ["c", "2026-11-15", "2026-11-15"],
    ]);
    expect(t.undated.map((r) => r.id)).toEqual(["d"]);
    expect(isoFromDay(t.from)).toBe("2026-11-02"); // Monday of the week with today
    expect(t.to - t.from + 1).toBeGreaterThanOrEqual(28);
    expect((t.to - t.from + 1) % 7).toBe(0);
  });
});
