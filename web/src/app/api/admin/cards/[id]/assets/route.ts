import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { reorderCardAssets, uploadCardAssets } from "@/lib/cards";
import type { AdminAssetUploadInput, AssetKind } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function getFileList(formData: FormData) {
  return formData.getAll("files").filter((entry): entry is File => entry instanceof File);
}

function normalizeAssetKind(value: FormDataEntryValue | null): AssetKind {
  const normalized = String(value ?? "");
  if (normalized === "question_screenshot" || normalized === "analysis_screenshot") {
    return normalized;
  }

  return "attachment";
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const files = getFileList(formData);
    if (files.length === 0) {
      return NextResponse.json({ error: "没有收到图片文件。" }, { status: 400 });
    }

    const assetKind = normalizeAssetKind(formData.get("assetKind"));
    const payload = await Promise.all(
      files.map(async (file) => {
        return {
          fileName: file.name,
          contentType: file.type,
          buffer: Buffer.from(await file.arrayBuffer()),
          assetKind,
        } satisfies AdminAssetUploadInput;
      }),
    );

    const assets = await uploadCardAssets(id, payload);
    return NextResponse.json({ success: true, assets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传附件失败。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as { orderedAssetIds?: string[] };
    if (!Array.isArray(payload.orderedAssetIds) || payload.orderedAssetIds.length === 0) {
      return NextResponse.json({ error: "缺少附件顺序数据。" }, { status: 400 });
    }

    const assets = await reorderCardAssets(id, payload.orderedAssetIds);
    return NextResponse.json({ success: true, assets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存附件顺序失败。" },
      { status: 500 },
    );
  }
}
