/**
 * Escape a string for safe interpolation into an HTML document. Use whenever
 * you concatenate user-controlled values into `document.write` / innerHTML.
 */
export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  return str.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}
