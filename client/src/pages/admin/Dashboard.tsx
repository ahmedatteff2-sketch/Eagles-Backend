import { Link } from "wouter";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function StatCard({ label, value, sub, accent, warn, danger, profit }: {
  label: string; value: string | number; sub?: string;
  accent?: boolean; warn?: boolean; danger?: boolean; profit?: boolean;
}) {
  const color = accent ? "text-primary" : warn ? "text-yellow-400" : danger ? "text-destructive" : profit ? "text-green-400" : "text-foreground";
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <p className="text-muted-foreground text-xs font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-muted-foreground text-xs mt-1">{sub}</p>}
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل" };

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const st = stats as any;

  const revenueData = [{ name: "هذا الشهر", revenue: st?.monthlyRevenue ?? 0, expenses: st?.monthlyExpenses ?? 0, profit: st?.monthlyProfit ?? 0 }];
  const attendanceData = [
    { name: "السبت", value: 8 }, { name: "الأحد", value: 12 }, { name: "الاثنين", value: 15 },
    { name: "الثلاثاء", value: 10 }, { name: "الأربعاء", value: 14 }, { name: "الخميس", value: 11 }, { name: "الجمعة", value: 6 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm">نظرة عامة على النادي</p>
        </div>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Expiring subscriptions alert */}
      {!isLoading && st?.expiringThisWeek > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1">
            <p className="text-yellow-400 font-bold text-sm mb-2">{st.expiringThisWeek} اشتراك تنتهي هذا الأسبوع</p>
            <div className="flex flex-wrap gap-2">
              {(st.expiringMembers ?? []).map((m: any) => (
                <Link key={m.userId} href={`/admin/members/${m.userId}`}>
                  <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs px-2 py-1 rounded-lg cursor-pointer hover:bg-yellow-500/20 transition-colors">
                    {m.userName} · {new Date(m.endDate).toLocaleDateString("ar-EG")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الأعضاء" value={st?.totalMembers ?? 0} />
        <StatCard label="الأعضاء النشطين" value={st?.activeMembers ?? 0} accent />
        <StatCard label="الاشتراكات المنتهية" value={st?.expiredMembers ?? 0} sub="يحتاجون تجديد" danger />
        <StatCard label="حضور اليوم" value={st?.todayCheckins ?? 0} accent />
        <StatCard label="إيرادات الشهر" value={`${Number(st?.monthlyRevenue ?? 0).toLocaleString()} ج`} accent />
        <StatCard label="مصاريف الشهر" value={`${Number(st?.monthlyExpenses ?? 0).toLocaleString()} ج`} danger />
        <StatCard label="صافي الربح" value={`${Number(st?.monthlyProfit ?? 0).toLocaleString()} ج`} profit />
        <StatCard label="تنتهي هذا الأسبوع" value={st?.expiringThisWeek ?? 0} sub="اشتراك" warn />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "تسجيل حضور QR", path: "/admin/qr-scanner", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
          { label: "إضافة مصروف", path: "/admin/expenses", icon: "M12 5v14M5 12h14" },
          { label: "الجدول الأسبوعي", path: "/admin/schedule", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
          { label: "الإحصائيات", path: "/admin/analytics", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
        ].map(item => (
          <Link key={item.path} href={item.path}>
            <div className="bg-card border border-card-border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                  <path d={item.icon} />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">مالية هذا الشهر</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} formatter={(v: number) => [`${Number(v).toLocaleString()} ج`, ""]} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="إيرادات" />
              <Bar dataKey="expenses" fill="hsl(0 72% 51% / 0.7)" radius={[4, 4, 0, 0]} name="مصاريف" />
              <Bar dataKey="profit" fill="#34d399" radius={[4, 4, 0, 0]} name="ربح" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">الحضور الأسبوعي (تقريبي)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent payments */}
      {st?.recentPayments?.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">آخر المدفوعات</h2>
          <div className="space-y-2">
            {(st.recentPayments as any[]).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.userName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method} · {new Date(p.date).toLocaleDateString("ar-EG")}</p>
                </div>
                <span className="text-primary font-bold text-sm">{Number(p.amount).toLocaleString()} ج.م</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
