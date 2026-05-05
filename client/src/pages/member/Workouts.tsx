import { useState, useEffect } from "react";
import { Link } from "wouter";
import { customFetch } from "@/api-client/custom-fetch";

interface TemplateExercise {
  id: number;
  exerciseId: number;
  sets: number;
  reps: number;
  weekNumber: number;
  dayNumber: number;
  sortOrder: number;
  exerciseName: string;
  targetMuscle: string;
  videoUrl: string | null;
}

interface AssignedTemplate {
  id: number;
  name: string;
  daysCount: number;
  daysPerWeek: number;
  weeksCount: number;
  assignedAt: string;
  exercises: TemplateExercise[];
}

const MUSCLE_COLORS: Record<string, string> = {
  "صدر": "#e74c3c", "ظهر": "#3498db", "أكتاف": "#2ecc71",
  "بايسبس": "#f39c12", "ترايسبس": "#e67e22", "أرجل": "#9b59b6",
  "بطن": "#1abc9c", "كارديو": "#e91e63", "أخرى": "#95a5a6",
};

function TemplateCard({ t }: { t: AssignedTemplate }) {
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(1);
  const weekExercises = t.exercises.filter((ex) => ex.weekNumber === activeWeek);
  const dayExercises = weekExercises.filter((ex) => ex.dayNumber === activeDay);

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border" style={{ background: "linear-gradient(135deg, hsl(40 65% 48% / 0.08), transparent)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">{t.name}</h2>
            <p className="text-muted-foreground text-xs mt-0.5">{t.weeksCount} أسبوع · {t.daysCount} يوم/أسبوع · {t.daysPerWeek} مرات/أسبوع · {t.exercises.length} تمرين</p>
          </div>
          <Link href="/member/log">
            <button className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "hsl(40 65% 48%)", color: "#000" }}>
              سجّل أداء
            </button>
          </Link>
        </div>

        {/* Week tabs */}
        {(t.weeksCount ?? 1) > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
            {Array.from({ length: t.weeksCount }).map((_, i) => {
              const week = i + 1;
              const count = t.exercises.filter((ex) => ex.weekNumber === week).length;
              return (
                <button key={week} onClick={() => { setActiveWeek(week); setActiveDay(1); }}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeWeek === week ? "text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  style={activeWeek === week ? { background: "hsl(40 65% 48%)", color: "#000" } : {}}>
                  أسبوع {week} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Day tabs */}
        {t.daysCount > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
            {Array.from({ length: t.daysCount }).map((_, i) => {
              const day = i + 1;
              const count = weekExercises.filter((ex) => ex.dayNumber === day).length;
              return (
                <button key={day} onClick={() => setActiveDay(day)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeDay === day ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}>
                  يوم {day} <span className="opacity-70">({count})</span>
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
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: `${color}20`, color }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{ex.exerciseName}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{ex.sets} مجموعات × {ex.reps} تكرار</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{ex.targetMuscle}</span>
                  </div>
                </div>
                {ex.videoUrl && (
                  <a href={ex.videoUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                    style={{ background: "hsl(40 65% 48% / 0.12)", color: "hsl(40 65% 60%)" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    فيديو
                  </a>
                )}
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
      <div>
        <h1 className="text-xl font-bold text-foreground">تمريناتي</h1>
        <p className="text-muted-foreground text-sm">القوالب المعيّنة لك من المدرب</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-10 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mx-auto mb-4 text-muted-foreground">
            <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" />
            <circle cx="6.5" cy="6.5" r="1.5" /><circle cx="6.5" cy="17.5" r="1.5" />
            <circle cx="17.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" />
          </svg>
          <p className="text-foreground font-medium mb-1">لم يتم تعيين تمارين لك بعد</p>
          <p className="text-muted-foreground text-sm">تواصل مع المدرب لتعيين قالب تمرين</p>
        </div>
      ) : (
        templates.map((t) => <TemplateCard key={t.id} t={t} />)
      )}
    </div>
  );
}
