import type { NextRequest } from "next/server";
import { handleLogin } from "@/lib/server/auth-handlers";
import { readConfig } from "@/lib/server/config";

export async function GET(req: NextRequest) {
  return handleLogin(req, readConfig());
}
