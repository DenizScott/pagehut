/**
 * Server-only helpers for sealed cookies and PKCE. Uses Web Crypto, so it runs on Node and edge.
 * Sealed values are AES-256-GCM encrypted and authenticated: a tampered cookie fails to open.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function keyFrom(secret: string, purpose: string): Promise<CryptoKey> {
  // Derive a separate key per purpose so a cookie of one kind can't be replayed as another.
  const material = await crypto.subtle.digest("SHA-256", enc.encode(`pagehut:${purpose}:${secret}`));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(value: unknown, secret: string, purpose: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(secret, purpose);
  const data = enc.encode(JSON.stringify(value));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}

/** Returns null for anything that is missing, malformed, tampered with or sealed for another purpose. */
export async function unseal<T>(sealed: string | undefined, secret: string, purpose: string): Promise<T | null> {
  if (!sealed) return null;
  try {
    const bytes = fromB64url(sealed);
    const key = await keyFrom(secret, purpose);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}

/** PKCE S256 challenge for a verifier (RFC 7636). */
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
}

/** Constant-time string comparison for secrets such as the OAuth state. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || /[\r\n]/.test(value)) return "/";
  return value;
}
