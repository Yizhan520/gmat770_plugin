"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: adminKey }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Admin Key 校验失败。");
      }

      setMessage("验证成功，正在进入后台…");
      router.refresh();
      router.push("/admin/import");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin Key 校验失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="paper-card rounded-[32px] p-6 sm:p-8">
      <div className="mb-6 space-y-2">
        <h2 className="section-title text-3xl">输入 Admin Key</h2>
        <p className="text-sm leading-7 text-[color:var(--muted)]">
          一期不做登录，后台能力统一通过管理员密钥开启。验证成功后，浏览器会收到一个短期
          `HttpOnly` cookie。
        </p>
      </div>
      <label className="mb-4 block text-sm font-medium text-[color:var(--foreground)]">
        Admin Key
        <input
          type="password"
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          placeholder="请输入部署时配置的 ADMIN_KEY"
          required
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-[color:var(--accent)] px-5 py-3 font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "验证中…" : "进入管理后台"}
      </button>
      {message ? (
        <p className="mt-4 rounded-2xl bg-[rgba(166,75,42,0.08)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {message}
        </p>
      ) : null}
    </form>
  );
}
