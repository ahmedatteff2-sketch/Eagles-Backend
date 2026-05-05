import { useAuthStore } from "@/store/auth";
import {
  useLogExercise, useListExerciseLogs, useDeleteExerciseLog,
  getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@/api-client/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface TemplateExercise {
  id: number;
  exerciseId: number;
  sets: number;
  reps: number;
  sortOrder: number;
  exerciseName: string;
  targetMuscle: string;
  videoUrl: string | null;
}

interface AssignedTemplate {
  id: number;
  name: string;
  exercises: TemplateExercise[];
}

interface QuickLogState {
  exerciseId: number;
  exerciseName: string;
  totalSets: number;
  targetReps: number;
  weight: number;
  reps: number;
  setNumber: number;
}

const MUSCLE_COLORS: Record<string, string> = {
  "صدر": "#e74c3c", "ظهر": "#3498db", "أكتاف": "#2ecc71",
  "بايسبس": "#f39c12", "ترايسبس": "#e67e22", "أرجل": "#9b59b6",
  "بطن": "#1abc9c", "كارديو": "#e91e63", "أخرى": "#95a5a6",
};

function SetBadge({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < done ? "bg-primary" : "bg-muted"}`} />
      ))}
    </div>
  );
}

function ExerciseCard({
  ex,
  loggedSets,
  onLog,
}: {
  ex: TemplateExercise;
  loggedSets: any[];
  onLog: (ex: TemplateExercise, nextSet: number, lastWeight: number) => void;
}) {
  const done = loggedSets.length;
  const total = ex.sets;
  const isComplete = done >= total;
  const lastWeight = loggedSets.length > 0 ? parseFloat(loggedSets[loggedSets.length - 1].weight) : 0;
  const nextSet = Math.min(done + 1, total);
  const color = MUSCLE_COLORS[ex.targetMuscle] ?? "#95a5a6";

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isComplete ? "border-green-500/30 bg-green-500/5" : "border-card-border bg-card hover:border-primary/40 cursor-pointer"
      }`}
      onClick={() => !isComplete && onLog(ex, nextSet, lastWeight)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isComplete && (
              <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
            )}
            <p className={`font-semibold text-sm ${isComplete ? "text-muted-foreground line-through" : "text-foreground"}`}>{ex.exerciseName}</p>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-muted-foreground">{total} مجموعات × {ex.reps} تكرار</p>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{ex.targetMuscle}</span>
            {lastWeight > 0 && <span className="text-xs text-muted-foreground">· آخر وزن: {lastWeight} كجم</span>}
          </div>
          <SetBadge done={done} total={total} />
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {ex.videoUrl && (
            <a href={ex.videoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              فيديو
            </a>
          )}
          {!isComplete && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{done}/{total}</p>
              <p className="text-xs text-primary font-medium">سيت {nextSet}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLogPanel({
  state, onChange, onSubmit, onClose, isPending,
}: {
  state: QuickLogState; onChange: (s: QuickLogState) => void; onSubmit: () => void; onClose: () => void; isPending: boolean;
}) {
  function adjust(field: "weight" | "reps", delta: number) {
    const step = field === "weight" ? 2.5 : 1;
    const min = field === "weight" ? 0 : 1;
    onChange({ ...state, [field]: Math.max(min, +(state[field] + delta * step).toFixed(1)) });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-card-border rounded-t-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">تسجيل أداء</p>
            <h3 className="text-base font-bold text-foreground">{state.exerciseName}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          {Array.from({ length: state.totalSets }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < state.setNumber - 1 ? "bg-primary" : i === state.setNumber - 1 ? "bg-primary/60" : "bg-muted"}`} />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mb-6">
          المجموعة {state.setNumber} من {state.totalSets} · الهدف: {state.targetReps} تكرار
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-input rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">الوزن (كجم)</p>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => adjust("weight", -1)} className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 text-foreground font-bold text-lg transition-colors">−</button>
              <span className="text-2xl font-bold text-foreground w-16 text-center">{state.weight}</span>
              <button onClick={() => adjust("weight", 1)} className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg transition-colors">+</button>
            </div>
          </div>
          <div className="bg-input rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">التكرارات</p>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => adjust("reps", -1)} className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 text-foreground font-bold text-lg transition-colors">−</button>
              <span className="text-2xl font-bold text-foreground w-16 text-center">{state.reps}</span>
              <button onClick={() => adjust("reps", 1)} className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg transition-colors">+</button>
            </div>
          </div>
        </div>

        <button onClick={onSubmit} disabled={isPending}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3.5 rounded-xl text-base font-bold transition-colors disabled:opacity-50">
          {isPending ? "جاري التسجيل..." : `✓ تسجيل المجموعة ${state.setNumber}`}
        </button>
      </div>
    </div>
  );
}

export default function MemberLog() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];

  const [templates, setTemplates] = useState<AssignedTemplate[]>([]);
  const [activeTemplateIdx, setActiveTemplateIdx] = useState(0);
  const [quickLog, setQuickLog] = useState<QuickLogState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    customFetch<AssignedTemplate[]>("/api/my-workouts")
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoaded(true));
  }, []);

  const activeTemplate = templates[activeTemplateIdx] ?? null;
  const exList = activeTemplate?.exercises ?? [];

  const { data: logs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } }
  );
  const logList = Array.isArray(logs) ? logs : [];
  const todayLogs = logList.filter((l: any) => l.date === today);
  const logExercise = useLogExercise();
  const deleteLog = useDeleteExerciseLog();

  function openQuickLog(ex: TemplateExercise, nextSet: number, lastWeight: number) {
    setQuickLog({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      totalSets: ex.sets,
      targetReps: ex.reps,
      weight: lastWeight || 0,
      reps: ex.reps,
      setNumber: nextSet,
    });
  }

  function handleLog() {
    if (!quickLog) return;
    logExercise.mutate(
      { data: { exerciseId: quickLog.exerciseId, setNumber: quickLog.setNumber, reps: quickLog.reps, weight: quickLog.weight, date: today } },
      {
        onSuccess: () => {
          toast({ title: `✓ مجموعة ${quickLog.setNumber} تم تسجيلها` });
          queryClient.invalidateQueries({ queryKey: getListExerciseLogsQueryKey({ userId }) });
          setQuickLog(null);
        },
        onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deleteLog.mutate({ logId: id }, {
      onSuccess: () => { toast({ title: "تم حذف السجل" }); queryClient.invalidateQueries({ queryKey: getListExerciseLogsQueryKey({ userId }) }); },
    });
  }

  const todayDoneCount = new Set(todayLogs.map((l: any) => l.exerciseId)).size;
  const sessionComplete = exList.length > 0 && exList.every((ex) => {
    const done = todayLogs.filter((l: any) => l.exerciseId === ex.exerciseId).length;
    return done >= ex.sets;
  });

  if (loaded && templates.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-card border border-card-border rounded-xl p-10 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mx-auto mb-4 text-muted-foreground">
            <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" />
            <circle cx="6.5" cy="6.5" r="1.5" /><circle cx="6.5" cy="17.5" r="1.5" />
            <circle cx="17.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" />
          </svg>
          <p className="text-foreground font-medium mb-1">لم يتم تعيين تمارين لك بعد</p>
          <p className="text-muted-foreground text-sm">تواصل مع المدرب لتعيين قالب تمرين</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">جلسة التدريب</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <button onClick={() => setShowHistory(!showHistory)}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showHistory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          {showHistory ? "الجلسة" : "السجل"}
        </button>
      </div>

      {!showHistory ? (
        <>
          {sessionComplete ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <p className="text-green-400 font-bold text-base">أحسنت! أتممت كل التمارين</p>
              <p className="text-green-400/70 text-sm mt-0.5">تم إكمال {exList.length} تمرين</p>
            </div>
          ) : todayLogs.length > 0 ? (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
              <p className="text-sm text-foreground"><span className="font-bold text-primary">{todayDoneCount}</span> تمارين تمت اليوم</p>
              <span className="text-xs text-muted-foreground">{exList.length - todayDoneCount} متبقية</span>
            </div>
          ) : null}

          {/* Template selector */}
          {templates.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">القالب الحالي</p>
              <p className="font-bold text-foreground mb-3">{activeTemplate?.name}</p>
              {templates.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {templates.map((t, i) => (
                    <button key={t.id} onClick={() => setActiveTemplateIdx(i)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        i === activeTemplateIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>{t.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {exList.length === 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm">لا توجد تمارين في هذا القالب</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground px-1">اضغط على التمرين لتسجيل المجموعة</p>
              {exList.map((ex) => {
                const loggedSets = todayLogs.filter((l: any) => l.exerciseId === ex.exerciseId);
                return <ExerciseCard key={ex.id} ex={ex} loggedSets={loggedSets} onLog={openQuickLog} />;
              })}
            </div>
          )}
        </>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border"><h2 className="text-sm font-semibold text-foreground">سجل التمارين</h2></div>
          {logList.length === 0 ? (
            <div className="p-8 text-center"><p className="text-muted-foreground text-sm">لا يوجد سجل بعد</p></div>
          ) : (
            <div className="divide-y divide-border">
              {logList.slice(0, 30).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{l.exercise?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">سيت {l.setNumber} · {l.reps} تكرار · {parseFloat(l.weight)} كجم</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">{new Date(l.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}</p>
                    <button onClick={() => handleDelete(l.id)} className="text-destructive/60 hover:text-destructive transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {quickLog && (
        <QuickLogPanel state={quickLog} onChange={setQuickLog} onSubmit={handleLog} onClose={() => setQuickLog(null)} isPending={logExercise.isPending} />
      )}
    </div>
  );
}
