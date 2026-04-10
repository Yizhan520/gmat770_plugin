import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasAdminAuthorization } from "@/lib/auth";
import { saveImportBatch } from "@/lib/cards";
import { parseFolderImport } from "@/lib/importers/folder";
import { parseWorkbookImport } from "@/lib/importers/xlsx";

function getFileList(formData: FormData) {
  return formData.getAll("files").filter((entry): entry is File => entry instanceof File);
}

export async function POST(request: NextRequest) {
  if (!requestHasAdminAuthorization(request)) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "");
    const files = getFileList(formData);

    if (files.length === 0) {
      return NextResponse.json({ error: "没有收到任何文件。" }, { status: 400 });
    }

    let batch;
    if (mode === "xlsx") {
      const workbook = files[0];
      batch = await parseWorkbookImport({
        buffer: Buffer.from(await workbook.arrayBuffer()),
        originalName: workbook.name,
      });
    } else if (mode === "folder") {
      batch = await parseFolderImport(
        await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            buffer: Buffer.from(await file.arrayBuffer()),
          })),
        ),
      );
    } else {
      return NextResponse.json({ error: "不支持的导入模式。" }, { status: 400 });
    }

    const result = await saveImportBatch(batch);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入失败。" },
      { status: 500 },
    );
  }
}
