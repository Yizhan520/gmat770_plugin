"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";
import { ASSET_KIND_LABELS, SECTION_LABELS, getCardDetailPath, hasBrowsePageForSection } from "@/lib/sections";
import type { AdminCardInput, AssetKind, MistakeAsset, MistakeCard, Section } from "@/lib/types";

interface AdminCardEditorProps {
  card: MistakeCard | null;
  usingSupabase: boolean;
}

type CardFormState = AdminCardInput;

const SECTION_OPTIONS = Object.entries(SECTION_LABELS) as Array<[Section, string]>;
const ASSET_KIND_OPTIONS: AssetKind[] = ["attachment", "question_screenshot", "analysis_screenshot"];

const EMPTY_FORM: CardFormState = {
  section: "logic",
  reasoningType: "",
  title: "",
  promptText: "",
  optionsText: "",
  myAnswer: "",
  correctAnswer: "",
  timeSpent: "",
  analysisText: "",
  logicChainText: "",
  personalSummaryText: "",
  extraNotesText: "",
};

async function parseResponse<T>(response: Response) {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "请求失败。");
  }

  return payload;
}

function createInitialForm(card: MistakeCard | null): CardFormState {
  if (!card) {
    return EMPTY_FORM;
  }

  return {
    section: card.section,
    reasoningType: card.reasoningType,
    title: card.title,
    promptText: card.promptText,
    optionsText: card.optionsText,
    myAnswer: card.myAnswer,
    correctAnswer: card.correctAnswer,
    timeSpent: card.timeSpent,
    analysisText: card.analysisText,
    logicChainText: card.logicChainText,
    personalSummaryText: card.personalSummaryText,
    extraNotesText: card.extraNotesText,
  };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}

function reorderAssets(assets: MistakeAsset[], assetId: string, direction: -1 | 1) {
  const currentIndex = assets.findIndex((asset) => asset.id === assetId);
  const targetIndex = currentIndex + direction;
  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= assets.length) {
    return assets;
  }

  const nextAssets = [...assets];
  const [targetAsset] = nextAssets.splice(currentIndex, 1);
  nextAssets.splice(targetIndex, 0, targetAsset);
  return nextAssets;
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[color:var(--line)] bg-white/70 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{label}</div>
      <div className="mt-3 break-all text-sm leading-7 text-[color:var(--foreground)]">{value || "暂无"}</div>
    </div>
  );
}

export function AdminCardEditor({ card, usingSupabase }: AdminCardEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<CardFormState>(() => createInitialForm(card));
  const [assets, setAssets] = useState<MistakeAsset[]>(card?.assets ?? []);
  const [message, setMessage] = useState("");
  const [assetMessage, setAssetMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAssetBusy, setIsAssetBusy] = useState(false);
  const [uploadKind, setUploadKind] = useState<AssetKind>("attachment");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIdRef = useRef<string | null>(null);

  const canMutate = usingSupabase;
  const isNewCard = !card;

  function updateField<K extends keyof CardFormState>(field: K, value: CardFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMutate) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(isNewCard ? "/api/admin/cards" : `/api/admin/cards/${card.id}`, {
        method: isNewCard ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await parseResponse<{ card: MistakeCard }>(response);
      setMessage(isNewCard ? "已创建新卡片，正在进入编辑页。" : "卡片内容已保存。");

      if (isNewCard) {
        startTransition(() => {
          router.push(`/admin/cards/${payload.card.id}`);
        });
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCard() {
    if (!card || !canMutate || !window.confirm("确认删除这张卡片吗？此操作不可撤销。")) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/cards/${card.id}`, {
        method: "DELETE",
      });

      await parseResponse(response);
      startTransition(() => {
        router.push("/admin/cards");
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败。");
      setIsSaving(false);
    }
  }

  async function handleUploadImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!card || files.length === 0 || !canMutate) {
      return;
    }

    setIsAssetBusy(true);
    setAssetMessage("");

    try {
      const formData = new FormData();
      formData.append("assetKind", uploadKind);
      files.forEach((file) => {
        formData.append("files", file, file.name);
      });

      const response = await fetch(`/api/admin/cards/${card.id}/assets`, {
        method: "POST",
        body: formData,
      });

      const payload = await parseResponse<{ assets: MistakeAsset[] }>(response);
      setAssets(payload.assets);
      setAssetMessage(`已上传 ${files.length} 张图片。`);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "上传附件失败。");
    } finally {
      setIsAssetBusy(false);
    }
  }

  async function handleChangeAssetKind(assetId: string, assetKind: AssetKind) {
    setIsAssetBusy(true);
    setAssetMessage("");

    try {
      const response = await fetch(`/api/admin/assets/${assetId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assetKind }),
      });

      const payload = await parseResponse<{ asset: MistakeAsset }>(response);
      setAssets((current) =>
        current.map((asset) => (asset.id === assetId ? payload.asset : asset)),
      );
      setAssetMessage("附件分类已更新。");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "更新附件失败。");
    } finally {
      setIsAssetBusy(false);
    }
  }

  async function handleDeleteAsset(assetId: string) {
    if (!window.confirm("确认删除这张图片吗？")) {
      return;
    }

    setIsAssetBusy(true);
    setAssetMessage("");

    try {
      const response = await fetch(`/api/admin/assets/${assetId}`, {
        method: "DELETE",
      });

      const payload = await parseResponse<{ assets: MistakeAsset[] }>(response);
      setAssets(payload.assets);
      setAssetMessage("附件已删除。");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "删除附件失败。");
    } finally {
      setIsAssetBusy(false);
    }
  }

  async function handleReorderAsset(assetId: string, direction: -1 | 1) {
    if (!card) {
      return;
    }

    const nextAssets = reorderAssets(assets, assetId, direction);
    if (nextAssets === assets) {
      return;
    }

    setIsAssetBusy(true);
    setAssetMessage("");

    try {
      const response = await fetch(`/api/admin/cards/${card.id}/assets`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderedAssetIds: nextAssets.map((asset) => asset.id),
        }),
      });

      const payload = await parseResponse<{ assets: MistakeAsset[] }>(response);
      setAssets(payload.assets);
      setAssetMessage("附件顺序已保存。");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "保存附件顺序失败。");
    } finally {
      setIsAssetBusy(false);
    }
  }

  async function handleReplaceAsset(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const assetId = replaceTargetIdRef.current;
    replaceTargetIdRef.current = null;

    if (!file || !assetId || !canMutate) {
      return;
    }

    setIsAssetBusy(true);
    setAssetMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await fetch(`/api/admin/assets/${assetId}/replace`, {
        method: "POST",
        body: formData,
      });

      const payload = await parseResponse<{ asset: MistakeAsset }>(response);
      setAssets((current) =>
        current.map((asset) => (asset.id === assetId ? payload.asset : asset)),
      );
      setAssetMessage("附件已替换。");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "替换附件失败。");
    } finally {
      setIsAssetBusy(false);
    }
  }

  function triggerReplace(assetId: string) {
    replaceTargetIdRef.current = assetId;
    replaceInputRef.current?.click();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="paper-card rounded-[38px] p-7 sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Cards Center</p>
            <h1 className="section-title mt-2 text-4xl sm:text-5xl">
              {isNewCard ? "手动新增错题" : "卡片完整编辑器"}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-[color:var(--muted)]">
              这里可以维护题目正文、答案、解析、总结和图片附件。公开详情页只保留轻量管理员区，完整内容统一在这里处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/cards"
              className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)]"
            >
              返回卡片中心
            </Link>
            {card && hasBrowsePageForSection(card.section) ? (
              <Link
                href={getCardDetailPath(card)}
                className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
              >
                打开详情页
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {!usingSupabase ? (
        <section className="paper-card rounded-[28px] p-6 text-sm leading-7 text-[color:var(--accent-strong)]">
          Supabase 尚未配置，当前页面为只读模式。你可以查看现有内容，但新增、保存、删除和附件操作都会被禁用。
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <form onSubmit={handleSubmit} className="paper-card rounded-[32px] p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="section-title text-3xl">题目内容</h2>
            <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              {isNewCard ? "Create" : "Edit"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              分区
              <select
                value={form.section}
                onChange={(event) => updateField("section", event.target.value as Section)}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              >
                {SECTION_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              题型
              <input
                value={form.reasoningType}
                onChange={(event) => updateField("reasoningType", event.target.value)}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
                placeholder="例如 CR / RC / PS / TPA"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium">
            标题
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              disabled={!canMutate || isSaving}
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              placeholder="标题必填"
              required
            />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              我的答案
              <input
                value={form.myAnswer}
                onChange={(event) => updateField("myAnswer", event.target.value)}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-medium">
              正确答案
              <input
                value={form.correctAnswer}
                onChange={(event) => updateField("correctAnswer", event.target.value)}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-medium">
              用时
              <input
                value={form.timeSpent}
                onChange={(event) => updateField("timeSpent", event.target.value)}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
                placeholder="例如 2m 35s"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium">
            题目正文
            <textarea
              value={form.promptText}
              onChange={(event) => updateField("promptText", event.target.value)}
              rows={8}
              disabled={!canMutate || isSaving}
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
            />
          </label>

          <label className="mt-4 block text-sm font-medium">
            选项
            <textarea
              value={form.optionsText}
              onChange={(event) => updateField("optionsText", event.target.value)}
              rows={5}
              disabled={!canMutate || isSaving}
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
            />
          </label>

          <div className="mt-4 grid gap-4">
            <label className="block text-sm font-medium">
              解析
              <textarea
                value={form.analysisText}
                onChange={(event) => updateField("analysisText", event.target.value)}
                rows={7}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-medium">
              逻辑链
              <textarea
                value={form.logicChainText}
                onChange={(event) => updateField("logicChainText", event.target.value)}
                rows={6}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-medium">
              个人总结
              <textarea
                value={form.personalSummaryText}
                onChange={(event) => updateField("personalSummaryText", event.target.value)}
                rows={6}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-medium">
              补充备注
              <textarea
                value={form.extraNotesText}
                onChange={(event) => updateField("extraNotesText", event.target.value)}
                rows={5}
                disabled={!canMutate || isSaving}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!canMutate || isSaving}
              className="rounded-full bg-[color:var(--accent)] px-5 py-3 font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:opacity-60"
            >
              {isSaving ? "保存中…" : isNewCard ? "创建卡片" : "保存修改"}
            </button>
            {!isNewCard ? (
              <button
                type="button"
                onClick={handleDeleteCard}
                disabled={!canMutate || isSaving}
                className="rounded-full border border-[color:var(--line)] px-5 py-3 font-medium text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)] disabled:opacity-60"
              >
                删除卡片
              </button>
            ) : null}
          </div>

          {message ? (
            <p className="mt-4 rounded-2xl bg-[rgba(166,75,42,0.08)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
              {message}
            </p>
          ) : null}
        </form>

        <div className="space-y-6">
          <section className="paper-card rounded-[32px] p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="section-title text-3xl">内部信息</h2>
              <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Read Only</span>
            </div>
            <div className="grid gap-4">
              <ReadonlyField label="创建时间" value={card ? formatTimestamp(card.createdAt) : "保存后自动生成"} />
              <ReadonlyField label="更新时间" value={card ? formatTimestamp(card.updatedAt) : "保存后自动生成"} />
            </div>
          </section>

          <section className="paper-card rounded-[32px] p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="section-title text-3xl">图片附件</h2>
              <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                {assets.length} 张
              </span>
            </div>

            {card ? (
              <>
                <div className="rounded-[24px] border border-[color:var(--line)] bg-white/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      value={uploadKind}
                      onChange={(event) => setUploadKind(event.target.value as AssetKind)}
                      disabled={!canMutate || isAssetBusy}
                      className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
                    >
                      {ASSET_KIND_OPTIONS.map((kind) => (
                        <option key={kind} value={kind}>
                          {ASSET_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={!canMutate || isAssetBusy}
                      className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:opacity-60"
                    >
                      {isAssetBusy ? "处理中…" : "上传图片"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                    仅支持 PNG、JPEG、WebP。新图片会追加到当前附件列表末尾，可随后修改分类和顺序。
                  </p>
                </div>

                {assets.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {assets.map((asset, index) => (
                      <div
                        key={asset.id}
                        className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="overflow-hidden rounded-[20px] border border-[color:var(--line)] bg-[#f8f3ea] p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={asset.publicUrl}
                              alt={ASSET_KIND_LABELS[asset.assetKind]}
                              className="block max-h-64 w-full object-contain"
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
                            <select
                              value={asset.assetKind}
                              onChange={(event) => handleChangeAssetKind(asset.id, event.target.value as AssetKind)}
                              disabled={!canMutate || isAssetBusy}
                              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[color:var(--accent)] disabled:opacity-60"
                            >
                              {ASSET_KIND_OPTIONS.map((kind) => (
                                <option key={kind} value={kind}>
                                  {ASSET_KIND_LABELS[kind]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleReorderAsset(asset.id, -1)}
                              disabled={!canMutate || isAssetBusy || index === 0}
                              className="rounded-full border border-[color:var(--line)] px-4 py-3 text-sm font-medium transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)] disabled:opacity-60"
                            >
                              上移
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderAsset(asset.id, 1)}
                              disabled={!canMutate || isAssetBusy || index === assets.length - 1}
                              className="rounded-full border border-[color:var(--line)] px-4 py-3 text-sm font-medium transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)] disabled:opacity-60"
                            >
                              下移
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerReplace(asset.id)}
                              disabled={!canMutate || isAssetBusy}
                              className="rounded-full border border-[color:var(--line)] px-4 py-3 text-sm font-medium transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)] disabled:opacity-60"
                            >
                              替换
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(asset.id)}
                              disabled={!canMutate || isAssetBusy}
                              className="rounded-full border border-[color:var(--line)] px-4 py-3 text-sm font-medium text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent)] hover:bg-[rgba(166,75,42,0.06)] disabled:opacity-60"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-[color:var(--line)] px-4 py-6 text-sm leading-7 text-[color:var(--muted)]">
                    这张卡片还没有图片附件。
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[color:var(--line)] px-4 py-6 text-sm leading-7 text-[color:var(--muted)]">
                先保存卡片，系统生成卡片 ID 后再上传和管理附件。
              </div>
            )}

            {assetMessage ? (
              <p className="mt-4 rounded-2xl bg-[rgba(166,75,42,0.08)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
                {assetMessage}
              </p>
            ) : null}
          </section>
        </div>
      </section>

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleUploadImages}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleReplaceAsset}
      />
    </div>
  );
}
