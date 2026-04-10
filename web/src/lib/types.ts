export type Section =
  | "logic"
  | "reading"
  | "sentence_correction"
  | "quant"
  | "data_insights"
  | "other";

export type CardStatus = "needs_review" | "learning" | "mastered";
export type ReviewStatusFilter = "pending" | "reviewed";

export type MathKind = "PS" | "DS" | "粗心";

export type CardContentField =
  | "promptText"
  | "logicChainText"
  | "analysisText"
  | "personalSummaryText"
  | "extraNotesText";

export type DetailLabelMap = Partial<Record<CardContentField, string>>;

export type AssetKind =
  | "attachment"
  | "question_screenshot"
  | "analysis_screenshot";

export interface MistakeAsset {
  id: string;
  cardId: string;
  assetKind: AssetKind;
  anchorColumn: number | null;
  sortOrder: number;
  storagePath: string;
  width: number | null;
  height: number | null;
  publicUrl: string;
}

export interface MistakeCard {
  id: string;
  section: Section;
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
  status: CardStatus;
  reviewCount: number;
  assetCount?: number;
  createdAt: string;
  updatedAt: string;
  assets: MistakeAsset[];
}

export interface ImportJob {
  id: string;
  sourceKind: string;
  originalName: string;
  fileSha256: string;
  importedCount: number;
  skippedCount: number;
  createdAt: string;
}

export interface CardFilters {
  q?: string;
  type?: string;
  kind?: MathKind | "all";
  module?: string | "all";
  status?: ReviewStatusFilter | "all";
}

export interface AdminCardFilters {
  q?: string;
  section?: Section | "all";
  status?: ReviewStatusFilter | "all";
  sourceKind?: string | "all";
}

export interface AdminCardInput {
  section: Section;
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
}

export interface AdminAssetUploadInput {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  assetKind?: AssetKind;
}

export interface BundledSeedData {
  cards: MistakeCard[];
  importJobs: ImportJob[];
}

export interface ImportAssetInput {
  assetKind: AssetKind;
  anchorColumn: number | null;
  sortOrder: number;
  buffer: Buffer;
  fileName: string;
  width: number | null;
  height: number | null;
}

export interface ImportCardInput {
  section: Section;
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
  status: CardStatus;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  assets: ImportAssetInput[];
}

export interface ImportBatch {
  sourceKind: string;
  originalName: string;
  fileSha256: string;
  cards: ImportCardInput[];
}

export interface ExtensionQuestionPayload {
  questionNumber?: string;
  questionType?: string;
  sectionHint?: Section;
  examTitle?: string;
  articleContent?: string;
  questionText?: string;
  options?: string[];
  myAnswer?: string;
  correctAnswer?: string;
  timeSpent?: string;
  analysis?: string;
  questionScreenshot?: string | null;
  analysisScreenshot?: string | null;
  timestamp?: string | number;
}

export interface DbMistakeCardRow {
  id: string;
  section: Section;
  reasoning_type: string | null;
  title: string | null;
  prompt_text: string | null;
  options_text: string | null;
  my_answer: string | null;
  correct_answer: string | null;
  time_spent: string | null;
  analysis_text: string | null;
  logic_chain_text: string | null;
  personal_summary_text: string | null;
  extra_notes_text: string | null;
  source_kind: string;
  source_row_key: string;
  source_payload: Record<string, unknown> | null;
  status: CardStatus;
  review_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbMistakeAssetRow {
  id: string;
  card_id: string;
  asset_kind: AssetKind;
  anchor_column: number | null;
  sort_order: number;
  storage_path: string;
  width: number | null;
  height: number | null;
  created_at?: string;
}

export interface DbImportJobRow {
  id: string;
  source_kind: string;
  original_name: string;
  file_sha256: string;
  imported_count: number;
  skipped_count: number;
  created_at: string;
}
