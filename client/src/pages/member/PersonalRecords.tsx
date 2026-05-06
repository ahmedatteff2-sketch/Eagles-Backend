import { useAuthStore } from "@/store/auth";
import { useListExerciseLogs, getListExerciseLogsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";

const GOLD = "hsl(40 65% 52%)";

function calc1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10; // Epley formula
}

export default function PersonalRecords() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";
  const { data: logs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } }
  );
  const logList: any[] = Array.isArray(logs) ? logs : [];

  // Build PR map
  const prMap: Record<string, { name: string; maxWeight: number; maxReps: number; estimated1RM: number; date: string; totalSets: number }> = {};
  logList.forEach((l: any) => {
    const name = l.exerciseName ?? l.exercise?.name ?? `Exercise ${l.exerciseId}`;
    const w = parseFloat(l.weight) || 0;
    const r = l.reps ?? 0;
    if (!prMap[name]) prMap[name] = { name, maxWeight: 0, maxReps: 0, estimated1RM: 0, date: "", totalSets: 0 };
    prMap[name].totalSets++;
    if (w > prMap[name].maxWeight) {
      prMap[name].maxWeight = w;
      prMap[name].date = l.date;
    }
    if (r > prMap[name].maxReps) prMap[name].maxReps = r;
    const est = calc1RM(w, r);
    if (est > prMap[name].estimated1RM) prMap[name].estimated1RM = est;
  });

  const records = Object.values(prMap).sort((a, b) => b.maxWeight - a.maxWeight);

  // 1RM Calculator
  const [calcWeight, setCalcWeight] = useState(0);
  const [calcReps, setCalcReps] = useState(1);
  const est1RM = calc1RM(calcWeight, calcReps);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">🏆 الأرقام الشخصية</h1>
        <p className="text-muted-foreground text-sm">أفضل أوزان وصلت لها</p>
      </div>

      {/* 1RM Calculator */}
      <div className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
        <h2 className="text-sm font-bold text-foreground mb-3">📊 حاسبة 1RM</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">الوزن (كجم)</label>
            <input type="number" min={0} value={calcWeight || ""} onChange={e => setCalcWeight(Number(e.target.value))}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">التكرارات</label>
            <input type="number" min={1} value={calcReps} onChange={e => setCalcReps(Number(e.target.value))}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        {calcWeight > 0 && (
          <div className="text-center p-3 rounded-lg" style={{ background: "hsl(40 65% 48% / 0.08)" }}>
            <p className="text-xs text-muted-foreground">أقصى وزن تقديري (1RM)</p>
            <p className="text-2xl font-black" style={{ color: GOLD }}>{est1RM} كجم</p>
            <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>75%: {Math.round(est1RM * 0.75)} كجم</span>
              <span>85%: {Math.round(est1RM * 0.85)} كجم</span>
              <span>90%: {Math.round(est1RM * 0.9)} كجم</span>
            </div>
          </div>
        )}
      </div>

      {/* PR Table */}
      {records.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <p className="text-3xl mb-2">🏋️</p>
          <p className="text-muted-foreground text-sm">سجّل تمارين لرؤية أرقامك الشخصية</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((pr, i) => (
            <div key={pr.name} className="rounded-xl p-3.5 flex items-center gap-3"
              style={{ background: "hsl(0 0% 9%)", border: `1px solid ${i < 3 ? "hsl(40 65% 48% / 0.2)" : "hsl(0 0% 14%)"}` }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
                style={{ background: i === 0 ? `${GOLD}25` : i === 1 ? "hsl(0 0% 70% / 0.12)" : i === 2 ? "hsl(25 60% 45% / 0.12)" : "hsl(0 0% 14%)",
                  color: i === 0 ? GOLD : i === 1 ? "hsl(0 0% 75%)" : i === 2 ? "hsl(25 60% 55%)" : "hsl(0 0% 50%)" }}>
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{pr.name}</p>
                <p className="text-xs text-muted-foreground">{pr.totalSets} مجموعة · 1RM: {pr.estimated1RM} كجم</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-black" style={{ color: GOLD }}>{pr.maxWeight}</p>
                <p className="text-[10px] text-muted-foreground">كجم</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
