/**
 * Product identity. This is the ONLY place the app name lives: UI strings receive it through
 * the `{appName}` placeholder, storage keys derive from `slug`. A rename is a one-line change here
 * (plus package.json "name", which npm cannot read from code).
 */
export const BRAND = {
  /** Display name in the UI, window title and docs. */
  name: "Project GDD",
  /** Machine-safe identifier: IndexedDB name, file prefixes, commit trailer. */
  slug: "project-gdd",
  /** GitHub organization for the public repo (not registered yet — see README). */
  githubOrg: null as string | null,
} as const;
