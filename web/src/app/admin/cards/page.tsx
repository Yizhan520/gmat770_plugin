import Link from "next/link";
import { redirect } from "next/navigation";
import { listAdminCards } from "@/lib/cards";
import { hasAdminSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { SECTION_LABELS, getCardDetailPath, getReviewCountLabel, hasBrowsePageForSection } from "@/lib/sections";
import type { Section } from "@/lib/types";

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface AdminCardsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}

export default async function AdminCardsPage({ searchParams }: AdminCardsPageProps) {
  const isAdmin = await hasAdminSession();
  if (!isAdmin) {
    redirect("/admin");
  }

  const params = await searchParams;
  const filters = {
    q: takeFirst(params.q) ?? "",
    section: (takeFirst(params.section) as Section | "all" | undefined) ?? "all",
    status: (takeFirst(params.status) as "all" | "pending" | "reviewed" | undefined) ?? "all",
    sourceKind: takeFirst(params.sourceKind) ?? "all",
  };

  const { cards, total, totalAll, sourceKinds } = await listAdminCards(filters);
  const usingSupabase = hasSupabaseConfig();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="paper-card rounded-[38px] p-7 sm:p-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Admin Cards</p>
            <h1 className="section-title mt-2 text-4xl sm:text-5xl">卡片中心</h1>
            <p className="mt-4 max-w-4xl text-sm leading-8 text-[color:var(--muted)]">
              这里可以跨分区检索所有错题，进入完整编辑器维护题目、答案、备注和图片附件。当前共 {totalAll} 张卡片，本次筛选命中 {total} 张。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
            >
              返回后台首页
            </Link>
            {usingSupabase ? (
              <Link
                href="/admin/cards/new"
                className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
              >
                手动新增错题
              </Link>
            ) : (
              <span className="rounded-full border border-dashed border-[color:var(--line)] px-5 py-3 text-sm text-[color:var(--muted)]">
                未配置 Supabase，暂时不能新增
              </span>
            )}
          </div>
        </div>
      </section>

      {!usingSupabase ? (
        <section className="paper-card rounded-[28px] p-6 text-sm leading-7 text-[color:var(--accent-strong)]">
          Supabase 尚未配置，当前页面为只读模式。你可以查看和筛选现有卡片，但无法新增、保存或管理附件。
        </section>
      ) : null}

      <section className="paper-card rounded-[32px] p-6 sm:p-8">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto]">
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="搜索标题、正文、逻辑链、来源"
            className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          />
          <select
            name="section"
            defaultValue={filters.section}
            className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          >
            <option value="all">全部分区</option>
            {Object.entries(SECTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          >
            <option value="all">全部复习进度</option>
            <option value="pending">待复习</option>
            <option value="reviewed">已复习</option>
          </select>
          <select
            name="sourceKind"
            defaultValue={filters.sourceKind}
            className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          >
            <option value="all">全部来源</option>
            {sourceKinds.map((sourceKind) => (
              <option key={sourceKind} value={sourceKind}>
                {sourceKind}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium whitespace-nowrap text-white transition hover:bg-[color:var(--accent-strong)]"
          >
            应用筛选
          </button>
        </form>
      </section>

      {cards.length > 0 ? (
        <section className="grid gap-4">
          {cards.map((card) => (
            <article key={card.id} className="paper-card rounded-[28px] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
                    <span className="rounded-full bg-[rgba(166,75,42,0.1)] px-3 py-1 font-semibold tracking-[0.22em] text-[color:var(--accent-strong)]">
                      {SECTION_LABELS[card.section]}
                    </span>
                    <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                      {card.reasoningType || "未分类"}
                    </span>
                    <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                      {getReviewCountLabel(card.reviewCount)}
                    </span>
                    <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                      {card.assetCount ?? card.assets.length} 个附件
                    </span>
                  </div>
                  <h2 className="section-title mt-4 text-3xl leading-tight">{card.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-[color:var(--muted)]">
                    {card.personalSummaryText || card.logicChainText || card.promptText || "这张卡片主要依靠附件承载内容。"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-[color:var(--muted)]">
                    <span>来源：{card.sourceKind}</span>
                    <span>更新时间：{formatTimestamp(card.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/cards/${card.id}`}
                    className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
                  >
                    完整编辑
                  </Link>
                  {hasBrowsePageForSection(card.section) ? (
                    <Link
                      href={getCardDetailPath(card)}
                      className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
                    >
                      打开详情页
                    </Link>
                  ) : (
                    <span className="rounded-full border border-dashed border-[color:var(--line)] px-5 py-3 text-sm text-[color:var(--muted)]">
                      仅后台管理
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="paper-card rounded-[30px] p-8 text-sm leading-7 text-[color:var(--muted)]">
          当前筛选条件下没有匹配的卡片。
        </section>
      )}
    </div>
  );
}
