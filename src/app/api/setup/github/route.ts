import type { NextRequest } from "next/server";
import { readConfig } from "@/lib/server/config";
import { appendEnvLocal } from "@/lib/server/env-file";
import { handleSetupStart } from "@/lib/server/setup";

/** One-click GitHub App registration (development, localhost, first run only). */
export async function GET(req: NextRequest) {
  return handleSetupStart(req, {
    isDev: process.env.NODE_ENV === "development",
    configured: readConfig() !== null,
    writeEnv: appendEnvLocal,
  });
}
