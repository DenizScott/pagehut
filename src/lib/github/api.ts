/**
 * Minimal GitHub REST client for the browser. The access token comes from a callback (in-memory
 * only) and is never logged. Errors are typed so the UI can explain them:
 * offline, rate limited, branch moved (conflict), no access.
 */

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class OfflineError extends Error {
  constructor() {
    super("Network unavailable");
  }
}
export class RateLimitError extends GitHubError {
  constructor(public resetAt: number) {
    super(429, "GitHub rate limit reached");
  }
}
/** The branch moved since our last sync (someone else pushed). Resolved by merging in P3. */
export class RemoteChangedError extends GitHubError {
  constructor() {
    super(409, "The branch has newer commits");
  }
}
export class SignedOutError extends GitHubError {
  constructor() {
    super(401, "Not signed in to GitHub");
  }
}

export interface ApiResponse<T> {
  status: number;
  data: T;
}

export class GitHubApi {
  constructor(
    private getToken: () => Promise<string | null>,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
    private base = "https://api.github.com",
  ) {}

  async request<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<ApiResponse<T>> {
    const token = await this.getToken();
    if (!token) throw new SignedOutError();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new OfflineError();
    }

    if (res.ok || okStatuses.includes(res.status)) {
      const text = res.status === 204 ? "" : await res.text();
      return { status: res.status, data: (text ? JSON.parse(text) : null) as T };
    }

    const remaining = res.headers.get("x-ratelimit-remaining");
    if ((res.status === 403 || res.status === 429) && (remaining === "0" || res.headers.has("retry-after"))) {
      const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000 || Date.now() + Number(res.headers.get("retry-after") ?? 60) * 1000;
      throw new RateLimitError(reset);
    }
    if (res.status === 401) throw new SignedOutError();
    let message = res.statusText;
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      /* not JSON */
    }
    throw new GitHubError(res.status, message);
  }

  get<T>(path: string, okStatuses?: number[]) {
    return this.request<T>("GET", path, undefined, okStatuses);
  }
  post<T>(path: string, body: unknown) {
    return this.request<T>("POST", path, body);
  }
}

/* ---------- base64 helpers (UTF-8 safe, chunked for large files) ---------- */

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0));
}

export const utf8 = {
  encode: (s: string) => new TextEncoder().encode(s),
  decode: (b: Uint8Array) => new TextDecoder().decode(b),
};

/** Git's blob id for some content: sha1("blob <size>\0" + content). Same bytes, same sha. */
export async function gitBlobSha(content: Uint8Array): Promise<string> {
  const header = utf8.encode(`blob ${content.length}\0`);
  const data = new Uint8Array(header.length + content.length);
  data.set(header);
  data.set(content, header.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", data));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}
