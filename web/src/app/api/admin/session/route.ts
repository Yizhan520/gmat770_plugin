import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
  isValidAdminKey,
  verifyAdminSessionToken,
} from "@/lib/auth";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
    ?.slice(ADMIN_COOKIE_NAME.length + 1);

  return NextResponse.json(
    { isAdmin: verifyAdminSessionToken(token) },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

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
