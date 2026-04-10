"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getReviewCountLabel, getSectionBrowsePath } from "@/lib/sections";
import type { MistakeCard } from "@/lib/types";

interface AdminCardActionsProps {
  card: MistakeCard;
}

export function AdminCardActions({ card }: AdminCardActionsProps) {
  const router = useRouter();
  const [personalSummaryText, setPersonalSummaryText] = useState(card.personalSummaryText);
  const [extraNotesText, setExtraNotesText] = useState(card.extraNotesText);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/cards/${card.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalSummaryText,
          extraNotesText,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "保存失败。");
      }

      setMessage("已保存这张错题卡。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("确认删除这张错题卡吗？此操作不可撤销。")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/cards/${card.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "删除失败。");
      }

      router.push(getSectionBrowsePath(card.section));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="paper-card rounded-[28px] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="section-title text-2xl">管理员操作</h3>
        <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Admin</span>
      </div>
      <div className="mb-4 rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-4 text-sm leading-7 text-[color:var(--muted)]">
        <div className="font-medium text-[color:var(--foreground)]">当前复习状态：{getReviewCountLabel(card.reviewCount)}</div>
        <div className="mt-1">复习次数请在详情页右侧的“复习完成”按钮中递增记录。</div>
      </div>
      <label className="mb-4 block text-sm font-medium">
        个人总结
        <textarea
          value={personalSummaryText}
          onChange={(event) => setPersonalSummaryText(event.target.value)}
          rows={6}
          className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
        />
      </label>
      <label className="mb-4 block text-sm font-medium">
        补充备注
        <textarea
          value={extraNotesText}
          onChange={(event) => setExtraNotesText(event.target.value)}
          rows={5}
          className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[color:var(--accent)] px-5 py-3 font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:opacity-60"
        >
          保存修改
        </button>
        <Link
          href={`/admin/cards/${card.id}`}
          className="rounded-full border border-[color:var(--line)] px-5 py-3 font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
        >
          完整编辑器
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting}
          className="rounded-full border border-[color:var(--line)] px-5 py-3 font-medium text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)] disabled:opacity-60"
        >
          删除卡片
        </button>
      </div>
      {message ? (
        <p className="mt-4 rounded-2xl bg-[rgba(166,75,42,0.08)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {message}
        </p>
      ) : null}
    </form>
  );
}
