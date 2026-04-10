import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getAdminKey } from "@/lib/env";

export const ADMIN_COOKIE_NAME = "gmat_admin_session";
const ADMIN_COOKIE_TTL_SECONDS = 60 * 60 * 12;

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = hashText(left);
  const rightBuffer = hashText(right);
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(payload: string, adminKey: string) {
  return crypto.createHmac("sha256", adminKey).update(payload).digest("hex");
}

function createSessionPayload(expiresAt: number) {
  return JSON.stringify({ exp: expiresAt });
}

export function isValidAdminKey(candidate: string) {
  const adminKey = getAdminKey();
  return Boolean(adminKey) && safeEqual(candidate, adminKey);
}

export function createAdminSessionToken() {
  const adminKey = getAdminKey();
  if (!adminKey) {
    throw new Error("ADMIN_KEY 未配置。");
  }

  const expiresAt = Date.now() + ADMIN_COOKIE_TTL_SECONDS * 1000;
  const payload = createSessionPayload(expiresAt);
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const signature = signPayload(payload, adminKey);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token?: string | null) {
  const adminKey = getAdminKey();
  if (!token || !adminKey) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expectedSignature = signPayload(payload, adminKey);
    if (!safeEqual(signature, expectedSignature)) {
      return false;
    }

    const parsed = JSON.parse(payload) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export function requestHasAdminAuthorization(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return isValidAdminKey(bearer.slice("Bearer ".length).trim());
  }

  return verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_COOKIE_TTL_SECONDS,
  };
}
