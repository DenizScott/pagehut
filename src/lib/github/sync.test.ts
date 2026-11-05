import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { markdownToDoc } from "@/lib/markdown/parse";
import { AppDB, getDB, setDBForTests } from "@/lib/storage/db";
import { createPage, ensureWorkspace, getPage, getWorkspace, listPages, savePageContent, savePageTitle, trashPage, updateWorkspace } from "@/lib/storage/local-repo";
import { GitHubApi, OfflineError, RateLimitError, RemoteChangedError, SignedOutError } from "./api";
import { FakeGitHub } from "./fake-github";
import { commitChanges, listRepos } from "./repo";
import {
  connectWorkspace,
  migrateLegacyRootWorkspace,
  moveWorkspaceDir,
  NotAWorkspaceError,
  openRepoWorkspace,
  pendingChanges,
  pendingCount,
  PendingChangesError,
  pushWorkspace,
  RepoHasWorkspaceError,
} from "./sync";

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
    const repoState = gh.repos.get("team/gdd")!;
    const staleHead = repoState.refs.get("main")!;
    const oldSha = repoState.trees.get(repoState.commits.get(staleHead)!.tree)!.get("a.txt")!;
    gh.commit("team/gdd", { "a.txt": "2 (someone else)" }, "Other change");
    const change = { path: "a.txt", content: new TextEncoder().encode("3 (mine)"), expectedSha: oldSha };
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

  it("pushes on top of teammates' commits to other files (e.g. Unity code)", async () => {
    const ws = await connected();
    const [page] = await listPages(ws.id);
    gh.commit("team/gdd", { "Assets/Scripts/Player.cs": "class Player {}" }, "Teammate: player script");
    await savePageContent(page.id, markdownToDoc("Design update\n"));
    await pushWorkspace(api, ws.id);
    const files = gh.files("team/gdd");
    expect(files["Assets/Scripts/Player.cs"]).toBe("class Player {}");
    expect(files[`pages/${page.id}.md`]).toContain("Design update");
  });

  it("stops without losing anything when a teammate changed the same page", async () => {
    const ws = await connected();
    const [page] = await listPages(ws.id);
    gh.commit("team/gdd", { [`pages/${page.id}.md`]: "---\ntitle: \"Welcome\"\n---\nTheir edit\n" }, "Teammate edits the page");
    await savePageContent(page.id, markdownToDoc("My unsynced text\n"));
    await expect(pushWorkspace(api, ws.id)).rejects.toBeInstanceOf(RemoteChangedError);
    expect((await getPage(page.id))?.markdown).toBe("My unsynced text\n");
    expect(gh.files("team/gdd")[`pages/${page.id}.md`]).toContain("Their edit");
  });

  it("reports GitHub as ahead only when the workspace's own files changed there", async () => {
    const ws = await connected();
    gh.commit("team/gdd", { "Assets/x.cs": "code" }, "Unrelated");
    expect((await pushWorkspace(api, ws.id)).commit).toBeNull();
    const [page] = await listPages(ws.id);
    gh.commit("team/gdd", { [`pages/${page.id}.md`]: "changed remotely" }, "Page edited on GitHub");
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

describe("workspace in a folder of a game repository", () => {
  const gameFiles = { "README.md": "# Twin Coasters", "Assets/Scripts/Player.cs": "class Player {}", "ProjectSettings/ProjectVersion.txt": "6000.0" };

  it("connects into GDD/ and leaves the game project untouched", async () => {
    gh.addRepo("team", "gdd", { files: gameFiles });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, { ...repo, dir: "/GDD/" });
    const files = gh.files("team/gdd");
    for (const [p, t] of Object.entries(gameFiles)) expect(files[p]).toBe(t);
    expect(files["GDD/workspace.json"]).toBeDefined();
    expect(Object.keys(files).filter((p) => p.startsWith("GDD/pages/"))).toHaveLength(1);
    expect(Object.keys(files).some((p) => p === "workspace.json" || p.startsWith("pages/"))).toBe(false);
    expect((await getWorkspace(ws.id))?.repo?.dir).toBe("GDD");
    expect(gh.lastCommitMessage("team/gdd")).toMatch(/in GDD\//);
  });

  it("opens a workspace from a folder without being told where it is", async () => {
    gh.addRepo("team", "gdd", { files: gameFiles });
    const ws = await ensureWorkspace(welcome);
    await createPage(ws.id, { title: "Levels", markdown: "Forest\n" });
    await connectWorkspace(api, ws.id, { ...repo, dir: "GDD" });

    setDBForTests(new AppDB(`device2-${Math.random()}`));
    const id = await openRepoWorkspace(api, repo);
    expect((await getWorkspace(id))?.repo?.dir).toBe("GDD");
    expect((await listPages(id)).map((p) => p.title).sort()).toEqual(["Levels", "Welcome"]);
    expect(await pendingCount(id)).toBe(0);
  });

  it("moves an existing root workspace into GDD/ in one commit", async () => {
    gh.addRepo("team", "gdd", { files: gameFiles });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, repo);
    const [page] = await listPages(ws.id);

    await moveWorkspaceDir(api, ws.id, "GDD");
    const files = gh.files("team/gdd");
    expect(files["workspace.json"]).toBeUndefined();
    expect(files[`pages/${page.id}.md`]).toBeUndefined();
    expect(files["GDD/workspace.json"]).toBeDefined();
    expect(files[`GDD/pages/${page.id}.md`]).toContain('title: "Welcome"');
    expect(files["Assets/Scripts/Player.cs"]).toBe("class Player {}");
    expect(gh.lastCommitMessage("team/gdd")).toMatch(/^Move PageHut workspace to GDD\//);
    expect(await pendingCount(ws.id)).toBe(0);

    // Later edits go to the new folder.
    await savePageContent(page.id, markdownToDoc("After the move\n"));
    await pushWorkspace(api, ws.id);
    expect(gh.files("team/gdd")[`GDD/pages/${page.id}.md`]).toContain("After the move");
  });

  it("refuses to move while changes are unpushed, and rejects unsafe folder names", async () => {
    gh.addRepo("team", "gdd", { files: gameFiles });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, repo);
    const [page] = await listPages(ws.id);
    await savePageContent(page.id, markdownToDoc("unpushed\n"));
    await expect(moveWorkspaceDir(api, ws.id, "GDD")).rejects.toBeInstanceOf(PendingChangesError);
    await expect(connectWorkspace(api, (await ensureWorkspace(welcome)).id, { ...repo, dir: "../evil" })).rejects.toThrow(/Invalid folder/);
  });

  it("counts only real pending changes (not old trashed local pages)", async () => {
    gh.addRepo("team", "gdd");
    const ws = await ensureWorkspace(welcome);
    const draft = await createPage(ws.id, { title: "Draft" });
    await trashPage(draft.id);
    await connectWorkspace(api, ws.id, repo);
    expect(await pendingCount(ws.id)).toBe(0);
  });
});

describe("workspaces connected by an older version (no stored workspace.json sha)", () => {
  it("still push and move after teammates commit Unity code", async () => {
    gh.addRepo("team", "gdd", { files: { "Assets/Scripts/Player.cs": "class Player {}" } });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, { ...repo, dir: "" });
    // Simulate the earlier version: the sha of workspace.json was never stored.
    await getDB().workspaces.update(ws.id, { workspaceFileSha: undefined });

    gh.commit("team/gdd", { "Assets/Scripts/Enemy.cs": "class Enemy {}" }, "Teammate: enemy");
    const [page] = await listPages(ws.id);
    await savePageTitle(page.id, "TwinCoasters");
    await pushWorkspace(api, ws.id);
    expect(JSON.parse(gh.files("team/gdd")["workspace.json"]).tree[0].title).toBe("TwinCoasters");

    gh.commit("team/gdd", { "Assets/Scripts/Boss.cs": "class Boss {}" }, "Teammate: boss");
    await getDB().workspaces.update(ws.id, { workspaceFileSha: undefined });
    await moveWorkspaceDir(api, ws.id, "GDD");
    const files = gh.files("team/gdd");
    expect(files["GDD/workspace.json"]).toBeDefined();
    expect(files["workspace.json"]).toBeUndefined();
    expect(files["Assets/Scripts/Boss.cs"]).toBe("class Boss {}");
  });

  it("computes the same blob id as git", async () => {
    const { gitBlobSha } = await import("./api");
    // `printf 'hello\n' | git hash-object --stdin`
    expect(await gitBlobSha(new TextEncoder().encode("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });
});

describe("automatic move of older root workspaces in game repos", () => {
  const unity = { "Assets/Scripts/Player.cs": "class Player {}", "ProjectSettings/ProjectVersion.txt": "6000.0" };

  async function legacyConnected(files: Record<string, string>) {
    gh.addRepo("team", "gdd", { files });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, { ...repo, dir: "" });
    // Older versions stored no folder and no workspace.json sha.
    await getDB().workspaces.update(ws.id, { repo: { owner: "team", name: "gdd", branch: "main" }, workspaceFileSha: undefined });
    return ws;
  }

  it("moves a root workspace in a Unity repo to GDD/, including unpushed edits", async () => {
    const ws = await legacyConnected(unity);
    gh.commit("team/gdd", { "Assets/Scripts/Enemy.cs": "class Enemy {}" }, "Teammate");
    const [page] = await listPages(ws.id);
    await savePageTitle(page.id, "TwinCoasters");

    expect(await migrateLegacyRootWorkspace(api, ws.id)).toBe("moved");
    const files = gh.files("team/gdd");
    expect(files["workspace.json"]).toBeUndefined();
    expect(files[`GDD/pages/${page.id}.md`]).toContain('title: "TwinCoasters"');
    expect(files["Assets/Scripts/Enemy.cs"]).toBe("class Enemy {}");
    expect((await getWorkspace(ws.id))?.repo?.dir).toBe("GDD");
    expect(await migrateLegacyRootWorkspace(api, ws.id)).toBe("skipped");
  });

  it("keeps the root in a repo that is not a game project, and never asks again", async () => {
    const ws = await legacyConnected({ "README.md": "# Docs" });
    expect(await migrateLegacyRootWorkspace(api, ws.id)).toBe("kept");
    expect(gh.files("team/gdd")["workspace.json"]).toBeDefined();
    expect((await getWorkspace(ws.id))?.repo?.dir).toBe("");
    expect(await migrateLegacyRootWorkspace(api, ws.id)).toBe("skipped");
  });

  it("never moves a workspace whose folder was chosen on purpose", async () => {
    gh.addRepo("team", "gdd", { files: unity });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, { ...repo, dir: "" });
    expect(await migrateLegacyRootWorkspace(api, ws.id)).toBe("skipped");
    expect(gh.files("team/gdd")["workspace.json"]).toBeDefined();
  });

  it("recognizes Unity, Unreal and Godot projects", async () => {
    const { isGameProject } = await import("./sync");
    expect(isGameProject(["Assets/a.cs", "ProjectSettings/x.asset"])).toBe(true);
    expect(isGameProject(["MyGame.uproject", "Source/x.cpp"])).toBe(true);
    expect(isGameProject(["project.godot"])).toBe(true);
    expect(isGameProject(["README.md", "docs/Assets/x.png"])).toBe(false);
  });
});

describe("migration concurrency", () => {
  it("runs once even when started twice at the same time", async () => {
    gh.addRepo("team", "gdd", { files: { "Assets/a.cs": "a", "ProjectSettings/p.asset": "p" } });
    const ws = await ensureWorkspace(welcome);
    await connectWorkspace(api, ws.id, { ...repo, dir: "" });
    await getDB().workspaces.update(ws.id, { repo: { owner: "team", name: "gdd", branch: "main" } });
    const results = await Promise.all([migrateLegacyRootWorkspace(api, ws.id), migrateLegacyRootWorkspace(api, ws.id)]);
    expect(results.sort()).toEqual(["moved", "skipped"]);
    expect(gh.files("team/gdd")["GDD/workspace.json"]).toBeDefined();
  });
});
