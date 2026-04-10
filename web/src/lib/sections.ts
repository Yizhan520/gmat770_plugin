import type { AssetKind, ReviewStatusFilter, Section } from "@/lib/types";

export const SECTION_LABELS: Record<Section, string> = {
  logic: "逻辑",
  reading: "阅读",
  sentence_correction: "句子改错",
  quant: "数学",
  data_insights: "数据洞察",
  other: "其他",
};

export const REVIEW_STATUS_OPTIONS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: "pending", label: "待复习" },
  { value: "reviewed", label: "已复习" },
];

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  attachment: "原始附件",
  question_screenshot: "题目截图",
  analysis_screenshot: "解析截图",
};

export const SECTION_BROWSE_LABELS: Partial<Record<Section, string>> = {
  logic: "逻辑题库",
  reading: "阅读题库",
  quant: "数学题库",
  data_insights: "数据洞察题库",
};

export function getReviewCountLabel(reviewCount: number) {
  return reviewCount <= 0 ? "待复习" : `复习 ${reviewCount} 次`;
}

export function hasBrowsePageForSection(section: Section) {
  return (
    section === "logic" ||
    section === "reading" ||
    section === "quant" ||
    section === "data_insights"
  );
}

export function getSectionBrowsePath(section: Section) {
  if (section === "data_insights") {
    return "/data-insights";
  }

  if (section === "quant") {
    return "/math";
  }

  if (section === "reading") {
    return "/reading";
  }

  if (section === "logic") {
    return "/logic";
  }

  return "/";
}

export function getSectionBrowseLabel(section: Section) {
  return SECTION_BROWSE_LABELS[section] ?? SECTION_LABELS[section];
}

export function getCardDetailPath(card: { id: string; section: Section }) {
  if (!hasBrowsePageForSection(card.section)) {
    return "/";
  }

  return `${getSectionBrowsePath(card.section)}/${card.id}`;
}

export function classifySection(
  questionType?: string,
  examTitle?: string,
  sectionHint?: string,
): Section {
  const haystack = `${sectionHint ?? ""} ${questionType ?? ""} ${examTitle ?? ""}`.toLowerCase();

  if (
    haystack.includes("data_insights") ||
    haystack.includes("data insights") ||
    haystack.includes("数据洞察") ||
    /\bmsr\b/.test(haystack) ||
    /\btpa\b/.test(haystack) ||
    /\bgi\b/.test(haystack) ||
    /\bta\b/.test(haystack) ||
    /\bir\b/.test(haystack)
  ) {
    return "data_insights";
  }

  if (haystack.includes("逻辑") || haystack.includes("cr")) {
    return "logic";
  }

  if (haystack.includes("阅读") || haystack.includes("rc")) {
    return "reading";
  }

  if (haystack.includes("句子改错") || haystack.includes("sc")) {
    return "sentence_correction";
  }

  if (
    haystack.includes("ps") ||
    haystack.includes("ds") ||
    haystack.includes("数学") ||
    haystack.includes("数据充分")
  ) {
    return "quant";
  }

  return "other";
}

export function getCardTitle(fallbackRowKey: string, providedTitle?: string) {
  const normalized = (providedTitle ?? "").trim();
  return normalized || `错题卡片 ${fallbackRowKey}`;
}
