import { useState } from "react";
import { MUSCLE_COLORS } from "./helpers";

interface Exercise {
  id: number;
  exerciseName: string;
  targetMuscle: string;
  sets: number;
  reps: number | string;
  dayNumber?: number;
}

interface Template {
  id: number;
  name: string;
}

interface Props {
  t: Template;
  daysCount: number;
  exercises: Exercise[];
  onUnassign: () => void;
}

/**
 * Card showing one workout template assigned to the member, with a
 * day-tab strip (only rendered when daysCount > 1) and the per-day
 * exercise list. The unassign button sits in the header.
 */
export function TemplateCardAdmin({ t, daysCount, exercises, onUnassign }: Props) {
  const [day, setDay] = useState(1);
  const dayExercises = daysCount > 1 ? exercises.filter((ex) => ex.dayNumber === day) : exercises;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-semibold text-foreground">{t.name}</p>
          <p className="text-xs text-muted-foreground">
            {daysCount} يوم · {exercises.length} تمرين
          </p>
        </div>
        <button
          onClick={onUnassign}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: "hsl(0 60% 50% / 0.1)", color: "hsl(0 60% 60%)" }}
        >
          إلغاء التعيين
        </button>
      </div>
      {daysCount > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
          {Array.from({ length: daysCount }).map((_, i) => {
            const d = i + 1;
            const count = exercises.filter((ex) => ex.dayNumber === d).length;
            return (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  day === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                يوم {d} ({count})
              </button>
            );
          })}
        </div>
      )}
      {dayExercises.length > 0 ? (
        <div className="space-y-1">
          {dayExercises.map((ex, i) => {
            const color = MUSCLE_COLORS[ex.targetMuscle] ?? "#95a5a6";
            return (
              <div key={ex.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-xs font-bold text-foreground">{i + 1}.</span>
                <span>{ex.exerciseName}</span>
                <span className="text-xs">
                  ({ex.sets}×{ex.reps})
                </span>
                <span className="text-xs px-1 py-0.5 rounded" style={{ background: `${color}15`, color }}>
                  {ex.targetMuscle}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">لا توجد تمارين في يوم {day}</p>
      )}
    </div>
  );
}
