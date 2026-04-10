import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { deleteCard, updateCard, updateCardContent } from "@/lib/cards";
import type { AdminCardInput, CardStatus } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isFullCardPayload(payload: Record<string, unknown>) {
  return (
    "section" in payload ||
    "title" in payload ||
    "promptText" in payload ||
    "optionsText" in payload ||
    "analysisText" in payload ||
    "logicChainText" in payload
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as {
      status?: CardStatus;
      personalSummaryText?: string;
      extraNotesText?: string;
    } & Partial<AdminCardInput>;

    if (isFullCardPayload(payload as Record<string, unknown>)) {
      const card = await updateCardContent(id, payload as AdminCardInput);
      return NextResponse.json({ success: true, card });
    }

    await updateCard(id, payload);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败。" },
      { status: 500 },
    );
  }
}


export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    await deleteCard(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败。" },
      { status: 500 },
    );
  }
}
