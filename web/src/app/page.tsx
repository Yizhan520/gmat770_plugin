import Link from "next/link";
import { CardPreview } from "@/components/card-preview";
import {
  listDataInsightsCards,
  listLogicCards,
  listMathCards,
  listReadingCards,
} from "@/lib/cards";

export default async function Home() {
  const [logicResult, readingResult, mathResult, dataInsightsResult] = await Promise.all([
    listLogicCards({}, { pageSize: 3, includeFilterOptions: false }),
    listReadingCards({}, { pageSize: 1, includeFilterOptions: false }),
    listMathCards({}, { pageSize: 3, includeFilterOptions: false }),
    listDataInsightsCards({}, { pageSize: 3, includeFilterOptions: false }),
  ]);

  const featuredLogicCards = logicResult.cards;
  const featuredMathCards = mathResult.cards;
  const featuredDataInsightsCards = dataInsightsResult.cards;
  const totalCards =
    logicResult.totalAll +
    readingResult.totalAll +
    mathResult.totalAll +
    dataInsightsResult.totalAll;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 sm:py-10">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-stretch">
        <div className="paper-card flex h-full flex-col rounded-[38px] p-7 sm:p-10">
          <div>
            <div className="mb-6 inline-flex rounded-full bg-[rgba(166,75,42,0.1)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">
              GMAT Archive
            </div>
            <h1 className="section-title max-w-4xl text-4xl leading-tight sm:text-6xl">
              Yizhan 的 Gmat 错题本
            </h1>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 lg:mt-auto">
            <Link
              href="/logic"
              className="rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              浏览逻辑题库
            </Link>
            <Link
              href="/math"
              className="rounded-full border border-[color:var(--line)] px-6 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
            >
              浏览数学题库
            </Link>
            <Link
              href="/data-insights"
              className="rounded-full border border-[color:var(--line)] px-6 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
            >
              浏览数据洞察
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-[color:var(--line)] px-6 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
            >
              打开管理入口
            </Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="paper-card rounded-[30px] p-6">
            <div className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">当前卡片数</div>
            <div className="section-title mt-3 text-5xl">{totalCards}</div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">逻辑与数学公开卡片总数。</p>
          </div>
          <div className="paper-card rounded-[30px] p-6">
            <div className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">模块分布</div>
            <div className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
              逻辑 {logicResult.totalAll} · 阅读 {readingResult.totalAll} · 数学 {mathResult.totalAll} · DI {dataInsightsResult.totalAll}
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              子模块支持细分筛选。
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Featured</p>
            <h2 className="section-title text-3xl">最新逻辑错题</h2>
          </div>
          <Link href="/logic" className="text-sm font-medium text-[color:var(--accent-strong)]">
            查看全部
          </Link>
        </div>
        {featuredLogicCards.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredLogicCards.map((card) => (
              <CardPreview key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="paper-card rounded-[28px] p-8 text-sm leading-7 text-[color:var(--muted)]">
            还没有可展示的错题卡。先配置 Supabase 并执行导入，或者运行 `npm run seed:bundle`
            生成站点内置种子数据。
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Quant</p>
            <h2 className="section-title text-3xl">最新数学错题</h2>
          </div>
          <Link href="/math" className="text-sm font-medium text-[color:var(--accent-strong)]">
            查看全部
          </Link>
        </div>
        {featuredMathCards.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredMathCards.map((card) => (
              <CardPreview key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="paper-card rounded-[28px] p-8 text-sm leading-7 text-[color:var(--muted)]">
            还没有可展示的数学卡。导入数学 Excel 后，这里会自动展示最新的 PS、DS 和粗心卡片。
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Data Insights</p>
            <h2 className="section-title text-3xl">最新数据洞察错题</h2>
          </div>
          <Link href="/data-insights" className="text-sm font-medium text-[color:var(--accent-strong)]">
            查看全部
          </Link>
        </div>
        {featuredDataInsightsCards.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredDataInsightsCards.map((card) => (
              <CardPreview key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="paper-card rounded-[28px] p-8 text-sm leading-7 text-[color:var(--muted)]">
            还没有可展示的数据洞察卡。导入模考报告中的 DI 错题后，这里会自动展示最新卡片。
          </div>
        )}
      </section>
    </div>
  );
}
