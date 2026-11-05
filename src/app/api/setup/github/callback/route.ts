import type { NextRequest } from "next/server";
import { readConfig } from "@/lib/server/config";
import { appendEnvLocal } from "@/lib/server/env-file";
import { handleSetupCallback } from "@/lib/server/setup";

export async function GET(req: NextRequest) {
  return handleSetupCallback(req, {
    isDev: process.env.NODE_ENV === "development",
    configured: readConfig() !== null,
    writeEnv: appendEnvLocal,
  });
}
