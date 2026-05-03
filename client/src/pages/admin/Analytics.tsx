import {
  useGetDashboardStats, useGetAttendanceAnalytics,
  getGetDashboardStatsQueryKey, getGetAttendanceAnalyticsQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area,
} from "recharts";
import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const TOOLTIP_STYLE = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" };

export default function AdminAnalytics() {
  const { data: stats } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
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

  const attendanceData = Array.isArray(attendance) ? attendance : (attendance as any)?.data ?? [];
  const recentAttendance = attendanceData.slice(-14).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
    count: d.count,
  }));

  const expiringMembers: any[] = st?.expiringMembers ?? [];

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("Eagle Gym - Monthly Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 23);

    autoTable(doc, {
      startY: 30,
      head: [["Month", "Revenue (EGP)", "Expenses (EGP)", "Profit (EGP)", "Payments"]],
      body: monthlyData.map(d => [d.month, d.revenue.toLocaleString(), d.expenses.toLocaleString(), d.profit.toLocaleString(), d.paymentCount]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [201, 168, 76] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 80;
    autoTable(doc, {
      startY: finalY + 10,
      head: [["Metric", "Value"]],
      body: [
        ["Total Members", st?.totalMembers ?? 0],
        ["Active Members", st?.activeMembers ?? 0],
        ["Total Revenue (EGP)", Number(st?.totalRevenue ?? 0).toLocaleString()],
        ["Monthly Revenue (EGP)", Number(st?.monthlyRevenue ?? 0).toLocaleString()],
        ["Monthly Expenses (EGP)", Number(st?.monthlyExpenses ?? 0).toLocaleString()],
        ["Monthly Profit (EGP)", Number(st?.monthlyProfit ?? 0).toLocaleString()],
        ["Today Checkins", st?.todayCheckins ?? 0],
        ["Expiring This Week", st?.expiringThisWeek ?? 0],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [201, 168, 76] },
    });

    doc.save(`eagle-gym-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الإحصائيات</h1>
          <p className="text-muted-foreground text-sm">تحليل الأداء العام للنادي</p>
        </div>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          تصدير PDF
        </button>
      </div>

      {/* Expiring subscriptions alert */}
      {expiringMembers.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-yellow-400 flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-yellow-400 font-bold text-sm">{expiringMembers.length} اشتراك تنتهي هذا الأسبوع</p>
          </div>
          <div className="space-y-2">
            {expiringMembers.map((m: any) => (
              <div key={m.userId} className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2">
                <span className="text-yellow-400/70 text-xs">{new Date(m.endDate).toLocaleDateString("ar-EG")}</span>
                <div className="text-right">
                  <span className="text-yellow-300 text-sm font-medium">{m.userName}</span>
                  <span className="text-yellow-400/60 text-xs mr-2">{m.userPhone}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الأعضاء", value: st?.totalMembers ?? 0 },
          { label: "الأعضاء النشطين", value: st?.activeMembers ?? 0, accent: true },
          { label: "إيرادات الشهر", value: `${Number(st?.monthlyRevenue ?? 0).toLocaleString()} ج`, accent: true },
          { label: "مصاريف الشهر", value: `${Number(st?.monthlyExpenses ?? 0).toLocaleString()} ج`, red: true },
          { label: "صافي الربح", value: `${Number(st?.monthlyProfit ?? 0).toLocaleString()} ج`, profit: true },
          { label: "حضور اليوم", value: st?.todayCheckins ?? 0 },
          { label: "تنتهي الأسبوع", value: st?.expiringThisWeek ?? 0, warn: true },
          { label: "إجمالي الإيرادات", value: `${Number(st?.totalRevenue ?? 0).toLocaleString()} ج` },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-card-border rounded-xl p-5">
            <p className="text-muted-foreground text-xs font-medium mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.accent ? "text-primary" : c.red ? "text-destructive" : c.warn ? "text-yellow-400" : c.profit ? (Number(st?.monthlyProfit ?? 0) >= 0 ? "text-green-400" : "text-destructive") : "text-foreground"}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">الإيرادات والمصاريف الشهرية</h2>
        {loadingMonthly ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : monthlyData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد بيانات كافية بعد</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${Number(v).toLocaleString()} ج`, ""]} />
              <Legend />
              <Area type="monotone" dataKey="revenue" fill="hsl(40 65% 48% / 0.1)" stroke="hsl(40 65% 48%)" strokeWidth={2} name="الإيرادات" />
              <Bar dataKey="expenses" fill="hsl(0 72% 51% / 0.7)" radius={[4, 4, 0, 0]} name="المصاريف" />
              <Line type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={2} dot={false} name="الربح" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Attendance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">الحضور (آخر 14 يوم)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recentAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="حضور" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent payments */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">آخر المدفوعات</h2>
          {st?.recentPayments?.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">لا توجد مدفوعات</p>
          ) : (
            <div className="space-y-2">
              {(st?.recentPayments ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-primary font-bold text-sm">{Number(p.amount).toLocaleString()} ج</span>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{p.userName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("ar-EG")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
