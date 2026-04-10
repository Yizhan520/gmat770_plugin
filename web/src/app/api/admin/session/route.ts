import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
  isValidAdminKey,
} from "@/lib/auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { key?: string } | null;
  const key = payload?.key?.trim() ?? "";

  if (!isValidAdminKey(key)) {
    return NextResponse.json({ error: "Admin Key 不正确。" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), getAdminCookieOptions());
  return response;
}
