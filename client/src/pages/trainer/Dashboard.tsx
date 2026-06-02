/**
 * Trainer dashboard — the home screen for `role=trainer`. Shows at-a-glance
 * KPIs, the trainer's pinned reminders ("⚠️ Ahmed: knee injury"), and a
 * recent-notes feed.
 *
 * Performance: a single `/api/trainer/dashboard` request fetches everything
 * (summary + pinned + recent) in parallel server-side. Client-side, all the
 * stat cards share one TanStack Query so we don't refetch six times.
 */
import { Link } from "wouter";
import { useTrainerDashboard } from "@workspace/api-client-react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn";
}

function StatCard({ label, value, hint, tone = "neutral" }: StatCardProps) {
  const toneColor =
    tone === "good" ? "hsl(142 60% 60%)" : tone === "warn" ? "hsl(40 90% 60%)" : "hsl(40 65% 58%)";
  return (
    <div className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
      <p className="text-xs text-[hsl(0_0%_50%)]">{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color: toneColor }}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-[hsl(0_0%_40%)] mt-1">{hint}</p>}
    </div>
  );
}

export default function TrainerDashboard() {
  const { data, isLoading, isError } = useTrainerDashboard();

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-[hsl(0_0%_9%)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-center text-[hsl(0_0%_50%)]">تعذّر تحميل البيانات. حاول إعادة التحميل.</div>
    );
  }

  const { summary, pinnedNotes, recentNotes } = data;
  const ratingDisplay = summary.averageRating != null ? summary.averageRating.toFixed(1) : "—";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-black text-[hsl(40_65%_60%)]">لوحة المدرب</h1>
        <p className="text-sm text-[hsl(0_0%_50%)] mt-1">نظرة سريعة على أعضائك ونشاط هذا الأسبوع</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الأعضاء" value={summary.totalMembers} />
        <StatCard
          label="أعضاء نشطون"
          value={summary.activeMembers}
          hint={`من إجمالي ${summary.totalMembers}`}
          tone="good"
        />
        <StatCard
          label="قرب الانتهاء"
          value={summary.expiringSoon}
          hint="خلال 7 أيام"
          tone={summary.expiringSoon > 0 ? "warn" : "neutral"}
        />
        <StatCard label="حضور اليوم" value={summary.checkinsToday} />
        <StatCard label="حضور هذا الأسبوع" value={summary.checkinsThisWeek} />
        <StatCard label="متوسط التقييم" value={ratingDisplay} hint="آخر 30 يوم" tone="good" />
        <StatCard label="ملاحظات مثبّتة" value={summary.pinnedNotesCount} hint="تذكيرات مهمة" />
      </section>

      {/* Pinned notes — the "things to remember" widget */}
      {pinnedNotes.length > 0 && (
        <section className="rounded-2xl p-4 bg-[hsl(40_65%_48%/0.05)] border border-[hsl(40_65%_48%/0.25)]">
          <h2 className="text-sm font-bold text-[hsl(40_65%_60%)] mb-3 flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M12 17v5" />
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
            </svg>
            ملاحظات مثبّتة
          </h2>
          <ul className="space-y-2">
            {pinnedNotes.map((n) => (
              <li key={n.id} className="rounded-xl p-3 bg-[hsl(0_0%_8%)] border border-[hsl(0_0%_14%)]">
                <Link href={`/trainer/members/${n.member.id}`}>
                  <div className="flex items-start justify-between gap-3 cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[hsl(40_65%_60%)] mb-1">
                        {n.member.name}{" "}
                        <span className="text-[hsl(0_0%_40%)]">• {translateCategory(n.category)}</span>
                      </p>
                      <p className="text-sm text-[hsl(40_20%_85%)]">{n.note}</p>
                    </div>
                    <span className="text-[10px] text-[hsl(0_0%_40%)] whitespace-nowrap">
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent activity feed */}
      <section className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[hsl(40_20%_85%)]">آخر الملاحظات</h2>
          <Link href="/trainer/members">
            <span className="text-xs text-[hsl(40_65%_55%)] cursor-pointer">عرض الأعضاء ←</span>
          </Link>
        </div>
        {recentNotes.length === 0 ? (
          <p className="text-sm text-[hsl(0_0%_45%)] text-center py-6">
            لم تكتب أي ملاحظات بعد. افتح ملف عضو وأضف أول ملاحظة.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentNotes.map((n) => (
              <li key={n.id} className="rounded-lg p-3 bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_12%)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-[hsl(40_20%_85%)] flex-1">{n.note}</p>
                  <span className="text-[10px] text-[hsl(0_0%_40%)] whitespace-nowrap">
                    {formatRelative(n.createdAt)}
                  </span>
                </div>
                <p className="text-[11px] text-[hsl(0_0%_40%)] mt-1">{translateCategory(n.category)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "عام",
  form: "أداء التمرين",
  nutrition: "تغذية",
  behavior: "سلوك",
  injury: "إصابة",
};
function translateCategory(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}

/**
 * Tiny relative-time formatter — avoids pulling date-fns just for "5 min ago"
 * style strings on this page (it's already in the bundle, but reading a
 * Date.now diff is faster and the localization is trivial).
 */
function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} س`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `منذ ${day} ي`;
  return new Date(iso).toLocaleDateString("ar-EG");
}
