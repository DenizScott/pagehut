import type { NextRequest } from "next/server";
import { handleToken } from "@/lib/server/auth-handlers";
import { readConfig } from "@/lib/server/config";

export async function POST(req: NextRequest) {
  return handleToken(req, readConfig());
}
