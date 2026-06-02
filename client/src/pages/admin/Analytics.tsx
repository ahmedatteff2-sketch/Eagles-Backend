import {
  useGetDashboardStats,
  useGetAttendanceAnalytics,
  getGetDashboardStatsQueryKey,
  getGetAttendanceAnalyticsQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { useMemo } from "react";

const GOLD = "hsl(40 65% 52%)";
const TIP = {
  background: "hsl(0 0% 10%)",
  border: "1px solid hsl(0 0% 18%)",
  borderRadius: 10,
  color: "hsl(0 0% 90%)",
};

function SkeletonChart() {
  return <div className="h-48 rounded-xl animate-pulse" style={{ background: "hsl(0 0% 12%)" }} />;
}

function StatBadge({ label, value, sub, color = GOLD }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

const DAYS_AR = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function AdminAnalytics() {
  const { data: stats } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const { data: attendance } = useGetAttendanceAnalytics(
    {},
    { query: { queryKey: getGetAttendanceAnalyticsQueryKey({}) } },
  );
  const st = stats as any;

  const attendanceData: any[] = Array.isArray(attendance) ? attendance : ((attendance as any)?.data ?? []);

  const recentAttendance = useMemo(
    () =>
      attendanceData.slice(-30).map((d: any) => ({
        date: new Date(d.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
        حضور: d.count,
      })),
    [attendanceData],
  );

  // Attendance by day of week
  const byDayOfWeek = useMemo(() => {
    const counts: Record<number, number> = {};
    attendanceData.forEach((d: any) => {
      const day = new Date(d.date).getDay(); // 0=Sun, 6=Sat
      counts[day] = (counts[day] ?? 0) + (d.count ?? 0);
    });
    return [6, 0, 1, 2, 3, 4, 5].map((day, i) => ({ name: DAYS_AR[i], حضور: counts[day] ?? 0 }));
  }, [attendanceData]);

  // Expiring subscriptions come back from /analytics/dashboard with
  // { userId, userName, userPhone, endDate } — tolerate both shapes so names
  // render correctly regardless of the serializer.
  const expiringMembers: any[] = st?.expiringMembers ?? [];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">الإحصائيات</h1>
        <p className="text-muted-foreground text-sm mt-0.5">تحليل أداء النادي</p>
      </div>

      {/* Membership KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatBadge
          label="إجمالي الأعضاء"
          value={st?.totalMembers ?? "—"}
          sub="عضو مسجل"
          color="hsl(0 0% 70%)"
        />
        <StatBadge
          label="أعضاء نشطين"
          value={st?.activeMembers ?? "—"}
          sub={`من ${st?.totalMembers ?? "—"} إجمالي`}
          color="hsl(142 60% 55%)"
        />
        <StatBadge
          label="ينتهي هذا الأسبوع"
          value={st?.expiringThisWeek ?? "—"}
          sub="اشتراك قارب على الانتهاء"
          color="hsl(30 90% 58%)"
        />
      </div>

      {/* Attendance charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-5"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
        >
          <h2 className="text-sm font-semibold text-foreground mb-4">الحضور — آخر 30 يوم</h2>
          {recentAttendance.length === 0 ? (
            <SkeletonChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={recentAttendance}>
                <defs>
                  <linearGradient id="goldGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(40 65% 52%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(40 65% 52%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(0 0% 40%)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TIP} formatter={(v: number) => [v + " شخص", "الحضور"]} />
                <Area
                  type="monotone"
                  dataKey="حضور"
                  stroke={GOLD}
                  strokeWidth={2}
                  fill="url(#goldGrad2)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
        >
          <h2 className="text-sm font-semibold text-foreground mb-4">أكثر أيام الحضور</h2>
          {byDayOfWeek.every((d) => d.حضور === 0) ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              لا توجد بيانات حضور بعد
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TIP} formatter={(v: number) => [v + " شخص", "الحضور"]} />
                <Bar dataKey="حضور" radius={[4, 4, 0, 0]}>
                  {byDayOfWeek.map((entry, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? GOLD : "hsl(40 65% 36%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Member distribution */}
      <div
        className="rounded-xl p-5"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      >
        <h2 className="text-sm font-semibold text-foreground mb-4">توزيع الأعضاء</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "إجمالي الأعضاء", value: st?.totalMembers ?? "—", color: "hsl(0 0% 55%)" },
            { label: "اشتراك نشط", value: st?.activeMembers ?? "—", color: "hsl(142 60% 55%)" },
            { label: "ينتهي هذا الأسبوع", value: st?.expiringThisWeek ?? "—", color: "hsl(30 90% 58%)" },
          ].map((s) => (
            <div
              key={s.label}
              className="text-center py-4 rounded-xl"
              style={{ background: "hsl(0 0% 12%)" }}
            >
              <p className="text-2xl font-bold mb-1" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expiring members */}
      {expiringMembers.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(30 90% 55% / 0.2)" }}
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>⚠️</span> اشتراكات تنتهي قريباً ({expiringMembers.length})
          </h2>
          <div className="space-y-2">
            {expiringMembers.slice(0, 8).map((m: any) => (
              <div
                key={m.id ?? m.userId}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "hsl(0 0% 12%)" }}
              >
                <p className="text-sm font-medium text-foreground">{m.name ?? m.userName}</p>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">{m.phone ?? m.userPhone}</p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "hsl(30 90% 55% / 0.15)", color: "hsl(30 90% 60%)" }}
                  >
                    {m.endDate ? new Date(m.endDate).toLocaleDateString("ar-EG") : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
