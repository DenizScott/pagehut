import { base64ToBytes, bytesToBase64, GitHubError, RemoteChangedError, utf8, type GitHubApi } from "./api";

/** Repository-level operations on top of the Git Data API. */

export interface RepoRef {
  owner: string;
  name: string;
  branch: string;
}

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

export type FileChange = { path: string; content: Uint8Array } | { path: string; delete: true };

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
 * One commit with all changes. Fails with RemoteChangedError if the branch moved since
 * `expectedHead` (the ref update is never forced, so nobody's work is overwritten).
 */
export async function commitChanges(
  api: GitHubApi,
  repo: RepoRef,
  input: { expectedHead: string | null; changes: FileChange[]; message: string; readmeForEmptyRepo: string },
): Promise<{ commit: string; blobShas: Map<string, string> }> {
  let head = await getHead(api, repo);
  if (input.expectedHead !== (head?.commit ?? null)) {
    // Accept the case where we are the ones initializing an empty repo.
    if (!(input.expectedHead === null && head === null)) throw new RemoteChangedError();
  }
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
export const installUrl = (appSlug: string) => `https://github.com/apps/${enc(appSlug)}/installations/new`;
