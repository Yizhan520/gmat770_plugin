import Link from "next/link";
import { AdminLoginForm } from "@/components/admin-login-form";
import { hasAdminSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { listImportJobs } from "@/lib/cards";

export default async function AdminPage() {
  const [isAdmin, jobs] = await Promise.all([hasAdminSession(), listImportJobs(6)]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="paper-card rounded-[38px] p-7 sm:p-10">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Admin Entry</p>
        <h1 className="section-title mt-2 text-4xl sm:text-5xl">网站管理入口</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-[color:var(--muted)]">
          当前采用无登录方案：公开页可直接浏览，后台操作统一依赖 Admin Key。服务端验证成功后，会签发短期管理 cookie。
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          {isAdmin ? (
            <div className="paper-card rounded-[32px] p-6 sm:p-8">
              <h2 className="section-title text-3xl">已验证管理员权限</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                现在可以进入导入中心、编辑卡片内容，或测试插件直传接口。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/admin/cards"
                  className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
                >
                  打开卡片中心
                </Link>
                <Link
                  href="/admin/import"
                  className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
                >
                  打开导入中心
                </Link>
                <form action="/api/admin/logout" method="post">
                  <button
                    type="submit"
                    className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
                  >
                    退出后台
                  </button>
                </form>
              </div>
              <div className="mt-6 rounded-[24px] bg-[rgba(166,75,42,0.08)] px-4 py-4 text-sm leading-7 text-[color:var(--accent-strong)]">
                {hasSupabaseConfig()
                  ? "Supabase 已配置，可以执行真实导入与编辑。"
                  : "Supabase 尚未配置，当前只能浏览内置种子数据，后台写操作会被拒绝。"}
              </div>
            </div>
          ) : (
            <AdminLoginForm />
          )}
        </div>
        <div className="paper-card rounded-[32px] p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="section-title text-3xl">最近导入记录</h2>
            {isAdmin ? (
              <Link href="/admin/import" className="text-sm font-medium text-[color:var(--accent-strong)]">
                去导入
              </Link>
            ) : null}
          </div>
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-[24px] border border-[color:var(--line)] bg-white/70 px-4 py-4 text-sm"
                >
                  <div className="font-medium text-[color:var(--foreground)]">{job.originalName}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[color:var(--muted)]">
                    <span>来源：{job.sourceKind}</span>
                    <span>新增：{job.importedCount}</span>
                    <span>跳过：{job.skippedCount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-[color:var(--muted)]">还没有新的导入记录。</p>
          )}
        </div>
      </section>
    </div>
  );
}
