"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { useAdminSession } from "@/lib/use-admin-session";
import { getCardDetailPath, getReviewCountLabel } from "@/lib/sections";
import type { MistakeCard } from "@/lib/types";

interface CardDetailActionsProps {
  cardId: string;
  initialReviewCount: number;
  nextCard: Pick<MistakeCard, "id" | "section" | "title"> | null;
  adminEditHref?: string;
}

export function CardDetailActions({
  cardId,
  initialReviewCount,
  nextCard,
  adminEditHref,
}: CardDetailActionsProps) {
  const router = useRouter();
  const { isAdmin } = useAdminSession();
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (nextCard) {
      router.prefetch(getCardDetailPath(nextCard));
    }

    if (isAdmin && adminEditHref) {
      router.prefetch(adminEditHref);
    }
  }, [adminEditHref, isAdmin, nextCard, router]);

  async function handleReviewComplete() {
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/cards/${cardId}/review`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string; reviewCount?: number };
      if (!response.ok || typeof payload.reviewCount !== "number") {
        throw new Error(payload.error || "复习次数更新失败。");
      }

      setReviewCount(payload.reviewCount);
      setMessage(`已记录，本题现在是${getReviewCountLabel(payload.reviewCount)}。`);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "复习次数更新失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="paper-card rounded-[28px] p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="section-title text-2xl">刷题动作</h3>
        <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Flow</span>
      </div>
      <div className="rounded-[24px] border border-[color:var(--line)] bg-white/70 p-4">
        <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">当前复习状态</div>
        <div className="mt-3 text-lg font-medium text-[color:var(--foreground)]">
          {getReviewCountLabel(reviewCount)}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {isAdmin && adminEditHref ? (
          <Link
            href={adminEditHref}
            className="flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
          >
            打开完整编辑器
          </Link>
        ) : null}
        {nextCard ? (
          <Link
            href={getCardDetailPath(nextCard)}
            className="flex rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
          >
            下一题
          </Link>
        ) : (
          <div className="rounded-full border border-dashed border-[color:var(--line)] px-5 py-3 text-sm text-[color:var(--muted)]">
            已经是当前题库的最后一题
          </div>
        )}
        {nextCard ? (
          <p className="rounded-[20px] bg-[rgba(255,255,255,0.7)] px-4 py-3 text-sm leading-7 text-[color:var(--muted)]">
            下一题：{nextCard.title}
          </p>
        ) : null}
        {isAdmin ? (
          <button
            type="button"
            onClick={handleReviewComplete}
            disabled={isSubmitting}
            className="w-full rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "记录中…" : "复习完成"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-4 rounded-2xl bg-[rgba(166,75,42,0.08)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
