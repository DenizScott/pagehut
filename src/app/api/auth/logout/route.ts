import type { NextRequest } from "next/server";
import { handleLogout } from "@/lib/server/auth-handlers";

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
