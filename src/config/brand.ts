/**
 * Product identity. The ONLY place the product name lives in code:
 * - UI text gets it from the `common.app.name` translation key (one per locale; `en` must equal `name`,
 *   checked by src/config/brand.test.ts) or through the `{appName}` placeholder;
 * - metadata, storage and file names derive from `name` / `slug` below.
 * A rename is a change here, in the three `app.name` keys, and in package.json "name".
 */
export const BRAND = {
  /** Display name in the UI, window title and docs. */
  name: "PageHut",
  /** Machine-safe identifier: IndexedDB name, export file prefixes, commit trailer. */
  slug: "pagehut",
  /**
   * IndexedDB names used by earlier development builds. Data found there is copied into the
   * current database once (see src/lib/storage/migrate.ts); the old database is left untouched.
   */
  legacyDatabaseNames: ["project-gdd", "lorekeep"] as readonly string[],
} as const;
