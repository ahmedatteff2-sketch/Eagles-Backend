import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GOLD } from "./helpers";
import { TemplateCardAdmin } from "./TemplateCardAdmin";

interface ExerciseLog {
  id: number;
  exercise?: { name?: string };
  setNumber: number;
  reps: number;
  weight: string;
  date: string;
}

interface AssignedTemplate {
  id: number;
  name: string;
  daysCount?: number;
  exercises?: Array<{
    id: number;
    exerciseName: string;
    targetMuscle: string;
    sets: number;
    reps: number | string;
    dayNumber?: number;
  }>;
  assignmentId: number;
}

interface Props {
  memberTemplates: AssignedTemplate[];
  logsByExercise: Record<string, ExerciseLog[]>;
  recentLogs: ExerciseLog[];
  totalLogCount: number;
  onAssignTemplate: () => void;
  onUnassignTemplate: (assignmentId: number) => void;
}

/**
 * "Training" tab body — assigned templates with day-tabs, weight
 * progression chart for the first exercise that has logs, per-exercise
 * weight summaries, and the most recent set-level logs.
 */
export function TrainingTab({
  memberTemplates,
  logsByExercise,
  recentLogs,
  totalLogCount,
  onAssignTemplate,
  onUnassignTemplate,
}: Props) {
  const exerciseNames = Object.keys(logsByExercise);
  const selectedExName = exerciseNames[0] ?? null;

  let progressData: Array<{ date: string; "أقصى وزن": number }> = [];
  if (selectedExName) {
    const exLogs = logsByExercise[selectedExName] ?? [];
    progressData = [...exLogs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .reduce<Array<{ date: string; "أقصى وزن": number }>>((acc, l) => {
        const dateStr = new Date(l.date).toLocaleDateString("ar-EG", {
          month: "short",
          day: "numeric",
        });
        const w = parseFloat(l.weight);
        const existing = acc.find((d) => d.date === dateStr);
        if (existing) {
          if (w > existing["أقصى وزن"]) existing["أقصى وزن"] = w;
        } else {
          acc.push({ date: dateStr, "أقصى وزن": w });
        }
        return acc;
      }, []);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onAssignTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
          style={{
            background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
            color: "hsl(0 0% 5%)",
          }}
        >
          + تعيين قالب تمرين
        </button>
      </div>

      {memberTemplates.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-10">لا توجد قوالب تمرين معيّنة</p>
      ) : (
        <div className="grid gap-3">
          {memberTemplates.map((t) => {
            const daysCount = t.daysCount ?? 1;
            const exercises = t.exercises ?? [];
            return (
              <TemplateCardAdmin
                key={t.id}
                t={t}
                daysCount={daysCount}
                exercises={exercises}
                onUnassign={() => onUnassignTemplate(t.assignmentId)}
              />
            );
          })}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">سجل أوزان التمارين</h2>
        {totalLogCount === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">لا يوجد سجل أوزان بعد</p>
        ) : (
          <>
            {selectedExName && progressData.length > 1 && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">تطور الأوزان — {selectedExName}</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(0 0% 10%)",
                        border: "1px solid hsl(0 0% 18%)",
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="أقصى وزن"
                      stroke={GOLD}
                      strokeWidth={2}
                      dot={{ fill: GOLD, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {exerciseNames.slice(0, 10).map((name) => {
                const eLogs = logsByExercise[name];
                const maxW = Math.max(...eLogs.map((l) => parseFloat(l.weight)));
                const lastLog = eLogs[0];
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {eLogs.length} سجل · أقصى وزن: {maxW} كجم
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold" style={{ color: GOLD }}>
                        {parseFloat(lastLog.weight)} كجم
                      </p>
                      <p className="text-xs text-muted-foreground">آخر تسجيل</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className="text-xs font-semibold text-muted-foreground mb-2">آخر التسجيلات</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">التمرين</th>
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">سيت</th>
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">تكرار</th>
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">الوزن</th>
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="py-2 px-2 font-medium text-foreground">{l.exercise?.name ?? "—"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{l.setNumber}</td>
                      <td className="py-2 px-2 text-muted-foreground">{l.reps}</td>
                      <td className="py-2 px-2 font-bold" style={{ color: GOLD }}>
                        {parseFloat(l.weight)} كجم
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {new Date(l.date).toLocaleDateString("ar-EG", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
