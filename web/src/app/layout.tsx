import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const bodyFont = Noto_Sans_SC({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const displayFont = Noto_Serif_SC({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "GMAT 错题库",
  description: "在线管理 GMAT 逻辑、阅读、数学和数据洞察错题，支持 Excel 导入与插件直传。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="grain-overlay" />
        <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[rgba(247,240,228,0.82)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="rounded-2xl border border-[color:var(--line)] bg-[rgba(166,75,42,0.08)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">
                GMAT
              </div>
              <div>
                <p className="section-title text-xl font-semibold">GMAT 错题档案馆</p>
                <p className="text-sm text-[color:var(--muted)]">公开浏览，按分区整理逻辑、阅读、数学与数据洞察复盘</p>
              </div>
            </Link>
            <nav className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted)]">
              <Link className="rounded-full px-4 py-2 transition hover:bg-[rgba(166,75,42,0.08)] hover:text-[color:var(--accent-strong)]" href="/">
                首页
              </Link>
              <Link className="rounded-full px-4 py-2 transition hover:bg-[rgba(166,75,42,0.08)] hover:text-[color:var(--accent-strong)]" href="/logic">
                逻辑题库
              </Link>
              <Link className="rounded-full px-4 py-2 transition hover:bg-[rgba(166,75,42,0.08)] hover:text-[color:var(--accent-strong)]" href="/reading">
                阅读题库
              </Link>
              <Link className="rounded-full px-4 py-2 transition hover:bg-[rgba(166,75,42,0.08)] hover:text-[color:var(--accent-strong)]" href="/math">
                数学题库
              </Link>
              <Link className="rounded-full px-4 py-2 transition hover:bg-[rgba(166,75,42,0.08)] hover:text-[color:var(--accent-strong)]" href="/data-insights">
                数据洞察
              </Link>
              <Link className="rounded-full px-4 py-2 transition hover:bg-[rgba(166,75,42,0.08)] hover:text-[color:var(--accent-strong)]" href="/admin">
                管理入口
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
