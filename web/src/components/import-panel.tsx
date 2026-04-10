"use client";

import { useRef, useState } from "react";

type BrowserFile = File & { webkitRelativePath?: string };

interface ImportResult {
  importedCount: number;
  skippedCount: number;
  duplicate?: boolean;
}

async function parseResponse(response: Response) {
  const payload = (await response.json()) as { error?: string } & Partial<ImportResult>;
  if (!response.ok) {
    throw new Error(payload.error || "导入失败。");
  }

  return payload as ImportResult;
}

export function ImportPanel() {
  const workbookInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("支持上传表格版 `.xlsx` 或带 `manifest.json` 的题目文件夹，系统会自动识别逻辑、阅读、数学和数据洞察数据。");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function uploadFormData(formData: FormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const payload = await parseResponse(response);
      const duplicateText = payload.duplicate ? "（检测到重复批次）" : "";
      setMessage(`导入完成：新增 ${payload.importedCount} 条，跳过 ${payload.skippedCount} 条 ${duplicateText}`.trim());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWorkbookChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("mode", "xlsx");
    formData.append("files", file, file.name);
    await uploadFormData(formData);
    event.target.value = "";
  }

  async function handleFolderChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []) as BrowserFile[];
    if (files.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.append("mode", "folder");
    files.forEach((file) => {
      formData.append("files", file, file.webkitRelativePath || file.name);
    });
    await uploadFormData(formData);
    event.target.value = "";
  }

  return (
    <div className="paper-card rounded-[32px] p-6 sm:p-8">
      <div className="mb-6 space-y-3">
        <h2 className="section-title text-3xl">导入中心</h2>
        <p className="text-sm leading-7 text-[color:var(--muted)]">
          Excel 导入会自动识别逻辑、阅读、数学和数据洞察内容，解析工作表文本与嵌入图片；文件夹导入会读取
          `manifest.json` 及其引用的图片文件。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => workbookInputRef.current?.click()}
          disabled={isSubmitting}
          className="rounded-[24px] border border-[color:var(--line)] bg-white/70 px-5 py-5 text-left transition hover:border-[color:var(--accent)] disabled:opacity-60"
        >
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
            XLSX
          </div>
          <div className="mt-2 text-lg font-medium">上传错题表格</div>
          <div className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
            适用于当前的逻辑表、阅读表、数学表，也适合插件后续导出的 Excel。
          </div>
        </button>
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          disabled={isSubmitting}
          className="rounded-[24px] border border-[color:var(--line)] bg-white/70 px-5 py-5 text-left transition hover:border-[color:var(--accent)] disabled:opacity-60"
        >
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
            Folder
          </div>
          <div className="mt-2 text-lg font-medium">上传题目文件夹</div>
          <div className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
            文件夹内需包含 `manifest.json`，并由清单显式声明题目和图片路径。
          </div>
        </button>
      </div>
      <input
        ref={workbookInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleWorkbookChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />
      <p className="mt-5 rounded-2xl bg-[rgba(166,75,42,0.08)] px-4 py-3 text-sm leading-7 text-[color:var(--accent-strong)]">
        {message}
      </p>
    </div>
  );
}
