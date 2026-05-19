import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@/api-client/custom-fetch";
import ExerciseVideoButton from "@/components/ExerciseVideoButton";

interface Exercise {
  id: number;
  name: string;
  videoUrl: string | null;
  targetMuscle: string;
  createdAt: string;
}

const MUSCLE_GROUPS = ["صدر", "ظهر", "أكتاف", "بايسبس", "ترايسبس", "أرجل", "بطن", "كارديو", "أخرى"];

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

export default function AdminExercises() {
  const { toast } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", videoUrl: "", targetMuscle: "صدر" });
  const [saving, setSaving] = useState(false);
  const [filterMuscle, setFilterMuscle] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function fetchExercises() {
    setLoading(true);
    try {
      const data = await customFetch<Exercise[]>("/api/exercises");
      setExercises(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchExercises();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", videoUrl: "", targetMuscle: "صدر" });
    setShowForm(true);
  }

  function openEdit(ex: Exercise) {
    setEditingId(ex.id);
    setForm({ name: ex.name, videoUrl: ex.videoUrl ?? "", targetMuscle: ex.targetMuscle });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.targetMuscle) {
      toast({ title: "يرجى تعبئة الحقول الإلزامية", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        targetMuscle: form.targetMuscle,
        videoUrl: form.videoUrl.trim() || null,
      };
      if (editingId) {
        await customFetch(`/api/exercises/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "تم تحديث التمرين" });
      } else {
        await customFetch("/api/exercises", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "تم إضافة التمرين" });
      }
      setShowForm(false);
      fetchExercises();
    } catch {
      toast({ title: "فشل في الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("تأكيد حذف التمرين؟")) return;
    try {
      await customFetch(`/api/exercises/${id}`, { method: "DELETE" });
      toast({ title: "تم الحذف" });
      fetchExercises();
    } catch {
      toast({ title: "فشل في الحذف", variant: "destructive" });
    }
  }

  const filtered = exercises.filter((e) => {
    if (filterMuscle && e.targetMuscle !== filterMuscle) return false;
    if (search && !e.name.includes(search)) return false;
    return true;
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">التمارين</h1>
          <p className="text-muted-foreground text-sm">مكتبة التمارين — {exercises.length} تمرين</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          إضافة تمرين
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن تمرين..."
          className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterMuscle(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterMuscle === null
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-muted text-muted-foreground"
            }`}
          >
            الكل
          </button>
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              onClick={() => setFilterMuscle(m)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterMuscle === m
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-5 w-16 rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "hsl(40 65% 52% / 0.1)" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-7 h-7"
              style={{ color: "hsl(40 65% 60%)" }}
            >
              <path d="M6 18 18 6M6 6l12 12" />
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
            </svg>
          </div>
          <p className="text-foreground font-semibold mb-1">
            {search || filterMuscle ? "لا توجد نتائج بهذه الفلاتر" : "لا توجد تمارين بعد"}
          </p>
          <p className="text-muted-foreground text-sm mb-4">
            {search || filterMuscle ? "جرّب تغيير البحث أو الفلتر" : "ابدأ بإضافة تمارين لمكتبتك"}
          </p>
          {!search && !filterMuscle && (
            <button
              onClick={openCreate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold"
            >
              + إضافة تمرين جديد
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((ex) => {
            const color = MUSCLE_COLORS[ex.targetMuscle] ?? "#95a5a6";
            return (
              <div
                key={ex.id}
                className="bg-card border border-card-border rounded-xl p-4 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{ex.name}</p>
                    <span
                      className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{ background: `${color}20`, color }}
                    >
                      {ex.targetMuscle}
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => openEdit(ex)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(ex.id)}
                      className="text-xs text-destructive px-2 py-1 rounded hover:bg-destructive/10"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                {ex.videoUrl && (
                  <div className="mt-3">
                    <ExerciseVideoButton url={ex.videoUrl} title={ex.name} variant="thumb" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">
              {editingId ? "تعديل تمرين" : "إضافة تمرين"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">اسم التمرين</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: بنش بريس بالبار"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">العضلة المستهدفة</label>
                <select
                  value={form.targetMuscle}
                  onChange={(e) => setForm({ ...form, targetMuscle: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {MUSCLE_GROUPS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">رابط فيديو (اختياري)</label>
                <input
                  value={form.videoUrl}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
