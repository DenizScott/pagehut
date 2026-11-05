import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Appends variables to .env.local in the project root. Refuses if any of them is already set
 * there, so existing keys are never overwritten. Next.js reloads .env.local in development.
 */
export async function appendEnvLocal(vars: Record<string, string>, dir = process.cwd()): Promise<void> {
  const file = join(dir, ".env.local");
  let current = "";
  try {
    current = await readFile(file, "utf8");
  } catch {
    /* no file yet */
  }
  for (const key of Object.keys(vars)) {
    if (new RegExp(`^\\s*${key}\\s*=\\s*\\S`, "m").test(current)) throw new Error(`${key} is already set in .env.local`);
  }
  const block = [
    "",
    `# GitHub sign-in, created by the setup page on ${new Date().toISOString().slice(0, 10)}. Keep this file private.`,
    ...Object.entries(vars).map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n");
  await writeFile(file, current.replace(/\s*$/, "\n") + block, { encoding: "utf8", mode: 0o600 });
}
