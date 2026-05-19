import { useState, useEffect } from "react";
import { Link } from "wouter";
import { customFetch } from "@/api-client/custom-fetch";
import ExerciseVideoButton from "@/components/ExerciseVideoButton";

interface TemplateExercise {
  id: number;
  exerciseId: number;
  sets: number;
  reps: number;
  dayNumber: number;
  sortOrder: number;
  exerciseName: string;
  targetMuscle: string;
  videoUrl: string | null;
  notes: string | null;
  restSeconds: number | null;
}

interface AssignedTemplate {
  id: number;
  name: string;
  daysCount: number;
  daysPerWeek: number;
  dayNames: string | null;
  notes: string | null;
  assignedAt: string;
  exercises: TemplateExercise[];
}

const MUSCLE_COLORS: Record<string, string> = {
  صدر: "#e74c3c",
  ظهر: "#3498db",
  أكتاف: "#2ecc71",
  بايسبس: "#f39c12",
  ترايسبس: "#e67e22",
  أرجل: "#9b59b6",
  بطن: "#1abc9c",
  كارديو: "#e91e63",
  أخرى: "#95a5a6",
};

function getDayName(t: AssignedTemplate, dayNum: number): string {
  if (t.dayNames) {
    try {
      const n = JSON.parse(t.dayNames);
      if (n[dayNum]) return n[dayNum];
    } catch {}
  }
  return `يوم ${dayNum}`;
}

function TemplateCard({ t }: { t: AssignedTemplate }) {
  const [activeDay, setActiveDay] = useState(1);
  const dayExercises = t.exercises.filter((ex) => ex.dayNumber === activeDay);

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div
        className="p-5 border-b border-border"
        style={{ background: "linear-gradient(135deg, hsl(40 65% 48% / 0.08), transparent)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">{t.name}</h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              {t.daysCount} يوم · {t.daysPerWeek} مرات/أسبوع · {t.exercises.length} تمرين
            </p>
          </div>
          <Link href="/member/log">
            <button
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: "hsl(40 65% 48%)", color: "#000" }}
            >
              سجّل أداء
            </button>
          </Link>
        </div>

        {t.daysCount > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
            {Array.from({ length: t.daysCount }).map((_, i) => {
              const day = i + 1;
              const count = t.exercises.filter((ex) => ex.dayNumber === day).length;
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeDay === day
                      ? "text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  style={activeDay === day ? { background: "hsl(40 65% 48%)", color: "#000" } : {}}
                >
                  {getDayName(t, day)} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-5">
        {dayExercises.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">لا توجد تمارين لهذا اليوم</p>
        ) : (
          dayExercises.map((ex, i) => {
            const color = MUSCLE_COLORS[ex.targetMuscle] ?? "#95a5a6";
            return (
              <div key={ex.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: `${color}20`, color }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{ex.exerciseName}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {ex.sets} مجموعات × {ex.reps} تكرار
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: `${color}15`, color }}
                    >
                      {ex.targetMuscle}
                    </span>
                    {ex.restSeconds && (
                      <span className="text-xs text-muted-foreground">⏱ {ex.restSeconds}ث</span>
                    )}
                  </div>
                  {ex.notes && <p className="text-xs text-muted-foreground mt-1 italic">💡 {ex.notes}</p>}
                </div>
                <ExerciseVideoButton url={ex.videoUrl} title={ex.exerciseName} variant="thumb" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function MemberWorkouts() {
  const [templates, setTemplates] = useState<AssignedTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<AssignedTemplate[]>("/api/my-workouts")
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">تمريناتي</h1>
          <p className="text-muted-foreground text-sm">القوالب المعيّنة لك من المدرب</p>
        </div>
        {/* Quick link to the member's own builder. Routed via wouter <Link> so
            it doesn't trigger a full reload on mobile. */}
        <Link href="/member/my-workouts">
          <button
            className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
              color: "hsl(0 0% 5%)",
            }}
          >
            + برنامج خاص بي
          </button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl p-5 space-y-3"
              style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 rounded bg-muted animate-pulse" />
                <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-8 w-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="h-4 rounded bg-muted animate-pulse"
                    style={{ width: `${80 - j * 15}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-10 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-12 h-12 mx-auto mb-4 text-muted-foreground"
          >
            <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" />
            <circle cx="6.5" cy="6.5" r="1.5" />
            <circle cx="6.5" cy="17.5" r="1.5" />
            <circle cx="17.5" cy="6.5" r="1.5" />
            <circle cx="17.5" cy="17.5" r="1.5" />
          </svg>
          <p className="text-foreground font-medium mb-1">لم يتم تعيين تمارين لك بعد</p>
          <p className="text-muted-foreground text-sm mb-4">تواصل مع المدرب — أو أنشئ برنامجك الخاص بنفسك</p>
          <Link href="/member/my-workouts">
            <button
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                color: "hsl(0 0% 5%)",
              }}
            >
              + إنشاء برنامج
            </button>
          </Link>
        </div>
      ) : (
        templates.map((t) => <TemplateCard key={t.id} t={t} />)
      )}
    </div>
  );
}
