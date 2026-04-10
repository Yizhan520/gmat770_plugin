import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import imageSize from "image-size";
import { inferMathKindFromSheetName } from "@/lib/math";
import type { DetailLabelMap, ImportBatch, ImportCardInput, ImportAssetInput } from "@/lib/types";
import {
  cleanText,
  createRelativeStoragePath,
  sanitizeFileName,
  sha256Buffer,
  toArray,
} from "@/lib/importers/shared";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  removeNSPrefix: true,
});

interface ParseWorkbookOptions {
  buffer: Buffer;
  originalName: string;
  sourceKind?: string;
  titlePrefix?: string;
}

type SheetMode = "logic" | "math";

interface ParsedSheetRow {
  rowNumber: number;
  cellMap: Map<number, string>;
  assets: ImportAssetInput[];
}

interface ParsedWorksheet {
  sheetName: string;
  headerMap: Map<number, string>;
  rows: ParsedSheetRow[];
}

function parseXml<T>(xmlText: string) {
  return xmlParser.parse(xmlText) as T;
}

async function readZipText(zip: JSZip, filePath: string) {
  const file = zip.file(filePath);
  if (!file) {
    return null;
  }

  return file.async("string");
}

async function readZipBuffer(zip: JSZip, filePath: string) {
  const file = zip.file(filePath);
  if (!file) {
    return null;
  }

  return Buffer.from(await file.async("nodebuffer"));
}

function resolveZipPath(baseFilePath: string, target: string) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(baseFilePath), target));
}

function extractTextNode(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractTextNode(item)).join("");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["#text"] === "string") {
      return record["#text"];
    }

    if ("t" in record) {
      return extractTextNode(record.t);
    }

    if ("r" in record) {
      return extractTextNode(record.r);
    }
  }

  return "";
}

function columnToIndex(reference: string) {
  const letters = reference.match(/[A-Z]+/i)?.[0] ?? "";
  let index = 0;

  for (const character of letters.toUpperCase()) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }

  return index;
}

function normalizeHeader(value: string) {
  return cleanText(value).replace(/\s+/g, "");
}

async function parseSharedStrings(zip: JSZip) {
  const sharedStringsText = await readZipText(zip, "xl/sharedStrings.xml");
  if (!sharedStringsText) {
    return [];
  }

  const xml = parseXml<{ sst?: { si?: unknown | unknown[] } }>(sharedStringsText);
  return toArray(xml.sst?.si).map((item) => extractTextNode(item));
}

async function parseSheetImageMap(zip: JSZip, sheetPath: string) {
  const relPath = `${path.posix.dirname(sheetPath)}/_rels/${path.posix.basename(sheetPath)}.rels`;
  const relText = await readZipText(zip, relPath);
  if (!relText) {
    return new Map<number, ImportAssetInput[]>();
  }

  const rels = parseXml<{
    Relationships?: { Relationship?: Record<string, string> | Array<Record<string, string>> };
  }>(relText);

  const drawingRel = toArray(rels.Relationships?.Relationship).find((item) =>
    item["@_Type"]?.includes("/drawing"),
  );

  if (!drawingRel?.["@_Target"]) {
    return new Map<number, ImportAssetInput[]>();
  }

  const drawingPath = resolveZipPath(sheetPath, drawingRel["@_Target"]);
  const drawingText = await readZipText(zip, drawingPath);
  if (!drawingText) {
    return new Map<number, ImportAssetInput[]>();
  }

  const drawingRelsPath = `${path.posix.dirname(drawingPath)}/_rels/${path.posix.basename(drawingPath)}.rels`;
  const drawingRelsText = await readZipText(zip, drawingRelsPath);
  const drawingRelMap = new Map<string, string>();

  if (drawingRelsText) {
    const drawingRels = parseXml<{
      Relationships?: { Relationship?: Record<string, string> | Array<Record<string, string>> };
    }>(drawingRelsText);

    for (const item of toArray(drawingRels.Relationships?.Relationship)) {
      if (item["@_Id"] && item["@_Target"]) {
        drawingRelMap.set(item["@_Id"], resolveZipPath(drawingPath, item["@_Target"]));
      }
    }
  }

  const drawingXml = parseXml<{
    wsDr?: {
      oneCellAnchor?: Record<string, unknown> | Array<Record<string, unknown>>;
      twoCellAnchor?: Record<string, unknown> | Array<Record<string, unknown>>;
    };
  }>(drawingText);

  const anchors = [
    ...toArray(drawingXml.wsDr?.oneCellAnchor),
    ...toArray(drawingXml.wsDr?.twoCellAnchor),
  ];
  const rowMap = new Map<number, ImportAssetInput[]>();

  for (const anchor of anchors) {
    const from = anchor.from as Record<string, string> | undefined;
    const picture = anchor.pic as Record<string, unknown> | undefined;
    const blipFill = picture?.blipFill as Record<string, unknown> | undefined;
    const blip = blipFill?.blip as Record<string, string> | undefined;
    const embedId = blip?.["@_embed"];
    const mediaPath = embedId ? drawingRelMap.get(embedId) : undefined;

    if (!from || !mediaPath) {
      continue;
    }

    const buffer = await readZipBuffer(zip, mediaPath);
    if (!buffer) {
      continue;
    }

    const size = imageSize(buffer);
    const rowNumber = Number(from.row ?? "0") + 1;
    const anchorColumn = Number(from.col ?? "0") + 1;
    const ext = path.extname(mediaPath) || ".png";
    const currentAssets = rowMap.get(rowNumber) ?? [];
    currentAssets.push({
      assetKind: "attachment",
      anchorColumn,
      sortOrder: currentAssets.length,
      buffer,
      fileName: sanitizeFileName(`${rowNumber}-${currentAssets.length + 1}${ext}`),
      width: size.width ?? null,
      height: size.height ?? null,
    });
    rowMap.set(rowNumber, currentAssets);
  }

  return rowMap;
}

function readCellValue(cell: Record<string, unknown>, sharedStrings: string[]) {
  const cellType = cleanText(cell["@_t"]);
  const rawValue = cell.v;

  if (cellType === "s") {
    const sharedIndex = Number(cleanText(rawValue));
    return sharedStrings[sharedIndex] ?? "";
  }

  if (cellType === "inlineStr") {
    return extractTextNode(cell.is);
  }

  return cleanText(rawValue);
}

function detectSheetMode(sheetName: string, headerMap: Map<number, string>): SheetMode | null {
  const normalizedHeaders = Array.from(headerMap.values())
    .map((value) => normalizeHeader(value))
    .filter(Boolean);
  const headerSet = new Set(normalizedHeaders);

  if (
    headerSet.has("问题类型") ||
    headerSet.has("题目情况") ||
    headerSet.has("逻辑链") ||
    headerSet.has("个人总结")
  ) {
    return "logic";
  }

  if (
    headerSet.has("模块") ||
    headerSet.has("问题") ||
    headerSet.has("问题&解法") ||
    headerSet.has("解法") ||
    headerSet.has("潜在考点") ||
    headerSet.has("解决方法") ||
    headerSet.has("一些有的没的思考心得")
  ) {
    return "math";
  }

  const normalizedSheetName = normalizeHeader(sheetName).toLowerCase();
  if (normalizedSheetName === "ds" || normalizedSheetName.includes("粗心")) {
    return "math";
  }

  return null;
}

function buildWorksheet(
  sheetName: string,
  sheetText: string,
  sharedStrings: string[],
  imageMap: Map<number, ImportAssetInput[]>,
) {
  const sheetXml = parseXml<{
    worksheet?: {
      sheetData?: {
        row?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
  }>(sheetText);

  const rows = toArray(sheetXml.worksheet?.sheetData?.row);
  const headerMap = new Map<number, string>();
  const parsedRows: ParsedSheetRow[] = [];

  for (const row of rows) {
    const rowNumber = Number(cleanText(row["@_r"]));
    if (!rowNumber) {
      continue;
    }

    const cellMap = new Map<number, string>();
    for (const cell of toArray(row.c as Record<string, unknown> | Array<Record<string, unknown>>)) {
      const reference = cleanText(cell["@_r"]);
      const columnIndex = columnToIndex(reference);
      cellMap.set(columnIndex, readCellValue(cell, sharedStrings));
    }

    if (rowNumber === 1) {
      for (const [columnIndex, cellValue] of cellMap.entries()) {
        headerMap.set(columnIndex, cleanText(cellValue));
      }
      continue;
    }

    parsedRows.push({
      rowNumber,
      cellMap,
      assets: imageMap.get(rowNumber) ?? [],
    });
  }

  return {
    sheetName,
    headerMap,
    rows: parsedRows,
  } satisfies ParsedWorksheet;
}

function buildAssetPath(sheetName: string, rowNumber: number, asset: ImportAssetInput) {
  return createRelativeStoragePath([
    sheetName,
    `${rowNumber}-${asset.sortOrder + 1}${path.extname(asset.fileName)}`,
  ]);
}

function hasAnyRowContent(row: ParsedSheetRow) {
  return Array.from(row.cellMap.values()).some((value) => cleanText(value)) || row.assets.length > 0;
}

function parseLogicSheet(
  worksheet: ParsedWorksheet,
  nowIso: string,
  originalName: string,
  sourceKind: string,
  titlePrefix: string,
) {
  const cards: ImportCardInput[] = [];

  for (const row of worksheet.rows) {
    const reasoningType = row.cellMap.get(1) ?? "";
    const promptText = row.cellMap.get(2) ?? "";
    const logicChainText = row.cellMap.get(3) ?? "";
    const personalSummaryText = row.cellMap.get(4) ?? "";
    const extraNotesText = row.cellMap.get(5) ?? "";

    if (
      !reasoningType &&
      !promptText &&
      !logicChainText &&
      !personalSummaryText &&
      !extraNotesText &&
      row.assets.length === 0
    ) {
      continue;
    }

    const title = `${titlePrefix} ${worksheet.sheetName} #${row.rowNumber - 1}`;
    cards.push({
      section: "logic",
      reasoningType,
      title,
      promptText,
      optionsText: "",
      myAnswer: "",
      correctAnswer: "",
      timeSpent: "",
      analysisText: "",
      logicChainText,
      personalSummaryText,
      extraNotesText,
      sourceKind,
      sourceRowKey: `${worksheet.sheetName}:${row.rowNumber}`,
      sourcePayload: {
        sheetName: worksheet.sheetName,
        rowNumber: row.rowNumber,
        originalName,
      },
      status: "needs_review",
      reviewCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      assets: row.assets.map((asset) => ({
        ...asset,
        fileName: buildAssetPath(worksheet.sheetName, row.rowNumber, asset),
      })),
    });
  }

  return cards;
}

function collectColumnValues(cellMap: Map<number, string>, columns: number[]) {
  return columns
    .map((column) => cleanText(cellMap.get(column)))
    .filter(Boolean)
    .join("\n\n");
}

function buildMathFieldColumns(headerMap: Map<number, string>) {
  const columns = {
    module: [] as number[],
    promptText: [] as number[],
    logicChainText: [] as number[],
    analysisText: [] as number[],
    personalSummaryText: [] as number[],
  };
  const detailLabels: DetailLabelMap = {
    extraNotesText: "补充备注",
  };
  const recognizedColumns = new Set<number>();

  for (const [column, header] of headerMap.entries()) {
    const normalized = normalizeHeader(header);
    switch (normalized) {
      case "模块":
        columns.module.push(column);
        recognizedColumns.add(column);
        break;
      case "问题":
      case "问题&解法":
        columns.promptText.push(column);
        detailLabels.promptText ??= header;
        recognizedColumns.add(column);
        break;
      case "解法":
        columns.logicChainText.push(column);
        detailLabels.logicChainText ??= header;
        recognizedColumns.add(column);
        break;
      case "潜在考点":
        columns.analysisText.push(column);
        detailLabels.analysisText ??= header;
        recognizedColumns.add(column);
        break;
      case "解决方法":
      case "一些有的没的思考心得":
        columns.personalSummaryText.push(column);
        detailLabels.personalSummaryText ??= header;
        recognizedColumns.add(column);
        break;
      default:
        break;
    }
  }

  return {
    columns,
    detailLabels,
    recognizedColumns,
  };
}

function parseMathSheet(
  worksheet: ParsedWorksheet,
  nowIso: string,
  originalName: string,
  sourceKind: string,
) {
  const cards: ImportCardInput[] = [];
  const mathKind = inferMathKindFromSheetName(worksheet.sheetName);
  const { columns, detailLabels, recognizedColumns } = buildMathFieldColumns(worksheet.headerMap);

  for (const row of worksheet.rows) {
    if (!hasAnyRowContent(row)) {
      continue;
    }

    const mathModule = collectColumnValues(row.cellMap, columns.module);
    const promptText = collectColumnValues(row.cellMap, columns.promptText);
    const logicChainText = collectColumnValues(row.cellMap, columns.logicChainText);
    const analysisText = collectColumnValues(row.cellMap, columns.analysisText);
    const personalSummaryText = collectColumnValues(row.cellMap, columns.personalSummaryText);
    const extraNoteParts: string[] = [];

    for (const [column, value] of row.cellMap.entries()) {
      const normalizedValue = cleanText(value);
      if (!normalizedValue || recognizedColumns.has(column)) {
        continue;
      }

      const header = cleanText(worksheet.headerMap.get(column));
      extraNoteParts.push(header ? `${header}：${normalizedValue}` : normalizedValue);
    }

    const extraNotesText = extraNoteParts.join("\n\n");
    const titleTopic = mathModule || worksheet.sheetName;
    const title = `${mathKind} · ${titleTopic} · ${worksheet.sheetName} #${row.rowNumber}`;

    cards.push({
      section: "quant",
      reasoningType: mathKind,
      title,
      promptText,
      optionsText: "",
      myAnswer: "",
      correctAnswer: "",
      timeSpent: "",
      analysisText,
      logicChainText,
      personalSummaryText,
      extraNotesText,
      sourceKind,
      sourceRowKey: `${worksheet.sheetName}:${row.rowNumber}`,
      sourcePayload: {
        sheetName: worksheet.sheetName,
        rowNumber: row.rowNumber,
        originalName,
        mathKind,
        module: mathModule,
        headerMap: detailLabels,
      },
      status: "needs_review",
      reviewCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      assets: row.assets.map((asset) => ({
        ...asset,
        fileName: buildAssetPath(worksheet.sheetName, row.rowNumber, asset),
      })),
    });
  }

  return cards;
}

export async function parseWorkbookImport({
  buffer,
  originalName,
  sourceKind = "xlsx_upload",
  titlePrefix = "错题",
}: ParseWorkbookOptions): Promise<ImportBatch> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await parseSharedStrings(zip);
  const workbookText = await readZipText(zip, "xl/workbook.xml");
  const workbookRelsText = await readZipText(zip, "xl/_rels/workbook.xml.rels");

  if (!workbookText || !workbookRelsText) {
    throw new Error("无法读取 Excel 工作簿结构。");
  }

  const workbook = parseXml<{
    workbook?: { sheets?: { sheet?: Record<string, string> | Array<Record<string, string>> } };
  }>(workbookText);
  const workbookRels = parseXml<{
    Relationships?: { Relationship?: Record<string, string> | Array<Record<string, string>> };
  }>(workbookRelsText);

  const relationshipMap = new Map<string, string>();
  for (const relation of toArray(workbookRels.Relationships?.Relationship)) {
    if (relation["@_Id"] && relation["@_Target"]) {
      relationshipMap.set(relation["@_Id"], resolveZipPath("xl/workbook.xml", relation["@_Target"]));
    }
  }

  const cards: ImportCardInput[] = [];
  const nowIso = new Date().toISOString();

  for (const sheet of toArray(workbook.workbook?.sheets?.sheet)) {
    const sheetName = cleanText(sheet["@_name"]) || "Sheet";
    const relId = cleanText(sheet["@_id"]);
    const sheetPath = relationshipMap.get(relId);
    if (!sheetPath) {
      continue;
    }

    const sheetText = await readZipText(zip, sheetPath);
    if (!sheetText) {
      continue;
    }

    const imageMap = await parseSheetImageMap(zip, sheetPath);
    const worksheet = buildWorksheet(sheetName, sheetText, sharedStrings, imageMap);
    const sheetMode = detectSheetMode(sheetName, worksheet.headerMap);

    if (sheetMode === "logic") {
      cards.push(...parseLogicSheet(worksheet, nowIso, originalName, sourceKind, titlePrefix));
      continue;
    }

    if (sheetMode === "math") {
      cards.push(...parseMathSheet(worksheet, nowIso, originalName, sourceKind));
    }
  }

  return {
    sourceKind,
    originalName,
    fileSha256: sha256Buffer(buffer),
    cards,
  };
}
