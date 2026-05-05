import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@/api-client/custom-fetch";

interface Exercise {
  id: number;
  name: string;
  videoUrl: string | null;
  targetMuscle: string;
}

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

interface WorkoutTemplate {
  id: number;
  name: string;
  daysCount: number;
  daysPerWeek: number;
  weeksCount: number;
  createdAt: string;
  exercises: TemplateExercise[];
  assignedCount: number;
}

interface User {
  id: string;
  name: string;
  role: string;
}

const MUSCLE_COLORS: Record<string, string> = {
  "صدر": "#e74c3c", "ظهر": "#3498db", "أكتاف": "#2ecc71",
  "بايسبس": "#f39c12", "ترايسبس": "#e67e22", "أرجل": "#9b59b6",
  "بطن": "#1abc9c", "كارديو": "#e91e63", "أخرى": "#95a5a6",
};

export default function AdminWorkoutTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create template
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDaysCount, setNewDaysCount] = useState(1);
  const [newDaysPerWeek, setNewDaysPerWeek] = useState(4);
  const [newWeeksCount, setNewWeeksCount] = useState(4);

  // Expanded template
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeWeek, setActiveWeek] = useState<Record<number, number>>({});
  const [activeDay, setActiveDay] = useState<Record<number, number>>({});

  // Add exercise to template
  const [showAddExercise, setShowAddExercise] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ exerciseId: 0, sets: 3, reps: 10 });
  const [exSearch, setExSearch] = useState("");

  // Assign to member
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [assignUserId, setAssignUserId] = useState("");

  async function fetchAll() {
    setLoading(true);
    try {
      const [t, e, u] = await Promise.all([
        customFetch<WorkoutTemplate[]>("/api/workout-templates"),
        customFetch<Exercise[]>("/api/exercises"),
        customFetch<{ data: User[] }>("/api/users?limit=500"),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setExercises(Array.isArray(e) ? e : []);
      setUsers(Array.isArray(u) ? u : (u as any)?.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function createTemplate() {
    if (!newName.trim()) return;
    try {
      await customFetch("/api/workout-templates", { method: "POST", body: JSON.stringify({ name: newName.trim(), daysCount: newDaysCount, daysPerWeek: newDaysPerWeek, weeksCount: newWeeksCount }) });
      toast({ title: "تم إنشاء القالب" });
      setShowCreateForm(false);
      setNewName("");
      setNewDaysCount(1);
      setNewDaysPerWeek(4);
      setNewWeeksCount(4);
      fetchAll();
    } catch {
      toast({ title: "فشل في الإنشاء", variant: "destructive" });
    }
  }

  async function updateDaysCount(templateId: number, daysCount: number) {
    try {
      await customFetch(`/api/workout-templates/${templateId}`, { method: "PUT", body: JSON.stringify({ daysCount }) });
      fetchAll();
    } catch {
      toast({ title: "فشل في التحديث", variant: "destructive" });
    }
  }

  async function deleteTemplate(id: number) {
    if (!confirm("تأكيد حذف القالب وكل تمارينه؟")) return;
    try {
      await customFetch(`/api/workout-templates/${id}`, { method: "DELETE" });
      toast({ title: "تم الحذف" });
      if (expandedId === id) setExpandedId(null);
      fetchAll();
    } catch {
      toast({ title: "فشل في الحذف", variant: "destructive" });
    }
  }

  async function addExerciseToTemplate(templateId: number) {
    if (!addForm.exerciseId) { toast({ title: "اختر تمرين", variant: "destructive" }); return; }
    const weekNumber = activeWeek[templateId] ?? 1;
    const dayNumber = activeDay[templateId] ?? 1;
    try {
      await customFetch(`/api/workout-templates/${templateId}/exercises`, {
        method: "POST",
        body: JSON.stringify({ exerciseId: addForm.exerciseId, sets: addForm.sets, reps: addForm.reps, weekNumber, dayNumber }),
      });
      toast({ title: "تم إضافة التمرين للقالب" });
      setShowAddExercise(null);
      setAddForm({ exerciseId: 0, sets: 3, reps: 10 });
      fetchAll();
    } catch {
      toast({ title: "فشل في الإضافة", variant: "destructive" });
    }
  }

  async function removeExerciseFromTemplate(teId: number) {
    try {
      await customFetch(`/api/workout-template-exercises/${teId}`, { method: "DELETE" });
      toast({ title: "تم الحذف" });
      fetchAll();
    } catch {
      toast({ title: "فشل", variant: "destructive" });
    }
  }

  async function assignToMember(templateId: number) {
    if (!assignUserId) return;
    try {
      await customFetch(`/api/workout-templates/${templateId}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId: assignUserId }),
      });
      toast({ title: "تم تعيين القالب للعضو" });
      setShowAssign(null);
      setAssignUserId("");
      fetchAll();
    } catch {
      toast({ title: "فشل في التعيين", variant: "destructive" });
    }
  }

  const filteredExercises = exSearch
    ? exercises.filter((e) => e.name.includes(exSearch))
    : exercises;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">قوالب التمرين</h1>
          <p className="text-muted-foreground text-sm">إنشاء قوالب تمارين مقسّمة على أيام وتعيينها للمتدربين</p>
        </div>
        <button onClick={() => setShowCreateForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          إنشاء قالب
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا توجد قوالب — أنشئ أول قالب</div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <div key={t.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                {/* Template header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {t.exercises.length}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.weeksCount} أسبوع · {t.daysCount} يوم/أسبوع · {t.daysPerWeek} مرات/أسبوع · {t.exercises.length} تمرين · {t.assignedCount} متدرب
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAssign(t.id); }}
                      className="text-xs text-primary hover:underline px-2 py-1"
                    >تعيين لعضو</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                      className="text-xs text-destructive hover:underline px-2 py-1"
                    >حذف</button>
                    <svg
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Expanded: day tabs + exercises list */}
                {isExpanded && (() => {
                  const currentWeek = activeWeek[t.id] ?? 1;
                  const currentDay = activeDay[t.id] ?? 1;
                  const weekExercises = t.exercises.filter((te) => te.weekNumber === currentWeek);
                  const dayExercises = weekExercises.filter((te) => te.dayNumber === currentDay);
                  return (
                    <div className="border-t border-border px-4 py-3 space-y-3">
                      {/* Days count control */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">عدد الأيام/أسبوع:</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => t.daysCount > 1 && updateDaysCount(t.id, t.daysCount - 1)}
                              disabled={t.daysCount <= 1}
                              className="w-6 h-6 rounded bg-muted hover:bg-muted/80 text-foreground text-xs font-bold disabled:opacity-30"
                            >−</button>
                            <span className="text-sm font-bold text-foreground w-6 text-center">{t.daysCount}</span>
                            <button
                              onClick={() => updateDaysCount(t.id, t.daysCount + 1)}
                              className="w-6 h-6 rounded bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold"
                            >+</button>
                          </div>
                        </div>
                      </div>

                      {/* Week tabs */}
                      {t.weeksCount > 1 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">الأسبوع</p>
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {Array.from({ length: t.weeksCount }).map((_, i) => {
                              const week = i + 1;
                              const count = t.exercises.filter((te) => te.weekNumber === week).length;
                              return (
                                <button
                                  key={week}
                                  onClick={() => { setActiveWeek((prev) => ({ ...prev, [t.id]: week })); setActiveDay((prev) => ({ ...prev, [t.id]: 1 })); }}
                                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    currentWeek === week
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  أسبوع {week} <span className="opacity-70">({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Day tabs */}
                      {t.daysCount > 1 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">اليوم</p>
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {Array.from({ length: t.daysCount }).map((_, i) => {
                              const day = i + 1;
                              const count = weekExercises.filter((te) => te.dayNumber === day).length;
                              return (
                                <button
                                  key={day}
                                  onClick={() => setActiveDay((prev) => ({ ...prev, [t.id]: day }))}
                                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    currentDay === day
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  يوم {day} <span className="opacity-70">({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Exercises for current week + day */}
                      {dayExercises.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-4">لا توجد تمارين في أسبوع {currentWeek} — يوم {currentDay}</p>
                      ) : (
                        dayExercises.map((te, i) => {
                          const color = MUSCLE_COLORS[te.targetMuscle] ?? "#95a5a6";
                          return (
                            <div key={te.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/20 transition-colors group">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: `${color}20`, color }}
                              >{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{te.exerciseName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{te.sets} مجموعات × {te.reps} تكرار</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{te.targetMuscle}</span>
                                </div>
                              </div>
                              {te.videoUrl && (
                                <a href={te.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex-shrink-0">فيديو</a>
                              )}
                              <button
                                onClick={() => removeExerciseFromTemplate(te.id)}
                                className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              >حذف</button>
                            </div>
                          );
                        })
                      )}
                      <button
                        onClick={() => { setShowAddExercise(t.id); setAddForm({ exerciseId: 0, sets: 3, reps: 10 }); setExSearch(""); }}
                        className="w-full py-2 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >+ إضافة تمرين لأسبوع {currentWeek} — يوم {currentDay}</button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Create template modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">إنشاء قالب تمرين</h2>
            <div className="space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم القالب — مثال: برنامج تضخيم 4 أيام"
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === "Enter" && createTemplate()}
              />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">عدد الأيام في القالب</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button key={n} onClick={() => setNewDaysCount(n)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${newDaysCount === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">عدد الأسابيع</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} onClick={() => setNewWeeksCount(n)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${newWeeksCount === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">هدف التدريب (مرات/أسبوع)</label>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5, 6, 7].map((n) => (
                    <button key={n} onClick={() => setNewDaysPerWeek(n)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${newDaysPerWeek === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={createTemplate} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold">إنشاء</button>
                <button onClick={() => setShowCreateForm(false)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add exercise to template modal */}
      {showAddExercise !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-md shadow-xl max-h-[85vh] flex flex-col">
            <h2 className="text-lg font-bold text-foreground mb-4">إضافة تمرين للقالب</h2>

            {/* Search */}
            <input
              value={exSearch}
              onChange={(e) => setExSearch(e.target.value)}
              placeholder="ابحث عن تمرين..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            />

            {/* Exercise picker */}
            <div className="overflow-y-auto flex-1 space-y-1 mb-3 max-h-48 border border-border rounded-lg p-2">
              {filteredExercises.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">لا توجد تمارين — أضف تمارين أولاً من صفحة التمارين</p>
              ) : (
                filteredExercises.map((ex) => {
                  const selected = addForm.exerciseId === ex.id;
                  const color = MUSCLE_COLORS[ex.targetMuscle] ?? "#95a5a6";
                  return (
                    <button
                      key={ex.id}
                      onClick={() => setAddForm({ ...addForm, exerciseId: ex.id })}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-right transition-colors ${
                        selected ? "bg-primary/10 border border-primary/40" : "hover:bg-muted/30"
                      }`}
                    >
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{ex.targetMuscle}</span>
                      <span className="text-sm text-foreground flex-1 truncate">{ex.name}</span>
                      {selected && <span className="text-primary text-xs">✓</span>}
                    </button>
                  );
                })
              )}
            </div>

            {/* Sets & Reps */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">المجموعات</label>
                <input
                  type="number" min={1} max={20}
                  value={addForm.sets}
                  onChange={(e) => setAddForm({ ...addForm, sets: Number(e.target.value) })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">التكرارات</label>
                <input
                  type="number" min={1} max={100}
                  value={addForm.reps}
                  onChange={(e) => setAddForm({ ...addForm, reps: Number(e.target.value) })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => addExerciseToTemplate(showAddExercise)}
                disabled={!addForm.exerciseId}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >إضافة</button>
              <button onClick={() => setShowAddExercise(null)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to member modal */}
      {showAssign !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">تعيين القالب لعضو</h2>
            <div className="space-y-3">
              <select
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر عضو</option>
                {users.filter((u) => u.role !== "admin").map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="flex gap-3">
                <button
                  onClick={() => assignToMember(showAssign)}
                  disabled={!assignUserId}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >تعيين</button>
                <button onClick={() => setShowAssign(null)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
