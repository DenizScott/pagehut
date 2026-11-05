import { describe, expect, it } from "vitest";
import { lineDiff, mergeText } from "./merge";

const base = "---\ntitle: \"Combat\"\n---\n\n## Core loop\n\nExplore.\n\n## Bosses\n\nThree phases.\n";

describe("three-way merge", () => {
  it("takes the only side that changed", () => {
    expect(mergeText(base, base, base + "More\n")).toEqual({ clean: true, text: base + "More\n" });
    expect(mergeText(base, base + "Mine\n", base)).toEqual({ clean: true, text: base + "Mine\n" });
  });

  it("merges edits to different parts of the page", () => {
    const mine = base.replace("Explore.", "Explore and loot.");
    const theirs = base.replace("Three phases.", "Four phases.");
    const r = mergeText(base, mine, theirs);
    expect(r).toEqual({ clean: true, text: base.replace("Explore.", "Explore and loot.").replace("Three phases.", "Four phases.") });
  });

  it("merges a title change on one side with a body change on the other", () => {
    const mine = base.replace('title: "Combat"', 'title: "Combat System"');
    const theirs = base.replace("Explore.", "Explore carefully.");
    const r = mergeText(base, mine, theirs);
    expect(r.clean && r.text).toContain('title: "Combat System"');
    expect(r.clean && r.text).toContain("Explore carefully.");
  });

  it("reports a conflict when both changed the same line, without picking a side", () => {
    const r = mergeText(base, base.replace("Three phases.", "Two phases."), base.replace("Three phases.", "Five phases."));
    expect(r).toEqual({ clean: false, conflicts: 1 });
  });

  it("treats identical edits on both sides as no conflict", () => {
    const same = base.replace("Explore.", "Explore!");
    expect(mergeText(base, same, same)).toEqual({ clean: true, text: same });
  });
});

describe("line diff for the compare view", () => {
  it("groups unchanged, my and their lines", () => {
    const blocks = lineDiff("a\nb\nc", "a\nB\nc");
    expect(blocks).toEqual([
      { kind: "same", lines: ["a"] },
      { kind: "mine", lines: ["b"] },
      { kind: "theirs", lines: ["B"] },
      { kind: "same", lines: ["c"] },
    ]);
  });
});
