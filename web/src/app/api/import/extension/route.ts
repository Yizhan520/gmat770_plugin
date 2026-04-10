import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { buildExtensionImportBatch, saveImportBatch } from "@/lib/cards";
import type { ExtensionQuestionPayload } from "@/lib/types";

export async function POST(request: NextRequest) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as
      | ExtensionQuestionPayload[]
      | { questions?: ExtensionQuestionPayload[] };
    const questions = Array.isArray(payload) ? payload : payload.questions ?? [];

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "请求中缺少 questions 数组。" }, { status: 400 });
    }

    const batch = buildExtensionImportBatch(questions);
    const result = await saveImportBatch(batch);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "插件上传失败。" },
      { status: 500 },
    );
  }
}
