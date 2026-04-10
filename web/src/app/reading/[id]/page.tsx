import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCardActions } from "@/components/admin-card-actions";
import { AssetGallery } from "@/components/asset-gallery";
import { CardDetailActions } from "@/components/card-detail-actions";
import { getReadingCardDetailContext } from "@/lib/cards";
import { hasAdminSession } from "@/lib/auth";
import { getReviewCountLabel } from "@/lib/sections";

interface ReadingCardDetailProps {
  params: Promise<{ id: string }>;
}

function DetailBlock({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <section className="paper-card rounded-[28px] p-6">
      <h2 className="section-title text-3xl">{title}</h2>
      <div className="content-prose mt-4 text-sm sm:text-base">{content}</div>
    </section>
  );
}

export default async function ReadingCardDetailPage({ params }: ReadingCardDetailProps) {
  const { id } = await params;
  const [{ card, nextCard }, isAdmin] = await Promise.all([
    getReadingCardDetailContext(id),
    hasAdminSession(),
  ]);

  if (!card) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
        <Link href="/reading" className="transition hover:text-[color:var(--accent-strong)]">
          阅读题库
        </Link>
        <span>/</span>
        <span>{card.title}</span>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="paper-card rounded-[38px] p-7 sm:p-10">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[rgba(166,75,42,0.1)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
              {card.reasoningType || "未分类"}
            </span>
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--muted)]">
              {getReviewCountLabel(card.reviewCount)}
            </span>
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--muted)]">
              {card.assets.length} 个附件
            </span>
          </div>
          <h1 className="section-title text-4xl leading-tight sm:text-5xl">{card.title}</h1>
          <p className="mt-5 text-sm leading-8 text-[color:var(--muted)]">
            来源：{card.sourceKind} · 记录键：{card.sourceRowKey}
          </p>
          <div className="mt-8 rounded-[24px] border border-[color:var(--line)] bg-white/70 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">答案信息</div>
            <div className="mt-3 space-y-2 text-sm leading-7">
              <p>我的答案：{card.myAnswer || "暂无"}</p>
              <p>正确答案：{card.correctAnswer || "暂无"}</p>
              <p>用时：{card.timeSpent || "暂无"}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <CardDetailActions
            cardId={card.id}
            initialReviewCount={card.reviewCount}
            isAdmin={isAdmin}
            nextCard={nextCard}
          />
          <div className="paper-card rounded-[28px] p-6 text-sm leading-7 text-[color:var(--muted)]">
            阅读错题的截图附件已移到下方全宽区域，方便直接阅读和放大查看。
          </div>
        </div>
      </section>

      <AssetGallery assets={card.assets} />

      {isAdmin ? <AdminCardActions card={card} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailBlock title="解题思路" content={card.logicChainText} />
        <DetailBlock title="个人总结" content={card.personalSummaryText} />
        <DetailBlock title="解析" content={card.analysisText} />
        <DetailBlock title="补充备注" content={card.extraNotesText} />
      </div>

      <DetailBlock title="题目内容" content={card.promptText} />
    </div>
  );
}
