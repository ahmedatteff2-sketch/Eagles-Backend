import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@/api-client/custom-fetch";
import ExerciseVideoButton from "@/components/ExerciseVideoButton";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  dayNumber: number;
  sortOrder: number;
  exerciseName: string;
  targetMuscle: string;
  videoUrl: string | null;
  notes: string | null;
  restSeconds: number | null;
}

interface MyTemplate {
  id: number;
  name: string;
  daysCount: number;
  daysPerWeek: number;
  dayNames: string | null;
  notes: string | null;
  isOwn: boolean;
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

function getDayName(t: MyTemplate, dayNum: number): string {
  if (t.dayNames) {
    try {
      const n = JSON.parse(t.dayNames);
      if (n[dayNum]) return n[dayNum];
    } catch {
      // ignore — fall through to default
    }
  }
  return `يوم ${dayNum}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Member-side workout-template editor. Mirrors the admin's
 * AdminWorkoutTemplates page but scoped to the current user's own templates
 * (`isOwn: true` in /api/my-workouts). Members can:
 *   - create a personal template with name + days_count
 *   - add exercises from the global library with sets/reps/rest/notes
 *   - edit or delete exercises they added
 *   - delete templates they own
 *
 * Templates assigned by the admin still appear (read-only on this page) so
 * the member sees their full program in one place, with a clear distinction
 * between "مَن المدرب" and "أنا".
 */
export default function MemberMyWorkouts() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MyTemplate[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Create template
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDaysCount, setNewDaysCount] = useState(1);
  const [creating, setCreating] = useState(false);

  // Expanded template + active day
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<Record<number, number>>({});

  // Add-exercise form (per-template)
  const [showAddExercise, setShowAddExercise] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({
    exerciseId: 0,
    sets: 3,
    reps: 10,
    notes: "",
    restSeconds: 90,
  });
  const [exSearch, setExSearch] = useState("");

  // Create-new-exercise sub-flow (lives inside the add-exercise modal).
  // When `creatingNewEx` is true we show a tiny name/muscle/video form
  // instead of the library list. On submit we POST /api/exercises (the
  // server stamps it with the current user's id), then auto-select the
  // freshly created exercise so the user can hit "إضافة" immediately.
  const [creatingNewEx, setCreatingNewEx] = useState(false);
  const [newExForm, setNewExForm] = useState({
    name: "",
    targetMuscle: "صدر",
    videoUrl: "",
  });
  const [savingNewEx, setSavingNewEx] = useState(false);

  // Edit-exercise modal
  const [editingExercise, setEditingExercise] = useState<{
    id: number;
    sets: number;
    reps: number;
    restSeconds: number;
    notes: string;
    name: string;
  } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Both calls are authenticated; /api/exercises is the global library
      // (everyone reads, admin writes). /api/my-workouts returns assigned +
      // owned templates with the `isOwn` flag.
      const [t, e] = await Promise.all([
        customFetch<MyTemplate[]>("/api/my-workouts"),
        customFetch<Exercise[]>("/api/exercises"),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setExercises(Array.isArray(e) ? e : []);
    } catch {
      // Initial load failure is silent — the empty state below covers it.
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-expand the user's first personal template on initial load so the
  // day tabs + "إضافة تمرين" button are visible without an extra tap.
  // The collapsed state is only useful when there are many programs; for the
  // common case (one program) the empty card below the day tabs is confusing.
  useEffect(() => {
    if (expandedId !== null) return;
    const firstOwn = templates.find((t) => t.isOwn);
    if (firstOwn) setExpandedId(firstOwn.id);
  }, [templates, expandedId]);

  async function createTemplate() {
    if (!newName.trim()) {
      toast({ title: "أدخل اسم البرنامج", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await customFetch("/api/workout-templates", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), daysCount: newDaysCount, daysPerWeek: 4 }),
      });
      toast({ title: "تم إنشاء البرنامج" });
      setShowCreate(false);
      setNewName("");
      setNewDaysCount(1);
      await fetchAll();
    } catch {
      toast({ title: "فشل في الإنشاء", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function deleteTemplate(id: number) {
    if (!confirm("تأكيد حذف البرنامج وكل تمارينه؟")) return;
    try {
      await customFetch(`/api/workout-templates/${id}`, { method: "DELETE" });
      toast({ title: "تم الحذف" });
      if (expandedId === id) setExpandedId(null);
      await fetchAll();
    } catch {
      toast({ title: "فشل في الحذف", variant: "destructive" });
    }
  }

  async function createNewExercise() {
    const name = newExForm.name.trim();
    if (!name) {
      toast({ title: "أدخل اسم التمرين", variant: "destructive" });
      return;
    }
    setSavingNewEx(true);
    try {
      // POST /api/exercises is open to members; the server stamps
      // createdByUserId so it stays in this member's personal library.
      const created = await customFetch<Exercise>("/api/exercises", {
        method: "POST",
        body: JSON.stringify({
          name,
          targetMuscle: newExForm.targetMuscle,
          videoUrl: newExForm.videoUrl.trim() || null,
        }),
      });
      toast({ title: "تم إضافة التمرين لمكتبتك" });
      // Refresh the exercise picker and auto-select the new entry so the
      // user can confirm sets/reps and add it in one tap.
      const next = await customFetch<Exercise[]>("/api/exercises");
      setExercises(Array.isArray(next) ? next : []);
      setAddForm((f) => ({ ...f, exerciseId: created.id }));
      setCreatingNewEx(false);
      setNewExForm({ name: "", targetMuscle: "صدر", videoUrl: "" });
    } catch {
      toast({ title: "فشل في إضافة التمرين", variant: "destructive" });
    } finally {
      setSavingNewEx(false);
    }
  }

  async function addExerciseToTemplate(templateId: number) {
    if (!addForm.exerciseId) {
      toast({ title: "اختر تمرين أولاً", variant: "destructive" });
      return;
    }
    const dayNumber = activeDay[templateId] ?? 1;
    try {
      await customFetch(`/api/workout-templates/${templateId}/exercises`, {
        method: "POST",
        body: JSON.stringify({
          exerciseId: addForm.exerciseId,
          sets: addForm.sets,
          reps: addForm.reps,
          dayNumber,
          notes: addForm.notes || null,
          restSeconds: addForm.restSeconds,
        }),
      });
      toast({ title: "تمت إضافة التمرين" });
      setShowAddExercise(null);
      setAddForm({ exerciseId: 0, sets: 3, reps: 10, notes: "", restSeconds: 90 });
      setExSearch("");
      await fetchAll();
    } catch {
      toast({ title: "فشل في الإضافة", variant: "destructive" });
    }
  }

  async function saveExerciseEdit() {
    if (!editingExercise) return;
    try {
      await customFetch(`/api/workout-template-exercises/${editingExercise.id}`, {
        method: "PUT",
        body: JSON.stringify({
          sets: editingExercise.sets,
          reps: editingExercise.reps,
          restSeconds: editingExercise.restSeconds,
          notes: editingExercise.notes || null,
        }),
      });
      toast({ title: "تم الحفظ" });
      setEditingExercise(null);
      await fetchAll();
    } catch {
      toast({ title: "فشل في الحفظ", variant: "destructive" });
    }
  }

  async function deleteExercise(id: number) {
    if (!confirm("حذف هذا التمرين من البرنامج؟")) return;
    try {
      await customFetch(`/api/workout-template-exercises/${id}`, { method: "DELETE" });
      toast({ title: "تم الحذف" });
      await fetchAll();
    } catch {
      toast({ title: "فشل في الحذف", variant: "destructive" });
    }
  }

  const ownTemplates = templates.filter((t) => t.isOwn);
  const assignedTemplates = templates.filter((t) => !t.isOwn);
  const filteredExercises = exSearch
    ? exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(exSearch.toLowerCase()) ||
          e.targetMuscle.toLowerCase().includes(exSearch.toLowerCase()),
      )
    : exercises;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">برامجي</h1>
          <p className="text-muted-foreground text-sm">أضف برنامج التمارين الخاص بك بالعدّات والأوقات</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{
            background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
            color: "hsl(0 0% 5%)",
          }}
        >
          + برنامج جديد
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl p-5 space-y-3"
              style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
            >
              <div className="h-5 w-40 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* My templates section */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground">برامجي الشخصية</h2>
            {ownTemplates.length === 0 ? (
              <div className="bg-card border border-card-border rounded-xl p-8 text-center">
                <p className="text-foreground font-medium mb-1">لم تنشئ برنامج بعد</p>
                <p className="text-muted-foreground text-xs">اضغط "+ برنامج جديد" لتضيف تمارينك</p>
              </div>
            ) : (
              ownTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  activeDay={activeDay[t.id] ?? 1}
                  setActiveDay={(d) => setActiveDay((m) => ({ ...m, [t.id]: d }))}
                  expanded={expandedId === t.id}
                  onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  onDelete={() => deleteTemplate(t.id)}
                  onAddExercise={() => setShowAddExercise(t.id)}
                  onEditExercise={(ex) =>
                    setEditingExercise({
                      id: ex.id,
                      sets: ex.sets,
                      reps: ex.reps,
                      restSeconds: ex.restSeconds ?? 90,
                      notes: ex.notes ?? "",
                      name: ex.exerciseName,
                    })
                  }
                  onDeleteExercise={(id) => deleteExercise(id)}
                  editable
                />
              ))
            )}
          </section>

          {assignedTemplates.length > 0 && (
            <section className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-muted-foreground">برامج من المدرب</h2>
              {assignedTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  activeDay={activeDay[t.id] ?? 1}
                  setActiveDay={(d) => setActiveDay((m) => ({ ...m, [t.id]: d }))}
                  expanded={expandedId === t.id}
                  onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  editable={false}
                />
              ))}
            </section>
          )}
        </>
      )}

      {/* Create template modal */}
      {showCreate && (
        <Modal title="برنامج جديد" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <Field label="اسم البرنامج">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-muted text-foreground"
                placeholder="مثال: برنامج التضخيم"
                autoFocus
              />
            </Field>
            <Field label="عدد الأيام">
              <input
                type="number"
                min={1}
                max={7}
                value={newDaysCount}
                onChange={(e) => setNewDaysCount(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 rounded-lg bg-muted text-foreground"
              />
            </Field>
            <div className="flex gap-2 pt-2">
              <button
                onClick={createTemplate}
                disabled={creating}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: "hsl(40 65% 48%)", color: "#000" }}
              >
                {creating ? "..." : "إنشاء"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 rounded-lg text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add-exercise modal */}
      {showAddExercise !== null && (
        <Modal
          title="إضافة تمرين"
          onClose={() => {
            setShowAddExercise(null);
            setExSearch("");
            setCreatingNewEx(false);
            setNewExForm({ name: "", targetMuscle: "صدر", videoUrl: "" });
          }}
        >
          <div className="space-y-3">
            {creatingNewEx ? (
              // Inline "create a new exercise" form. Lives inside the same
              // modal so the member never loses their place — once saved
              // we drop them right back into the sets/reps panel below.
              <div
                className="p-3 rounded-lg space-y-3"
                style={{ background: "hsl(40 65% 48% / 0.06)", border: "1px solid hsl(40 65% 48% / 0.25)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">تمرين جديد</p>
                  <button
                    onClick={() => setCreatingNewEx(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    رجوع للمكتبة
                  </button>
                </div>
                <Field label="اسم التمرين">
                  <input
                    value={newExForm.name}
                    onChange={(e) => setNewExForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-muted text-foreground text-sm"
                    placeholder="مثلاً: بنش برس بالدمبل"
                    autoFocus
                  />
                </Field>
                <Field label="العضلة المستهدفة">
                  <select
                    value={newExForm.targetMuscle}
                    onChange={(e) => setNewExForm((f) => ({ ...f, targetMuscle: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-muted text-foreground text-sm"
                  >
                    {Object.keys(MUSCLE_COLORS).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="رابط فيديو (اختياري)">
                  <input
                    value={newExForm.videoUrl}
                    onChange={(e) => setNewExForm((f) => ({ ...f, videoUrl: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-muted text-foreground text-sm"
                    placeholder="https://..."
                  />
                </Field>
                <button
                  onClick={createNewExercise}
                  disabled={savingNewEx}
                  className="w-full py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                  style={{ background: "hsl(40 65% 48%)", color: "#000" }}
                >
                  {savingNewEx ? "..." : "حفظ التمرين"}
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={exSearch}
                    onChange={(e) => setExSearch(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-muted text-foreground text-sm"
                    placeholder="ابحث: اسم التمرين أو العضلة"
                  />
                  <button
                    onClick={() => setCreatingNewEx(true)}
                    className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
                    style={{
                      background: "hsl(40 65% 48% / 0.18)",
                      color: "hsl(40 65% 70%)",
                      border: "1px solid hsl(40 65% 48% / 0.4)",
                    }}
                    title="أضف تمرين مش موجود في المكتبة"
                  >
                    + تمرين جديد
                  </button>
                </div>
                <div className="max-h-44 overflow-y-auto border border-card-border rounded-lg">
                  {filteredExercises.length === 0 ? (
                    <p className="p-3 text-center text-muted-foreground text-xs">
                      لا توجد نتائج — اضغط "+ تمرين جديد" لإضافته
                    </p>
                  ) : (
                    filteredExercises.slice(0, 50).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setAddForm((f) => ({ ...f, exerciseId: e.id }))}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between"
                        style={
                          addForm.exerciseId === e.id ? { background: "hsl(40 65% 48% / 0.15)" } : undefined
                        }
                      >
                        <span className="font-medium">{e.name}</span>
                        <span className="text-xs text-muted-foreground">{e.targetMuscle}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label="مجموعات">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={addForm.sets}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, sets: Math.max(1, Number(e.target.value) || 1) }))
                  }
                  className="w-full px-2 py-2 rounded-lg bg-muted text-foreground text-sm"
                />
              </Field>
              <Field label="تكرار">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={addForm.reps}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, reps: Math.max(1, Number(e.target.value) || 1) }))
                  }
                  className="w-full px-2 py-2 rounded-lg bg-muted text-foreground text-sm"
                />
              </Field>
              <Field label="راحة (ث)">
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={addForm.restSeconds}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, restSeconds: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="w-full px-2 py-2 rounded-lg bg-muted text-foreground text-sm"
                />
              </Field>
            </div>
            <Field label="ملاحظات (اختياري)">
              <input
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-muted text-foreground text-sm"
                placeholder="مثلاً: زيادة وزن أسبوعياً"
              />
            </Field>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => addExerciseToTemplate(showAddExercise)}
                disabled={creatingNewEx}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: "hsl(40 65% 48%)", color: "#000" }}
              >
                إضافة للبرنامج
              </button>
              <button
                onClick={() => {
                  setShowAddExercise(null);
                  setExSearch("");
                  setCreatingNewEx(false);
                  setNewExForm({ name: "", targetMuscle: "صدر", videoUrl: "" });
                }}
                className="px-4 rounded-lg text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit-exercise modal */}
      {editingExercise && (
        <Modal title={`تعديل ${editingExercise.name}`} onClose={() => setEditingExercise(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Field label="مجموعات">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={editingExercise.sets}
                  onChange={(e) =>
                    setEditingExercise((p) =>
                      p ? { ...p, sets: Math.max(1, Number(e.target.value) || 1) } : p,
                    )
                  }
                  className="w-full px-2 py-2 rounded-lg bg-muted text-foreground text-sm"
                />
              </Field>
              <Field label="تكرار">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={editingExercise.reps}
                  onChange={(e) =>
                    setEditingExercise((p) =>
                      p ? { ...p, reps: Math.max(1, Number(e.target.value) || 1) } : p,
                    )
                  }
                  className="w-full px-2 py-2 rounded-lg bg-muted text-foreground text-sm"
                />
              </Field>
              <Field label="راحة (ث)">
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={editingExercise.restSeconds}
                  onChange={(e) =>
                    setEditingExercise((p) =>
                      p ? { ...p, restSeconds: Math.max(0, Number(e.target.value) || 0) } : p,
                    )
                  }
                  className="w-full px-2 py-2 rounded-lg bg-muted text-foreground text-sm"
                />
              </Field>
            </div>
            <Field label="ملاحظات">
              <input
                value={editingExercise.notes}
                onChange={(e) => setEditingExercise((p) => (p ? { ...p, notes: e.target.value } : p))}
                className="w-full px-3 py-2 rounded-lg bg-muted text-foreground text-sm"
              />
            </Field>
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveExerciseEdit}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold"
                style={{ background: "hsl(40 65% 48%)", color: "#000" }}
              >
                حفظ
              </button>
              <button
                onClick={() => setEditingExercise(null)}
                className="px-4 rounded-lg text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TemplateCard({
  t,
  activeDay,
  setActiveDay,
  expanded,
  onToggle,
  onDelete,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  editable,
}: {
  t: MyTemplate;
  activeDay: number;
  setActiveDay: (d: number) => void;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onAddExercise?: () => void;
  onEditExercise?: (ex: TemplateExercise) => void;
  onDeleteExercise?: (id: number) => void;
  editable: boolean;
}) {
  const dayExercises = t.exercises.filter((ex) => ex.dayNumber === activeDay);

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div
        className="p-4 border-b border-border"
        style={{ background: "linear-gradient(135deg, hsl(40 65% 48% / 0.08), transparent)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <button onClick={onToggle} className="flex-1 text-right">
            <h2 className="text-base font-bold text-foreground">{t.name}</h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              {t.daysCount} يوم · {t.exercises.length} تمرين
            </p>
          </button>
          {editable && onDelete && (
            <button
              onClick={onDelete}
              className="px-2 py-1 rounded-md text-xs"
              style={{ background: "hsl(0 70% 40% / 0.15)", color: "hsl(0 70% 70%)" }}
              title="حذف البرنامج"
            >
              حذف
            </button>
          )}
        </div>

        {t.daysCount > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
            {Array.from({ length: t.daysCount }).map((_, i) => {
              const day = i + 1;
              const count = t.exercises.filter((ex) => ex.dayNumber === day).length;
              return (
                <button
                  key={day}
                  onClick={() => {
                    setActiveDay(day);
                    if (!expanded) onToggle();
                  }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

      {expanded && (
        <div className="px-4 pb-3">
          {dayExercises.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-5">لا توجد تمارين لهذا اليوم</p>
          ) : (
            dayExercises.map((ex, i) => {
              const color = MUSCLE_COLORS[ex.targetMuscle] ?? "#95a5a6";
              return (
                <div key={ex.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: `${color}20`, color }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{ex.exerciseName}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {ex.sets} × {ex.reps}
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
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {ex.videoUrl && <ExerciseVideoButton url={ex.videoUrl} title={ex.exerciseName} />}
                    {editable && onEditExercise && (
                      <button
                        onClick={() => onEditExercise(ex)}
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 75%)" }}
                      >
                        تعديل
                      </button>
                    )}
                    {editable && onDeleteExercise && (
                      <button
                        onClick={() => onDeleteExercise(ex.id)}
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ background: "hsl(0 70% 40% / 0.15)", color: "hsl(0 70% 70%)" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {editable && onAddExercise && (
            <button
              onClick={onAddExercise}
              className="w-full mt-3 py-2 rounded-lg text-xs font-bold border border-dashed"
              style={{ borderColor: "hsl(40 65% 48% / 0.4)", color: "hsl(40 65% 60%)" }}
            >
              + إضافة تمرين لـ{getDayName(t, activeDay)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-card-border max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground"
            style={{ background: "hsl(0 0% 14%)" }}
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
