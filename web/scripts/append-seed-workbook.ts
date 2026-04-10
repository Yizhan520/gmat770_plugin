import fs from "node:fs/promises";
import path from "node:path";
import { parseWorkbookImport } from "../src/lib/importers/xlsx";

interface BundledSeedAsset {
  id: string;
  cardId: string;
  assetKind: string;
  anchorColumn: number | null;
  sortOrder: number;
  storagePath: string;
  width: number | null;
  height: number | null;
  publicUrl: string;
}

interface BundledSeedCard {
  id: string;
  section: string;
  reasoningType: string;
  title: string;
  promptText: string;
  optionsText: string;
  myAnswer: string;
  correctAnswer: string;
  timeSpent: string;
  analysisText: string;
  logicChainText: string;
  personalSummaryText: string;
  extraNotesText: string;
  sourceKind: string;
  sourceRowKey: string;
  sourcePayload: Record<string, unknown> | null;
  status: string;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  assets: BundledSeedAsset[];
}

interface BundledSeedJob {
  id: string;
  sourceKind: string;
  originalName: string;
  fileSha256: string;
  importedCount: number;
  skippedCount: number;
  createdAt: string;
}

interface BundledSeedData {
  cards: BundledSeedCard[];
  importJobs: BundledSeedJob[];
}

async function main() {
  const workbookPath = process.env.GMAT_APPEND_XLSX_PATH;
  if (!workbookPath) {
    throw new Error("请先设置 GMAT_APPEND_XLSX_PATH。");
  }

  const sourceKind = process.env.GMAT_APPEND_SOURCE_KIND || "excel_seed_append";
  const originalName = path.basename(workbookPath);
  const dataPath = path.join(process.cwd(), "src", "data", "bundled-seed.json");
  const publicDir = path.join(process.cwd(), "public", "seed-assets");

  const existing = JSON.parse(await fs.readFile(dataPath, "utf8")) as BundledSeedData;
  const buffer = await fs.readFile(workbookPath);
  const batch = await parseWorkbookImport({
    buffer,
    originalName,
    sourceKind,
    titlePrefix: "表格错题",
  });

  const existingKeys = new Set(
    existing.cards.map((card) => `${card.sourceKind}:${card.sourceRowKey}`),
  );
  const cardsToAdd = batch.cards.filter(
    (card) => !existingKeys.has(`${card.sourceKind}:${card.sourceRowKey}`),
  );
  const skippedCount = batch.cards.length - cardsToAdd.length;

  const maxCardId = existing.cards.reduce((max, card) => {
    const match = String(card.id).match(/^seed-card-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  await fs.mkdir(publicDir, { recursive: true });

  const newCards = await Promise.all(
    cardsToAdd.map(async (card, index) => {
      const cardId = `seed-card-${maxCardId + index + 1}`;
      const assets = await Promise.all(
        card.assets.map(async (asset, assetIndex) => {
          const ext = path.extname(asset.fileName) || ".png";
          const relativePath = path
            .join("seed-assets", `${card.sourceKind}-${card.sourceRowKey}-${assetIndex + 1}${ext}`)
            .replace(/\\/g, "/");
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
          } satisfies BundledSeedAsset;
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
      } satisfies BundledSeedCard;
    }),
  );

  const importJob = {
    id: `seed-import-${existing.importJobs.length + 1}`,
    sourceKind,
    originalName,
    fileSha256: batch.fileSha256,
    importedCount: newCards.length,
    skippedCount,
    createdAt: new Date().toISOString(),
  } satisfies BundledSeedJob;

  const nextData: BundledSeedData = {
    cards: [...existing.cards, ...newCards],
    importJobs: [importJob, ...existing.importJobs],
  };

  await fs.writeFile(dataPath, JSON.stringify(nextData, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        importedCount: newCards.length,
        skippedCount,
        totalCards: nextData.cards.length,
        totalImportJobs: nextData.importJobs.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
