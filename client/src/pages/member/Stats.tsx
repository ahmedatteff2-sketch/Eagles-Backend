import { useAuthStore } from "@/store/auth";
import {
  useListBodyStats, useCreateBodyStat, useDeleteBodyStat,
  getListBodyStatsQueryKey, useListExerciseLogs, getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@/api-client/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";

const GOLD = "hsl(40 65% 52%)";
const MUSCLE_COLORS: Record<string, string> = {
  "صدر": "#e74c3c", "ظهر": "#3498db", "أكتاف": "#2ecc71",
  "بايسبس": "#f39c12", "ترايسبس": "#e67e22", "أرجل": "#9b59b6",
  "بطن": "#1abc9c", "كارديو": "#e91e63", "أخرى": "#95a5a6",
};

interface PR { exerciseId: number; exerciseName: string; targetMuscle: string; maxWeight: number; maxReps: number; date: string; totalSets: number; }

const statSchema = z.object({
  date: z.string().min(1),
  weight: z.coerce.number().optional(),
  bodyFat: z.coerce.number().optional(),
  dietNote: z.string().optional(),
  performanceNote: z.string().optional(),
});
type StatForm = z.infer<typeof statSchema>;

export default function MemberStats() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bodyStats, isLoading } = useListBodyStats(
    { userId },
    { query: { queryKey: getListBodyStatsQueryKey({ userId }), enabled: !!userId } }
  );

  const createStat = useCreateBodyStat();
  const deleteStat = useDeleteBodyStat();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StatForm>({
    resolver: zodResolver(statSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0] },
  });

  function onSubmit(data: StatForm) {
    createStat.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "تم تسجيل القياسات" });
        queryClient.invalidateQueries({ queryKey: getListBodyStatsQueryKey({ userId }) });
        reset({ date: new Date().toISOString().split("T")[0] });
      },
      onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteStat.mutate({ statId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBodyStatsQueryKey({ userId }) });
      },
    });
  }

  // PRs
  const [prs, setPrs] = useState<PR[]>([]);
  useEffect(() => {
    if (!userId) return;
    customFetch<PR[]>(`/api/personal-records?userId=${userId}`)
      .then(d => setPrs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [userId]);

  // Exercise logs for weight progression
  const { data: exerciseLogs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } }
  );
  const logList: any[] = Array.isArray(exerciseLogs) ? exerciseLogs : [];

  // Top exercises by volume for chart
  const exerciseChartData = useMemo(() => {
    const byExercise: Record<string, { name: string; logs: any[] }> = {};
    logList.forEach((l: any) => {
      const name = l.exercise?.name ?? "—";
      if (!byExercise[name]) byExercise[name] = { name, logs: [] };
      byExercise[name].logs.push(l);
    });
    // Top 5 exercises by number of logs
    return Object.values(byExercise)
      .sort((a, b) => b.logs.length - a.logs.length)
      .slice(0, 5)
      .map(ex => {
        // Group by date, get max weight per date
        const byDate: Record<string, number> = {};
        ex.logs.forEach((l: any) => {
          const w = parseFloat(l.weight) || 0;
          if (!byDate[l.date] || w > byDate[l.date]) byDate[l.date] = w;
        });
        const points = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, weight]) => ({
            date: new Date(date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
            weight,
          }));
        return { name: ex.name, points };
      });
  }, [logList]);

  // Weekly volume chart
  const weeklyVolume = useMemo(() => {
    const byWeek: Record<string, number> = {};
    logList.forEach((l: any) => {
      const d = new Date(l.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0];
      byWeek[key] = (byWeek[key] || 0) + (parseFloat(l.weight) || 0) * (l.reps || 0);
    });
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, volume]) => ({
        week: new Date(date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
        volume: Math.round(volume),
      }));
  }, [logList]);

  const [tab, setTab] = useState<"body" | "weights" | "prs">("body");

  const statList = Array.isArray(bodyStats) ? bodyStats : (bodyStats as any)?.stats ?? [];
  const chartData = statList
    .slice()
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((s: any) => ({
      date: new Date(s.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
      weight: s.weight,
      bodyFat: s.bodyFat,
    }))
    .filter((d: any) => d.weight || d.bodyFat);

  const [selectedExChart, setSelectedExChart] = useState(0);
  const TIP_STYLE = { background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 8, color: "hsl(0 0% 90%)" };

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">القياسات والأرقام</h1>
        <p className="text-muted-foreground text-sm">قياسات الجسم · تطور الأوزان · الأرقام الشخصية</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([["body", "قياسات الجسم"], ["weights", "تطور الأوزان"], ["prs", "🏆 الأرقام"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === key ? "text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={tab === key ? { background: GOLD, color: "#000" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══ Body Stats Tab ═══ */}
      {tab === "body" && (
        <>
          {/* Chart */}
          {chartData.length > 1 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">تطور القياسات</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={TIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="weight" stroke={GOLD} strokeWidth={2} dot={true} name="الوزن (كجم)" />
                  <Line type="monotone" dataKey="bodyFat" stroke="#e74c3c" strokeWidth={2} dot={true} name="الدهون (%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Add stat form */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">إضافة قياس جديد</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">التاريخ</label>
                <input {...register("date")} type="date" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">الوزن (كجم)</label>
                  <input {...register("weight")} type="number" step={0.1} placeholder="75.5" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">الدهون (%)</label>
                  <input {...register("bodyFat")} type="number" step={0.1} placeholder="18.5" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">ملاحظات التغذية</label>
                <textarea {...register("dietNote")} rows={2} placeholder="سعرات حرارية، وجبات..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">ملاحظات الأداء</label>
                <textarea {...register("performanceNote")} rows={2} placeholder="شعرت بالقوة، زدت الوزن..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <button type="submit" disabled={createStat.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                {createStat.isPending ? "جاري الحفظ..." : "حفظ القياس"}
              </button>
            </form>
          </div>

          {/* History */}
          {statList.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">سجل القياسات</h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="py-3 border-b border-border last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-10 rounded bg-muted animate-pulse" />
                      </div>
                      <div className="flex gap-4">
                        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {statList.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((s: any) => (
                    <div key={s.id} className="py-3 border-b border-border last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-foreground">{new Date(s.date).toLocaleDateString("ar-EG", { weekday: "short", month: "short", day: "numeric" })}</p>
                        <button onClick={() => handleDelete(s.id)} className="text-xs text-destructive hover:underline">حذف</button>
                      </div>
                      <div className="flex gap-4">
                        {s.weight && <span className="text-sm font-bold" style={{ color: GOLD }}>{s.weight} كجم</span>}
                        {s.bodyFat && <span className="text-red-400 text-sm font-bold">{s.bodyFat}% دهون</span>}
                      </div>
                      {s.dietNote && <p className="text-muted-foreground text-xs mt-1">التغذية: {s.dietNote}</p>}
                      {s.performanceNote && <p className="text-muted-foreground text-xs">الأداء: {s.performanceNote}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ Weight Progression Tab ═══ */}
      {tab === "weights" && (
        <>
          {/* Weekly volume bar chart */}
          {weeklyVolume.length > 1 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">الحجم التدريبي الأسبوعي</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={TIP_STYLE} formatter={(v: any) => [`${v.toLocaleString()} كجم`, "الحجم"]} />
                  <Bar dataKey="volume" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-exercise weight progression */}
          {exerciseChartData.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
                <h2 className="text-sm font-semibold text-foreground mb-2">تطور الأوزان لكل تمرين</h2>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {exerciseChartData.map((ex, i) => (
                    <button key={ex.name} onClick={() => setSelectedExChart(i)}
                      className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        i === selectedExChart ? "text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      style={i === selectedExChart ? { background: GOLD, color: "#000" } : {}}>
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>
              {exerciseChartData[selectedExChart]?.points.length > 1 && (
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={exerciseChartData[selectedExChart].points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={TIP_STYLE} formatter={(v: any) => [`${v} كجم`, "الوزن"]} />
                      <Line type="monotone" dataKey="weight" stroke={GOLD} strokeWidth={2.5} dot={{ fill: GOLD, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {logList.length === 0 && (
            <div className="bg-card border border-card-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm">لا يوجد سجل تمارين بعد — ابدأ بتسجيل أوزانك</p>
            </div>
          )}
        </>
      )}

      {/* ═══ Personal Records Tab ═══ */}
      {tab === "prs" && (
        <>
          {prs.length === 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-foreground font-medium mb-1">لا يوجد أرقام شخصية بعد</p>
              <p className="text-muted-foreground text-sm">سجّل تمارينك لتظهر أرقامك هنا</p>
            </div>
          ) : (
            <>
              {/* Top 3 PRs hero */}
              <div className="grid grid-cols-3 gap-2">
                {prs.slice(0, 3).map((pr, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={pr.exerciseId} className="bg-card border border-card-border rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">{medals[i]}</div>
                      <p className="text-xl font-black tabular-nums" style={{ color: GOLD }}>{pr.maxWeight}</p>
                      <p className="text-xs text-muted-foreground">كجم</p>
                      <p className="text-xs font-semibold text-foreground truncate mt-1">{pr.exerciseName}</p>
                    </div>
                  );
                })}
              </div>

              {/* Full PRs list */}
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
                  <p className="text-sm font-bold text-foreground">كل الأرقام الشخصية</p>
                </div>
                <div className="divide-y" style={{ borderColor: "hsl(0 0% 13%)" }}>
                  {prs.map(pr => {
                    const color = MUSCLE_COLORS[pr.targetMuscle] ?? "#95a5a6";
                    return (
                      <div key={pr.exerciseId} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}20` }}>
                          <span className="text-lg font-black" style={{ color }}>{pr.maxWeight}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{pr.exerciseName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{pr.targetMuscle}</span>
                            <span className="text-xs text-muted-foreground">{pr.maxReps} تكرار</span>
                            <span className="text-xs text-muted-foreground">· {new Date(pr.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}</span>
                          </div>
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="text-lg font-black tabular-nums" style={{ color: GOLD }}>{pr.maxWeight}</p>
                          <p className="text-xs text-muted-foreground">كجم</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
