import { CardPreview } from "@/components/card-preview";
import { MATH_KIND_OPTIONS } from "@/lib/math";
import { REVIEW_STATUS_OPTIONS } from "@/lib/sections";
import { listMathCards } from "@/lib/cards";

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface MathPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MathPage({ searchParams }: MathPageProps) {
  const params = await searchParams;
  const filters = {
    q: takeFirst(params.q) ?? "",
    kind: (takeFirst(params.kind) as "all" | "PS" | "DS" | "粗心" | undefined) ?? "all",
    module: takeFirst(params.module) ?? "all",
    status: (takeFirst(params.status) as "all" | "pending" | "reviewed" | undefined) ?? "all",
  };

  const { cards, kinds, modules, total, totalAll } = await listMathCards(filters);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="paper-card rounded-[36px] p-7 sm:p-9">
        <div className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">公开题库</p>
            <h1 className="section-title text-4xl sm:text-5xl">数学错题整体库</h1>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-[color:var(--muted)]">
              一级按 PS、DS、粗心分类，二级按模块和复习状态筛选。当前共收录 {totalAll} 张数学卡片，本次筛选命中 {total} 张。
            </p>
          </div>
          <form className="grid max-w-6xl gap-3 rounded-[28px] border border-[color:var(--line)] bg-white/70 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_auto]">
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="搜索模块、考点、心得、关键词"
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
            />
            <select
              name="kind"
              defaultValue={filters.kind}
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
            >
              <option value="all">全部题型</option>
              {MATH_KIND_OPTIONS.filter((option) => kinds.includes(option.value)).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              name="module"
              defaultValue={filters.module}
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
            >
              <option value="all">全部模块</option>
              {modules.map((mathModule) => (
                <option key={mathModule} value={mathModule}>
                  {mathModule}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={filters.status}
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
            >
              <option value="all">全部状态</option>
              {REVIEW_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium whitespace-nowrap text-white transition hover:bg-[color:var(--accent-strong)] sm:col-span-2 xl:col-span-1"
            >
              应用筛选
            </button>
          </form>
        </div>
      </section>

      {cards.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <CardPreview key={card.id} card={card} />
          ))}
        </section>
      ) : (
        <section className="paper-card rounded-[30px] p-8 text-sm leading-7 text-[color:var(--muted)]">
          没有匹配的卡片。你可以换一个关键词，或者取消题型、模块、复习状态筛选。
        </section>
      )}
    </div>
  );
}
