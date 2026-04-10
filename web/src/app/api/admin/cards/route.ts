import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { createManualCard } from "@/lib/cards";
import type { AdminCardInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as AdminCardInput;
    const card = await createManualCard(payload);
    return NextResponse.json({ success: true, card });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建失败。" },
      { status: 500 },
    );
  }
}
