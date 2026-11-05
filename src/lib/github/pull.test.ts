import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { markdownToDoc } from "@/lib/markdown/parse";
import { AppDB, getDB, setDBForTests } from "@/lib/storage/db";
import { createPage, ensureWorkspace, getPage, getWorkspace, listPages, movePage, savePageContent, trashPage } from "@/lib/storage/local-repo";
import { GitHubApi } from "./api";
import { FakeGitHub } from "./fake-github";
import { pullWorkspace, resolveConflict, restorePageVersion, syncWorkspace } from "./pull";
import { listFileCommits, readFileAt } from "./repo";
import { connectWorkspace, pageFileText, pendingCount, pushWorkspace } from "./sync";

const welcome = { title: "Combat", markdown: "## Core loop\n\nExplore.\n\n## Bosses\n\nThree phases.\n", workspaceName: "Twin Coasters" };
const repo = { owner: "team", name: "game", branch: "main", dir: "GDD" };
const unity = { "Assets/Scripts/Player.cs": "class Player {}", "ProjectSettings/ProjectVersion.txt": "6000.0" };

let gh: FakeGitHub;
let api: GitHubApi;

beforeEach(() => {
  setDBForTests(new AppDB(`pull-${Math.random()}`));
  gh = new FakeGitHub();
  api = new GitHubApi(async () => "ghu_test", gh.fetch);
});

async function setup() {
  gh.addRepo("team", "game", { files: unity });
  const ws = await ensureWorkspace(welcome);
  await connectWorkspace(api, ws.id, repo);
  const [page] = await listPages(ws.id);
  const path = `GDD/pages/${page.id}.md`;
  const remoteText = () => gh.files("team/game")[path];
  /** A teammate edits the page file on GitHub. */
  const teammateEdits = (fn: (text: string) => string) => gh.commit("team/game", { [path]: fn(remoteText()) }, "Teammate edit");
  return { ws, page, path, remoteText, teammateEdits };
}

const editWorkspaceJson = (fn: (json: { tree: { id: string; parentId: string | null }[]; pillars: unknown[] }) => void, message: string) => {
  const json = JSON.parse(gh.files("team/game")["GDD/workspace.json"]);
  fn(json);
  gh.commit("team/game", { "GDD/workspace.json": `${JSON.stringify(json, null, 2)}\n` }, message);
};

describe("pull", () => {
  it("does nothing when GitHub has no new commits", async () => {
    const { ws } = await setup();
    expect((await pullWorkspace(api, ws.id)).pulled).toBe(false);
  });

  it("ignores teammates' commits that don't touch the GDD", async () => {
    const { ws, page } = await setup();
    gh.commit("team/game", { "Assets/Scripts/Enemy.cs": "class Enemy {}" }, "Code");
    const r = await pullWorkspace(api, ws.id);
    expect(r).toMatchObject({ pulled: true, updated: [], conflicts: [] });
    expect((await getPage(page.id))?.markdown).toBe(welcome.markdown);
  });

  it("takes a teammate's edit when the page wasn't changed here", async () => {
    const { ws, page, teammateEdits } = await setup();
    teammateEdits((t) => t.replace("Three phases.", "Four phases."));
    const r = await pullWorkspace(api, ws.id);
    expect(r.updated).toEqual([page.id]);
    const local = await getPage(page.id);
    expect(local?.markdown).toContain("Four phases.");
    expect(local?.dirty).toBe(false);
    expect(await pendingCount(ws.id)).toBe(0);
  });

  it("takes a teammate's title change", async () => {
    const { ws, page, teammateEdits } = await setup();
    teammateEdits((t) => t.replace('title: "Combat"', 'title: "Combat System"'));
    await pullWorkspace(api, ws.id);
    expect((await getPage(page.id))?.title).toBe("Combat System");
  });

  it("merges edits to different parts of the same page, then pushes the merge", async () => {
    const { ws, page, teammateEdits, remoteText } = await setup();
    teammateEdits((t) => t.replace("Three phases.", "Four phases."));
    await savePageContent(page.id, markdownToDoc(welcome.markdown.replace("Explore.", "Explore and loot.")));

    const { pull } = await syncWorkspace(api, ws.id);
    expect(pull.merged).toEqual([page.id]);
    const local = await getPage(page.id);
    expect(local?.markdown).toContain("Explore and loot.");
    expect(local?.markdown).toContain("Four phases.");
    expect(remoteText()).toContain("Explore and loot.");
    expect(remoteText()).toContain("Four phases.");
    expect(await pendingCount(ws.id)).toBe(0);
  });

  it("marks a conflict when both edited the same line, keeps my text, and still pushes other pages", async () => {
    const { ws, page, teammateEdits, remoteText } = await setup();
    const other = await createPage(ws.id, { title: "Levels", markdown: "Forest\n" });
    await pushWorkspace(api, ws.id);

    teammateEdits((t) => t.replace("Three phases.", "Five phases."));
    await savePageContent(page.id, markdownToDoc(welcome.markdown.replace("Three phases.", "Two phases.")));
    await savePageContent(other.id, markdownToDoc("Forest and cave\n"));

    const { pull } = await syncWorkspace(api, ws.id);
    expect(pull.conflicts).toEqual([page.id]);
    const local = await getPage(page.id);
    expect(local?.markdown).toContain("Two phases.");
    expect(local?.conflict?.remoteText).toContain("Five phases.");
    expect(remoteText()).toContain("Five phases."); // their text is not overwritten
    expect(gh.files("team/game")[`GDD/pages/${other.id}.md`]).toContain("Forest and cave");
  });

  it("resolves a conflict with 'keep mine': my text is pushed over theirs", async () => {
    const { ws, page, teammateEdits, remoteText } = await setup();
    teammateEdits((t) => t.replace("Three phases.", "Five phases."));
    await savePageContent(page.id, markdownToDoc(welcome.markdown.replace("Three phases.", "Two phases.")));
    await syncWorkspace(api, ws.id);

    await resolveConflict(page.id, "mine");
    await syncWorkspace(api, ws.id);
    expect(remoteText()).toContain("Two phases.");
    expect((await getPage(page.id))?.conflict).toBeUndefined();
    expect(await pendingCount(ws.id)).toBe(0);
  });

  it("resolves a conflict with 'keep theirs': their text replaces mine", async () => {
    const { ws, page, teammateEdits } = await setup();
    teammateEdits((t) => t.replace("Three phases.", "Five phases."));
    await savePageContent(page.id, markdownToDoc(welcome.markdown.replace("Three phases.", "Two phases.")));
    await syncWorkspace(api, ws.id);

    await resolveConflict(page.id, "theirs");
    const local = await getPage(page.id);
    expect(local?.markdown).toContain("Five phases.");
    expect(local?.conflict).toBeUndefined();
    expect(await pendingCount(ws.id)).toBe(0);
  });

  it("adds pages and images created by a teammate", async () => {
    const { ws } = await setup();
    const newId = "01NEWPAGE00000000000000000";
    const json = JSON.parse(gh.files("team/game")["GDD/workspace.json"]);
    json.tree.push({ id: newId, parentId: null, order: 99, title: "Story" });
    gh.commit(
      "team/game",
      {
        [`GDD/pages/${newId}.md`]: `---\nid: "${newId}"\ntitle: "Story"\n---\n\nOnce upon a time.\n`,
        "GDD/workspace.json": `${JSON.stringify(json, null, 2)}\n`,
        "GDD/assets/abc-map.png": "PNG",
      },
      "Teammate adds Story",
    );
    const r = await pullWorkspace(api, ws.id);
    expect(r.added).toEqual([newId]);
    expect(await getPage(newId)).toMatchObject({ title: "Story", markdown: "Once upon a time.\n", order: 99 });
    expect(await getDB().assets.get("assets/abc-map.png")).toBeDefined();
    expect(await pendingCount(ws.id)).toBe(0);
  });

  it("removes a page deleted on GitHub, but keeps it if I edited it", async () => {
    const { ws, page, path } = await setup();
    const keep = await createPage(ws.id, { title: "Notes", markdown: "Mine\n" });
    await pushWorkspace(api, ws.id);
    gh.commit("team/game", { [path]: null, [`GDD/pages/${keep.id}.md`]: null }, "Teammate deletes two pages");
    await savePageContent(keep.id, markdownToDoc("Mine, edited\n"));

    const r = await pullWorkspace(api, ws.id);
    expect(r.removed).toEqual([page.id]);
    expect((await listPages(ws.id)).map((p) => p.title)).toEqual(["Notes"]);
    await pushWorkspace(api, ws.id);
    expect(gh.files("team/game")[`GDD/pages/${keep.id}.md`]).toContain("Mine, edited");
  });

  it("restores a page I deleted when a teammate edited it meanwhile", async () => {
    const { ws, page, teammateEdits } = await setup();
    await trashPage(page.id);
    teammateEdits((t) => t.replace("Three phases.", "Four phases."));
    await syncWorkspace(api, ws.id);
    const local = await getPage(page.id);
    expect(local?.deletedAt).toBeUndefined();
    expect(local?.markdown).toContain("Four phases.");
  });

  it("takes a teammate's move in the page tree", async () => {
    const { ws, page } = await setup();
    const parent = await createPage(ws.id, { title: "Design" });
    await pushWorkspace(api, ws.id);
    editWorkspaceJson((j) => {
      j.tree.find((n) => n.id === page.id)!.parentId = parent.id;
    }, "Teammate moves Combat");
    await pullWorkspace(api, ws.id);
    expect((await getPage(page.id))?.parentId).toBe(parent.id);
    expect(await pendingCount(ws.id)).toBe(0);
  });

  it("keeps my own move when we both moved the same page", async () => {
    const { ws, page } = await setup();
    const a = await createPage(ws.id, { title: "A" });
    const b = await createPage(ws.id, { title: "B" });
    await pushWorkspace(api, ws.id);
    editWorkspaceJson((j) => {
      j.tree.find((n) => n.id === page.id)!.parentId = a.id;
    }, "Teammate moves to A");
    await movePage(page.id, { parentId: b.id, order: 1 });
    await syncWorkspace(api, ws.id);
    expect((await getPage(page.id))?.parentId).toBe(b.id);
    const remoteTree = JSON.parse(gh.files("team/game")["GDD/workspace.json"]).tree as { id: string; parentId: string }[];
    expect(remoteTree.find((n) => n.id === page.id)?.parentId).toBe(b.id);
  });

  it("takes teammates' pillars when mine didn't change", async () => {
    const { ws } = await setup();
    editWorkspaceJson((j) => {
      j.pillars = [{ id: "01PPPPPPPPPPPPPPPPPPPPPPPP", title: "Speed" }];
    }, "Pillars");
    await pullWorkspace(api, ws.id);
    expect((await getWorkspace(ws.id))?.pillars?.[0]).toMatchObject({ title: "Speed" });
  });

  it("postpones the page being edited and picks it up on the next pull", async () => {
    const { ws, page, teammateEdits } = await setup();
    teammateEdits((t) => t.replace("Three phases.", "Four phases."));
    const busy = await syncWorkspace(api, ws.id, { canTouchPage: (id) => id !== page.id });
    expect(busy.pull.deferred).toEqual([page.id]);
    expect((await getPage(page.id))?.markdown).toContain("Three phases.");
    expect((await getWorkspace(ws.id))?.pullDeferred).toBe(true);

    const later = await pullWorkspace(api, ws.id);
    expect(later.updated).toEqual([page.id]);
    expect((await getPage(page.id))?.markdown).toContain("Four phases.");
  });
});

describe("page history", () => {
  it("lists who changed a page and restores an older version as a new commit", async () => {
    const { ws, page, path, teammateEdits, remoteText } = await setup();
    teammateEdits((t) => t.replace("Three phases.", "Four phases."));
    await pullWorkspace(api, ws.id);

    const commits = await listFileCommits(api, repo, path);
    expect(commits.map((c) => c.author)).toEqual(["teammate", "octo-designer"]);
    expect(commits[0].message).toBe("Teammate edit");

    const original = await readFileAt(api, repo, path, commits[1].sha);
    expect(original).toContain("Three phases.");
    await restorePageVersion(page.id, original!);
    await syncWorkspace(api, ws.id);
    expect(remoteText()).toContain("Three phases.");
    expect(await listFileCommits(api, repo, path)).toHaveLength(3);
    expect(pageFileText((await getPage(page.id))!)).toBe(remoteText());
  });
});
