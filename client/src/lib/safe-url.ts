/**
 * Image-source guards. We only render `<img src={...}>` for values that come
 * from a safe scheme (`http(s):` or `data:image/...`). Anything else (e.g.
 * `javascript:`, `vbscript:`, `file:`) is replaced with an empty src so a
 * malicious upload can't smuggle an active payload into the page.
 */

const SAFE_IMAGE_DATA_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;

export function isSafeImageUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 5_000_000) return false;
  if (trimmed.startsWith("/")) return true;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("https://") || lower.startsWith("http://")) return true;
  if (SAFE_IMAGE_DATA_RE.test(trimmed)) return true;
  return false;
}

export function safeImageSrc(value: unknown): string {
  return isSafeImageUrl(value) ? (value as string) : "";
}
