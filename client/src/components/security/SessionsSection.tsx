import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { listSessions, revokeSession, revokeAllOtherSessions, type SessionRow } from "@/lib/auth-extras";

const GOLD = "hsl(40 65% 52%)";

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

/**
 * Active sessions list. Reads /api/auth/sessions, lets the user revoke an
 * individual session row or every other session in one shot.
 *
 * Looks intentionally identical between admin and member settings — the
 * underlying capability is the same, the framing isn't.
 */
export default function SessionsSection() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [actingAll, setActingAll] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل الجلسات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRevoke(id: number) {
    setActingId(id);
    try {
      await revokeSession(id);
      toast({ title: "✅ تم إنهاء الجلسة" });
      await load();
    } catch (err) {
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذّر إنهاء الجلسة",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  }

  async function handleRevokeAll() {
    setActingAll(true);
    try {
      const r = await revokeAllOtherSessions();
      toast({ title: "✅ تم إنهاء الجلسات الأخرى", description: `تم إنهاء ${r.revoked} جلسة` });
      await load();
    } catch (err) {
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذّر إنهاء الجلسات",
        variant: "destructive",
      });
    } finally {
      setActingAll(false);
    }
  }

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground tracking-wide">🖥️ الجلسات النشطة</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)", border: "1px solid hsl(0 0% 22%)" }}
          >
            {loading ? "..." : "تحديث"}
          </button>
          <button
            onClick={() => void handleRevokeAll()}
            disabled={actingAll || !rows || rows.length <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
            style={{
              background: "hsl(0 72% 51% / 0.12)",
              color: "hsl(0 72% 65%)",
              border: "1px solid hsl(0 72% 51% / 0.25)",
            }}
          >
            {actingAll ? "..." : "إنهاء كل الجلسات الأخرى"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        كل سطر هنا هو جهاز/متصفح فيه session نشطة لحسابك. لو لقيت جهاز مش بتاعك، اضغط
        <span style={{ color: "hsl(0 72% 65%)" }}> إنهاء</span>.
      </p>

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

      {!rows && loading && <div className="text-xs text-muted-foreground">جاري التحميل...</div>}

      {rows && rows.length === 0 && <p className="text-xs text-muted-foreground">لا توجد جلسات نشطة.</p>}

      {rows && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 px-3 py-3 rounded-lg"
              style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 13%)" }}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">{s.label || "جهاز غير معروف"}</p>
                <p className="text-xs text-muted-foreground truncate" title={s.userAgent ?? ""}>
                  {s.userAgent || "—"}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    IP: <span className="font-mono">{s.ip || "—"}</span>
                  </span>
                  <span>أُنشئت: {fmt(s.createdAt)}</span>
                  <span>آخر استخدام: {fmt(s.lastUsedAt)}</span>
                  <span>تنتهي: {fmt(s.expiresAt)}</span>
                </div>
              </div>
              <button
                onClick={() => void handleRevoke(s.id)}
                disabled={actingId === s.id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 flex-shrink-0"
                style={{
                  background: "hsl(0 72% 51% / 0.12)",
                  color: "hsl(0 72% 65%)",
                  border: "1px solid hsl(0 72% 51% / 0.25)",
                }}
              >
                {actingId === s.id ? "..." : "إنهاء"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px]" style={{ color: GOLD }}>
        ملاحظة: قد تستمر بعض الـ access tokens لدقائق قليلة بعد الإنهاء حتى تنتهي صلاحيتها.
      </p>
    </div>
  );
}
