import Link from "next/link";
import { getMathModuleFromCard } from "@/lib/math";
import { getCardDetailPath } from "@/lib/sections";
import { getReviewCountLabel } from "@/lib/sections";
import type { MistakeCard } from "@/lib/types";

interface CardPreviewProps {
  card: MistakeCard;
}

export function CardPreview({ card }: CardPreviewProps) {
  const mathModule = card.section === "quant" ? getMathModuleFromCard(card) : "";
  const assetCount = card.assetCount ?? card.assets.length;

  return (
    <Link
      href={getCardDetailPath(card)}
      className="paper-card group flex h-full flex-col rounded-[28px] p-5 transition duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_24px_70px_rgba(127,45,24,0.16)]"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[rgba(166,75,42,0.1)] px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[color:var(--accent-strong)]">
            {card.reasoningType || "未分类"}
          </span>
          {mathModule ? (
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--muted)]">
              {mathModule}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-[color:var(--muted)]">{getReviewCountLabel(card.reviewCount)}</span>
      </div>
      <h3 className="section-title text-2xl leading-tight text-[color:var(--foreground)]">
        {card.title}
      </h3>
      <p className="mt-3 line-clamp-4 text-sm leading-7 text-[color:var(--muted)]">
        {card.personalSummaryText || card.logicChainText || card.promptText || "这张卡片主要依靠附件承载内容。"}
      </p>
      <div className="mt-5 flex items-center justify-between text-sm text-[color:var(--muted)]">
        <span>{assetCount} 个附件</span>
        <span className="transition group-hover:text-[color:var(--accent-strong)]">查看详情</span>
      </div>
    </Link>
  );
}
