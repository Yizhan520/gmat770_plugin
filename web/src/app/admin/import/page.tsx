import { redirect } from "next/navigation";
import { ImportPanel } from "@/components/import-panel";
import { hasAdminSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";

export default async function AdminImportPage() {
  const isAdmin = await hasAdminSession();
  if (!isAdmin) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="paper-card rounded-[38px] p-7 sm:p-10">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Import Center</p>
        <h1 className="section-title mt-2 text-4xl sm:text-5xl">错题导入与同步</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-[color:var(--muted)]">
          支持表格版 `.xlsx`、带 `manifest.json`
          的文件夹，以及 Chrome 插件的直传接口。Excel 会自动识别逻辑、阅读、数学和数据洞察内容，当前页面用于手动导入和联调。
        </p>
      </section>
      {!hasSupabaseConfig() ? (
        <section className="paper-card rounded-[28px] p-6 text-sm leading-7 text-[color:var(--accent-strong)]">
          Supabase 尚未配置，因此导入接口会返回错误。先在部署环境里配置
          `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_KEY`
          等变量，再执行真实导入。
        </section>
      ) : null}
      <ImportPanel />
    </div>
  );
}
