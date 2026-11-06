import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { schemaExtensions } from "@/lib/editor/extensions";
import { markdownToDoc } from "@/lib/markdown/parse";
import { anchorFor, findAnchor, flatten } from "./anchor";
import { mentions, mergeThreads, type Thread } from "./types";

const schema = getSchema(schemaExtensions());
const docOf = (md: string) => PMNode.fromJSON(schema, markdownToDoc(md));
const textAt = (doc: PMNode, r: { from: number; to: number } | null) => (r ? doc.textBetween(r.from, r.to) : null);

describe("anchors", () => {
  const md = "## Combat\n\nThe boss has three phases.\n\n- Dash cancels attacks\n- The boss has a shield\n";

  it("anchors a selection by its text and finds it again", () => {
    const doc = docOf(md);
    const from = flatten(doc);
    const i = from.text.indexOf("three phases");
    const anchor = anchorFor(doc, from.pos[i], from.pos[i + "three phases".length - 1] + 1)!;
    expect(anchor.exact).toBe("three phases");
    expect(textAt(doc, findAnchor(doc, anchor))).toBe("three phases");
  });

  it("survives edits before it, and picks the right one of several matches by context", () => {
    const doc = docOf(md);
    const flat = flatten(doc);
    const second = flat.text.lastIndexOf("The boss");
    const anchor = anchorFor(doc, flat.pos[second], flat.pos[second + 7] + 1)!;
    expect(anchor.exact).toBe("The boss");

    const edited = docOf(`## Combat and enemies\n\nIntro paragraph added by a teammate.\n\n${md.split("\n\n").slice(1).join("\n\n")}`);
    const found = findAnchor(edited, anchor)!;
    expect(textAt(edited, found)).toBe("The boss");
    // It is the one in the list ("…has a shield"), not the paragraph.
    expect(edited.textBetween(found.from, found.to + 14)).toBe("The boss has a shield");
  });

  it("reports a detached anchor when the quoted text is gone", () => {
    const doc = docOf(md);
    expect(findAnchor(doc, { exact: "four phases", prefix: "", suffix: "" })).toBeNull();
  });
});

describe("comment merge", () => {
  const c = (id: string, body: string, author = "ada") => ({ id, author, body, createdAt: 1 });
  const base: Thread[] = [{ id: "t1", anchor: { exact: "boss", prefix: "", suffix: "" }, comments: [c("c1", "Too long?")] }];

  it("keeps replies and threads added on both sides", () => {
    const mine: Thread[] = [{ ...base[0], comments: [...base[0].comments, c("c2", "Agreed", "me")] }, { id: "t2", comments: [c("c3", "Page note", "me")] }];
    const theirs: Thread[] = [{ ...base[0], comments: [...base[0].comments, c("c4", "Cut phase 2")] }];
    const merged = mergeThreads(base, mine, theirs);
    expect(merged.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(merged[0].comments.map((x) => x.id)).toEqual(["c1", "c2", "c4"]);
  });

  it("never loses text when the same comment is edited on both sides", () => {
    const edit = (body: string): Thread[] => [{ ...base[0], comments: [{ ...base[0].comments[0], body, editedAt: 2 }] }];
    const merged = mergeThreads(base, edit("Too long."), edit("Way too long?"));
    expect(merged[0].comments[0].body).toBe("Too long.\n\nWay too long?");
  });

  it("a reply on one side reopens a thread resolved on the other", () => {
    const resolved: Thread[] = [{ ...base[0], resolved: true }];
    const replied: Thread[] = [{ ...base[0], comments: [...base[0].comments, c("c9", "Not done yet")] }];
    expect(mergeThreads(base, resolved, replied)[0].resolved).toBe(false);
    expect(mergeThreads(base, resolved, base)[0].resolved).toBe(true);
  });

  it("finds @mentions", () => {
    expect(mentions("Hey @Ada and @bob-2, see mail@example.com and @ada again")).toEqual(["ada", "bob-2"]);
  });
});
