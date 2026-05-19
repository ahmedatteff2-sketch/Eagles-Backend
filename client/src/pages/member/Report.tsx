import { useAuthStore } from "@/store/auth";
import { useListExerciseLogs, getListExerciseLogsQueryKey } from "@workspace/api-client-react";
import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOLD = "hsl(40 65% 52%)";

type Period = "week" | "month" | "all";

function StatBox({
  label,
  value,
  sub,
  color = GOLD,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function MemberReport() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";
  const [period, setPeriod] = useState<Period>("week");

  const { data: logs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } },
  );
  const logList: any[] = Array.isArray(logs) ? logs : [];

  const [checkins, setCheckins] = useState<any[]>([]);
  useEffect(() => {
    if (!userId) return;
    customFetch<any[]>(`/api/checkins?userId=${userId}`)
      .then((d) => setCheckins(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [userId]);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtered = useMemo(() => {
    if (period === "all") return logList;
    const cutoff = period === "week" ? weekStart : monthStart;
    return logList.filter((l: any) => new Date(l.date) >= cutoff);
  }, [logList, period]);

  const filteredCheckins = useMemo(() => {
    if (period === "all") return checkins;
    const cutoff = period === "week" ? weekStart : monthStart;
    return checkins.filter((c: any) => new Date(c.timestamp || c.createdAt) >= cutoff);
  }, [checkins, period]);

  // Stats
  const totalSets = filtered.length;
  const totalVolume = filtered.reduce(
    (sum: number, l: any) => sum + (parseFloat(l.weight) || 0) * (l.reps || 0),
    0,
  );
  const uniqueDays = new Set(filtered.map((l: any) => l.date)).size;
  const uniqueExercises = new Set(filtered.map((l: any) => l.exerciseId)).size;
  const attendanceDays = filteredCheckins.length;

  // Per-exercise breakdown
  const byExercise = useMemo(() => {
    const map: Record<string, { name: string; logs: any[]; maxWeight: number; totalVolume: number }> = {};
    filtered.forEach((l: any) => {
      const name = l.exercise?.name ?? "—";
      if (!map[name]) map[name] = { name, logs: [], maxWeight: 0, totalVolume: 0 };
      map[name].logs.push(l);
      const w = parseFloat(l.weight) || 0;
      if (w > map[name].maxWeight) map[name].maxWeight = w;
      map[name].totalVolume += w * (l.reps || 0);
    });
    return Object.values(map).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [filtered]);

  // Week-over-week comparison
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const thisWeekLogs = logList.filter((l: any) => new Date(l.date) >= weekStart);
  const prevWeekLogs = logList.filter((l: any) => {
    const d = new Date(l.date);
    return d >= prevWeekStart && d < weekStart;
  });
  const thisWeekVol = thisWeekLogs.reduce(
    (s: number, l: any) => s + (parseFloat(l.weight) || 0) * (l.reps || 0),
    0,
  );
  const prevWeekVol = prevWeekLogs.reduce(
    (s: number, l: any) => s + (parseFloat(l.weight) || 0) * (l.reps || 0),
    0,
  );
  const volDiff = prevWeekVol > 0 ? ((thisWeekVol - prevWeekVol) / prevWeekVol) * 100 : 0;

  const periods: { key: Period; label: string }[] = [
    { key: "week", label: "هذا الأسبوع" },
    { key: "month", label: "هذا الشهر" },
    { key: "all", label: "الكل" },
  ];

  function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const periodLabel = periods.find((p) => p.key === period)?.label ?? "";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Training Report - ${user?.name ?? ""}`, 105, 20, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(periodLabel, 105, 28, { align: "center" });

    // Summary table
    autoTable(doc, {
      startY: 35,
      head: [["Metric", "Value"]],
      body: [
        ["Sessions", String(uniqueDays)],
        ["Total Sets", String(totalSets)],
        ["Total Volume (kg x reps)", totalVolume.toLocaleString()],
        ["Unique Exercises", String(uniqueExercises)],
        ["Attendance Days", String(attendanceDays)],
      ],
      theme: "grid",
      headStyles: { fillColor: [180, 140, 50] },
    });

    // Exercise breakdown
    if (byExercise.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 80;
      autoTable(doc, {
        startY: finalY + 10,
        head: [["Exercise", "Sets", "Max Weight (kg)", "Last Weight (kg)", "Change"]],
        body: byExercise.map((ex) => {
          const firstW = parseFloat(ex.logs[ex.logs.length - 1].weight) || 0;
          const lastW = parseFloat(ex.logs[0].weight) || 0;
          const diff = lastW - firstW;
          return [
            ex.name,
            String(ex.logs.length),
            String(ex.maxWeight),
            String(lastW),
            diff !== 0 ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "-",
          ];
        }),
        theme: "grid",
        headStyles: { fillColor: [180, 140, 50] },
      });
    }

    doc.save(`training-report-${new Date().toISOString().split("T")[0]}.pdf`);
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">التقرير التدريبي</h1>
          <p className="text-muted-foreground text-sm">ملخص أدائك وتطور أوزانك</p>
        </div>
        <button
          onClick={exportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PDF
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === p.key
                ? "text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={period === p.key ? { background: GOLD, color: "#000" } : {}}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="عدد الجلسات" value={uniqueDays} sub={`${attendanceDays} حضور`} />
        <StatBox label="إجمالي المجموعات" value={totalSets} />
        <StatBox
          label="إجمالي الحجم"
          value={totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}K` : totalVolume.toLocaleString()}
          sub="كجم × تكرار"
        />
        <StatBox label="تمارين مختلفة" value={uniqueExercises} />
      </div>

      {/* Week comparison */}
      {period === "week" && (
        <div
          className="rounded-xl p-4"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
        >
          <p className="text-xs text-muted-foreground mb-2">مقارنة بالأسبوع السابق</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">هذا الأسبوع</span>
                <span className="text-sm font-bold text-foreground">{thisWeekVol.toLocaleString()} كجم</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    background: GOLD,
                    width: `${Math.min(100, prevWeekVol > 0 ? (thisWeekVol / Math.max(thisWeekVol, prevWeekVol)) * 100 : 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">الأسبوع السابق</span>
                <span className="text-sm font-bold text-foreground">{prevWeekVol.toLocaleString()} كجم</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    background: "hsl(0 0% 40%)",
                    width: `${Math.min(100, thisWeekVol > 0 ? (prevWeekVol / Math.max(thisWeekVol, prevWeekVol)) * 100 : 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
          {prevWeekVol > 0 && (
            <p className={`text-xs font-bold mt-2 ${volDiff >= 0 ? "text-green-400" : "text-red-400"}`}>
              {volDiff >= 0 ? "↑" : "↓"} {Math.abs(volDiff).toFixed(1)}% {volDiff >= 0 ? "زيادة" : "نقص"}
            </p>
          )}
        </div>
      )}

      {/* Per-exercise breakdown */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      >
        <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
          <p className="text-sm font-bold text-foreground">تفاصيل التمارين</p>
        </div>
        {byExercise.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">لا يوجد سجل في هذه الفترة</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "hsl(0 0% 13%)" }}>
            {byExercise.map((ex) => {
              const firstW = parseFloat(ex.logs[ex.logs.length - 1].weight) || 0;
              const lastW = parseFloat(ex.logs[0].weight) || 0;
              const diff = lastW - firstW;
              return (
                <div key={ex.name} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{ex.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ex.logs.length} مجموعة · أقصى: {ex.maxWeight} كجم
                    </p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: GOLD }}>
                      {lastW} كجم
                    </p>
                    {diff !== 0 && ex.logs.length > 1 && (
                      <p className={`text-xs font-medium ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
                        {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toFixed(1)} كجم
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Personal records */}
      {byExercise.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
        >
          <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
            <p className="text-sm font-bold text-foreground">🏆 أفضل أوزانك</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: "hsl(0 0% 13%)" }}>
            {byExercise.slice(0, 6).map((ex) => (
              <div key={ex.name} className="px-3 py-3 text-center" style={{ background: "hsl(0 0% 9%)" }}>
                <p className="text-lg font-black" style={{ color: GOLD }}>
                  {ex.maxWeight}
                </p>
                <p className="text-xs text-muted-foreground truncate">{ex.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
