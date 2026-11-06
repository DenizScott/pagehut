/**
 * In-memory GitHub for tests: the subset of the REST API PageHut uses (user, installations,
 * refs, commits, trees, blobs, contents). Behaves like GitHub where it matters: empty repos refuse
 * Git Data writes (409), and ref updates must be fast-forwards (422).
 */
import { createHash } from "node:crypto";
import { base64ToBytes, bytesToBase64, utf8 } from "./api";

interface Commit {
  tree: string;
  parents: string[];
  message: string;
  author: string;
  date: string;
}

let clock = Date.parse("2026-01-01T00:00:00Z");
const nextDate = () => new Date((clock += 60_000)).toISOString();

export interface FakeRepo {
  owner: string;
  name: string;
  defaultBranch: string;
  blobs: Map<string, Uint8Array>;
  trees: Map<string, Map<string, string>>;
  commits: Map<string, Commit>;
  refs: Map<string, string>;
}

let counter = 0;
const newSha = () => (++counter).toString(16).padStart(40, "0");
/** Blobs use real git ids (like GitHub), so clients can compute them from content. */
const blobSha = (bytes: Uint8Array) =>
  createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), Buffer.from(bytes)])).digest("hex");

export class FakeGitHub {
  repos = new Map<string, FakeRepo>();
  user = { login: "octo-designer", id: 1, avatar_url: "https://avatars.example/1" };
  requests: { method: string; path: string }[] = [];

  addRepo(owner: string, name: string, opts: { files?: Record<string, string>; defaultBranch?: string } = {}) {
    const repo: FakeRepo = {
      owner,
      name,
      defaultBranch: opts.defaultBranch ?? "main",
      blobs: new Map(),
      trees: new Map(),
      commits: new Map(),
      refs: new Map(),
    };
    this.repos.set(`${owner}/${name}`, repo);
    if (opts.files) this.commit(`${owner}/${name}`, opts.files, "Initial commit");
    return repo;
  }

  /** Commits directly (simulates another collaborator pushing). null deletes a file. */
  commit(fullName: string, files: Record<string, string | null>, message: string, branch?: string, author = "teammate"): string {
    const repo = this.repos.get(fullName)!;
    const b = branch ?? repo.defaultBranch;
    const head = repo.refs.get(b);
    const entries = new Map(head ? repo.trees.get(repo.commits.get(head)!.tree)! : []);
    for (const [path, content] of Object.entries(files)) {
      if (content === null) entries.delete(path);
      else {
        const bytes = utf8.encode(content);
        const sha = blobSha(bytes);
        repo.blobs.set(sha, bytes);
        entries.set(path, sha);
      }
    }
    const treeSha = newSha();
    repo.trees.set(treeSha, entries);
    const sha = newSha();
    repo.commits.set(sha, { tree: treeSha, parents: head ? [head] : [], message, author, date: nextDate() });
    repo.refs.set(b, sha);
    return sha;
  }

  /** Current files on a branch, as text. */
  files(fullName: string, branch?: string): Record<string, string> {
    const repo = this.repos.get(fullName)!;
    const head = repo.refs.get(branch ?? repo.defaultBranch);
    if (!head) return {};
    const tree = repo.trees.get(repo.commits.get(head)!.tree)!;
    return Object.fromEntries([...tree].map(([p, sha]) => [p, utf8.decode(repo.blobs.get(sha)!)]));
  }

  lastCommitMessage(fullName: string, branch?: string): string | undefined {
    const repo = this.repos.get(fullName)!;
    const head = repo.refs.get(branch ?? repo.defaultBranch);
    return head ? repo.commits.get(head)!.message : undefined;
  }

  private isAncestor(repo: FakeRepo, ancestor: string, sha: string): boolean {
    const stack = [sha];
    while (stack.length) {
      const s = stack.pop()!;
      if (s === ancestor) return true;
      stack.push(...(repo.commits.get(s)?.parents ?? []));
    }
    return false;
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;
    this.requests.push({ method, path });
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const json = (data: unknown, status = 200) => Response.json(data, { status });
    const fail = (status: number, message: string) => Response.json({ message }, { status });

    if (!(new Headers(init?.headers).get("authorization") ?? "").startsWith("Bearer ")) return fail(401, "Requires authentication");

    if (path === "/user") return json(this.user);
    if (path === "/user/installations") return json({ total_count: 1, installations: [{ id: 42 }] });
    if (path === "/user/installations/42/repositories") {
      const repos = [...this.repos.values()].map((r) => ({
        name: r.name,
        full_name: `${r.owner}/${r.name}`,
        owner: { login: r.owner },
        private: true,
        default_branch: r.defaultBranch,
        permissions: { push: true },
      }));
      return json({ total_count: repos.length, repositories: repos });
    }

    const m = /^\/repos\/([^/]+)\/([^/]+)\/(.*)$/.exec(path);
    if (!m) return fail(404, "Not Found");
    const repo = this.repos.get(`${m[1]}/${m[2]}`);
    if (!repo) return fail(404, "Not Found");
    const rest = m[3];
    const empty = repo.refs.size === 0;

    let r: RegExpExecArray | null;
    if ((r = /^git\/ref\/heads\/(.+)$/.exec(rest)) && method === "GET") {
      if (empty) return fail(409, "Git Repository is empty.");
      const sha = repo.refs.get(decodeURIComponent(r[1]));
      return sha ? json({ object: { sha, type: "commit" } }) : fail(404, "Not Found");
    }
    if ((r = /^git\/commits\/(\w+)$/.exec(rest)) && method === "GET") {
      const c = repo.commits.get(r[1]);
      return c ? json({ sha: r[1], tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })), message: c.message }) : fail(404, "Not Found");
    }
    if ((r = /^git\/trees\/(\w+)$/.exec(rest)) && method === "GET") {
      const t = repo.trees.get(r[1]);
      if (!t) return fail(404, "Not Found");
      return json({
        sha: r[1],
        truncated: false,
        tree: [...t].map(([p, sha]) => ({ path: p, type: "blob", mode: "100644", sha, size: repo.blobs.get(sha)!.length })),
      });
    }
    if ((r = /^git\/blobs\/(\w+)$/.exec(rest)) && method === "GET") {
      const b = repo.blobs.get(r[1]);
      return b ? json({ sha: r[1], content: bytesToBase64(b), encoding: "base64", size: b.length }) : fail(404, "Not Found");
    }
    if (rest === "git/blobs" && method === "POST") {
      if (empty) return fail(409, "Git Repository is empty.");
      const bytes = body.encoding === "base64" ? base64ToBytes(body.content) : utf8.encode(body.content);
      const sha = blobSha(bytes);
      repo.blobs.set(sha, bytes);
      return json({ sha }, 201);
    }
    if (rest === "git/trees" && method === "POST") {
      const entries = new Map(body.base_tree ? repo.trees.get(body.base_tree) : []);
      for (const e of body.tree as { path: string; sha: string | null }[]) {
        if (e.sha === null) entries.delete(e.path);
        else entries.set(e.path, e.sha);
      }
      const sha = newSha();
      repo.trees.set(sha, entries);
      return json({ sha }, 201);
    }
    if (rest === "git/commits" && method === "POST") {
      const sha = newSha();
      repo.commits.set(sha, { tree: body.tree, parents: body.parents, message: body.message, author: this.user.login, date: nextDate() });
      return json({ sha }, 201);
    }
    if ((r = /^git\/refs\/heads\/(.+)$/.exec(rest)) && method === "PATCH") {
      const branch = decodeURIComponent(r[1]);
      const current = repo.refs.get(branch);
      if (!current) return fail(422, "Reference does not exist");
      if (!body.force && !this.isAncestor(repo, current, body.sha)) return fail(422, "Update is not a fast forward");
      repo.refs.set(branch, body.sha);
      return json({ object: { sha: body.sha } });
    }
    if (rest === "collaborators" && method === "GET") {
      const logins = new Set([repo.owner, this.user.login, ...[...repo.commits.values()].map((c) => c.author)]);
      return json([...logins].map((login) => ({ login })));
    }
    if (rest === "commits" && method === "GET") {
      // Commits on the branch (first parent) that changed ?path=, newest first.
      const path = url.searchParams.get("path") ?? "";
      let sha = repo.refs.get(url.searchParams.get("sha") ?? repo.defaultBranch);
      const out = [];
      while (sha) {
        const c: Commit = repo.commits.get(sha)!;
        const parent = c.parents[0] ? repo.commits.get(c.parents[0]) : undefined;
        const now = repo.trees.get(c.tree)!.get(path);
        const before = parent ? repo.trees.get(parent.tree)!.get(path) : undefined;
        if (!path || now !== before) {
          out.push({
            sha,
            commit: { message: c.message, author: { name: c.author, date: c.date } },
            author: { login: c.author, avatar_url: `https://avatars.example/${c.author}` },
          });
        }
        sha = c.parents[0];
      }
      return json(out.slice(0, Number(url.searchParams.get("per_page") ?? 30)));
    }
    if ((r = /^contents\/(.+)$/.exec(rest)) && method === "GET") {
      const ref = url.searchParams.get("ref") ?? repo.refs.get(repo.defaultBranch) ?? "";
      const c = repo.commits.get(ref) ?? repo.commits.get(repo.refs.get(ref) ?? "");
      const blob = c ? repo.trees.get(c.tree)!.get(decodeURIComponent(r[1])) : undefined;
      return blob ? json({ content: bytesToBase64(repo.blobs.get(blob)!), encoding: "base64", sha: blob }) : fail(404, "Not Found");
    }
    if ((r = /^contents\/(.+)$/.exec(rest)) && method === "PUT") {
      const sha = this.commit(`${repo.owner}/${repo.name}`, { [decodeURIComponent(r[1])]: utf8.decode(base64ToBytes(body.content)) }, body.message, body.branch);
      return json({ commit: { sha } }, 201);
    }
    return fail(404, `Fake GitHub: unhandled ${method} ${path}`);
  };
}
