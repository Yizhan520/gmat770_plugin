import crypto from "node:crypto";
import path from "node:path";

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function sha256Buffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function sha256Text(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function normalizeFileName(fileName: string) {
  return fileName
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\.\.(\/|\\)/g, "");
}

export function sanitizeFileName(fileName: string) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const safeBase = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeBase || "asset"}${ext.toLowerCase()}`;
}

export function dataUrlToBuffer(dataUrl?: string | null) {
  if (!dataUrl) {
    return null;
  }

  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return Buffer.from(match[2], "base64");
}

export function createRelativeStoragePath(parts: string[]) {
  return parts
    .map((part) => sanitizeFileName(part))
    .filter(Boolean)
    .join("/");
}
