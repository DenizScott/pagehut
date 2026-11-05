import { connection } from "next/server";
import { handleStatus } from "@/lib/server/auth-handlers";
import { readConfig } from "@/lib/server/config";

/** Whether GitHub sign-in is configured on this server (read at request time, never prerendered). */
export async function GET() {
  await connection();
  return handleStatus(readConfig());
}
