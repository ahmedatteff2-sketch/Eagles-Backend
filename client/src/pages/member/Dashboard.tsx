import { useAuthStore } from "@/store/auth";
import {
  useGetMemberCurrentSubscription, useListExerciseLogs, useListCheckins,
  getGetMemberCurrentSubscriptionQueryKey, getListExerciseLogsQueryKey, getListCheckinsQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect } from "react";
import { Link } from "wouter";

const GOLD = "hsl(40 65% 52%)";
const G2 = "hsl(40 65% 42%)";

function ProgressRing({ percent, size = 72, stroke = 6, color = GOLD }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(0 0% 14%)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
    </svg>
  );
}

const GREET = (() => {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
})();

export default function MemberDashboard() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";
  const today = new Date().toISOString().split("T")[0];

  const { data: sub, isLoading } = useGetMemberCurrentSubscription(userId, {
    query: { queryKey: getGetMemberCurrentSubscriptionQueryKey(userId), enabled: !!userId },
  });
  const { data: exerciseLogs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } }
  );
  const { data: checkins } = useListCheckins(
    { userId },
    { query: { queryKey: getListCheckinsQueryKey({ userId }), enabled: !!userId } }
  );

  const [templates, setTemplates] = useState<any[]>([]);
  const [water, setWater] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const WATER_GOAL = 8;
  useEffect(() => {
    customFetch<any[]>("/api/my-workouts")
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
    customFetch<any>(`/api/water?date=${today}`)
      .then(d => setWater(d?.glasses ?? 0)).catch(() => {});
    customFetch<any[]>("/api/notifications")
      .then(d => { const arr = Array.isArray(d) ? d : []; setNotifCount(arr.filter((n: any) => !n.read).length); }).catch(() => {});
  }, []);

  function addWater(delta: number) {
    const g = Math.max(0, water + delta);
    setWater(g);
    customFetch("/api/water", { method: "POST", body: JSON.stringify({ glasses: g, date: today }) }).catch(() => {});
  }

  const subData = sub as any;
  const isActive = subData?.status === "active";
  const daysLeft = subData?.endDate
    ? Math.max(0, Math.ceil((new Date(subData.endDate).getTime() - Date.now()) / 86400000))
    : null;
  const totalDays = subData?.startDate && subData?.endDate
    ? Math.max(1, Math.ceil((new Date(subData.endDate).getTime() - new Date(subData.startDate).getTime()) / 86400000))
    : 1;
  const subPercent = daysLeft !== null ? Math.round(((totalDays - daysLeft) / totalDays) * 100) : 0;

  const logList: any[] = Array.isArray(exerciseLogs) ? exerciseLogs : (exerciseLogs as any)?.data ?? [];
  const todayLogs = logList.filter((l: any) => l.date === today);
  const todayExercises = new Set(todayLogs.map((l: any) => l.exerciseId)).size;
  const allExCount = templates.reduce((s: number, t: any) => s + (t.exercises?.length ?? 0), 0);
  const todayPercent = allExCount > 0 ? Math.round((todayExercises / allExCount) * 100) : 0;

  // Recent weight records grouped by exercise
  const byEx: Record<string, any[]> = {};
  logList.slice(0, 50).forEach((l: any) => {
    const name = l.exercise?.name ?? "—";
    if (!byEx[name]) byEx[name] = [];
    byEx[name].push(l);
  });
  const topExercises = Object.entries(byEx).slice(0, 4);

  // Weekly attendance
  const checkinList: any[] = Array.isArray(checkins) ? checkins : (checkins as any)?.data ?? [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const thisWeek = checkinList.filter((c: any) => new Date(c.timestamp ?? c.date ?? "").getTime() >= weekAgo.getTime()).length;

  const quickLinks = [
    { label: "التمارين", desc: "قالب التمرين الحالي", href: "/member/workouts", icon: "🏋️" },
    { label: "سجّل أداء", desc: "سجل جلستك الحالية", href: "/member/log", icon: "✏️" },
    { label: "القياسات", desc: "الوزن والدهون", href: "/member/stats", icon: "📊" },
    { label: "الحضور", desc: "تاريخ حضورك", href: "/member/attendance", icon: "📅" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-8">
      {/* ── Welcome header ── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, hsl(0 0% 9%), hsl(0 0% 6%))`, border: "1px solid hsl(0 0% 12%)" }}>
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-[0.06]"
          style={{ background: `radial-gradient(circle, ${GOLD}, transparent 70%)`, filter: "blur(30px)" }} />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${GOLD}, ${G2})`, color: "hsl(0 0% 5%)",
              boxShadow: `0 4px 20px ${GOLD}40` }}>
            {user?.name?.[0] ?? "؟"}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{GREET} 👋</p>
            <h1 className="text-lg font-bold text-foreground">{user?.name}</h1>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl p-2.5 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <p className="text-lg font-black" style={{ color: GOLD }}>{todayExercises}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">تمارين</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <p className="text-lg font-black" style={{ color: "hsl(142 60% 55%)" }}>{thisWeek}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">حضور</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <p className="text-lg font-black" style={{ color: "hsl(220 70% 65%)" }}>{logList.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">سجلات</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(200 80% 50% / 0.15)" }}>
          <p className="text-lg font-black" style={{ color: "hsl(200 80% 60%)" }}>{water}/{WATER_GOAL}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">💧 ماء</p>
        </div>
      </div>

      {/* ── Two columns: subscription + today progress ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Subscription */}
        <div className="rounded-xl p-4 relative overflow-hidden"
          style={{ background: "hsl(0 0% 9%)", border: `1px solid ${isActive ? "hsl(142 60% 50% / 0.25)" : "hsl(0 60% 50% / 0.25)"}` }}>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-24 rounded bg-muted" /><div className="h-6 w-32 rounded bg-muted" />
            </div>
          ) : subData ? (
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <ProgressRing percent={subPercent} color={isActive ? "hsl(142 60% 50%)" : "hsl(0 60% 50%)"} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">{daysLeft ?? 0}d</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-foreground truncate">{subData.subscription?.name ?? "—"}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {isActive ? "نشط" : "منتهي"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(subData.startDate).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })} ← {new Date(subData.endDate).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                </p>
                {daysLeft !== null && isActive && (
                  <p className="text-xs font-medium mt-1" style={{ color: daysLeft <= 3 ? "hsl(0 60% 60%)" : "hsl(142 60% 55%)" }}>
                    {daysLeft === 0 ? "⚠ ينتهي اليوم!" : `متبقي ${daysLeft} يوم`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm">لا يوجد اشتراك</p>
              <p className="text-xs text-muted-foreground mt-1">تواصل مع المدرب</p>
            </div>
          )}
        </div>

        {/* Today workout progress */}
        <div className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <ProgressRing percent={todayPercent} color={todayPercent >= 100 ? "hsl(142 60% 50%)" : GOLD} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black" style={{ color: todayPercent >= 100 ? "hsl(142 60% 55%)" : GOLD }}>{todayPercent}%</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">جلسة اليوم</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayExercises === 0 ? "لم تبدأ بعد" : `${todayExercises} تمارين تمت`}
              </p>
              {todayPercent >= 100 && <p className="text-xs font-bold text-green-400 mt-1">أحسنت! أتممت الجلسة ✓</p>}
              {todayPercent > 0 && todayPercent < 100 && (
                <Link href="/member/log">
                  <button className="text-xs font-bold mt-1.5 px-3 py-1 rounded-lg" style={{ background: `${GOLD}20`, color: GOLD }}>
                    أكمل الجلسة ←
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent weights ── */}
      {topExercises.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">آخر الأوزان</h2>
            <Link href="/member/log">
              <span className="text-xs" style={{ color: GOLD }}>عرض الكل ←</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {topExercises.map(([name, logs]) => {
              const lastW = parseFloat(logs[0].weight);
              return (
                <div key={name} className="rounded-lg p-3" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}>
                  <p className="text-xs text-muted-foreground truncate mb-1">{name}</p>
                  <p className="text-base font-black" style={{ color: GOLD }}>{lastW} <span className="text-xs text-muted-foreground font-normal">كجم</span></p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Water widget ── */}
      <div className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(200 80% 50% / 0.15)" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">💧 تتبع شرب الماء</h2>
          <span className="text-xs" style={{ color: water >= WATER_GOAL ? "hsl(142 60% 55%)" : "hsl(200 80% 60%)" }}>{water >= WATER_GOAL ? "✓ أتممت الهدف!" : `${WATER_GOAL - water} أكواب متبقية`}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "hsl(0 0% 14%)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (water / WATER_GOAL) * 100)}%`, background: water >= WATER_GOAL ? "hsl(142 60% 50%)" : "hsl(200 80% 55%)" }} />
          </div>
          <div className="flex gap-1">
            <button onClick={() => addWater(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors bg-muted text-muted-foreground hover:bg-muted/80">−</button>
            <button onClick={() => addWater(1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors" style={{ background: "hsl(200 80% 50% / 0.2)", color: "hsl(200 80% 60%)" }}>+</button>
          </div>
        </div>
        <div className="flex gap-0.5 mt-2">
          {Array.from({ length: WATER_GOAL }).map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full transition-all" style={{ background: i < water ? "hsl(200 80% 55%)" : "hsl(0 0% 14%)" }} />
          ))}
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 gap-3">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="rounded-xl p-4 transition-all duration-200 cursor-pointer group"
              style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}40`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(0 0% 14%)"; }}>
              <span className="text-2xl mb-2 block">{item.icon}</span>
              <p className="font-bold text-foreground text-sm">{item.label}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
