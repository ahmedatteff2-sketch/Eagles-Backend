import { useAuthStore } from "@/store/auth";
import {
  useLogExercise, useListExerciseLogs, useDeleteExerciseLog,
  getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@/api-client/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/hooks/use-pull-refresh";
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

function getDayName(t: AssignedTemplate, dayNum: number): string {
  if (t.dayNames) {
    try { const n = JSON.parse(t.dayNames); if (n[dayNum]) return n[dayNum]; } catch {}
  }
  return `يوم ${dayNum}`;
}

const GOLD = "hsl(40 65% 52%)";

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
            {ex.restSeconds && <span className="text-xs text-muted-foreground">· ⏱ {ex.restSeconds}ث</span>}
          </div>
          {ex.notes && <p className="text-xs text-muted-foreground mb-1 italic">💡 {ex.notes}</p>}
          <SetBadge done={done} total={total} />
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <ExerciseVideoButton url={ex.videoUrl} title={ex.exerciseName} variant="chip" />
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

function PRCelebration({ exerciseName, weight, prevMax, onClose }: { exerciseName: string; weight: number; prevMax: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50" onClick={onClose}>
      <div className="text-center px-6" onClick={e => e.stopPropagation()}>
        <div className="text-6xl mb-4 animate-bounce">🏆</div>
        <h2 className="text-2xl font-black text-foreground mb-1">رقم شخصي جديد!</h2>
        <p className="text-lg font-bold mb-2" style={{ color: "hsl(40 65% 52%)" }}>{exerciseName}</p>
        <div className="flex items-center justify-center gap-4 mb-4">
          {prevMax > 0 && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">السابق</p>
              <p className="text-lg text-muted-foreground line-through">{prevMax} كجم</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xs" style={{ color: "hsl(40 65% 52%)" }}>الجديد</p>
            <p className="text-3xl font-black" style={{ color: "hsl(40 65% 52%)" }}>{weight} كجم</p>
          </div>
        </div>
        {prevMax > 0 && (
          <p className="text-sm text-green-400 font-bold">↑ +{(weight - prevMax).toFixed(1)} كجم</p>
        )}
        <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground">تمام 💪</button>
      </div>
    </div>
  );
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.5);
    }, 200);
  } catch { /* silent fallback */ }
}

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    let beeped = false;
    const tick = setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 3 && !beeped) { beeped = true; playBeep(); }
      if (remaining <= 0) { clearInterval(tick); playBeep(); onDoneRef.current(); return; }
      setLeft(remaining);
    }, 200);
    return () => clearInterval(tick);
  }, [seconds]);
  const pct = ((seconds - left) / seconds) * 100;
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onDone}>
      <div className="text-center" onClick={e => e.stopPropagation()}>
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(0 0% 20%)" strokeWidth="6" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(40 65% 52%)" strokeWidth="6"
              strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - pct / 100)}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-black text-foreground tabular-nums">{mins}:{secs.toString().padStart(2, '0')}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-3">راحة بين المجموعات</p>
        <button onClick={onDone} className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground">تخطي</button>
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

  const [templates, setTemplates] = useState<AssignedTemplate[]>([]);
  const [activeTemplateIdx, setActiveTemplateIdx] = useState(0);
  const [activeDay, setActiveDay] = useState(1);
  const [quickLog, setQuickLog] = useState<QuickLogState | null>(null);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loaded, setLoaded] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [prCelebration, setPrCelebration] = useState<{ exerciseName: string; weight: number; prevMax: number } | null>(null);

  // Session timer
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [sessionRating, setSessionRating] = useState(3);

  useEffect(() => {
    if (!sessionStart) return;
    const t = setInterval(() => setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

  function formatTimer(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  }

  function endSession() {
    setShowRating(true);
  }

  function submitRating() {
    customFetch("/api/session-rating", {
      method: "POST",
      body: JSON.stringify({ rating: sessionRating, date: logDate }),
    }).catch(() => {});
    toast({ title: "تم تقييم الجلسة" });
    setShowRating(false);
    setSessionStart(null);
    setSessionElapsed(0);
  }

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
  const logList: any[] = Array.isArray(logs) ? logs : [];
  const logExercise = useLogExercise();
  const deleteLog = useDeleteExerciseLog();

  // ── Month & week helpers ────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);
  const monthName = monthStart.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });

  // 4 weeks of the current month
  function getWeekRanges() {
    const weeks: { label: string; start: Date; end: Date; num: number }[] = [];
    const d = new Date(monthStart);
    let wn = 1;
    while (d <= monthEnd && wn <= 5) {
      const wStart = new Date(d);
      const wEnd = new Date(d);
      wEnd.setDate(wEnd.getDate() + 6);
      if (wEnd > monthEnd) wEnd.setTime(monthEnd.getTime());
      weeks.push({ label: `أسبوع ${wn}`, start: wStart, end: wEnd, num: wn });
      d.setDate(d.getDate() + 7);
      wn++;
    }
    return weeks;
  }
  const weeks = getWeekRanges();

  // Current week number
  const todayDate = new Date();
  const currentWeekIdx = weeks.findIndex(w => todayDate >= w.start && todayDate <= w.end);

  // Logs for current month
  const monthLogs = logList.filter((l: any) => {
    const ld = new Date(l.date);
    return ld >= monthStart && ld <= monthEnd;
  });

  // Get logs for a specific exercise in a specific week
  function getWeekLogs(exerciseId: number, week: typeof weeks[0]) {
    const ws = week.start.toISOString().split("T")[0];
    const we = week.end.toISOString().split("T")[0];
    return monthLogs.filter((l: any) => l.exerciseId === exerciseId && l.date >= ws && l.date <= we);
  }

  // Best weight for an exercise in a week
  function getWeekBestWeight(exerciseId: number, week: typeof weeks[0]): number | null {
    const wl = getWeekLogs(exerciseId, week);
    if (wl.length === 0) return null;
    return Math.max(...wl.map((l: any) => parseFloat(l.weight) || 0));
  }

  function getWeekSetsCount(exerciseId: number, week: typeof weeks[0]): number {
    return getWeekLogs(exerciseId, week).length;
  }

  function openQuickLog(ex: TemplateExercise, weekIdx: number) {
    const week = weeks[weekIdx];
    const wLogs = getWeekLogs(ex.exerciseId, week);
    const nextSet = wLogs.length + 1;
    const lastW = wLogs.length > 0 ? parseFloat(wLogs[wLogs.length - 1].weight) || 0 : 0;
    // Pick a date within this week for logging
    const today = new Date().toISOString().split("T")[0];
    const ws = week.start.toISOString().split("T")[0];
    const we = week.end.toISOString().split("T")[0];
    const dateForLog = today >= ws && today <= we ? today : ws;
    setLogDate(dateForLog);
    setQuickLog({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      totalSets: ex.sets,
      targetReps: ex.reps,
      weight: lastW,
      reps: ex.reps,
      setNumber: Math.min(nextSet, ex.sets),
    });
  }

  function handleLog() {
    if (!quickLog) return;
    const currentEx = allExercises.find(e => e.exerciseId === quickLog.exerciseId);
    const restSecs = currentEx?.restSeconds ?? 90;
    const isLastSet = quickLog.setNumber >= quickLog.totalSets;
    logExercise.mutate(
      { data: { exerciseId: quickLog.exerciseId, setNumber: quickLog.setNumber, reps: quickLog.reps, weight: quickLog.weight, date: logDate } },
      {
        onSuccess: (data: any) => {
          haptic(data?.isPR ? 50 : 15);
          queryClient.invalidateQueries({ queryKey: getListExerciseLogsQueryKey({ userId }) });
          if (data?.isPR) {
            setPrCelebration({ exerciseName: quickLog.exerciseName, weight: quickLog.weight, prevMax: data.previousMax ?? 0 });
            toast({ title: `🏆 رقم شخصي جديد! ${quickLog.weight} كجم` });
          } else {
            toast({ title: `✓ مجموعة ${quickLog.setNumber} تم تسجيلها` });
          }
          setQuickLog(null);
          if (restSecs > 0 && !data?.isPR) {
            setRestTimer(restSecs);
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

  if (loaded && templates.length === 0) {
    return (
      <div className="p-3 sm:p-6">
        <div className="bg-card border border-card-border rounded-xl p-6 sm:p-10 text-center">
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
      {/* Session Timer Bar */}
      <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: sessionStart ? "hsl(40 65% 48% / 0.08)" : "hsl(0 0% 9%)", border: `1px solid ${sessionStart ? "hsl(40 65% 48% / 0.2)" : "hsl(0 0% 14%)"}` }}>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{sessionStart ? "الجلسة جارية" : "ابدأ جلسة التمرين"}</p>
          {sessionStart && <p className="text-lg font-black tabular-nums" style={{ color: GOLD }}>{formatTimer(sessionElapsed)}</p>}
        </div>
        {!sessionStart ? (
          <button onClick={() => setSessionStart(Date.now())} className="px-4 py-2 rounded-xl text-xs font-bold transition-colors" style={{ background: GOLD, color: "#000" }}>▶ بدء</button>
        ) : (
          <button onClick={endSession} className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 hover:bg-red-500/20 transition-colors">■ إنهاء</button>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">سجل التمرين الشهري</h1>
        <p className="text-muted-foreground text-sm">{monthName} · سجّل أوزانك كل أسبوع</p>
      </div>

      {/* Template selector */}
      {templates.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {templates.map((t, i) => (
            <button key={t.id} onClick={() => { setActiveTemplateIdx(i); setActiveDay(1); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                i === activeTemplateIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}>{t.name}</button>
          ))}
        </div>
      )}

      {/* Day tabs */}
      {activeTemplate && (activeTemplate.daysCount > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: activeTemplate.daysCount }).map((_, i) => {
            const day = i + 1;
            return (
              <button key={day} onClick={() => setActiveDay(day)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeDay === day ? "text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={activeDay === day ? { background: "hsl(40 65% 48%)", color: "#000" } : {}}>
                {getDayName(activeTemplate, day)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl px-4 py-2.5">
          <p className="text-sm font-bold text-foreground">{activeTemplate.name}</p>
        </div>
      ))}

      {/* Template notes */}
      {activeTemplate?.notes && (
        <div className="rounded-lg px-3 py-2" style={{ background: "hsl(40 65% 48% / 0.08)", border: "1px solid hsl(40 65% 48% / 0.15)" }}>
          <p className="text-xs" style={{ color: "hsl(40 65% 60%)" }}>💡 {activeTemplate.notes}</p>
        </div>
      )}

      {/* ═══ Monthly Table: Exercises × Weeks ═══ */}
      {exList.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">لا توجد تمارين في هذا اليوم</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exList.map((ex) => {
            const color = MUSCLE_COLORS[ex.targetMuscle] ?? "#95a5a6";
            return (
              <div key={ex.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                {/* Exercise header */}
                <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${color}20`, color }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{ex.exerciseName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{ex.sets}×{ex.reps}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{ex.targetMuscle}</span>
                      {ex.restSeconds ? <span className="text-xs text-muted-foreground">⏱ {ex.restSeconds}ث</span> : null}
                    </div>
                  </div>
                  <ExerciseVideoButton
                    url={ex.videoUrl}
                    title={ex.exerciseName}
                    variant="icon"
                    style={{ background: `${color}15`, color }}
                  />
                </div>
                {ex.notes && (
                  <div className="px-4 py-1.5" style={{ background: "hsl(0 0% 7%)", borderBottom: "1px solid hsl(0 0% 13%)" }}>
                    <p className="text-xs text-muted-foreground italic">💡 {ex.notes}</p>
                  </div>
                )}
                {/* Weeks grid */}
                <div className="grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
                  {weeks.map((week, wi) => {
                    const bestW = getWeekBestWeight(ex.exerciseId, week);
                    const setsCount = getWeekSetsCount(ex.exerciseId, week);
                    const isDone = setsCount >= ex.sets;
                    const isCurrent = wi === currentWeekIdx;
                    const wLogs = getWeekLogs(ex.exerciseId, week);

                    return (
                      <div key={wi}
                        className={`text-center py-3 px-1 cursor-pointer transition-all hover:bg-white/5 ${wi > 0 ? "border-r" : ""}`}
                        style={{
                          borderColor: "hsl(0 0% 13%)",
                          background: isCurrent ? "hsl(40 65% 48% / 0.04)" : "transparent",
                        }}
                        onClick={() => !isDone && openQuickLog(ex, wi)}>
                        {/* Week label */}
                        <p className={`text-xs font-bold mb-1.5 ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                          {week.label}
                        </p>
                        {/* Weight display */}
                        {bestW !== null ? (
                          <>
                            <p className={`text-lg font-black tabular-nums ${isDone ? "text-green-400" : "text-foreground"}`}>
                              {bestW}
                            </p>
                            <p className="text-xs text-muted-foreground">كجم</p>
                            <div className="flex justify-center gap-0.5 mt-1.5">
                              {Array.from({ length: ex.sets }).map((_, si) => (
                                <div key={si} className={`w-2 h-2 rounded-full ${si < setsCount ? "bg-green-400" : "bg-muted"}`} />
                              ))}
                            </div>
                            {/* Show per-set details */}
                            {wLogs.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {wLogs.map((l: any, li: number) => (
                                  <p key={li} className="text-xs text-muted-foreground tabular-nums">
                                    {parseFloat(l.weight)}×{l.reps}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-2">
                            <div className="w-8 h-8 mx-auto rounded-full flex items-center justify-center"
                              style={{ border: isCurrent ? "2px dashed hsl(40 65% 48% / 0.5)" : "2px dashed hsl(0 0% 20%)" }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke={isCurrent ? "hsl(40 65% 48%)" : "hsl(0 0% 25%)"} strokeWidth={2} className="w-3.5 h-3.5">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">سجّل</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Weight Progression Summary ═══ */}
      {exList.length > 0 && (() => {
        const progressData = exList.map(ex => {
          const weekWeights = weeks.map(w => getWeekBestWeight(ex.exerciseId, w));
          const filled = weekWeights.filter(w => w !== null) as number[];
          const progression = filled.length >= 2 ? filled[filled.length - 1] - filled[0] : 0;
          return { name: ex.exerciseName, weekWeights, progression };
        }).filter(d => d.weekWeights.some(w => w !== null));

        if (progressData.length === 0) return null;
        return (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
              <p className="text-sm font-bold text-foreground">📈 تطور الأوزان هذا الشهر</p>
            </div>
            <div className="divide-y" style={{ borderColor: "hsl(0 0% 13%)" }}>
              {progressData.map(d => (
                <div key={d.name} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{d.name}</p>
                    <div className="flex gap-2 mt-1">
                      {d.weekWeights.map((w, i) => (
                        <span key={i} className={`text-xs tabular-nums ${w !== null ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                          {w !== null ? `${w}` : "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                  {d.progression !== 0 && (
                    <span className={`text-xs font-bold flex-shrink-0 ${d.progression > 0 ? "text-green-400" : "text-red-400"}`}>
                      {d.progression > 0 ? "↑" : "↓"}{Math.abs(d.progression).toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {prCelebration && (
        <PRCelebration {...prCelebration} onClose={() => setPrCelebration(null)} />
      )}
      {quickLog && (
        <QuickLogPanel state={quickLog} onChange={setQuickLog} onSubmit={handleLog} onClose={() => setQuickLog(null)} isPending={logExercise.isPending} />
      )}
      {restTimer !== null && (
        <RestTimer seconds={restTimer} onDone={() => setRestTimer(null)} />
      )}

      {/* Session Rating Modal */}
      {showRating && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowRating(false)}>
          <div className="bg-card rounded-2xl p-6 w-[85vw] max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground text-center mb-1">كيف كانت الجلسة؟</h2>
            <p className="text-xs text-muted-foreground text-center mb-4">
              مدة الجلسة: <span className="font-bold" style={{ color: GOLD }}>{formatTimer(sessionElapsed)}</span>
            </p>
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map(r => (
                <button key={r} onClick={() => setSessionRating(r)}
                  className={`w-11 h-11 rounded-xl text-lg font-bold transition-all ${
                    r <= sessionRating ? "" : "bg-muted text-muted-foreground"
                  }`}
                  style={r <= sessionRating ? { background: GOLD, color: "#000" } : {}}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2 text-xs text-muted-foreground mb-4">
              <span>سهلة</span><span>·</span><span>متوسطة</span><span>·</span><span>صعبة</span>
            </div>
            <button onClick={submitRating} className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold transition-colors">
              حفظ التقييم
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
