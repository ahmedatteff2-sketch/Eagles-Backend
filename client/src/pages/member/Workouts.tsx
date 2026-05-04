import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { Link } from "wouter";
import {
  useListTrainingPrograms, useGetTrainingProgram,
  getListTrainingProgramsQueryKey, getGetTrainingProgramQueryKey,
} from "@workspace/api-client-react";

function ExerciseRow({ ex, index }: { ex: any; index: number }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{
          background: "linear-gradient(135deg, hsl(40 65% 30%), hsl(40 65% 22%))",
          color: "hsl(40 65% 65%)",
        }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm">{ex.name}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
              <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" />
            </svg>
            {ex.setsRequired} مجموعات
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            </svg>
            {ex.repsMin}–{ex.repsMax} تكرار
          </span>
        </div>
      </div>
      {ex.videoUrl && (
        <a
          href={ex.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
          style={{ background: "hsl(40 65% 48% / 0.12)", color: "hsl(40 65% 60%)" }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          فيديو
        </a>
      )}
    </div>
  );
}

function ProgramCard({ programId }: { programId: number }) {
  const [activeWeek, setActiveWeek] = useState(0);
  const { data: program, isLoading } = useGetTrainingProgram(programId, {
    query: { queryKey: getGetTrainingProgramQueryKey(programId) },
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-6 text-center text-muted-foreground text-sm">
        جاري التحميل...
      </div>
    );
  }

  const prog = program as any;
  const weeks: any[] = prog?.weeks ?? [];
  const currentWeek = weeks[activeWeek];
  const exercises: any[] = currentWeek?.exercises ?? [];
  const totalExercises = weeks.reduce((acc: number, w: any) => acc + (w.exercises?.length ?? 0), 0);

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      {/* Program header */}
      <div className="p-5 border-b border-border" style={{ background: "linear-gradient(135deg, hsl(40 65% 48% / 0.08), transparent)" }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-foreground">{prog?.name}</h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              {weeks.length} أسبوع · {totalExercises} تمرين إجمالاً
            </p>
          </div>
          <Link href="/member/log">
            <button
              className="px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              style={{ background: "hsl(40 65% 48%)", color: "#000" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              ابدأ الجلسة
            </button>
          </Link>
        </div>

        {/* Week pills */}
        {weeks.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weeks.map((w: any, i: number) => (
              <button
                key={w.id}
                onClick={() => setActiveWeek(i)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  i === activeWeek
                    ? "text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={i === activeWeek ? { background: "hsl(40 65% 48%)", color: "#000" } : {}}
              >
                الأسبوع {w.weekNumber}
                <span className="mr-1.5 opacity-70">({w.exercises?.length ?? 0})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Exercises list */}
      <div className="px-5">
        {exercises.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">لا توجد تمارين لهذا الأسبوع</p>
        ) : (
          exercises.map((ex: any, i: number) => (
            <ExerciseRow key={ex.id} ex={ex} index={i} />
          ))
        )}
      </div>

      {exercises.length > 0 && (
        <div className="px-5 py-3 border-t border-border">
          <Link href="/member/log">
            <button className="w-full py-2.5 rounded-lg text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/5 transition-colors">
              سجّل أداء هذه التمارين
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MemberWorkouts() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";

  const { data: programs, isLoading } = useListTrainingPrograms(
    { userId },
    { query: { queryKey: getListTrainingProgramsQueryKey({ userId }), enabled: !!userId } }
  );

  const programList = Array.isArray(programs) ? programs : (programs as any)?.programs ?? [];

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">برنامج التدريب</h1>
        <p className="text-muted-foreground text-sm">تمارينك وخطتك التدريبية</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : programList.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-10 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mx-auto mb-4 text-muted-foreground">
            <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" />
            <circle cx="6.5" cy="6.5" r="1.5" /><circle cx="6.5" cy="17.5" r="1.5" />
            <circle cx="17.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" />
          </svg>
          <p className="text-foreground font-medium mb-1">لم يتم تعيين برنامج تدريبي بعد</p>
          <p className="text-muted-foreground text-sm">تواصل مع المسؤول لإنشاء برنامجك</p>
        </div>
      ) : (
        programList.map((p: any) => (
          <ProgramCard key={p.id} programId={p.id} />
        ))
      )}
    </div>
  );
}
