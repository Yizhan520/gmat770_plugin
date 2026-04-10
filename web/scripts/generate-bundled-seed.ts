import fs from "node:fs/promises";
import path from "node:path";
import { parseWorkbookImport } from "../src/lib/importers/xlsx";
import type { BundledSeedData } from "../src/lib/types";

async function main() {
  const workbookPath = process.env.GMAT_SEED_XLSX_PATH;
  if (!workbookPath) {
    throw new Error("请先设置 GMAT_SEED_XLSX_PATH。");
  }

  const buffer = await fs.readFile(workbookPath);
  const batch = await parseWorkbookImport({
    buffer,
    originalName: path.basename(workbookPath),
    sourceKind: "excel_seed",
    titlePrefix: "表格错题",
  });

  const publicAssetDir = path.join(process.cwd(), "public", "seed-assets");
  await fs.rm(publicAssetDir, { recursive: true, force: true });
  await fs.mkdir(publicAssetDir, { recursive: true });

  const cards = await Promise.all(
    batch.cards.map(async (card, cardIndex) => {
      const cardId = `seed-card-${cardIndex + 1}`;
      const assets = await Promise.all(
        card.assets.map(async (asset, assetIndex) => {
          const relativePath = path.join("seed-assets", `${card.sourceRowKey}-${assetIndex + 1}.png`).replace(/\\/g, "/");
          const outputPath = path.join(process.cwd(), "public", relativePath);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, asset.buffer);

          return {
            id: `${cardId}-asset-${assetIndex + 1}`,
            cardId,
            assetKind: asset.assetKind,
            anchorColumn: asset.anchorColumn,
            sortOrder: asset.sortOrder,
            storagePath: `/${relativePath}`,
            width: asset.width,
            height: asset.height,
            publicUrl: `/${relativePath}`,
          };
        }),
      );

      return {
        id: cardId,
        section: card.section,
        reasoningType: card.reasoningType,
        title: card.title,
        promptText: card.promptText,
        optionsText: card.optionsText,
        myAnswer: card.myAnswer,
        correctAnswer: card.correctAnswer,
        timeSpent: card.timeSpent,
        analysisText: card.analysisText,
        logicChainText: card.logicChainText,
        personalSummaryText: card.personalSummaryText,
        extraNotesText: card.extraNotesText,
        sourceKind: card.sourceKind,
        sourceRowKey: card.sourceRowKey,
        sourcePayload: card.sourcePayload,
        status: card.status,
        reviewCount: card.reviewCount,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        assets,
      };
    }),
  );

  const data: BundledSeedData = {
    cards,
    importJobs: [
      {
        id: "seed-import-1",
        sourceKind: "excel_seed",
        originalName: path.basename(workbookPath),
        fileSha256: batch.fileSha256,
        importedCount: cards.length,
        skippedCount: 0,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  await fs.writeFile(
    path.join(process.cwd(), "src", "data", "bundled-seed.json"),
    JSON.stringify(data, null, 2),
    "utf8",
  );

  console.log(`Bundled seed generated: ${cards.length} cards, ${cards.reduce((sum, card) => sum + card.assets.length, 0)} assets.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
