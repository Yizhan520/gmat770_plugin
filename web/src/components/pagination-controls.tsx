import Link from "next/link";

interface PaginationControlsProps {
  pathname: string;
  currentPage: number;
  totalPages: number;
  searchParams?: Record<string, string | undefined>;
}

function buildPageHref(
  pathname: string,
  currentPage: number,
  searchParams: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (!value) {
      continue;
    }

    params.set(key, value);
  }

  if (currentPage > 1) {
    params.set("page", String(currentPage));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function PaginationControls({
  pathname,
  currentPage,
  totalPages,
  searchParams = {},
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="paper-card flex flex-col gap-4 rounded-[28px] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-[color:var(--muted)]">
        第 {currentPage} / {totalPages} 页
      </div>
      <div className="flex flex-wrap gap-3">
        {currentPage > 1 ? (
          <Link
            href={buildPageHref(pathname, currentPage - 1, searchParams)}
            className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
          >
            上一页
          </Link>
        ) : (
          <span className="rounded-full border border-dashed border-[color:var(--line)] px-5 py-3 text-sm text-[color:var(--muted)]">
            已经是第一页
          </span>
        )}
        {currentPage < totalPages ? (
          <Link
            href={buildPageHref(pathname, currentPage + 1, searchParams)}
            className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
          >
            下一页
          </Link>
        ) : (
          <span className="rounded-full border border-dashed border-[color:var(--line)] px-5 py-3 text-sm text-[color:var(--muted)]">
            已经是最后一页
          </span>
        )}
      </div>
    </nav>
  );
}
