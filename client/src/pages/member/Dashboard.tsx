import { useAuthStore } from "@/store/auth";
import {
  useGetMemberCurrentSubscription, useListCheckins, useListExerciseLogs,
  getGetMemberCurrentSubscriptionQueryKey, getListCheckinsQueryKey, getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect } from "react";
import { Link } from "wouter";

const GOLD = "hsl(40 65% 52%)";
const QUOTES = [
  "النجاح ليس نهائيًا، والفشل ليس قاتلًا — الشجاعة للاستمرار هي ما يهم.",
  "جسمك يستطيع تحمّل أي شيء تقريبًا — عليك إقناع عقلك فقط.",
  "لا تتوقف عندما تتعب، توقف عندما تنتهي.",
  "التمرين الوحيد السيئ هو التمرين الذي لم تؤده.",
  "كل تكرار يقربك من هدفك.",
  "الألم مؤقت، والفخر دائم.",
];

function ProgressRing({ percent, size = 80, stroke = 6, color = GOLD }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(0 0% 14%)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
    </svg>
  );
}

export default function MemberDashboard() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";
  const today = new Date().toISOString().split("T")[0];

  const { data: sub, isLoading } = useGetMemberCurrentSubscription(userId, {
    query: { queryKey: getGetMemberCurrentSubscriptionQueryKey(userId), enabled: !!userId },
  });
  const { data: checkins } = useListCheckins({ userId }, { query: { queryKey: getListCheckinsQueryKey({ userId }), enabled: !!userId } });
  const { data: exerciseLogs } = useListExerciseLogs({ userId }, { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } });

  const [workouts, setWorkouts] = useState<any[]>([]);
  useEffect(() => {
    customFetch<any[]>("/api/my-workouts").then(d => setWorkouts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const subData = sub as any;
  const isActive = subData?.status === "active";
  const daysLeft = subData?.endDate ? Math.max(0, Math.ceil((new Date(subData.endDate).getTime() - Date.now()) / 86400000)) : null;
  const totalDays = subData?.startDate && subData?.endDate ? Math.ceil((new Date(subData.endDate).getTime() - new Date(subData.startDate).getTime()) / 86400000) : null;
  const subPercent = totalDays && daysLeft !== null ? Math.round(((totalDays - daysLeft) / totalDays) * 100) : 0;

  const checkinList: any[] = Array.isArray(checkins) ? checkins : (checkins as any)?.data ?? [];
  const logList: any[] = Array.isArray(exerciseLogs) ? exerciseLogs : (exerciseLogs as any)?.data ?? [];
  const todayLogs = logList.filter((l: any) => l.date === today);

  // Attendance streak
  const sortedCheckins = [...checkinList].sort((a: any, b: any) => new Date(b.date ?? b.timestamp ?? "").getTime() - new Date(a.date ?? a.timestamp ?? "").getTime());
  let streak = 0;
  const streakDate = new Date();
  for (const c of sortedCheckins) {
    const cd = new Date(c.date ?? c.timestamp ?? "").toDateString();
    if (cd === streakDate.toDateString()) { streak++; streakDate.setDate(streakDate.getDate() - 1); }
    else if (cd === new Date(streakDate.getTime() - 86400000).toDateString()) { streak++; streakDate.setDate(streakDate.getDate() - 1); }
    else break;
  }

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور";

  // Recent weights — last logged per exercise
  const recentWeights: { name: string; weight: number; date: string }[] = [];
  const seen = new Set<string>();
  for (const l of logList) {
    const name = l.exercise?.name ?? "";
    if (name && !seen.has(name)) { seen.add(name); recentWeights.push({ name, weight: parseFloat(l.weight), date: l.date }); }
    if (recentWeights.length >= 4) break;
  }

  // Total exercises for today's template
  const totalExToday = workouts.flatMap((w: any) => w.exercises ?? []).length;
  const uniqueExDone = new Set(todayLogs.map((l: any) => l.exerciseId)).size;

  const quoteIndex = Math.floor(Date.now() / 86400000) % QUOTES.length;

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-8">
      {/* Welcome header */}
      <div className="relative overflow-hidden rounded-2xl p-6" style={{ background: "linear-gradient(135deg, hsl(0 0% 8%), hsl(0 0% 6%))", border: "1px solid hsl(40 65% 48% / 0.2)" }}>
        <div className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-10" style={{ background: "radial-gradient(circle, hsl(40 65% 48%), transparent)", filter: "blur(30px)" }} />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(40 65% 42%), hsl(40 65% 32%))", color: "hsl(40 65% 80%)", boxShadow: "0 4px 20px hsl(40 65% 48% / 0.25)" }}>
            {user?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: GOLD }}>{greeting} 👋</p>
            <h1 className="text-xl font-black text-foreground truncate">{user?.name}</h1>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
        </div>
        {/* Motivational quote */}
        <p className="text-xs mt-4 leading-relaxed relative z-10" style={{ color: "hsl(40 30% 60%)" }}>
          "{QUOTES[quoteIndex]}"
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3.5 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <p className="text-2xl font-black" style={{ color: GOLD }}>{streak}</p>
          <p className="text-xs text-muted-foreground mt-0.5">أيام متتالية 🔥</p>
        </div>
        <div className="rounded-xl p-3.5 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <p className="text-2xl font-black text-green-400">{checkinList.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي الحضور</p>
        </div>
        <div className="rounded-xl p-3.5 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <p className="text-2xl font-black" style={{ color: "hsl(220 70% 65%)" }}>{todayLogs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">سجلات اليوم</p>
        </div>
      </div>

      {/* Subscription progress ring */}
      {subData && (
        <div className="rounded-xl p-5 flex items-center gap-5" style={{ background: "hsl(0 0% 9%)", border: `1px solid ${isActive ? "hsl(142 60% 50% / 0.2)" : "hsl(0 60% 50% / 0.2)"}` }}>
          <div className="relative flex-shrink-0">
            <ProgressRing percent={subPercent} color={isActive ? "hsl(142 60% 50%)" : "hsl(0 60% 50%)"} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-black text-foreground">{daysLeft ?? 0}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-foreground text-sm truncate">{subData.subscription?.name ?? "—"}</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                {isActive ? "نشط" : "منتهي"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isActive && daysLeft !== null ? `باقي ${daysLeft} يوم من ${totalDays}` : "انتهى الاشتراك"}
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(0 0% 14%)" }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${subPercent}%`, background: isActive ? "hsl(142 60% 50%)" : "hsl(0 60% 50%)" }} />
            </div>
          </div>
        </div>
      )}

      {/* Today's workout summary */}
      {workouts.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(40 65% 48% / 0.15)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">تمرين اليوم</h2>
            <Link href="/member/log">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD }}>
                ابدأ الجلسة ←
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-shrink-0">
              <ProgressRing percent={totalExToday > 0 ? (uniqueExDone / totalExToday) * 100 : 0} size={50} stroke={4} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">{uniqueExDone}/{totalExToday}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-foreground font-medium">{workouts[0]?.name}</p>
              <p className="text-xs text-muted-foreground">{uniqueExDone === 0 ? "لم تبدأ بعد" : uniqueExDone >= totalExToday ? "مكتملة! 🎉" : "قيد التنفيذ..."}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent weights */}
      {recentWeights.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <h2 className="text-sm font-bold text-foreground mb-3">آخر الأوزان المسجلة</h2>
          <div className="grid grid-cols-2 gap-2">
            {recentWeights.map((w) => (
              <div key={w.name} className="rounded-lg p-3" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}>
                <p className="text-xs text-muted-foreground truncate">{w.name}</p>
                <p className="text-lg font-black mt-0.5" style={{ color: GOLD }}>{w.weight} <span className="text-xs font-normal text-muted-foreground">كجم</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "برنامج التمارين", desc: "اطلع على تمارينك", href: "/member/workouts", icon: "🏋️" },
          { label: "سجّل أداءك", desc: "ابدأ جلسة التمرين", href: "/member/log", icon: "📝" },
          { label: "قياساتك", desc: "تابع الوزن والدهون", href: "/member/stats", icon: "📊" },
          { label: "سجل الحضور", desc: "تاريخ حضورك", href: "/member/attendance", icon: "📅" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="rounded-xl p-4 transition-all duration-200 cursor-pointer group"
              style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(40 65% 48% / 0.4)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(0 0% 15%)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
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
