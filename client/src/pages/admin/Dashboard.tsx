import {
  useGetDashboardStats, useListUsers,
  getGetDashboardStatsQueryKey, getListUsersQueryKey,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOLD = "hsl(40 65% 52%)";
const TIP = { background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 10, color: "hsl(0 0% 90%)" };

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 animate-pulse" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
      <div className="h-3 w-20 rounded mb-3" style={{ background: "hsl(0 0% 14%)" }} />
      <div className="h-8 w-28 rounded" style={{ background: "hsl(0 0% 14%)" }} />
    </div>
  );
}

function StatCard({ label, value, sub, icon, color = GOLD, href }: any) {
  const inner = (
    <div className="rounded-xl p-5 flex items-center gap-4 transition-all cursor-pointer"
      style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(40 65% 48% / 0.3)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(0 0% 15%)"; }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + "22" }}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-2xl font-black text-foreground">{value ?? "—"}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function AdminDashboard() {
  const [, nav] = useLocation();
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const { data: expiringData } = useListUsers(
    { status: "active", limit: 100 },
    { query: { queryKey: getListUsersQueryKey({ status: "active", limit: 100 }) } }
  );
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [gymName, setGymName] = useState("Eagle Gym");

  useEffect(() => {
    const s = localStorage.getItem("gym-settings");
    if (s) setGymName(JSON.parse(s).gymName ?? "Eagle Gym");
  }, []);

  useEffect(() => {
    fetch("/api/analytics/monthly-revenue")
      .then(r => r.json())
      .then(d => setMonthlyData(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const st = stats as any;
  const allExpiring: any[] = (expiringData as any)?.data ?? [];
  const today = new Date();
  const todayExpiring = allExpiring.filter((m: any) => {
    if (!m.currentSubscription?.endDate) return false;
    return new Date(m.currentSubscription.endDate).toDateString() === today.toDateString();
  });
  const soonExpiring = allExpiring.filter((m: any) => {
    if (!m.currentSubscription?.endDate) return false;
    const diff = (new Date(m.currentSubscription.endDate).getTime() - today.getTime()) / 86400000;
    return diff > 0 && diff <= 7;
  });

  const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const chartData = monthlyData.slice(-6).map((d: any) => ({
    month: MONTH_AR[new Date(d.month + "-01").getMonth()] ?? d.month,
    إيرادات: d.revenue,
    مصاريف: d.expenses,
  }));

  function exportPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFillColor(201, 164, 60);
    doc.rect(0, 0, 210, 18, "F");
    doc.setTextColor(10,10,10); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text(gymName + " — Dashboard Report", 105, 12, { align: "center" });
    doc.setTextColor(180,180,180); doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("en-GB"), 105, 22, { align: "center" });
    autoTable(doc, {
      startY: 28,
      head: [["المقياس", "القيمة"]],
      body: [
        ["إجمالي الأعضاء", st?.totalMembers ?? 0],
        ["اشتراكات نشطة", st?.activeMembers ?? 0],
        ["حضور اليوم", st?.todayCheckins ?? 0],
        ["ينتهي هذا الأسبوع", st?.expiringThisWeek ?? 0],
        ["إيرادات هذا الشهر (ج)", Number(st?.monthlyRevenue ?? 0).toLocaleString()],
        ["مصاريف هذا الشهر (ج)", Number(st?.monthlyExpenses ?? 0).toLocaleString()],
        ["ربح هذا الشهر (ج)", Number(st?.monthlyProfit ?? 0).toLocaleString()],
      ],
      styles: { fontSize: 9 }, headStyles: { fillColor: [30,30,30], textColor: [201,164,60] },
      alternateRowStyles: { fillColor: [20,20,20] }, bodyStyles: { fillColor: [14,14,14], textColor: [200,200,200] }, theme: "plain",
    });
    doc.save("eagle-gym-dashboard.pdf");
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span style={{ color: GOLD }}>لوحة التحكم</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {today.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          تصدير PDF
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? [1,2,3,4].map(i => <SkeletonCard key={i} />) : <>
          <StatCard label="إجمالي الأعضاء" value={st?.totalMembers} sub="عضو مسجل" href="/admin/members"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="9" cy="7" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><circle cx="19" cy="8" r="3"/><path d="M22 21v-1a5 5 0 0 0-4-4.9"/></svg>} />
          <StatCard label="اشتراكات نشطة" value={st?.activeMembers} sub="فعال" href="/admin/members"
            color="hsl(142 60% 55%)"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="hsl(142 60% 55%)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>} />
          <StatCard label="حضور اليوم" value={st?.todayCheckins} sub="زيارة" href="/admin/attendance"
            color="hsl(220 70% 65%)"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="hsl(220 70% 65%)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
          <StatCard label="ينتهي قريباً" value={st?.expiringThisWeek} sub="هذا الأسبوع"
            color="hsl(30 90% 58%)"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="hsl(30 90% 58%)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
        </>}
      </div>

      {/* Financial cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "إيرادات الشهر", value: st?.monthlyRevenue, color: GOLD },
          { label: "مصاريف الشهر", value: st?.monthlyExpenses, color: "hsl(0 72% 55%)" },
          { label: "صافي الربح", value: st?.monthlyProfit, color: "hsl(142 60% 55%)" },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className="text-xl font-black" style={{ color: c.color }}>{Number(c.value ?? 0).toLocaleString()} ج</p>
          </div>
        ))}
      </div>

      {/* Area chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">الإيرادات — آخر 6 أشهر</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3}/><stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TIP} formatter={(v: number, n: string) => [Number(v).toLocaleString() + " ج", n]} />
              <Area type="monotone" dataKey="إيرادات" stroke={GOLD} strokeWidth={2} fill="url(#g1)" dot={false} />
              <Area type="monotone" dataKey="مصاريف" stroke="hsl(0 72% 51%)" strokeWidth={1.5} fill="transparent" dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Today's Tasks */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0 0% 15%)" }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "hsl(0 0% 9%)", borderBottom: "1px solid hsl(0 0% 13%)" }}>
          <div className="flex items-center gap-2">
            <span>📋</span>
            <h2 className="text-sm font-semibold text-foreground">مهام اليوم</h2>
          </div>
          {(todayExpiring.length + soonExpiring.length) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "hsl(30 90% 55% / 0.15)", color: "hsl(30 90% 60%)" }}>
              {todayExpiring.length + soonExpiring.length} مهمة
            </span>
          )}
        </div>
        <div style={{ background: "hsl(0 0% 8%)" }}>
          {todayExpiring.length === 0 && soonExpiring.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm text-muted-foreground">لا توجد مهام معلقة اليوم</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "hsl(0 0% 12%)" }}>
              {todayExpiring.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: "hsl(0 60% 50% / 0.15)", color: "hsl(0 60% 60%)" }}>{m.name?.[0]}</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(0 60% 50% / 0.15)", color: "hsl(0 60% 60%)" }}>ينتهي اليوم</span>
                    <a href={"https://wa.me/2" + (m.phone ?? "").replace(/^0/,"")} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg" style={{ background: "hsl(142 60% 42% / 0.15)", color: "hsl(142 60% 55%)" }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    </a>
                    <button onClick={() => nav("/admin/members/" + m.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold"
                      style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 58%)" }}>تجديد</button>
                  </div>
                </div>
              ))}
              {soonExpiring.slice(0, 6).map((m: any) => {
                const daysLeft = Math.ceil((new Date(m.currentSubscription.endDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 58%)" }}>{m.name?.[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 58%)" }}>
                        بعد {daysLeft} يوم
                      </span>
                      <a href={"https://wa.me/2" + (m.phone ?? "").replace(/^0/,"")} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg" style={{ background: "hsl(142 60% 42% / 0.15)", color: "hsl(142 60% 55%)" }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      </a>
                    </div>
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
