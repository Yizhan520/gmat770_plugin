import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { replaceAssetFile } from "@/lib/cards";
import type { AdminAssetUploadInput } from "@/lib/types";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const { assetId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "没有收到替换图片。" }, { status: 400 });
    }

    const payload = {
      fileName: file.name,
      contentType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    } satisfies AdminAssetUploadInput;

    const asset = await replaceAssetFile(assetId, payload);
    return NextResponse.json({ success: true, asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "替换附件失败。" },
      { status: 500 },
    );
  }
}
