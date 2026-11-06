import { connection } from "next/server";
import { handleStatus } from "@/lib/server/auth-handlers";
import { readConfig } from "@/lib/server/config";

/** Whether GitHub sign-in is configured on this server (read at request time, never prerendered). */
export async function GET() {
  await connection();
  // The desktop app runs this server on the user's own computer, without GitHub keys.
  const desktop = process.env.PAGEHUT_DESKTOP === "1" ? { appSlug: process.env.PAGEHUT_DESKTOP_APP_SLUG } : false;
  return handleStatus(readConfig(), desktop);
}
