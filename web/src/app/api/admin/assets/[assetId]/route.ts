import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { deleteAsset, updateAssetMeta } from "@/lib/cards";
import type { AssetKind } from "@/lib/types";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

function normalizeAssetKind(value: unknown): AssetKind | null {
  if (value === "attachment" || value === "question_screenshot" || value === "analysis_screenshot") {
    return value;
  }

  return null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { assetId } = await context.params;
    const payload = (await request.json()) as { assetKind?: string; sortOrder?: number };
    const asset = await updateAssetMeta(assetId, {
      assetKind: normalizeAssetKind(payload.assetKind) ?? undefined,
      sortOrder: payload.sortOrder,
    });
    return NextResponse.json({ success: true, asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新附件失败。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { assetId } = await context.params;
    const assets = await deleteAsset(assetId);
    return NextResponse.json({ success: true, assets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除附件失败。" },
      { status: 500 },
    );
  }
}
