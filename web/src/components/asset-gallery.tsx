"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ASSET_KIND_LABELS } from "@/lib/sections";
import type { MistakeAsset } from "@/lib/types";

interface AssetGalleryProps {
  assets: MistakeAsset[];
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));
}

export function AssetGallery({ assets }: AssetGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const activeAsset = activeIndex === null ? null : assets[activeIndex];
  const canNavigate = assets.length > 1;
  const isViewerOpen = activeIndex !== null;
  const activePosition = activeIndex ?? 0;

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    dragStateRef.current = null;
  }

  function openViewer(index: number) {
    setActiveIndex(index);
    resetView();
  }

  function closeViewer() {
    setActiveIndex(null);
    resetView();
  }

  function showPrev() {
    if (!canNavigate) {
      return;
    }

    setActiveIndex((current) => {
      if (current === null) {
        return 0;
      }

      return (current - 1 + assets.length) % assets.length;
    });
    resetView();
  }

  function showNext() {
    if (!canNavigate) {
      return;
    }

    setActiveIndex((current) => {
      if (current === null) {
        return 0;
      }

      return (current + 1) % assets.length;
    });
    resetView();
  }

  function setZoomLevel(nextZoom: number) {
    const clamped = clampZoom(nextZoom);
    setZoom(clamped);
    if (clamped === 1) {
      setOffset({ x: 0, y: 0 });
    }
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isViewerOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeViewer();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrev();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoomLevel(zoom + ZOOM_STEP);
      return;
    }

    if (event.key === "-") {
      event.preventDefault();
      setZoomLevel(zoom - ZOOM_STEP);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      resetView();
    }
  });

  useEffect(() => {
    if (!isViewerOpen) {
      document.body.classList.remove("viewer-open");
      return;
    }

    document.body.classList.add("viewer-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("viewer-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isViewerOpen]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || zoom <= 1) {
      return;
    }

    setOffset({
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY,
    });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (assets.length === 0) {
    return (
      <div className="paper-card rounded-[30px] p-8 text-sm leading-7 text-[color:var(--muted)]">
        这张卡片没有附件。
      </div>
    );
  }

  return (
    <>
      <section className="paper-card rounded-[34px] p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title text-3xl sm:text-4xl">附件</h2>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
              已切换为大图阅读模式。点击任意图片可进入全屏查看器，支持放大、缩小、重置与左右切换。
            </p>
          </div>
          <div className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--muted)]">
            共 {assets.length} 个附件
          </div>
        </div>

        <div className="mt-6 grid gap-6">
          {assets.map((asset, index) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => openViewer(index)}
              aria-haspopup="dialog"
              className="group block w-full text-left"
            >
              <figure className="overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.82)] transition duration-300 group-hover:border-[color:var(--accent)] group-hover:shadow-[0_20px_60px_rgba(127,45,24,0.1)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3 text-xs text-[color:var(--muted)] sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[rgba(166,75,42,0.08)] px-3 py-1 font-semibold uppercase tracking-[0.2em] text-[color:var(--accent-strong)]">
                      {ASSET_KIND_LABELS[asset.assetKind]}
                    </span>
                    <span>附件 {index + 1}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      {asset.width && asset.height ? `${asset.width} × ${asset.height}` : "尺寸未知"}
                    </span>
                    <span className="font-medium text-[color:var(--accent-strong)]">点击放大</span>
                  </div>
                </div>
                <div className="bg-[#f8f3ea] p-3 sm:p-5">
                  <div className="overflow-hidden rounded-[22px] border border-[rgba(69,45,23,0.08)] bg-white p-2 sm:p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.publicUrl}
                      alt={ASSET_KIND_LABELS[asset.assetKind]}
                      loading="lazy"
                      decoding="async"
                      className="asset-inline-preview"
                    />
                  </div>
                </div>
              </figure>
            </button>
          ))}
        </div>
      </section>

      {activeAsset ? (
        <div
          className="asset-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="附件查看器"
        >
          <button
            type="button"
            aria-label="关闭查看器"
            className="asset-viewer-backdrop"
            onClick={() => closeViewer()}
          />

          <div className="asset-viewer-shell">
            <div className="asset-viewer-toolbar">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold uppercase tracking-[0.24em] text-[rgba(255,255,255,0.74)]">
                  {ASSET_KIND_LABELS[activeAsset.assetKind]}
                </div>
                <div className="mt-1 text-sm text-white/85">
                  第 {activePosition + 1} / {assets.length} 张
                  {activeAsset.width && activeAsset.height
                    ? ` · ${activeAsset.width} × ${activeAsset.height}`
                    : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel(zoom - ZOOM_STEP)}
                  className="asset-viewer-button"
                >
                  缩小
                </button>
                <button
                  type="button"
                  onClick={() => resetView()}
                  className="asset-viewer-button"
                >
                  重置
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(zoom + ZOOM_STEP)}
                  className="asset-viewer-button"
                >
                  放大
                </button>
                <button
                  type="button"
                  onClick={() => closeViewer()}
                  className="asset-viewer-button asset-viewer-button-strong"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="asset-viewer-stage-wrap">
              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => showPrev()}
                  className="asset-viewer-nav asset-viewer-nav-left"
                  aria-label="查看上一张"
                >
                  ←
                </button>
              ) : null}

              <div
                className={`asset-viewer-stage ${zoom > 1 ? "asset-viewer-stage-zoomed" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
              >
                <div
                  className="asset-viewer-image-wrap"
                  style={{
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeAsset.publicUrl}
                    alt={ASSET_KIND_LABELS[activeAsset.assetKind]}
                    decoding="async"
                    className="asset-viewer-image"
                    draggable={false}
                  />
                </div>
              </div>

              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => showNext()}
                  className="asset-viewer-nav asset-viewer-nav-right"
                  aria-label="查看下一张"
                >
                  →
                </button>
              ) : null}
            </div>

            <div className="asset-viewer-footer">
              <span>缩放 {Math.round(zoom * 100)}%</span>
              <span>键盘支持：Esc 关闭，←/→ 切换，+/- 缩放，0 重置</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
