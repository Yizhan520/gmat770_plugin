import fs from "node:fs/promises";
import path from "node:path";
import { parseWorkbookImport } from "../src/lib/importers/xlsx";
import { saveImportBatch } from "../src/lib/cards";

function getWorkbookPaths() {
  const combined = process.env.GMAT_SEED_XLSX_PATHS;
  if (combined) {
    return combined
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const single = process.env.GMAT_SEED_XLSX_PATH;
  return single ? [single] : [];
}

function inferSourceKind(workbookPath: string, index: number) {
  const fileName = path.basename(workbookPath).toLowerCase();
  if (fileName.includes("数学") || fileName.includes("math")) {
    return "excel_seed_math";
  }

  if (fileName.includes("逻辑") || fileName.includes("logic")) {
    return "excel_seed_logic";
  }

  return `excel_seed_${index + 1}`;
}

async function main() {
  const workbookPaths = getWorkbookPaths();
  if (workbookPaths.length === 0) {
    throw new Error("请先设置 GMAT_SEED_XLSX_PATH 或 GMAT_SEED_XLSX_PATHS。");
  }

  const results = [];
  for (const [index, workbookPath] of workbookPaths.entries()) {
    const buffer = await fs.readFile(workbookPath);
    const batch = await parseWorkbookImport({
      buffer,
      originalName: path.basename(workbookPath),
      sourceKind: inferSourceKind(workbookPath, index),
      titlePrefix: "表格错题",
    });

    const result = await saveImportBatch(batch);
    results.push({
      workbookPath,
      sourceKind: batch.sourceKind,
      ...result,
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
