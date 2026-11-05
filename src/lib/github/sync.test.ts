import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { markdownToDoc } from "@/lib/markdown/parse";
import { AppDB, getDB, setDBForTests } from "@/lib/storage/db";
import { createPage, ensureWorkspace, getPage, getWorkspace, listPages, savePageContent, savePageTitle, trashPage, updateWorkspace } from "@/lib/storage/local-repo";
import { GitHubApi, OfflineError, RateLimitError, RemoteChangedError, SignedOutError } from "./api";
import { FakeGitHub } from "./fake-github";
import { commitChanges, listRepos } from "./repo";
import { connectWorkspace, NotAWorkspaceError, openRepoWorkspace, pendingChanges, pushWorkspace, RepoHasWorkspaceError } from "./sync";

const welcome = { title: "Welcome", markdown: "Hello\n", workspaceName: "Dungeon Game" };
const repo = { owner: "team", name: "gdd", branch: "main" };

let gh: FakeGitHub;
let api: GitHubApi;

beforeEach(() => {
  setDBForTests(new AppDB(`sync-${Math.random()}`));
  gh = new FakeGitHub();
  api = new GitHubApi(async () => "ghu_test", gh.fetch);
});

describe("GitHub API client", () => {
  it("lists repositories the app is installed on", async () => {
    gh.addRepo("team", "gdd");
    gh.addRepo("team", "art");
    expect((await listRepos(api)).map((r) => r.fullName)).toEqual(["team/art", "team/gdd"]);
  });

  it("maps errors to typed errors", async () => {
    await expect(new GitHubApi(async () => null, gh.fetch).get("/user")).rejects.toBeInstanceOf(SignedOutError);
    const offline = new GitHubApi(async () => "t", async () => Promise.reject(new TypeError("fetch failed")));
    await expect(offline.get("/user")).rejects.toBeInstanceOf(OfflineError);
    const limited = new GitHubApi(async () => "t", async () =>
      new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000000000" } }));
    const err = await limited.get("/user").catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.resetAt).toBe(2_000_000_000_000);
  });

  it("never forces a ref update: a moved branch is reported, not overwritten", async () => {
    gh.addRepo("team", "gdd", { files: { "a.txt": "1" } });
    const staleHead = gh.repos.get("team/gdd")!.refs.get("main")!;
    gh.commit("team/gdd", { "a.txt": "2 (someone else)" }, "Other change");
    const change = { path: "a.txt", content: new TextEncoder().encode("3 (mine)") };
    await expect(
      commitChanges(api, repo, { expectedHead: staleHead, changes: [change], message: "x", readmeForEmptyRepo: "" }),
    ).rejects.toBeInstanceOf(RemoteChangedError);
    expect(gh.files("team/gdd")["a.txt"]).toBe("2 (someone else)");
  });
});

describe("connect a local workspace to a repository", () => {
  it("pushes every page, workspace.json and a README into an empty repo in one commit", async () => {
    gh.addRepo("team", "gdd");
    const ws = await ensureWorkspace(welcome);
    const levels = await createPage(ws.id, { title: "Levels" });
    await createPage(ws.id, { title: "Forest", parentId: levels.id, markdown: "- [ ] Place the boss\n" });
    await updateWorkspace(ws.id, { pillars: [{ id: "01PPPPPPPPPPPPPPPPPPPPPPPP", title: "Explore" }] });

    const result = await connectWorkspace(api, ws.id, repo);
    expect(result.files).toBe(4); // 3 pages + workspace.json

    const files = gh.files("team/gdd");
    const pageFiles = (await listPages(ws.id)).map((p) => `pages/${p.id}.md`);
    expect(Object.keys(files).sort()).toEqual(["README.md", "workspace.json", ...pageFiles].sort());
    expect(files["README.md"]).toContain("Dungeon Game");
    const json = JSON.parse(files["workspace.json"]);
    expect(json.name).toBe("Dungeon Game");
    expect(json.pillars[0].title).toBe("Explore");
    expect(json.tree.find((n: { title: string }) => n.title === "Forest").parentId).toBe(levels.id);
    const forest = Object.entries(files).find(([p, t]) => p.startsWith("pages/") && t.includes('title: "Forest"'))!;
    expect(forest[1]).toContain("- [ ] Place the boss");
    expect(gh.lastCommitMessage("team/gdd")).toMatch(/^Add PageHut workspace/);

    const local = await getWorkspace(ws.id);
    expect(local).toMatchObject({ mode: "github", repo, headSha: gh.repos.get("team/gdd")!.refs.get("main") });
    expect((await pendingChanges(ws.id)).changes).toEqual([]);
  });

  it("works with a repo that already has unrelated files, and keeps them", async () => {
    gh.addRepo("team", "gdd", { files: { "README.md": "# Our game", "build/notes.txt": "keep me" } });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, repo);
    const files = gh.files("team/gdd");
    expect(files["README.md"]).toBe("# Our game");
    expect(files["build/notes.txt"]).toBe("keep me");
    expect(files["workspace.json"]).toBeDefined();
  });

  it("refuses a repo that already holds a workspace and stays in local mode", async () => {
    gh.addRepo("team", "gdd", { files: { "workspace.json": "{}" } });
    const ws = await ensureWorkspace(welcome);
    await expect(connectWorkspace(api, ws.id, repo)).rejects.toBeInstanceOf(RepoHasWorkspaceError);
    expect((await getWorkspace(ws.id))?.mode).toBe("local");
  });
});

describe("push changes", () => {
  async function connected() {
    gh.addRepo("team", "gdd");
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, repo);
    return ws;
  }

  it("sends only changed pages, with a readable commit message", async () => {
    const ws = await connected();
    const [page] = await listPages(ws.id);
    await savePageContent(page.id, markdownToDoc("Changed text\n"));
    await savePageTitle(page.id, "Combat System");

    const pending = await pendingChanges(ws.id);
    expect(pending.changes.map((c) => c.path).sort()).toEqual([`pages/${page.id}.md`, "workspace.json"]);
    await pushWorkspace(api, ws.id);
    expect(gh.lastCommitMessage("team/gdd")).toMatch(/^Update "Combat System"/);
    expect(gh.files("team/gdd")[`pages/${page.id}.md`]).toContain("Changed text");
    expect((await pushWorkspace(api, ws.id)).commit).toBeNull();
  });

  it("deletes the files of pages moved to trash", async () => {
    const ws = await connected();
    const [page] = await listPages(ws.id);
    await trashPage(page.id);
    await pushWorkspace(api, ws.id);
    expect(gh.files("team/gdd")[`pages/${page.id}.md`]).toBeUndefined();
    expect(JSON.parse(gh.files("team/gdd")["workspace.json"]).tree).toEqual([]);
  });

  it("stops without losing anything when someone else pushed first", async () => {
    const ws = await connected();
    const [page] = await listPages(ws.id);
    gh.commit("team/gdd", { "notes.md": "teammate" }, "Teammate change");
    await savePageContent(page.id, markdownToDoc("My unsynced text\n"));
    await expect(pushWorkspace(api, ws.id)).rejects.toBeInstanceOf(RemoteChangedError);
    expect((await getPage(page.id))?.markdown).toBe("My unsynced text\n");
    expect((await pendingChanges(ws.id)).changes.length).toBeGreaterThan(0);
  });

  it("does not report 'synced' when GitHub has newer commits and nothing is pending locally", async () => {
    const ws = await connected();
    gh.commit("team/gdd", { "notes.md": "teammate" }, "Teammate change");
    await expect(pushWorkspace(api, ws.id)).rejects.toBeInstanceOf(RemoteChangedError);
  });

  it("uploads new images once", async () => {
    const ws = await connected();
    await getDB().assets.add({
      path: "assets/abc-hero.png", workspaceId: ws.id, blob: new Blob([new Uint8Array([137, 80, 78, 71])]), mime: "image/png", size: 4, createdAt: 1,
    });
    await pushWorkspace(api, ws.id);
    expect(gh.files("team/gdd")["assets/abc-hero.png"]).toBeDefined();
    expect((await pendingChanges(ws.id)).assetPaths).toEqual([]);
  });
});

describe("open a workspace from a repository", () => {
  it("round-trips: what one device pushes, another opens", async () => {
    gh.addRepo("team", "gdd");
    const ws = await ensureWorkspace(welcome);
    const parent = await createPage(ws.id, { title: "Story", markdown: ":::callout idea\nTwist!\n:::\n" });
    await createPage(ws.id, { title: "Act I", parentId: parent.id });
    await connectWorkspace(api, ws.id, repo);

    // Second device: fresh database.
    setDBForTests(new AppDB(`device2-${Math.random()}`));
    const openedId = await openRepoWorkspace(api, repo);
    const opened = await getWorkspace(openedId);
    expect(opened).toMatchObject({ name: "Dungeon Game", mode: "github", repo });
    const pages = await listPages(openedId);
    expect(pages.map((p) => p.title).sort()).toEqual(["Act I", "Story", "Welcome"]);
    expect(pages.find((p) => p.title === "Story")?.markdown).toBe(":::callout idea\nTwist!\n:::\n");
    expect(pages.find((p) => p.title === "Act I")?.parentId).toBe(parent.id);
    expect((await pendingChanges(openedId)).changes).toEqual([]);

    // Opening again returns the same local workspace.
    expect(await openRepoWorkspace(api, repo)).toBe(openedId);
  });

  it("rejects repositories without workspace.json", async () => {
    gh.addRepo("team", "gdd", { files: { "README.md": "hi" } });
    await expect(openRepoWorkspace(api, repo)).rejects.toBeInstanceOf(NotAWorkspaceError);
    gh.addRepo("team", "empty");
    await expect(openRepoWorkspace(api, { ...repo, name: "empty" })).rejects.toBeInstanceOf(NotAWorkspaceError);
  });
});
