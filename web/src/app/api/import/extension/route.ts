import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { buildExtensionImportBatch, saveImportBatch } from "@/lib/cards";
import type { ExtensionQuestionPayload } from "@/lib/types";

function getImportErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23514" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("mistake_cards_section_check")
  ) {
    return "线上数据库还没有应用最新版 section 迁移，当前批次里的数据洞察题暂时无法导入。";
  }

  return error instanceof Error ? error.message : "插件上传失败。";
}

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
    console.error("[extension import] failed", error);
    return NextResponse.json(
      { error: getImportErrorMessage(error) },
      { status: 500 },
    );
  }
}
