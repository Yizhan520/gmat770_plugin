import { randomUUID } from "node:crypto";
import bundledSeedData from "@/data/bundled-seed.json";
import { hasSupabaseConfig, getSupabaseConfig } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { classifySection } from "@/lib/sections";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  getMathKindFromCard,
  getMathModuleFromCard,
  normalizeMathKind,
} from "@/lib/math";
import { dataUrlToBuffer, sanitizeFileName, sha256Text } from "@/lib/importers/shared";
import type {
  AdminAssetUploadInput,
  AdminCardFilters,
  AdminCardInput,
  CardStatus,
  CardFilters,
  DbImportJobRow,
  DbMistakeAssetRow,
  DbMistakeCardRow,
  ExtensionQuestionPayload,
  ImportBatch,
  ImportCardInput,
  ImportJob,
  MathKind,
  MistakeAsset,
  MistakeCard,
  Section,
} from "@/lib/types";
import imageSize from "image-size";

type BundledMistakeCard = Omit<MistakeCard, "reviewCount" | "assetCount"> & {
  reviewCount?: number;
  assetCount?: number;
};
type BrowseSection = Extract<Section, "logic" | "reading" | "quant" | "data_insights">;
type CardRowSnapshot = Partial<DbMistakeCardRow> &
  Pick<DbMistakeCardRow, "id" | "section" | "status" | "created_at" | "updated_at">;

const CARDS_CACHE_TAG = "cards";
const IMPORT_JOBS_CACHE_TAG = "import-jobs";
const PUBLIC_DATA_REVALIDATE_SECONDS = 300;
const IMAGE_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SECTION_CARD_COLUMNS = [
  "id",
  "section",
  "reasoning_type",
  "title",
  "prompt_text",
  "analysis_text",
  "logic_chain_text",
  "personal_summary_text",
  "extra_notes_text",
  "source_payload",
  "status",
  "review_count",
  "created_at",
  "updated_at",
].join(", ");
const ADMIN_CARD_COLUMNS = [
  "id",
  "section",
  "reasoning_type",
  "title",
  "prompt_text",
  "options_text",
  "my_answer",
  "correct_answer",
  "time_spent",
  "analysis_text",
  "logic_chain_text",
  "personal_summary_text",
  "extra_notes_text",
  "source_kind",
  "source_row_key",
  "source_payload",
  "status",
  "review_count",
  "created_at",
  "updated_at",
].join(", ");

function deriveReviewCount(status: CardStatus) {
  return status === "needs_review" ? 0 : 1;
}

function normalizeReviewCount(reviewCount: number | null | undefined, status: CardStatus) {
  if (typeof reviewCount === "number" && Number.isFinite(reviewCount) && reviewCount >= 0) {
    return Math.floor(reviewCount);
  }

  return deriveReviewCount(status);
}

function resolveAssetPublicUrl(storagePath: string) {
  if (storagePath.startsWith("/")) {
    return storagePath;
  }

  const { bucket } = getSupabaseConfig();
  const supabase = getSupabaseAdminClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

function mapAsset(row: DbMistakeAssetRow): MistakeAsset {
  return {
    id: row.id,
    cardId: row.card_id,
    assetKind: row.asset_kind,
    anchorColumn: row.anchor_column,
    sortOrder: row.sort_order,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    publicUrl: resolveAssetPublicUrl(row.storage_path),
  };
}

function mapCard(
  row: CardRowSnapshot,
  options: { assets?: MistakeAsset[]; assetCount?: number | null } = {},
): MistakeCard {
  const assets = options.assets ?? [];
  const assetCount =
    typeof options.assetCount === "number" && Number.isFinite(options.assetCount)
      ? Math.max(0, Math.floor(options.assetCount))
      : assets.length;

  return {
    id: row.id,
    section: row.section,
    reasoningType: row.reasoning_type ?? "",
    title: row.title ?? "",
    promptText: row.prompt_text ?? "",
    optionsText: row.options_text ?? "",
    myAnswer: row.my_answer ?? "",
    correctAnswer: row.correct_answer ?? "",
    timeSpent: row.time_spent ?? "",
    analysisText: row.analysis_text ?? "",
    logicChainText: row.logic_chain_text ?? "",
    personalSummaryText: row.personal_summary_text ?? "",
    extraNotesText: row.extra_notes_text ?? "",
    sourceKind: row.source_kind ?? "",
    sourceRowKey: row.source_row_key ?? "",
    sourcePayload: row.source_payload ?? null,
    status: row.status,
    reviewCount: normalizeReviewCount(row.review_count, row.status),
    assetCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assets,
  };
}

function mapBundledCard(card: BundledMistakeCard): MistakeCard {
  const status = card.status ?? "needs_review";
  const assets = card.assets ?? [];

  return {
    ...card,
    status,
    assetCount: card.assetCount ?? assets.length,
    reviewCount: normalizeReviewCount(card.reviewCount, status),
    assets,
  };
}

function compareCards(left: Pick<MistakeCard, "id" | "updatedAt">, right: Pick<MistakeCard, "id" | "updatedAt">) {
  const updatedAtDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  return right.id.localeCompare(left.id);
}

function sortCards(cards: MistakeCard[]) {
  return [...cards].sort((left, right) => {
    return compareCards(left, right);
  });
}

function sortReasoningTypes(
  values: string[],
  preferredOrder: string[] = [],
) {
  return [...values].sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left);
    const rightIndex = preferredOrder.indexOf(right);

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right, "zh-CN");
  });
}

function filterCards(cards: MistakeCard[], section: Section, filters: CardFilters) {
  const keyword = (filters.q ?? "").trim().toLowerCase();

  return cards.filter((card) => {
    if (card.section !== section) {
      return false;
    }

    if (section === "logic" || section === "reading" || section === "data_insights") {
      if (filters.type && filters.type !== "all" && card.reasoningType !== filters.type) {
        return false;
      }
    }

    if (section === "quant") {
      const mathKind = getMathKindFromCard(card);
      const mathModule = getMathModuleFromCard(card);

      if (filters.kind && filters.kind !== "all" && mathKind !== filters.kind) {
        return false;
      }

      if (filters.module && filters.module !== "all" && mathModule !== filters.module) {
        return false;
      }
    }

    if (filters.status && filters.status !== "all") {
      if (filters.status === "pending" && card.reviewCount > 0) {
        return false;
      }

      if (filters.status === "reviewed" && card.reviewCount <= 0) {
        return false;
      }
    }

    if (!keyword) {
      return true;
    }

    const haystack = [
      card.title,
      card.reasoningType,
      card.promptText,
      card.logicChainText,
      card.personalSummaryText,
      card.analysisText,
      card.extraNotesText,
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(keyword);
  });
}

function groupAssetCounts(rows: Array<{ card_id: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.card_id, (counts.get(row.card_id) ?? 0) + 1);
  }

  return counts;
}

function filterAdminCards(cards: MistakeCard[], filters: AdminCardFilters) {
  const keyword = (filters.q ?? "").trim().toLowerCase();

  return cards.filter((card) => {
    if (filters.section && filters.section !== "all" && card.section !== filters.section) {
      return false;
    }

    if (filters.status && filters.status !== "all") {
      if (filters.status === "pending" && card.reviewCount > 0) {
        return false;
      }

      if (filters.status === "reviewed" && card.reviewCount <= 0) {
        return false;
      }
    }

    if (filters.sourceKind && filters.sourceKind !== "all" && card.sourceKind !== filters.sourceKind) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = [
      card.title,
      card.reasoningType,
      card.promptText,
      card.logicChainText,
      card.personalSummaryText,
      card.analysisText,
      card.extraNotesText,
      card.sourceKind,
      card.sourceRowKey,
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(keyword);
  });
}

function normalizeAdminCardInput(input: AdminCardInput) {
  return {
    section: input.section,
    reasoningType: input.reasoningType.trim(),
    title: input.title.trim(),
    promptText: input.promptText.trim(),
    optionsText: input.optionsText.trim(),
    myAnswer: input.myAnswer.trim(),
    correctAnswer: input.correctAnswer.trim(),
    timeSpent: input.timeSpent.trim(),
    analysisText: input.analysisText.trim(),
    logicChainText: input.logicChainText.trim(),
    personalSummaryText: input.personalSummaryText.trim(),
    extraNotesText: input.extraNotesText.trim(),
  } satisfies AdminCardInput;
}

function buildAdminCardUpdatePayload(input: AdminCardInput) {
  const normalized = normalizeAdminCardInput(input);

  if (!normalized.title) {
    throw new Error("标题不能为空。");
  }

  return {
    section: normalized.section,
    reasoning_type: normalized.reasoningType,
    title: normalized.title,
    prompt_text: normalized.promptText,
    options_text: normalized.optionsText,
    my_answer: normalized.myAnswer,
    correct_answer: normalized.correctAnswer,
    time_spent: normalized.timeSpent,
    analysis_text: normalized.analysisText,
    logic_chain_text: normalized.logicChainText,
    personal_summary_text: normalized.personalSummaryText,
    extra_notes_text: normalized.extraNotesText,
    updated_at: new Date().toISOString(),
  };
}

function getSupabaseOrThrow(errorMessage: string) {
  if (!hasSupabaseConfig()) {
    throw new Error(errorMessage);
  }

  return getSupabaseAdminClient();
}

function normalizeAssetKind(value?: string | null) {
  if (value === "question_screenshot" || value === "analysis_screenshot") {
    return value;
  }

  return "attachment" as const;
}

function ensureSupportedImage(contentType: string) {
  if (!IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error("当前只支持 PNG、JPEG 或 WebP 图片。");
  }
}

function getImageMetadata(buffer: Buffer) {
  const size = imageSize(buffer);
  if (!size.width || !size.height) {
    throw new Error("无法识别图片尺寸，请重新上传。");
  }

  return {
    width: size.width,
    height: size.height,
  };
}

function createAdminAssetPath(cardId: string, fileName: string) {
  return `admin_manual/${cardId}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

async function listCardAssets(cardId: string) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法读取附件。");
  const response = await supabase
    .from("mistake_assets")
    .select("*")
    .eq("card_id", cardId)
    .order("sort_order", { ascending: true });

  if (response.error) {
    throw response.error;
  }

  return (response.data as DbMistakeAssetRow[]).map((row) => mapAsset(row));
}

async function getAssetRow(assetId: string) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法读取附件。");
  const response = await supabase
    .from("mistake_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    throw new Error("未找到对应附件。");
  }

  return response.data as DbMistakeAssetRow;
}

async function normalizeCardAssetSortOrders(cardId: string) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法整理附件顺序。");
  const response = await supabase
    .from("mistake_assets")
    .select("id")
    .eq("card_id", cardId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (response.error) {
    throw response.error;
  }

  const rows = response.data ?? [];
  for (const [index, row] of rows.entries()) {
    const updateResponse = await supabase
      .from("mistake_assets")
      .update({ sort_order: index })
      .eq("id", row.id as string);

    if (updateResponse.error) {
      throw updateResponse.error;
    }
  }
}

function loadBundledCards() {
  return (bundledSeedData.cards as BundledMistakeCard[]).map((card) => mapBundledCard(card));
}

const loadCachedSupabaseSectionCards = unstable_cache(
  async (section: BrowseSection) => {
    const supabase = getSupabaseAdminClient();
    const cardsResponse = await supabase
      .from("mistake_cards")
      .select(SECTION_CARD_COLUMNS)
      .eq("section", section)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false });

    if (cardsResponse.error) {
      throw cardsResponse.error;
    }

    const rows = ((cardsResponse.data ?? []) as unknown as CardRowSnapshot[]);
    if (rows.length === 0) {
      return [];
    }

    const cardIds = rows.map((row) => row.id);
    const assetCountsResponse = await supabase
      .from("mistake_assets")
      .select("card_id")
      .in("card_id", cardIds);

    if (assetCountsResponse.error) {
      throw assetCountsResponse.error;
    }

    const assetCounts = groupAssetCounts(
      ((assetCountsResponse.data ?? []) as Array<{ card_id: string }>),
    );

    return rows.map((row) =>
      mapCard(row, {
        assetCount: assetCounts.get(row.id) ?? 0,
      }),
    );
  },
  ["supabase-section-cards"],
  { tags: [CARDS_CACHE_TAG], revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

const loadCachedSupabaseCardDetail = unstable_cache(
  async (cardId: string) => {
    const supabase = getSupabaseAdminClient();
    const cardResponse = await supabase
      .from("mistake_cards")
      .select("*")
      .eq("id", cardId)
      .maybeSingle();

    if (cardResponse.error) {
      throw cardResponse.error;
    }

    if (!cardResponse.data) {
      return null;
    }

    const assetsResponse = await supabase
      .from("mistake_assets")
      .select("*")
      .eq("card_id", cardId)
      .order("sort_order", { ascending: true });

    if (assetsResponse.error) {
      throw assetsResponse.error;
    }

    const assets = (assetsResponse.data as DbMistakeAssetRow[]).map((row) => mapAsset(row));
    return mapCard(cardResponse.data as DbMistakeCardRow, { assets });
  },
  ["supabase-card-detail"],
  { tags: [CARDS_CACHE_TAG], revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

const loadCachedSupabaseImportJobs = unstable_cache(
  async (limit: number) => {
    const supabase = getSupabaseAdminClient();
    const response = await supabase
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (response.error) {
      throw response.error;
    }

    return (response.data as DbImportJobRow[]).map((row) => ({
      id: row.id,
      sourceKind: row.source_kind,
      originalName: row.original_name,
      fileSha256: row.file_sha256,
      importedCount: row.imported_count,
      skippedCount: row.skipped_count,
      createdAt: row.created_at,
    }));
  },
  ["supabase-import-jobs"],
  { tags: [IMPORT_JOBS_CACHE_TAG], revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

async function loadSectionCards(section: BrowseSection) {
  if (hasSupabaseConfig()) {
    return loadCachedSupabaseSectionCards(section);
  }

  return sortCards(loadBundledCards().filter((card) => card.section === section));
}

async function loadAllCards() {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const cardsResponse = await supabase
      .from("mistake_cards")
      .select(ADMIN_CARD_COLUMNS)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false });

    if (cardsResponse.error) {
      throw cardsResponse.error;
    }

    const rows = (cardsResponse.data ?? []) as unknown as CardRowSnapshot[];
    if (rows.length === 0) {
      return [];
    }

    const cardIds = rows.map((row) => row.id);
    const assetCountsResponse = await supabase
      .from("mistake_assets")
      .select("card_id")
      .in("card_id", cardIds);

    if (assetCountsResponse.error) {
      throw assetCountsResponse.error;
    }

    const assetCounts = groupAssetCounts(
      ((assetCountsResponse.data ?? []) as Array<{ card_id: string }>),
    );

    return rows.map((row) =>
      mapCard(row, {
        assetCount: assetCounts.get(row.id) ?? 0,
      }),
    );
  }

  return sortCards(loadBundledCards());
}

async function loadSupabaseImportJobs(limit: number) {
  return loadCachedSupabaseImportJobs(limit);
}

async function getCardBySection(section: BrowseSection, cardId: string) {
  if (!hasSupabaseConfig()) {
    const cards = await loadSectionCards(section);
    return cards.find((card) => card.id === cardId) ?? null;
  }

  const card = await loadCachedSupabaseCardDetail(cardId);
  if (!card || card.section !== section) {
    return null;
  }

  return card;
}

async function getCardById(cardId: string) {
  if (!hasSupabaseConfig()) {
    const cards = await loadAllCards();
    return cards.find((card) => card.id === cardId) ?? null;
  }

  return loadCachedSupabaseCardDetail(cardId);
}

async function getCardDetailContext(section: BrowseSection, cardId: string) {
  if (!hasSupabaseConfig()) {
    const cards = await loadSectionCards(section);
    return getDetailContext(cards, cardId);
  }

  const [card, sectionCards] = await Promise.all([
    loadCachedSupabaseCardDetail(cardId),
    loadSectionCards(section),
  ]);

  if (!card || card.section !== section) {
    return {
      card: null,
      nextCard: null,
    };
  }

  const { nextCard } = getDetailContext(sectionCards, cardId);
  return {
    card,
    nextCard,
  };
}

function getDetailContext(cards: MistakeCard[], cardId: string) {
  const currentIndex = cards.findIndex((card) => card.id === cardId);
  if (currentIndex === -1) {
    return {
      card: null,
      nextCard: null,
    };
  }

  return {
    card: cards[currentIndex] ?? null,
    nextCard: cards[currentIndex + 1] ?? null,
  };
}

export async function listLogicCards(filters: CardFilters = {}) {
  const allLogicCards = await loadSectionCards("logic");
  const logicCards = filterCards(allLogicCards, "logic", filters);
  const reasoningTypes = sortReasoningTypes(
    Array.from(new Set(allLogicCards.map((card) => card.reasoningType).filter(Boolean))),
    ["CR"],
  );

  return {
    cards: logicCards,
    total: logicCards.length,
    totalAll: allLogicCards.length,
    reasoningTypes,
    usingSupabase: hasSupabaseConfig(),
  };
}

export async function getLogicCard(cardId: string) {
  return getCardBySection("logic", cardId);
}

export async function getLogicCardDetailContext(cardId: string) {
  return getCardDetailContext("logic", cardId);
}

export async function listReadingCards(filters: CardFilters = {}) {
  const allReadingCards = await loadSectionCards("reading");
  const readingCards = filterCards(allReadingCards, "reading", filters);
  const reasoningTypes = sortReasoningTypes(
    Array.from(new Set(allReadingCards.map((card) => card.reasoningType).filter(Boolean))),
    ["RC"],
  );

  return {
    cards: readingCards,
    total: readingCards.length,
    totalAll: allReadingCards.length,
    reasoningTypes,
    usingSupabase: hasSupabaseConfig(),
  };
}

export async function getReadingCard(cardId: string) {
  return getCardBySection("reading", cardId);
}

export async function getReadingCardDetailContext(cardId: string) {
  return getCardDetailContext("reading", cardId);
}

export async function listMathCards(filters: CardFilters = {}) {
  const allMathCards = await loadSectionCards("quant");
  const mathCards = filterCards(allMathCards, "quant", filters);
  const kinds = Array.from(
    new Set(allMathCards.map((card) => getMathKindFromCard(card)).filter(Boolean)),
  ).sort((left, right) => {
    const order: MathKind[] = ["PS", "DS", "粗心"];
    return order.indexOf(left as MathKind) - order.indexOf(right as MathKind);
  });
  const modules = Array.from(
    new Set(allMathCards.map((card) => getMathModuleFromCard(card)).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "zh-CN"));

  return {
    cards: mathCards,
    total: mathCards.length,
    totalAll: allMathCards.length,
    kinds,
    modules,
    usingSupabase: hasSupabaseConfig(),
  };
}

export async function getMathCard(cardId: string) {
  return getCardBySection("quant", cardId);
}

export async function getMathCardDetailContext(cardId: string) {
  return getCardDetailContext("quant", cardId);
}

export async function listDataInsightsCards(filters: CardFilters = {}) {
  const allDataInsightsCards = await loadSectionCards("data_insights");
  const dataInsightsCards = filterCards(allDataInsightsCards, "data_insights", filters);
  const reasoningTypes = sortReasoningTypes(
    Array.from(new Set(allDataInsightsCards.map((card) => card.reasoningType).filter(Boolean))),
    ["DS", "MSR", "GI", "TA", "TPA", "IR"],
  );

  return {
    cards: dataInsightsCards,
    total: dataInsightsCards.length,
    totalAll: allDataInsightsCards.length,
    reasoningTypes,
    usingSupabase: hasSupabaseConfig(),
  };
}

export async function getDataInsightsCard(cardId: string) {
  return getCardBySection("data_insights", cardId);
}

export async function getDataInsightsCardDetailContext(cardId: string) {
  return getCardDetailContext("data_insights", cardId);
}

export async function listAdminCards(filters: AdminCardFilters = {}) {
  const allCards = await loadAllCards();
  const cards = filterAdminCards(allCards, filters);
  const sourceKinds = sortReasoningTypes(
    Array.from(new Set(allCards.map((card) => card.sourceKind).filter(Boolean))),
  );

  return {
    cards,
    total: cards.length,
    totalAll: allCards.length,
    sourceKinds,
    usingSupabase: hasSupabaseConfig(),
  };
}

export async function getAdminCardEditor(cardId: string) {
  return getCardById(cardId);
}

export async function listImportJobs(limit = 8): Promise<ImportJob[]> {
  if (hasSupabaseConfig()) {
    return loadSupabaseImportJobs(limit);
  }

  return ((bundledSeedData.importJobs as ImportJob[]) ?? []).slice(0, limit);
}

function extensionQuestionToCard(question: ExtensionQuestionPayload, index: number): ImportCardInput {
  const timestamp = question.timestamp ? new Date(question.timestamp) : new Date();
  const createdAt = Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
  const section = classifySection(question.questionType, question.examTitle, question.sectionHint);
  const mathKind = section === "quant" ? normalizeMathKind(question.questionType, question.examTitle) : "";
  const sourcePayload = {
    ...(question as unknown as Record<string, unknown>),
    section,
    ...(mathKind ? { mathKind } : {}),
  };
  const contentHash = sha256Text(JSON.stringify(sourcePayload));
  const questionScreenshot = dataUrlToBuffer(question.questionScreenshot);
  const analysisScreenshot = dataUrlToBuffer(question.analysisScreenshot);
  const assets = [];

  if (questionScreenshot) {
    const size = imageSize(questionScreenshot);
    assets.push({
      assetKind: "question_screenshot" as const,
      anchorColumn: null,
      sortOrder: assets.length,
      buffer: questionScreenshot,
      fileName: sanitizeFileName(`${contentHash}-question.png`),
      width: size.width ?? null,
      height: size.height ?? null,
    });
  }

  if (analysisScreenshot) {
    const size = imageSize(analysisScreenshot);
    assets.push({
      assetKind: "analysis_screenshot" as const,
      anchorColumn: null,
      sortOrder: assets.length,
      buffer: analysisScreenshot,
      fileName: sanitizeFileName(`${contentHash}-analysis.png`),
      width: size.width ?? null,
      height: size.height ?? null,
    });
  }

  return {
    section,
    reasoningType: section === "quant" && mathKind ? mathKind : question.questionType ?? "",
    title: question.examTitle?.trim() || `插件导入错题 ${index + 1}`,
    promptText: [question.articleContent, question.questionText].filter(Boolean).join("\n\n"),
    optionsText: Array.isArray(question.options) ? question.options.join("\n") : "",
    myAnswer: question.myAnswer ?? "",
    correctAnswer: question.correctAnswer ?? "",
    timeSpent: question.timeSpent ?? "",
    analysisText: question.analysis ?? "",
    logicChainText: "",
    personalSummaryText: "",
    extraNotesText: [question.questionNumber ? `题号：${question.questionNumber}` : "", question.sectionHint ? `分区：${question.sectionHint}` : ""]
      .filter(Boolean)
      .join("\n"),
    sourceKind: "extension_upload",
    sourceRowKey: contentHash,
    sourcePayload,
    status: "needs_review",
    reviewCount: 0,
    createdAt,
    updatedAt: createdAt,
    assets,
  };
}

export function buildExtensionImportBatch(questions: ExtensionQuestionPayload[]): ImportBatch {
  const cards = questions.map(extensionQuestionToCard);
  const serialized = JSON.stringify(questions);
  return {
    sourceKind: "extension_upload",
    originalName: `extension-batch-${new Date().toISOString()}.json`,
    fileSha256: sha256Text(serialized),
    cards,
  };
}

export async function saveImportBatch(batch: ImportBatch) {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase 未配置，当前环境只能浏览内置种子数据。");
  }

  const uniqueCardsBySourceKey = new Map<string, (typeof batch.cards)[number]>();
  batch.cards.forEach((card) => {
    if (!uniqueCardsBySourceKey.has(card.sourceRowKey)) {
      uniqueCardsBySourceKey.set(card.sourceRowKey, card);
    }
  });
  const dedupedCards = Array.from(uniqueCardsBySourceKey.values());
  const duplicateWithinBatchCount = batch.cards.length - dedupedCards.length;

  const supabase = getSupabaseAdminClient();
  const existingJobResponse = await supabase
    .from("import_jobs")
    .select("*")
    .eq("source_kind", batch.sourceKind)
    .eq("file_sha256", batch.fileSha256)
    .maybeSingle();

  if (existingJobResponse.error) {
    throw existingJobResponse.error;
  }

  if (existingJobResponse.data) {
    return {
      duplicate: true,
      importedCount: 0,
      skippedCount: batch.cards.length,
      job: {
        id: existingJobResponse.data.id,
        sourceKind: existingJobResponse.data.source_kind,
        originalName: existingJobResponse.data.original_name,
        fileSha256: existingJobResponse.data.file_sha256,
        importedCount: existingJobResponse.data.imported_count,
        skippedCount: existingJobResponse.data.skipped_count,
        createdAt: existingJobResponse.data.created_at,
      } satisfies ImportJob,
    };
  }

  const sourceRowKeys = dedupedCards.map((card) => card.sourceRowKey);
  const existingCardsResponse = await supabase
    .from("mistake_cards")
    .select("id, source_row_key")
    .eq("source_kind", batch.sourceKind)
    .in("source_row_key", sourceRowKeys);

  if (existingCardsResponse.error) {
    throw existingCardsResponse.error;
  }

  const existingSourceKeys = new Set(
    (existingCardsResponse.data ?? []).map((row) => row.source_row_key as string),
  );
  const newCards = dedupedCards.filter((card) => !existingSourceKeys.has(card.sourceRowKey));
  const skippedCount = duplicateWithinBatchCount + (dedupedCards.length - newCards.length);

  const insertPayload = newCards.map((card) => ({
    section: card.section,
    reasoning_type: card.reasoningType,
    title: card.title,
    prompt_text: card.promptText,
    options_text: card.optionsText,
    my_answer: card.myAnswer,
    correct_answer: card.correctAnswer,
    time_spent: card.timeSpent,
    analysis_text: card.analysisText,
    logic_chain_text: card.logicChainText,
    personal_summary_text: card.personalSummaryText,
    extra_notes_text: card.extraNotesText,
    source_kind: card.sourceKind,
    source_row_key: card.sourceRowKey,
    source_payload: card.sourcePayload,
    status: card.status,
    review_count: card.reviewCount,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  }));

  const insertedCardsResponse =
    insertPayload.length > 0
      ? await supabase.from("mistake_cards").insert(insertPayload).select("id, source_row_key")
      : { data: [], error: null };

  if (insertedCardsResponse.error) {
    throw insertedCardsResponse.error;
  }

  const insertedCards = insertedCardsResponse.data ?? [];
  const insertedMap = new Map<string, string>();
  insertedCards.forEach((row) => {
    insertedMap.set(row.source_row_key as string, row.id as string);
  });

  const { bucket } = getSupabaseConfig();
  const assetRows: Array<{
    card_id: string;
    asset_kind: string;
    anchor_column: number | null;
    sort_order: number;
    storage_path: string;
    width: number | null;
    height: number | null;
  }> = [];

  for (const card of newCards) {
    const cardId = insertedMap.get(card.sourceRowKey);
    if (!cardId) {
      continue;
    }

    for (const asset of card.assets) {
      const objectPath = `${card.sourceKind}/${cardId}/${sanitizeFileName(asset.fileName)}`;
      const uploadResponse = await supabase.storage
        .from(bucket)
        .upload(objectPath, asset.buffer, {
          cacheControl: "3600",
          contentType: "image/png",
          upsert: false,
        });

      if (uploadResponse.error) {
        throw uploadResponse.error;
      }

      assetRows.push({
        card_id: cardId,
        asset_kind: asset.assetKind,
        anchor_column: asset.anchorColumn,
        sort_order: asset.sortOrder,
        storage_path: objectPath,
        width: asset.width,
        height: asset.height,
      });
    }
  }

  if (assetRows.length > 0) {
    const assetInsertResponse = await supabase.from("mistake_assets").insert(assetRows);
    if (assetInsertResponse.error) {
      throw assetInsertResponse.error;
    }
  }

  const importedCount = insertedCards.length;
  const importJobResponse = await supabase
    .from("import_jobs")
    .insert({
      source_kind: batch.sourceKind,
      original_name: batch.originalName,
      file_sha256: batch.fileSha256,
      imported_count: importedCount,
      skipped_count: skippedCount,
    })
    .select("*")
    .single();

  if (importJobResponse.error) {
    throw importJobResponse.error;
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
  revalidateTag(IMPORT_JOBS_CACHE_TAG, "max");

  return {
    duplicate: false,
    importedCount,
    skippedCount,
    job: {
      id: importJobResponse.data.id,
      sourceKind: importJobResponse.data.source_kind,
      originalName: importJobResponse.data.original_name,
      fileSha256: importJobResponse.data.file_sha256,
      importedCount: importJobResponse.data.imported_count,
      skippedCount: importJobResponse.data.skipped_count,
      createdAt: importJobResponse.data.created_at,
    } satisfies ImportJob,
  };
}

export async function updateCard(
  cardId: string,
  updates: Partial<Pick<MistakeCard, "status" | "personalSummaryText" | "extraNotesText">>,
) {
  if (!hasSupabaseConfig()) {
    throw new Error("未配置 Supabase，无法修改卡片。");
  }

  const supabase = getSupabaseAdminClient();
  const updatePayload: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) {
    updatePayload.status = updates.status;
  }

  if (typeof updates.personalSummaryText === "string") {
    updatePayload.personal_summary_text = updates.personalSummaryText;
  }

  if (typeof updates.extraNotesText === "string") {
    updatePayload.extra_notes_text = updates.extraNotesText;
  }

  const response = await supabase
    .from("mistake_cards")
    .update(updatePayload)
    .eq("id", cardId)
    .select("*")
    .single();

  if (response.error) {
    throw response.error;
  }

  revalidateTag(CARDS_CACHE_TAG, "max");

  return response.data;
}

export async function createManualCard(input: AdminCardInput) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法新增卡片。");
  const now = new Date().toISOString();
  const payload = buildAdminCardUpdatePayload(input);
  const sourceRowKey = `manual:${randomUUID()}`;

  const response = await supabase
    .from("mistake_cards")
    .insert({
      ...payload,
      source_kind: "admin_manual",
      source_row_key: sourceRowKey,
      source_payload: {
        createdFrom: "admin_cards_center",
      },
      status: "needs_review",
      review_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (response.error) {
    throw response.error;
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
  const card = await getAdminCardEditor(response.data.id as string);
  if (!card) {
    throw new Error("卡片已创建，但重新读取失败。");
  }

  return card;
}

export async function updateCardContent(cardId: string, input: AdminCardInput) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法修改卡片。");
  const payload = buildAdminCardUpdatePayload(input);

  const response = await supabase
    .from("mistake_cards")
    .update(payload)
    .eq("id", cardId)
    .select("id")
    .single();

  if (response.error) {
    throw response.error;
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
  const card = await getAdminCardEditor(response.data.id as string);
  if (!card) {
    throw new Error("卡片已更新，但重新读取失败。");
  }

  return card;
}

export async function uploadCardAssets(cardId: string, files: AdminAssetUploadInput[]) {
  if (files.length === 0) {
    throw new Error("请至少选择一张图片。");
  }

  const supabase = getSupabaseOrThrow("未配置 Supabase，无法上传附件。");
  const card = await getAdminCardEditor(cardId);
  if (!card) {
    throw new Error("未找到要上传附件的卡片。");
  }

  const existingAssets = await listCardAssets(cardId);
  const { bucket } = getSupabaseConfig();
  const assetRows: Array<{
    card_id: string;
    asset_kind: string;
    anchor_column: number | null;
    sort_order: number;
    storage_path: string;
    width: number;
    height: number;
  }> = [];

  for (const [index, file] of files.entries()) {
    ensureSupportedImage(file.contentType);
    const { width, height } = getImageMetadata(file.buffer);
    const storagePath = createAdminAssetPath(cardId, file.fileName);
    const uploadResponse = await supabase.storage.from(bucket).upload(storagePath, file.buffer, {
      cacheControl: "3600",
      contentType: file.contentType,
      upsert: false,
    });

    if (uploadResponse.error) {
      throw uploadResponse.error;
    }

    assetRows.push({
      card_id: cardId,
      asset_kind: normalizeAssetKind(file.assetKind),
      anchor_column: null,
      sort_order: existingAssets.length + index,
      storage_path: storagePath,
      width,
      height,
    });
  }

  const insertResponse = await supabase.from("mistake_assets").insert(assetRows);
  if (insertResponse.error) {
    throw insertResponse.error;
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
  return listCardAssets(cardId);
}

export async function reorderCardAssets(cardId: string, orderedAssetIds: string[]) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法调整附件顺序。");
  const response = await supabase
    .from("mistake_assets")
    .select("id")
    .eq("card_id", cardId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (response.error) {
    throw response.error;
  }

  const existingIds = (response.data ?? []).map((row) => row.id as string);
  if (existingIds.length !== orderedAssetIds.length) {
    throw new Error("附件顺序数据不完整，请刷新后重试。");
  }

  const existingSet = new Set(existingIds);
  if (orderedAssetIds.some((assetId) => !existingSet.has(assetId))) {
    throw new Error("检测到未知附件，无法保存顺序。");
  }

  for (const [index, assetId] of orderedAssetIds.entries()) {
    const updateResponse = await supabase
      .from("mistake_assets")
      .update({ sort_order: index })
      .eq("id", assetId)
      .eq("card_id", cardId);

    if (updateResponse.error) {
      throw updateResponse.error;
    }
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
  return listCardAssets(cardId);
}

export async function updateAssetMeta(
  assetId: string,
  updates: Partial<Pick<MistakeAsset, "assetKind" | "sortOrder">>,
) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法修改附件。");
  const asset = await getAssetRow(assetId);
  const updatePayload: Record<string, string | number> = {};

  if (updates.assetKind) {
    updatePayload.asset_kind = normalizeAssetKind(updates.assetKind);
  }

  if (typeof updates.sortOrder === "number" && Number.isFinite(updates.sortOrder)) {
    updatePayload.sort_order = Math.max(0, Math.floor(updates.sortOrder));
  }

  if (Object.keys(updatePayload).length === 0) {
    return mapAsset(asset);
  }

  const response = await supabase
    .from("mistake_assets")
    .update(updatePayload)
    .eq("id", assetId)
    .select("*")
    .single();

  if (response.error) {
    throw response.error;
  }

  if (typeof updates.sortOrder === "number") {
    await normalizeCardAssetSortOrders(asset.card_id);
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
  return mapAsset(response.data as DbMistakeAssetRow);
}

export async function replaceAssetFile(assetId: string, file: AdminAssetUploadInput) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法替换附件。");
  const asset = await getAssetRow(assetId);
  ensureSupportedImage(file.contentType);
  const { width, height } = getImageMetadata(file.buffer);
  const newStoragePath = createAdminAssetPath(asset.card_id, file.fileName);
  const { bucket } = getSupabaseConfig();

  const uploadResponse = await supabase.storage.from(bucket).upload(newStoragePath, file.buffer, {
    cacheControl: "3600",
    contentType: file.contentType,
    upsert: false,
  });

  if (uploadResponse.error) {
    throw uploadResponse.error;
  }

  const updateResponse = await supabase
    .from("mistake_assets")
    .update({
      storage_path: newStoragePath,
      width,
      height,
    })
    .eq("id", assetId)
    .select("*")
    .single();

  if (updateResponse.error) {
    throw updateResponse.error;
  }

  if (asset.storage_path) {
    const removeResponse = await supabase.storage.from(bucket).remove([asset.storage_path]);
    if (removeResponse.error) {
      throw removeResponse.error;
    }
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
  return mapAsset(updateResponse.data as DbMistakeAssetRow);
}

export async function deleteAsset(assetId: string) {
  const supabase = getSupabaseOrThrow("未配置 Supabase，无法删除附件。");
  const asset = await getAssetRow(assetId);
  const { bucket } = getSupabaseConfig();

  if (asset.storage_path) {
    const removeResponse = await supabase.storage.from(bucket).remove([asset.storage_path]);
    if (removeResponse.error) {
      throw removeResponse.error;
    }
  }

  const deleteResponse = await supabase.from("mistake_assets").delete().eq("id", assetId);
  if (deleteResponse.error) {
    throw deleteResponse.error;
  }

  await normalizeCardAssetSortOrders(asset.card_id);
  revalidateTag(CARDS_CACHE_TAG, "max");
  return listCardAssets(asset.card_id);
}

export async function incrementCardReviewCount(cardId: string) {
  if (!hasSupabaseConfig()) {
    throw new Error("未配置 Supabase，无法记录复习进度。");
  }

  const supabase = getSupabaseAdminClient();
  const response = await supabase.rpc("increment_card_review_count", {
    target_card_id: cardId,
  });

  if (response.error) {
    throw response.error;
  }

  const row = Array.isArray(response.data) ? response.data[0] : response.data;
  if (!row || typeof row.review_count !== "number") {
    throw new Error("未找到要更新的卡片。");
  }

  revalidateTag(CARDS_CACHE_TAG, "max");

  return {
    reviewCount: row.review_count,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

export async function deleteCard(cardId: string) {
  if (!hasSupabaseConfig()) {
    throw new Error("未配置 Supabase，无法删除卡片。");
  }

  const supabase = getSupabaseAdminClient();
  const assetsResponse = await supabase
    .from("mistake_assets")
    .select("storage_path")
    .eq("card_id", cardId);

  if (assetsResponse.error) {
    throw assetsResponse.error;
  }

  const objectPaths = (assetsResponse.data ?? [])
    .map((item) => item.storage_path as string)
    .filter(Boolean);

  if (objectPaths.length > 0) {
    const { bucket } = getSupabaseConfig();
    const removeResponse = await supabase.storage.from(bucket).remove(objectPaths);
    if (removeResponse.error) {
      throw removeResponse.error;
    }
  }

  const assetDeleteResponse = await supabase.from("mistake_assets").delete().eq("card_id", cardId);
  if (assetDeleteResponse.error) {
    throw assetDeleteResponse.error;
  }

  const cardDeleteResponse = await supabase.from("mistake_cards").delete().eq("id", cardId);
  if (cardDeleteResponse.error) {
    throw cardDeleteResponse.error;
  }

  revalidateTag(CARDS_CACHE_TAG, "max");
}
