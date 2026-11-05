import { base64ToBytes, bytesToBase64, GitHubError, RemoteChangedError, utf8, type GitHubApi } from "./api";

/** Repository-level operations on top of the Git Data API. */

export interface RepoRef {
  owner: string;
  name: string;
  branch: string;
  /**
   * Folder inside the repository that holds the workspace ("" = repository root), e.g. "GDD" so a
   * game's design documents live next to its Unity/Unreal project.
   */
  dir?: string;
}

/** "GDD/", "/docs/gdd" → "GDD", "docs/gdd"; rejects ".." and odd characters. */
export function normalizeDir(input: string | undefined): string {
  const dir = (input ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
  if (dir.split("/").some((part) => part === ".." || part === ".")) throw new Error("Invalid folder");
  if (dir && !/^[\w .\-/]+$/u.test(dir)) throw new Error("Invalid folder");
  return dir;
}

/** Path of a workspace file inside the repository. */
export const inRepo = (repo: Pick<RepoRef, "dir">, path: string) => (repo.dir ? `${repo.dir}/${path}` : path);

export interface RepoSummary {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  canPush: boolean;
}

export interface GitHubUser {
  login: string;
  avatarUrl: string;
}

const enc = encodeURIComponent;
const repoPath = (r: RepoRef) => `/repos/${enc(r.owner)}/${enc(r.name)}`;

export async function getUser(api: GitHubApi): Promise<GitHubUser> {
  const { data } = await api.get<{ login: string; avatar_url: string }>("/user");
  return { login: data.login, avatarUrl: data.avatar_url };
}

/** Repositories the user can reach through the app's installations. */
export async function listRepos(api: GitHubApi): Promise<RepoSummary[]> {
  const { data } = await api.get<{ installations: { id: number }[] }>("/user/installations?per_page=100");
  const out: RepoSummary[] = [];
  for (const inst of data.installations) {
    for (let page = 1; page <= 10; page++) {
      const res = await api.get<{
        total_count: number;
        repositories: {
          name: string;
          full_name: string;
          owner: { login: string };
          private: boolean;
          default_branch: string;
          permissions?: { push?: boolean };
        }[];
      }>(`/user/installations/${inst.id}/repositories?per_page=100&page=${page}`);
      for (const r of res.data.repositories) {
        out.push({
          owner: r.owner.login,
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          defaultBranch: r.default_branch,
          canPush: r.permissions?.push !== false,
        });
      }
      if (res.data.repositories.length < 100) break;
    }
  }
  return out.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Head commit of a branch, or null when the repository is empty (no commits yet). */
export async function getHead(api: GitHubApi, repo: RepoRef): Promise<{ commit: string; tree: string } | null> {
  const ref = await api.get<{ object: { sha: string } } | { message: string }>(
    `${repoPath(repo)}/git/ref/heads/${enc(repo.branch)}`,
    [404, 409],
  );
  if (ref.status === 409) return null; // empty repository
  if (ref.status === 404) throw new GitHubError(404, `Branch "${repo.branch}" not found`);
  const sha = (ref.data as { object: { sha: string } }).object.sha;
  const { data } = await api.get<{ tree: { sha: string } }>(`${repoPath(repo)}/git/commits/${sha}`);
  return { commit: sha, tree: data.tree.sha };
}

export interface TreeEntry {
  path: string;
  sha: string;
  size: number;
}

export async function readTree(api: GitHubApi, repo: RepoRef, treeSha: string): Promise<TreeEntry[]> {
  const { data } = await api.get<{ truncated: boolean; tree: { path: string; type: string; sha: string; size?: number }[] }>(
    `${repoPath(repo)}/git/trees/${treeSha}?recursive=1`,
  );
  if (data.truncated) throw new GitHubError(413, "Repository tree is too large to read in one request");
  return data.tree.filter((e) => e.type === "blob").map((e) => ({ path: e.path, sha: e.sha, size: e.size ?? 0 }));
}

export async function readBlob(api: GitHubApi, repo: RepoRef, sha: string): Promise<Uint8Array> {
  const { data } = await api.get<{ content: string; encoding: string }>(`${repoPath(repo)}/git/blobs/${sha}`);
  return data.encoding === "base64" ? base64ToBytes(data.content) : utf8.encode(data.content);
}

/**
 * One file to write or delete. `expectedSha` is the blob sha this file had in the repository when
 * we last synced (null = it should not exist). It lets a commit go on top of teammates' newer
 * commits safely: only when none of OUR files changed remotely.
 */
export type FileChange = ({ path: string; content: Uint8Array } | { path: string; delete: true }) & { expectedSha?: string | null };

/** Git Data writes fail on an empty repository, so the first commit goes through the Contents API. */
async function initializeEmptyRepo(api: GitHubApi, repo: RepoRef, readme: string): Promise<{ commit: string; tree: string }> {
  await api.request("PUT", `${repoPath(repo)}/contents/README.md`, {
    message: "Initialize workspace",
    content: bytesToBase64(utf8.encode(readme)),
    branch: repo.branch,
  });
  const head = await getHead(api, repo);
  if (!head) throw new GitHubError(500, "Repository is still empty after initialization");
  return head;
}

/**
 * One commit with all changes. If the branch moved since `expectedHead` (a teammate pushed, e.g.
 * Unity code), the commit is placed on top of the new head, but only if none of the files we write
 * changed remotely. Otherwise RemoteChangedError. The ref update is never forced.
 */
export async function commitChanges(
  api: GitHubApi,
  repo: RepoRef,
  input: { expectedHead: string | null; changes: FileChange[]; message: string; readmeForEmptyRepo: string },
): Promise<{ commit: string; blobShas: Map<string, string> }> {
  // A teammate may push between our check and the ref update (422). Re-check once and retry;
  // the per-file check still refuses anything that would overwrite their work.
  try {
    return await commitOnce(api, repo, input);
  } catch (err) {
    if (!(err instanceof RemoteChangedError) || !input.changes.every((c) => c.expectedSha !== undefined)) throw err;
    return commitOnce(api, repo, input);
  }
}

async function commitOnce(
  api: GitHubApi,
  repo: RepoRef,
  input: { expectedHead: string | null; changes: FileChange[]; message: string; readmeForEmptyRepo: string },
): Promise<{ commit: string; blobShas: Map<string, string> }> {
  let head = await getHead(api, repo);
  if (head && input.expectedHead !== head.commit) {
    // The branch moved. Safe to continue only if every file we touch is still as we last saw it.
    const remote = new Map((await readTree(api, repo, head.tree)).map((e) => [e.path, e.sha]));
    const touched = input.changes.some((c) => c.expectedSha === undefined || (remote.get(c.path) ?? null) !== c.expectedSha);
    if (touched) throw new RemoteChangedError();
  }
  if (!head && input.expectedHead !== null) throw new RemoteChangedError(); // repo was emptied
  head ??= await initializeEmptyRepo(api, repo, input.readmeForEmptyRepo);

  const blobShas = new Map<string, string>();
  const tree: { path: string; mode: "100644"; type: "blob"; sha: string | null }[] = [];
  for (const change of input.changes) {
    if ("delete" in change) {
      tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const { data } = await api.post<{ sha: string }>(`${repoPath(repo)}/git/blobs`, {
      content: bytesToBase64(change.content),
      encoding: "base64",
    });
    blobShas.set(change.path, data.sha);
    tree.push({ path: change.path, mode: "100644", type: "blob", sha: data.sha });
  }

  const newTree = await api.post<{ sha: string }>(`${repoPath(repo)}/git/trees`, { base_tree: head.tree, tree });
  const commit = await api.post<{ sha: string }>(`${repoPath(repo)}/git/commits`, {
    message: input.message,
    tree: newTree.data.sha,
    parents: [head.commit],
  });
  try {
    await api.request("PATCH", `${repoPath(repo)}/git/refs/heads/${enc(repo.branch)}`, { sha: commit.data.sha, force: false });
  } catch (err) {
    if (err instanceof GitHubError && err.status === 422) throw new RemoteChangedError();
    throw err;
  }
  return { commit: commit.data.sha, blobShas };
}

export const collaboratorsUrl = (repo: { owner: string; name: string }) =>
  `https://github.com/${enc(repo.owner)}/${enc(repo.name)}/settings/access`;
export const repoUrl = (repo: { owner: string; name: string }) => `https://github.com/${enc(repo.owner)}/${enc(repo.name)}`;
/** The workspace folder on github.com (the repository page when it lives at the root). */
export const workspaceUrl = (repo: RepoRef) =>
  repo.dir ? `${repoUrl(repo)}/tree/${enc(repo.branch)}/${repo.dir.split("/").map(enc).join("/")}` : repoUrl(repo);
export const installUrl = (appSlug: string) => `https://github.com/apps/${enc(appSlug)}/installations/new`;

export interface FileCommit {
  sha: string;
  message: string;
  date: string;
  /** GitHub login when the author is a GitHub user, otherwise the git author name. */
  author: string;
  avatarUrl: string | null;
}

/** Commits that changed one file, newest first. */
export async function listFileCommits(api: GitHubApi, repo: RepoRef, path: string, perPage = 30): Promise<FileCommit[]> {
  const { data } = await api.get<
    { sha: string; commit: { message: string; author: { name: string; date: string } }; author: { login: string; avatar_url: string } | null }[]
  >(`${repoPath(repo)}/commits?path=${enc(path)}&sha=${enc(repo.branch)}&per_page=${perPage}`);
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split("\n")[0],
    date: c.commit.author.date,
    author: c.author?.login ?? c.commit.author.name,
    avatarUrl: c.author?.avatar_url ?? null,
  }));
}

/** A file's text at a given commit, or null if it didn't exist there. */
export async function readFileAt(api: GitHubApi, repo: RepoRef, path: string, ref: string): Promise<string | null> {
  const res = await api.get<{ content?: string; encoding?: string }>(
    `${repoPath(repo)}/contents/${path.split("/").map(enc).join("/")}?ref=${enc(ref)}`,
    [404],
  );
  if (res.status === 404 || !res.data.content) return null;
  return utf8.decode(base64ToBytes(res.data.content));
}
