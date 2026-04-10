import type { DetailLabelMap, MathKind, MistakeCard } from "@/lib/types";

export const MATH_KIND_OPTIONS: Array<{ value: MathKind; label: string }> = [
  { value: "PS", label: "PS" },
  { value: "DS", label: "DS" },
  { value: "粗心", label: "粗心" },
];

function normalizeHaystack(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function normalizeMathKind(...parts: Array<string | null | undefined>): MathKind | "" {
  const haystack = normalizeHaystack(parts);
  if (!haystack) {
    return "";
  }

  if (haystack.includes("粗心")) {
    return "粗心";
  }

  if (haystack.includes("数据充分") || /\bds\b/.test(haystack)) {
    return "DS";
  }

  if (
    haystack.includes("问题求解") ||
    haystack.includes("数学ps") ||
    /\bps\b/.test(haystack)
  ) {
    return "PS";
  }

  return "";
}

export function inferMathKindFromSheetName(sheetName: string): MathKind {
  return normalizeMathKind(sheetName) || "PS";
}

export function getMathKindFromSourcePayload(
  sourcePayload: Record<string, unknown> | null,
  fallbackReasoningType?: string,
) {
  const mathKind = normalizeMathKind(
    typeof sourcePayload?.mathKind === "string" ? sourcePayload.mathKind : "",
    fallbackReasoningType,
  );

  return mathKind;
}

export function getMathModuleFromSourcePayload(sourcePayload: Record<string, unknown> | null) {
  return typeof sourcePayload?.module === "string" ? sourcePayload.module.trim() : "";
}

export function getMathDetailLabelsFromSourcePayload(sourcePayload: Record<string, unknown> | null) {
  const headerMapRecord = asRecord(sourcePayload?.headerMap);
  if (!headerMapRecord) {
    return {} satisfies DetailLabelMap;
  }

  const labels: DetailLabelMap = {};
  for (const [key, value] of Object.entries(headerMapRecord)) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    switch (key) {
      case "promptText":
      case "logicChainText":
      case "analysisText":
      case "personalSummaryText":
      case "extraNotesText":
        labels[key] = value.trim();
        break;
      default:
        break;
    }
  }

  return labels;
}

export function getMathKindFromCard(card: MistakeCard) {
  return getMathKindFromSourcePayload(card.sourcePayload, card.reasoningType);
}

export function getMathModuleFromCard(card: MistakeCard) {
  return getMathModuleFromSourcePayload(card.sourcePayload);
}

export function getMathDetailLabelsFromCard(card: MistakeCard) {
  return getMathDetailLabelsFromSourcePayload(card.sourcePayload);
}
