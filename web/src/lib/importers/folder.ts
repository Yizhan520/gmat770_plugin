import imageSize from "image-size";
import type { ImportBatch, ImportCardInput } from "@/lib/types";
import { normalizeMathKind } from "@/lib/math";
import { classifySection, getCardTitle } from "@/lib/sections";
import {
  cleanText,
  createRelativeStoragePath,
  normalizeFileName,
  sanitizeFileName,
  sha256Buffer,
  sha256Text,
} from "@/lib/importers/shared";

export interface FolderUploadFile {
  name: string;
  buffer: Buffer;
}

interface FolderManifestItem {
  externalId?: string;
  questionType?: string;
  sectionHint?: string;
  examTitle?: string;
  questionText?: string;
  options?: string[];
  myAnswer?: string;
  correctAnswer?: string;
  timeSpent?: string;
  analysis?: string;
  logicChain?: string;
  personalSummary?: string;
  extraNotes?: string;
  assets?: Array<{ path: string; kind?: "attachment" | "question_screenshot" | "analysis_screenshot" }>;
}

interface FolderManifest {
  version?: string | number;
  section?: string;
  items?: FolderManifestItem[];
}

function computeFolderHash(files: FolderUploadFile[]) {
  const serialized = files
    .map((file) => `${normalizeFileName(file.name)}:${sha256Buffer(file.buffer)}`)
    .sort()
    .join("|");

  return sha256Text(serialized);
}

export async function parseFolderImport(files: FolderUploadFile[]): Promise<ImportBatch> {
  const manifestFile = files.find((file) =>
    normalizeFileName(file.name).toLowerCase().endsWith("manifest.json"),
  );

  if (!manifestFile) {
    throw new Error("文件夹导入需要包含 manifest.json。");
  }

  const manifest = JSON.parse(manifestFile.buffer.toString("utf8")) as FolderManifest;
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error("manifest.json 中缺少 items 数组。");
  }

  const fileMap = new Map<string, FolderUploadFile>();
  for (const file of files) {
    fileMap.set(normalizeFileName(file.name), file);
  }

  const nowIso = new Date().toISOString();
  const cards: ImportCardInput[] = [];

  manifest.items.forEach((item, index) => {
    const sourceKeySeed =
      cleanText(item.externalId) ||
      sha256Text(JSON.stringify({ item, index })).slice(0, 24);
    const sourceRowKey = `manifest:${sourceKeySeed}`;
    const title = getCardTitle(sourceKeySeed, cleanText(item.examTitle));
    const section = classifySection(item.questionType, item.examTitle, item.sectionHint);
    const mathKind = section === "quant" ? normalizeMathKind(item.questionType, item.examTitle) : "";

    const assets = (item.assets ?? []).map((asset, assetIndex) => {
      const normalizedPath = normalizeFileName(asset.path);
      const matched = fileMap.get(normalizedPath);
      if (!matched) {
        throw new Error(`manifest 引用的文件不存在: ${asset.path}`);
      }

      const size = imageSize(matched.buffer);
      return {
        assetKind: asset.kind ?? "attachment",
        anchorColumn: null,
        sortOrder: assetIndex,
        buffer: matched.buffer,
        fileName: createRelativeStoragePath([sourceKeySeed, sanitizeFileName(normalizedPath)]),
        width: size.width ?? null,
        height: size.height ?? null,
      };
    });

    cards.push({
      section,
      reasoningType: section === "quant" && mathKind ? mathKind : cleanText(item.questionType),
      title,
      promptText: cleanText(item.questionText),
      optionsText: Array.isArray(item.options) ? item.options.join("\n") : "",
      myAnswer: cleanText(item.myAnswer),
      correctAnswer: cleanText(item.correctAnswer),
      timeSpent: cleanText(item.timeSpent),
      analysisText: cleanText(item.analysis),
      logicChainText: cleanText(item.logicChain),
      personalSummaryText: cleanText(item.personalSummary),
      extraNotesText: cleanText(item.extraNotes),
      sourceKind: "folder_upload",
      sourceRowKey,
      sourcePayload: {
        manifestVersion: manifest.version ?? "1",
        originalItem: item,
        section,
        ...(mathKind ? { mathKind } : {}),
      },
      status: "needs_review",
      reviewCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      assets,
    });
  });

  return {
    sourceKind: "folder_upload",
    originalName: manifestFile.name,
    fileSha256: computeFolderHash(files),
    cards,
  };
}
