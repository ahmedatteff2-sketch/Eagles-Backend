import { Fragment, useEffect, useState, useCallback } from "react";
import { listAudit, type AuditLogRow, type AuditQueryParams } from "@/lib/auth-extras";

const GOLD = "hsl(40 65% 52%)";
const inp =
  "rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none transition-all";
const inpSt = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" };

const PAGE_SIZE = 50;

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return d;
  }
}

/** Map HTTP status -> badge color. 4xx is yellow (validation/forbidden), 5xx red, 2xx green. */
function statusColor(s: number | null): { bg: string; fg: string } {
  if (!s) return { bg: "hsl(0 0% 18%)", fg: "hsl(0 0% 60%)" };
  if (s >= 500) return { bg: "hsl(0 72% 50% / 0.15)", fg: "hsl(0 72% 65%)" };
  if (s >= 400) return { bg: "hsl(40 80% 50% / 0.15)", fg: "hsl(40 80% 65%)" };
  if (s >= 200 && s < 300) return { bg: "hsl(142 60% 50% / 0.12)", fg: "hsl(142 60% 60%)" };
  return { bg: "hsl(0 0% 18%)", fg: "hsl(0 0% 60%)" };
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Show/hide a row's payload (raw JSON) — payloads can be huge so they're collapsed by default.
  const [openPayload, setOpenPayload] = useState<Record<number, boolean>>({});

  const load = useCallback(
    async (currentOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const params: AuditQueryParams = {
          limit: PAGE_SIZE,
          offset: currentOffset,
        };
        if (action.trim()) params.action = action.trim();
        if (actorId.trim()) params.actorId = actorId.trim();
        if (targetType.trim()) params.targetType = targetType.trim();
        if (targetId.trim()) params.targetId = targetId.trim();
        if (from) params.from = new Date(from).toISOString();
        if (to) params.to = new Date(to).toISOString();
        const res = await listAudit(params);
        setRows(res.rows);
        setTotal(res.total);
        setOffset(res.offset);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذّر تحميل السجل");
      } finally {
        setLoading(false);
      }
    },
    [action, actorId, targetType, targetId, from, to],
  );

  useEffect(() => {
    void load(0);
    // Run only on mount; subsequent loads happen via the apply/page buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    void load(0);
  }

  function resetFilters() {
    setAction("");
    setActorId("");
    setTargetType("");
    setTargetId("");
    setFrom("");
    setTo("");
    setTimeout(() => void load(0), 0);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">📋 سجل العمليات (Audit Log)</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          سجل بكل العمليات اللي بتحصل في النظام — تسجيل دخول، إنشاء أعضاء، تعديل بيانات، إلخ.
        </p>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">الإجراء (action)</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="مثال: POST /auth/login"
              className={inp + " w-full"}
              style={inpSt}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">المنفّذ (actorId)</label>
            <input
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="UUID"
              className={inp + " w-full"}
              style={inpSt}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">نوع الهدف (targetType)</label>
            <input
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              placeholder="user/payment/..."
              className={inp + " w-full"}
              style={inpSt}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">معرف الهدف (targetId)</label>
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder=""
              className={inp + " w-full"}
              style={inpSt}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">من تاريخ</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inp + " w-full"}
              style={inpSt}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">إلى تاريخ</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inp + " w-full"}
              style={inpSt}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
              color: "hsl(0 0% 5%)",
            }}
          >
            {loading ? "..." : "تطبيق"}
          </button>
          <button
            onClick={resetFilters}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)", border: "1px solid hsl(0 0% 22%)" }}
          >
            إعادة تعيين
          </button>
          <span className="ml-auto text-xs text-muted-foreground self-center">
            الإجمالي: {total.toLocaleString("ar-EG")} • صفحة {page} / {totalPages}
          </span>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background: "hsl(0 72% 50% / 0.1)",
            color: "hsl(0 72% 65%)",
            border: "1px solid hsl(0 72% 50% / 0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: "hsl(0 0% 7%)" }}>
              <tr className="text-right" style={{ color: "hsl(0 0% 55%)" }}>
                <th className="px-3 py-2 font-semibold">الوقت</th>
                <th className="px-3 py-2 font-semibold">المنفّذ</th>
                <th className="px-3 py-2 font-semibold">الدور</th>
                <th className="px-3 py-2 font-semibold">الإجراء</th>
                <th className="px-3 py-2 font-semibold">الهدف</th>
                <th className="px-3 py-2 font-semibold">الحالة</th>
                <th className="px-3 py-2 font-semibold">IP</th>
                <th className="px-3 py-2 font-semibold w-12">…</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    لا توجد سجلات تطابق المعايير المحددة.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const sc = statusColor(r.status);
                const open = !!openPayload[r.id];
                return (
                  <Fragment key={r.id}>
                    <tr style={{ borderTop: "1px solid hsl(0 0% 13%)" }}>
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmt(r.createdAt)}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground" title={r.actorId ?? ""}>
                        {r.actorId ? r.actorId.slice(0, 8) + "…" : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                          style={{ background: "hsl(0 0% 14%)", color: r.actorRole ? GOLD : "hsl(0 0% 50%)" }}
                        >
                          {r.actorRole || "guest"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground font-mono">{r.action}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.targetType
                          ? `${r.targetType}${r.targetId ? `:${r.targetId.slice(0, 12)}` : ""}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{ background: sc.bg, color: sc.fg }}
                        >
                          {r.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{r.ip || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setOpenPayload((m) => ({ ...m, [r.id]: !m[r.id] }))}
                          className="px-2 py-1 rounded text-[10px] font-bold"
                          style={{ background: "hsl(0 0% 14%)", color: GOLD }}
                        >
                          {open ? "إخفاء" : "تفاصيل"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr style={{ borderTop: "1px solid hsl(0 0% 13%)" }}>
                        <td colSpan={8} className="px-3 py-3" style={{ background: "hsl(0 0% 6%)" }}>
                          <div className="space-y-2">
                            {r.userAgent && (
                              <p className="text-[11px] text-muted-foreground">
                                <span style={{ color: GOLD }}>UA:</span> {r.userAgent}
                              </p>
                            )}
                            <pre
                              className="text-[11px] font-mono whitespace-pre-wrap break-all rounded p-2"
                              style={{
                                background: "hsl(0 0% 4%)",
                                color: "hsl(0 0% 75%)",
                                border: "1px solid hsl(0 0% 12%)",
                              }}
                            >
                              {JSON.stringify(r.payload ?? {}, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
          disabled={!canPrev || loading}
          className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
          style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)", border: "1px solid hsl(0 0% 22%)" }}
        >
          → السابق
        </button>
        <span className="text-xs text-muted-foreground">
          صفحة {page} / {totalPages}
        </span>
        <button
          onClick={() => void load(offset + PAGE_SIZE)}
          disabled={!canNext || loading}
          className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
          style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)", border: "1px solid hsl(0 0% 22%)" }}
        >
          التالي ←
        </button>
      </div>
    </div>
  );
}
