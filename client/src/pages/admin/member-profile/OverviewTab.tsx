import { GOLD } from "./helpers";

interface HistoryRow {
  id: number;
  subscription?: { name?: string };
  startDate?: string;
  endDate?: string;
  paymentAmount?: number | string | null;
  paymentMethod?: string | null;
}

interface CheckinRow {
  id: number;
  date?: string;
}

interface Props {
  totalCheckins: number;
  thisMonth: number;
  thisWeek: number;
  templateCount: number;
  history: HistoryRow[];
  checkins: CheckinRow[];
}

/**
 * "Overview" tab body — KPI cards plus subscription history and the
 * member's recent check-ins.
 */
export function OverviewTab({
  totalCheckins,
  thisMonth,
  thisWeek,
  templateCount,
  history,
  checkins,
}: Props) {
  const stats = [
    { label: "إجمالي الحضور", value: totalCheckins, color: GOLD },
    { label: "حضور الشهر", value: thisMonth, color: "hsl(142 60% 55%)" },
    { label: "حضور الأسبوع", value: thisWeek, color: "hsl(220 70% 65%)" },
    { label: "قوالب التمرين", value: templateCount, color: "hsl(280 60% 60%)" },
  ];

  const recentCheckins = [...checkins]
    .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime())
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4 text-center"
            style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
          >
            <p className="text-2xl font-black mb-0.5" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            تاريخ الاشتراكات والمدفوعات
          </h2>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا يوجد سجل اشتراكات</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 5).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {h.subscription?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {h.startDate ? new Date(h.startDate).toLocaleDateString("ar-EG") : "—"} →{" "}
                      {h.endDate ? new Date(h.endDate).toLocaleDateString("ar-EG") : "—"}
                    </p>
                  </div>
                  <div className="text-left">
                    {h.paymentAmount && (
                      <p className="text-sm font-bold" style={{ color: GOLD }}>
                        {Number(h.paymentAmount).toLocaleString()} ج
                      </p>
                    )}
                    {h.paymentMethod && (
                      <p className="text-xs text-muted-foreground">
                        {h.paymentMethod === "cash"
                          ? "نقدي"
                          : h.paymentMethod === "card"
                            ? "بطاقة"
                            : "تحويل"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            آخر زيارات ({checkins.length})
          </h2>
          {checkins.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا يوجد حضور مسجل</p>
          ) : (
            <div className="space-y-1.5">
              {recentCheckins.map((c) => {
                const d = new Date(c.date ?? "");
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <p className="text-sm text-foreground">
                      {d.toLocaleDateString("ar-EG", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-xs tabular-nums" style={{ color: GOLD }}>
                      {d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
