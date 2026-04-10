import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { incrementCardReviewCount } from "@/lib/cards";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const result = await incrementCardReviewCount(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "复习次数更新失败。" },
      { status: 500 },
    );
  }
}
