import { useAuthStore } from "@/store/auth";
import {
  useLogExercise, useListExerciseLogs, useDeleteExerciseLog,
  getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@/api-client/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

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
}

interface AssignedTemplate {
  id: number;
  name: string;
  daysCount: number;
  daysPerWeek: number;
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
        <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i < done ? "bg-primary scale-110" : "bg-muted"}`} />
      ))}
    </div>
  );
}

function RestTimer({ onDone }: { onDone: () => void }) {
  const [seconds, setSeconds] = useState(90);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0 && running) {
      setRunning(false);
      try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1sZWJy").play(); } catch {}
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, seconds]);

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const pct = ((90 - seconds) / 90) * 100;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 flex justify-center">
      <div className="bg-card border border-primary/30 rounded-2xl px-5 py-3.5 shadow-xl flex items-center gap-4 max-w-sm w-full"
        style={{ backdropFilter: "blur(12px)" }}>
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(0 0% 14%)" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={seconds === 0 ? "hsl(142 60% 50%)" : "hsl(40 65% 52%)"} strokeWidth="3"
              strokeDasharray={125.6} strokeDashoffset={125.6 - (pct / 100) * 125.6} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
            {min}:{sec.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">{seconds === 0 ? "وقت الراحة انتهى!" : "استراحة"}</p>
          <p className="text-xs text-muted-foreground">بين المجموعات</p>
        </div>
        <div className="flex gap-2">
          {seconds > 0 && (
            <button onClick={() => { setSeconds(s => Math.max(0, s - 30)); }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80">-30</button>
          )}
          <button onClick={onDone}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold">
            {seconds === 0 ? "ابدأ" : "تخطي"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ["#C9A84C", "#4CAF50", "#FF5252", "#448AFF", "#FF9800", "#E040FB"];
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const dur = 1.5 + Math.random();
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        return (
          <div key={i} className="absolute" style={{
            left: `${left}%`, top: "-10px", width: size, height: size, borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            background: color, opacity: 0.9,
            animation: `confettiFall ${dur}s ease-in ${delay}s forwards`,
          }} />
        );
      })}
      <style>{`@keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(${360 + Math.random()*360}deg);opacity:0} }`}</style>
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
  const progressPct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-all relative overflow-hidden ${
        isComplete ? "border-green-500/30 bg-green-500/5" : "border-card-border bg-card hover:border-primary/40 cursor-pointer"
      }`}
      onClick={() => !isComplete && onLog(ex, nextSet, lastWeight)}
    >
      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "hsl(0 0% 12%)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: isComplete ? "hsl(142 60% 50%)" : "hsl(40 65% 52%)" }} />
      </div>
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
  const [activeDay, setActiveDay] = useState(1);
  const [quickLog, setQuickLog] = useState<QuickLogState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevSessionComplete = useRef(false);

  useEffect(() => {
    customFetch<AssignedTemplate[]>("/api/my-workouts")
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoaded(true));
  }, []);

  const activeTemplate = templates[activeTemplateIdx] ?? null;
  const allExercises = activeTemplate?.exercises ?? [];
  const exList = allExercises.filter((ex) => ex.dayNumber === activeDay);

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
          // Show rest timer if not last set of last exercise
          if (quickLog.setNumber < quickLog.totalSets) {
            setShowRestTimer(true);
          }
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

  // Show confetti when session just completed
  useEffect(() => {
    if (sessionComplete && !prevSessionComplete.current) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
    prevSessionComplete.current = sessionComplete;
  }, [sessionComplete]);

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
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">🏆</div>
              <p className="text-green-400 font-black text-lg">أحسنت! أتممت كل التمارين</p>
              <p className="text-green-400/70 text-sm mt-1">تم إكمال {exList.length} تمرين · {todayLogs.length} مجموعة</p>
            </div>
          ) : todayLogs.length > 0 ? (
            <div className="rounded-xl p-3" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(40 65% 48% / 0.2)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-foreground"><span className="font-bold" style={{ color: "hsl(40 65% 52%)" }}>{todayDoneCount}</span> تمارين تمت اليوم</p>
                <span className="text-xs text-muted-foreground">{exList.length - todayDoneCount} متبقية</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(0 0% 14%)" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${exList.length > 0 ? (todayDoneCount / exList.length) * 100 : 0}%`, background: "linear-gradient(90deg, hsl(40 65% 48%), hsl(40 65% 58%))" }} />
              </div>
            </div>
          ) : null}

          {/* Template selector */}
          {templates.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">القالب الحالي</p>
              <p className="font-bold text-foreground mb-3">{activeTemplate?.name}</p>
              {templates.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                  {templates.map((t, i) => (
                    <button key={t.id} onClick={() => { setActiveTemplateIdx(i); setActiveDay(1); }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        i === activeTemplateIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>{t.name}</button>
                  ))}
                </div>
              )}
              {(activeTemplate?.daysCount ?? 1) > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: activeTemplate!.daysCount }).map((_, i) => {
                    const day = i + 1;
                    const count = allExercises.filter((ex) => ex.dayNumber === day).length;
                    return (
                      <button key={day} onClick={() => setActiveDay(day)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          activeDay === day ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}>
                        يوم {day} <span className="opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {exList.length === 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm">لا توجد تمارين في هذا اليوم</p>
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
        <div className="space-y-3">
          {/* Weight progression per exercise */}
          {logList.length > 0 && (() => {
            const byEx: Record<string, any[]> = {};
            logList.forEach((l: any) => {
              const name = l.exercise?.name ?? "—";
              if (!byEx[name]) byEx[name] = [];
              byEx[name].push(l);
            });
            return (
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-foreground mb-3">تطور الأوزان</h2>
                <div className="space-y-2">
                  {Object.entries(byEx).slice(0, 10).map(([name, logs]) => {
                    const maxW = Math.max(...logs.map((l: any) => parseFloat(l.weight)));
                    const lastW = parseFloat(logs[0].weight);
                    const firstW = parseFloat(logs[logs.length - 1].weight);
                    const diff = lastW - firstW;
                    return (
                      <div key={name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{name}</p>
                          <p className="text-xs text-muted-foreground">{logs.length} سجل · أقصى: {maxW} كجم</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-primary">{lastW} كجم</p>
                          {diff !== 0 && (
                            <p className={`text-xs font-medium ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
                              {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toFixed(1)} كجم
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Raw log entries */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border"><h2 className="text-sm font-semibold text-foreground">آخر التسجيلات</h2></div>
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
        </div>
      )}

      {quickLog && (
        <QuickLogPanel state={quickLog} onChange={setQuickLog} onSubmit={handleLog} onClose={() => setQuickLog(null)} isPending={logExercise.isPending} />
      )}
      {showRestTimer && !quickLog && <RestTimer onDone={() => setShowRestTimer(false)} />}
      {showConfetti && <Confetti />}
    </div>
  );
}
