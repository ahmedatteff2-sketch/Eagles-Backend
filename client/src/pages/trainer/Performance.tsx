/**
 * Trainer performance dashboard. Visible to the trainer themselves (and
 * later, optionally, to admins via a separate route). The metrics here
 * are the ones we can compute reliably:
 *
 *   - retention (active vs expired latest subs)
 *   - average session rating (last 30d)
 *   - check-in volume (last 7d / 30d)
 *   - top members by check-ins
 *
 * Future additions worth considering once we have the data:
 *   - average member tenure
 *   - conversion rate from trial → active
 *   - PRs hit per member
 */
import { Link } from "wouter";
import { useTrainerPerformance } from "@workspace/api-client-react";

export default function TrainerPerformance() {
  const { data, isLoading, isError } = useTrainerPerformance();

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-[hsl(0_0%_9%)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <div className="p-6 text-center text-sm text-[hsl(0_72%_70%)]">تعذّر تحميل الأداء.</div>;
  }

  const retentionPct = data.retentionRate != null ? Math.round(data.retentionRate * 100) : null;
  const ratingDisplay = data.averageRating != null ? data.averageRating.toFixed(1) : "—";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl font-black text-[hsl(40_65%_60%)]">أدائي</h1>
        <p className="text-sm text-[hsl(0_0%_50%)] mt-1">مقاييس مبنية على بيانات أعضائك المخصّصين فقط</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="إجمالي الأعضاء" value={data.totalMembers} />
        <Card
          label="نسبة الاحتفاظ"
          value={retentionPct != null ? `${retentionPct}%` : "—"}
          hint={`${data.activeMembers} نشط من ${data.activeMembers + data.expiredMembers}`}
          tone={retentionPct == null ? "neutral" : retentionPct >= 70 ? "good" : "warn"}
        />
        <Card
          label="متوسط التقييم"
          value={ratingDisplay}
          hint={`${data.ratingCount} تقييم آخر 30 يوم`}
          tone={data.averageRating != null && data.averageRating >= 4 ? "good" : "neutral"}
        />
        <Card label="حضور آخر 7 أيام" value={data.checkinsLast7d} />
      </section>

      {/* Retention bar */}
      <section className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
        <h2 className="text-sm font-bold text-[hsl(40_20%_85%)] mb-3">توزيع الأعضاء</h2>
        {data.totalMembers === 0 ? (
          <p className="text-sm text-[hsl(0_0%_50%)]">لا يوجد أعضاء مخصّصون لك بعد.</p>
        ) : (
          <>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-[hsl(0_0%_12%)]">
              {data.activeMembers > 0 && (
                <div
                  className="bg-[hsl(142_60%_50%)]"
                  style={{
                    width: `${(data.activeMembers / data.totalMembers) * 100}%`,
                  }}
                />
              )}
              {data.expiredMembers > 0 && (
                <div
                  className="bg-[hsl(0_60%_50%)]"
                  style={{
                    width: `${(data.expiredMembers / data.totalMembers) * 100}%`,
                  }}
                />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[hsl(142_60%_50%)]" />
                <span className="text-[hsl(40_20%_80%)]">نشط</span>
                <span className="text-[hsl(0_0%_50%)]">{data.activeMembers}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[hsl(0_60%_50%)]" />
                <span className="text-[hsl(40_20%_80%)]">منتهٍ</span>
                <span className="text-[hsl(0_0%_50%)]">{data.expiredMembers}</span>
              </span>
              {data.totalMembers - data.activeMembers - data.expiredMembers > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[hsl(0_0%_30%)]" />
                  <span className="text-[hsl(40_20%_80%)]">بدون اشتراك</span>
                  <span className="text-[hsl(0_0%_50%)]">
                    {data.totalMembers - data.activeMembers - data.expiredMembers}
                  </span>
                </span>
              )}
            </div>
          </>
        )}
      </section>

      {/* Top members */}
      <section className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
        <h2 className="text-sm font-bold text-[hsl(40_20%_85%)] mb-3">الأكثر حضوراً (آخر 30 يوم)</h2>
        {data.topMembers.length === 0 ? (
          <p className="text-sm text-[hsl(0_0%_50%)]">لا توجد بيانات حضور كافية بعد.</p>
        ) : (
          <ol className="space-y-1.5">
            {data.topMembers.map((m, i) => (
              <li key={m.id}>
                <Link href={`/trainer/members/${m.id}`}>
                  <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[hsl(0_0%_12%)] cursor-pointer">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background:
                          i === 0
                            ? "hsl(40 65% 48%)"
                            : i === 1
                              ? "hsl(0 0% 60%)"
                              : i === 2
                                ? "hsl(20 50% 45%)"
                                : "hsl(0 0% 18%)",
                        color: i < 3 ? "hsl(0 0% 5%)" : "hsl(0 0% 50%)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-[hsl(40_20%_85%)] truncate">{m.name}</span>
                    <span className="text-xs text-[hsl(40_65%_60%)]">{m.checkinsLast30d} مرة</span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

interface CardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn";
}
function Card({ label, value, hint, tone = "neutral" }: CardProps) {
  const color =
    tone === "good" ? "hsl(142 60% 60%)" : tone === "warn" ? "hsl(40 90% 60%)" : "hsl(40 65% 58%)";
  return (
    <div className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
      <p className="text-xs text-[hsl(0_0%_50%)]">{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color }}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-[hsl(0_0%_40%)] mt-1">{hint}</p>}
    </div>
  );
}
