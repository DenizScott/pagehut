import type { NextRequest } from "next/server";
import { handleCallback } from "@/lib/server/auth-handlers";
import { readConfig } from "@/lib/server/config";

export async function GET(req: NextRequest) {
  return handleCallback(req, readConfig());
}
