/**
 * Imperative DOM helpers for the QR tab. Kept outside the React tree because
 * they manipulate window.open() / canvas / dynamic blobs — they don't need
 * (and can't easily participate in) component re-render cycles.
 */

import { escapeHtml } from "@/lib/escape-html";

/**
 * Rasterize the QR <svg> sitting inside `qrEl` to a 300x300 PNG and trigger
 * a browser download named `qr-{userId}.png`.
 */
export function downloadQR(qrEl: HTMLElement | null, userId: string): void {
  const svgEl = qrEl?.querySelector("svg");
  if (!svgEl) return;

  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 300, 300);

  const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 300, 300);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${userId}.png`;
    a.click();
  };
  img.src = URL.createObjectURL(blob);
}

/**
 * Open the QR in a printable popup. memberName/userId are HTML-escaped to
 * defang admin-supplied XSS. The QR <svg> itself is app-generated and
 * trusted as-is. The popup uses noopener,noreferrer so it can't reach
 * back into the admin app via window.opener.
 */
export function printQR(qrEl: HTMLElement | null, memberName: string, userId: string): void {
  const svgEl = qrEl?.querySelector("svg");
  if (!svgEl) return;

  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;

  const safeName = escapeHtml(memberName);
  const safeId = escapeHtml(userId);
  win.document.write(
    `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>QR - ${safeName}</title>
    <style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;direction:rtl;}h2{color:#C9A84C;}p{color:#666;font-size:13px;}@media print{button{display:none}}</style></head>
    <body><h2>🦅 Eagle Gym</h2><h3>${safeName}</h3><p>رقم العضوية: #${safeId}</p><div style="display:inline-block;padding:16px;background:#fff;border:2px solid #C9A84C;border-radius:12px;margin:16px 0">${svgEl.outerHTML}</div><p>امسح الكود لتسجيل الحضور</p><script>window.onload=()=>window.print()</script></body></html>`,
  );
  win.document.close();
}
