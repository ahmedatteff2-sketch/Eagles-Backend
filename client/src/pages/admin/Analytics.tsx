import {
  useGetDashboardStats, useGetAttendanceAnalytics,
  getGetDashboardStatsQueryKey, getGetAttendanceAnalyticsQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell,
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOLD = "hsl(40 65% 52%)";
const TIP = { background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 10, color: "hsl(0 0% 90%)" };

function SkeletonChart() {
  return <div className="h-48 rounded-xl animate-pulse" style={{ background: "hsl(0 0% 12%)" }} />;
}

function StatBadge({ label, value, sub, color = GOLD }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAYS_AR = ["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"];
const COLORS_PIE = [GOLD, "hsl(142 60% 50%)", "hsl(0 72% 55%)", "hsl(220 70% 60%)", "hsl(280 60% 60%)"];

export default function AdminAnalytics() {
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const { data: attendance } = useGetAttendanceAnalytics({}, { query: { queryKey: getGetAttendanceAnalyticsQueryKey({}) } });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const st = stats as any;

  useEffect(() => {
    fetch("/api/analytics/monthly-revenue")
      .then(r => r.json())
      .then(d => setMonthlyData(Array.isArray(d) ? d : []))
      .finally(() => setLoadingMonthly(false));
  }, []);

  const attendanceData: any[] = Array.isArray(attendance) ? attendance : (attendance as any)?.data ?? [];

  const recentAttendance = useMemo(() =>
    attendanceData.slice(-30).map((d: any) => ({
      date: new Date(d.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
      حضور: d.count,
    })), [attendanceData]);

  // Attendance by day of week
  const byDayOfWeek = useMemo(() => {
    const counts: Record<number, number> = {};
    attendanceData.forEach((d: any) => {
      const day = new Date(d.date).getDay(); // 0=Sun, 6=Sat
      counts[day] = (counts[day] ?? 0) + (d.count ?? 0);
    });
    return [6,0,1,2,3,4,5].map((day, i) => ({ name: DAYS_AR[i], حضور: counts[day] ?? 0 }));
  }, [attendanceData]);

  // Month-over-month with percentage change
  const enrichedMonthly = useMemo(() =>
    monthlyData.map((d: any, i: number) => {
      const prev = monthlyData[i - 1];
      const change = prev && prev.revenue > 0 ? Math.round(((d.revenue - prev.revenue) / prev.revenue) * 100) : null;
      return { ...d, monthAr: MONTH_AR[new Date(d.month + "-01").getMonth()] ?? d.month, change };
    }), [monthlyData]);

  const expiringMembers: any[] = st?.expiringMembers ?? [];

  // Subscription plan distribution (mock from total vs active)
  const memberDistribution = [
    { name: "نشطين", value: st?.activeMembers ?? 0 },
    { name: "منتهي", value: Math.max(0, (st?.totalMembers ?? 0) - (st?.activeMembers ?? 0)) },
  ].filter(d => d.value > 0);

  const totalRevenue = monthlyData.reduce((acc, d) => acc + (d.revenue ?? 0), 0);
  const avgMonthlyRevenue = monthlyData.length ? Math.round(totalRevenue / monthlyData.length) : 0;
  const bestMonth = [...monthlyData].sort((a, b) => b.revenue - a.revenue)[0];
  const totalProfit = monthlyData.reduce((acc, d) => acc + (d.profit ?? 0), 0);

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(201, 164, 60);
    doc.rect(0, 0, 297, 20, "F");
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Eagle Gym — Analytics Report", 148, 13, { align: "center" });
    doc.setTextColor(180, 180, 180); doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }), 148, 26, { align: "center" });
    autoTable(doc, {
      startY: 32,
      head: [["الشهر", "الإيرادات", "المصاريف", "الربح", "عدد المدفوعات"]],
      body: enrichedMonthly.map(d => [d.monthAr, `${Number(d.revenue ?? 0).toLocaleString()} ج`, `${Number(d.expenses ?? 0).toLocaleString()} ج`, `${Number(d.profit ?? 0).toLocaleString()} ج`, d.paymentCount ?? 0]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [30, 30, 30], textColor: [201, 164, 60] },
      alternateRowStyles: { fillColor: [20, 20, 20] }, bodyStyles: { fillColor: [14, 14, 14], textColor: [200, 200, 200] }, theme: "plain",
    });
    doc.save(`eagle-gym-analytics-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الإحصائيات</h1>
          <p className="text-muted-foreground text-sm mt-0.5">تحليل أداء النادي بالكامل</p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          تصدير PDF
        </button>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBadge label="إجمالي الإيرادات" value={`${Number(totalRevenue).toLocaleString()} ج`} sub="كل الفترات" color={GOLD} />
        <StatBadge label="صافي الأرباح" value={`${Number(totalProfit).toLocaleString()} ج`} sub="بعد المصاريف" color="hsl(142 60% 55%)" />
        <StatBadge label="متوسط الإيرادات/شهر" value={`${Number(avgMonthlyRevenue).toLocaleString()} ج`} sub={`أفضل شهر: ${bestMonth?.monthAr ?? "—"}`} />
        <StatBadge label="أعضاء نشطين" value={st?.activeMembers ?? "—"} sub={`من ${st?.totalMembers ?? "—"} إجمالي`} color="hsl(220 70% 65%)" />
      </div>

      {/* Monthly revenue vs expenses */}
      <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-foreground">الإيرادات والمصاريف — شهر بشهر</h2>
          {bestMonth && (
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "hsl(142 60% 50% / 0.15)", color: "hsl(142 60% 60%)" }}>
              🏆 أفضل شهر: {bestMonth.monthAr} ({Number(bestMonth.revenue).toLocaleString()} ج)
            </span>
          )}
        </div>
        {loadingMonthly ? <SkeletonChart /> : enrichedMonthly.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10">لا توجد بيانات مالية بعد</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={enrichedMonthly} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
              <XAxis dataKey="monthAr" tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TIP} formatter={(v: number, name: string) => [`${Number(v).toLocaleString()} ج`, name]} />
              <Legend wrapperStyle={{ fontSize: 11, color: "hsl(0 0% 60%)" }} />
              <Bar dataKey="revenue" name="إيرادات" fill={GOLD} radius={[4,4,0,0]} />
              <Bar dataKey="expenses" name="مصاريف" fill="hsl(0 72% 51% / 0.7)" radius={[4,4,0,0]} />
              <Bar dataKey="profit" name="ربح" fill="hsl(142 60% 50%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Month-over-month change */}
      {enrichedMonthly.filter(d => d.change !== null).length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">نمو الإيرادات شهر بشهر</h2>
          <div className="flex gap-3 flex-wrap">
            {enrichedMonthly.filter(d => d.change !== null).slice(-6).map((d: any) => (
              <div key={d.month} className="flex-1 min-w-[80px] text-center py-3 px-2 rounded-xl"
                style={{ background: d.change >= 0 ? "hsl(142 60% 50% / 0.1)" : "hsl(0 60% 50% / 0.1)", border: `1px solid ${d.change >= 0 ? "hsl(142 60% 50% / 0.25)" : "hsl(0 60% 50% / 0.25)"}` }}>
                <p className="text-lg font-bold" style={{ color: d.change >= 0 ? "hsl(142 60% 60%)" : "hsl(0 60% 60%)" }}>
                  {d.change >= 0 ? "+" : ""}{d.change}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">{d.monthAr}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">الحضور — آخر 30 يوم</h2>
          {recentAttendance.length === 0 ? <SkeletonChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={recentAttendance}>
                <defs>
                  <linearGradient id="goldGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(40 65% 52%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(40 65% 52%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(0 0% 40%)", fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TIP} formatter={(v: number) => [v + " شخص", "الحضور"]} />
                <Area type="monotone" dataKey="حضور" stroke={GOLD} strokeWidth={2} fill="url(#goldGrad2)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">أكثر أيام الحضور</h2>
          {byDayOfWeek.every(d => d.حضور === 0) ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">لا توجد بيانات حضور بعد</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TIP} formatter={(v: number) => [v + " شخص", "الحضور"]} />
                <Bar dataKey="حضور" radius={[4,4,0,0]}>
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
      <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
        <h2 className="text-sm font-semibold text-foreground mb-4">توزيع الأعضاء</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "إجمالي الأعضاء", value: st?.totalMembers ?? "—", color: "hsl(0 0% 55%)" },
            { label: "اشتراك نشط", value: st?.activeMembers ?? "—", color: "hsl(142 60% 55%)" },
            { label: "ينتهي هذا الأسبوع", value: st?.expiringThisWeek ?? "—", color: "hsl(30 90% 58%)" },
          ].map(s => (
            <div key={s.label} className="text-center py-4 rounded-xl" style={{ background: "hsl(0 0% 12%)" }}>
              <p className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expiring members */}
      {expiringMembers.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(30 90% 55% / 0.2)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>⚠️</span> اشتراكات تنتهي قريباً ({expiringMembers.length})
          </h2>
          <div className="space-y-2">
            {expiringMembers.slice(0, 8).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "hsl(0 0% 12%)" }}>
                <p className="text-sm font-medium text-foreground">{m.name}</p>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">{m.phone}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(30 90% 55% / 0.15)", color: "hsl(30 90% 60%)" }}>
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
