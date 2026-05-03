import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetTrainingProgram, useCreateTrainingWeek, useListExercises,
  useCreateExercise, useUpdateExercise, useDeleteExercise, useGetUser,
  getGetTrainingProgramQueryKey, getListExercisesQueryKey, getGetUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

const exSchema = z.object({
  name: z.string().min(1, "اسم التمرين مطلوب"),
  videoUrl: z.string().url("رابط غير صحيح").optional().or(z.literal("")),
  setsRequired: z.coerce.number().min(1).max(10),
  repsMin: z.coerce.number().min(1),
  repsMax: z.coerce.number().min(1),
});
type ExForm = z.infer<typeof exSchema>;

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  goal: string;
  level: string;
  daysPerWeek: number;
  weekCount: number;
  totalExercises: number;
  weekLabels: string[];
}

// ─── Exercise Library ─────────────────────────────────────────────────────────

const EXERCISE_LIBRARY: Record<string, { name: string; sets: number; repsMin: number; repsMax: number }[]> = {
  "💪 الصدر": [
    { name: "بنش بريس بالبار", sets: 4, repsMin: 8, repsMax: 12 },
    { name: "انكلاين دمبل بريس", sets: 3, repsMin: 10, repsMax: 12 },
    { name: "ديكلاين بنش بريس", sets: 3, repsMin: 10, repsMax: 12 },
    { name: "تشست فلاي بالدمبل", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "كابل كروس أوفر", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "بوش أب", sets: 3, repsMin: 15, repsMax: 20 },
  ],
  "🔙 الظهر": [
    { name: "ديدليفت", sets: 4, repsMin: 5, repsMax: 8 },
    { name: "باربيل رو", sets: 4, repsMin: 8, repsMax: 12 },
    { name: "لات بول داون", sets: 4, repsMin: 10, repsMax: 12 },
    { name: "سيتد كابل رو", sets: 3, repsMin: 10, repsMax: 12 },
    { name: "بول أب", sets: 3, repsMin: 8, repsMax: 12 },
    { name: "هايبر إكستنشن", sets: 3, repsMin: 12, repsMax: 15 },
  ],
  "🦵 الأرجل": [
    { name: "سكوات بالبار", sets: 4, repsMin: 8, repsMax: 12 },
    { name: "ليج بريس", sets: 4, repsMin: 10, repsMax: 15 },
    { name: "لانجز بالدمبل", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "ليج كيرل", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "ليج إكستنشن", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "ستاندينج كالف ريز", sets: 4, repsMin: 15, repsMax: 20 },
  ],
  "🔺 الأكتاف": [
    { name: "أوفر هيد بريس", sets: 4, repsMin: 8, repsMax: 12 },
    { name: "لاترال ريز", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "فرونت ريز", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "فيس بول", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "شراجز", sets: 3, repsMin: 12, repsMax: 15 },
  ],
  "💪 البايسبس": [
    { name: "باربيل كيرل", sets: 3, repsMin: 10, repsMax: 12 },
    { name: "هامر كيرل", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "إنكلاين دمبل كيرل", sets: 3, repsMin: 10, repsMax: 12 },
    { name: "كونسنتريشن كيرل", sets: 3, repsMin: 12, repsMax: 15 },
  ],
  "💪 الترايسبس": [
    { name: "ترايسبس بوش داون", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "سكول كراشر", sets: 3, repsMin: 10, repsMax: 12 },
    { name: "أوفرهيد ترايسبس إكستنشن", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "ديبس", sets: 3, repsMin: 8, repsMax: 12 },
  ],
  "🔥 الكور": [
    { name: "بلانك (ثانية)", sets: 3, repsMin: 30, repsMax: 60 },
    { name: "كرنشز", sets: 3, repsMin: 15, repsMax: 25 },
    { name: "ليج ريز", sets: 3, repsMin: 12, repsMax: 15 },
    { name: "ماونتن كلايمبر (ثانية)", sets: 3, repsMin: 30, repsMax: 45 },
  ],
};

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  "مبتدئ": { bg: "bg-green-500/15", text: "text-green-400" },
  "متوسط": { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  "متقدم": { bg: "bg-red-500/15", text: "text-red-400" },
};

const GOAL_ICONS: Record<string, string> = {
  "بناء اللياقة الأساسية": "🏋️",
  "زيادة الكتلة العضلية": "💪",
  "حرق الدهون والتنحيف": "🔥",
  "زيادة القوة القصوى": "⚡",
};

// ─── Template Picker Modal ─────────────────────────────────────────────────────

function TemplatePicker({
  onApply,
  onClose,
  applying,
}: {
  onApply: (id: string) => void;
  onClose: () => void;
  applying: boolean;
}) {
  const { accessToken } = useAuthStore();
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  if (templates === null) {
    fetch("/api/training-templates", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(setTemplates);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">القوالب الجاهزة</h2>
            <p className="text-muted-foreground text-sm mt-0.5">اختر برنامجاً ويتعبأ تلقائياً بكل الأسابيع والتمارين</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Template list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {templates === null ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : (
            templates.map(t => {
              const isSelected = selected === t.id;
              const isExpanded = expanded === t.id;
              const levelColor = LEVEL_COLORS[t.level] ?? LEVEL_COLORS["مبتدئ"];
              const goalIcon = GOAL_ICONS[t.goal] ?? "🏋️";

              return (
                <div
                  key={t.id}
                  className={`border rounded-xl overflow-hidden transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-card-border hover:border-primary/40"
                  }`}
                  onClick={() => setSelected(t.id)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl mt-0.5 flex-shrink-0">{goalIcon}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-foreground text-sm">{t.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColor.bg} ${levelColor.text}`}>
                              {t.level}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-xs mb-2">{t.description}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>📅 {t.weekCount} أسابيع</span>
                            <span>🏋️ {t.totalExercises} تمرين</span>
                            <span>📆 {t.daysPerWeek} أيام/أسبوع</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3 text-primary-foreground">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setExpanded(isExpanded ? null : t.id); }}
                          className="text-xs text-primary hover:underline"
                        >
                          {isExpanded ? "إخفاء" : "التفاصيل"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-foreground mb-2">محتوى كل أسبوع:</p>
                        <div className="space-y-1.5">
                          {t.weekLabels.map((label, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {i + 1}
                              </span>
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            onClick={() => selected && onApply(selected)}
            disabled={!selected || applying}
            className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors"
            style={{ background: "hsl(40 65% 48%)", color: "#000" }}
          >
            {applying ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                جاري التطبيق...
              </span>
            ) : selected ? (
              "✓ تطبيق القالب المختار"
            ) : (
              "اختر قالباً أولاً"
            )}
          </button>
          <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-semibold bg-muted text-foreground hover:bg-muted/80">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exercise Library Modal ────────────────────────────────────────────────────

function ExerciseLibrary({
  onSelect,
  onClose,
}: {
  onSelect: (ex: { name: string; sets: number; repsMin: number; repsMax: number }) => void;
  onClose: () => void;
}) {
  const [activeGroup, setActiveGroup] = useState(Object.keys(EXERCISE_LIBRARY)[0]);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? Object.values(EXERCISE_LIBRARY).flat().filter(e => e.name.includes(search))
    : EXERCISE_LIBRARY[activeGroup] ?? [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">مكتبة التمارين</h2>
            <p className="text-xs text-muted-foreground mt-0.5">اضغط على أي تمرين لإضافته مباشرة</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-1 flex-shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن تمرين..."
            className="w-full bg-input border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Muscle group tabs */}
        {!search && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto flex-shrink-0">
            {Object.keys(EXERCISE_LIBRARY).map(group => (
              <button
                key={group}
                onClick={() => setActiveGroup(group)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeGroup === group
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        )}

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
          {filtered.map((ex, i) => (
            <button
              key={i}
              onClick={() => { onSelect(ex); onClose(); }}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-card-border hover:border-primary/40 hover:bg-primary/5 transition-all text-right group"
            >
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{ex.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ex.sets} مجموعات · {ex.repsMin}–{ex.repsMax} تكرار
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">لا توجد تمارين مطابقة</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Exercise Card ─────────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, string> = {
  "بنش": "#e74c3c", "صدر": "#e74c3c", "تشست": "#e74c3c", "بوش": "#e74c3c",
  "سكوات": "#3498db", "أرجل": "#3498db", "ليج": "#3498db", "لانجز": "#3498db", "كالف": "#3498db",
  "ديدليفت": "#9b59b6", "ظهر": "#9b59b6", "رو": "#9b59b6", "لات": "#9b59b6", "بول": "#9b59b6",
  "شولدر": "#2ecc71", "كتف": "#2ecc71", "ريز": "#2ecc71", "بريس": "#2ecc71",
  "بايسبس": "#f39c12", "كيرل": "#f39c12", "ترايسبس": "#e67e22", "سكول": "#e67e22", "ديبس": "#e67e22",
  "بلانك": "#1abc9c", "كرنشز": "#1abc9c", "كور": "#1abc9c",
};

function getExerciseColor(name: string) {
  for (const [key, color] of Object.entries(MUSCLE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return "hsl(40 65% 48%)";
}

function ExerciseCard({
  ex, index, onEdit, onDelete,
}: {
  ex: any; index: number;
  onEdit: (ex: any) => void;
  onDelete: (id: number) => void;
}) {
  const color = getExerciseColor(ex.name);
  return (
    <div className="flex items-start gap-3 group">
      <div className="flex flex-col items-center pt-1">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
          style={{ background: `${color}20`, color }}
        >
          {index + 1}
        </div>
        <div className="w-0.5 bg-border mt-2 flex-1" style={{ minHeight: 12 }} />
      </div>
      <div className="flex-1 min-w-0 bg-card border border-card-border rounded-xl p-4 mb-2 group-hover:border-primary/30 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">{ex.name}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: `${color}15`, color }}>
                {ex.setsRequired} مجموعات
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                {ex.repsMin}–{ex.repsMax} تكرار
              </span>
              {ex.videoUrl && (
                <a
                  href={ex.videoUrl} target="_blank" rel="noreferrer"
                  className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  فيديو
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => onEdit(ex)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >تعديل</button>
            <button
              onClick={() => onDelete(ex.id)}
              className="text-xs text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
            >حذف</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Exercise List (per week) ──────────────────────────────────────────────────

function ExerciseList({ weekId, weekNumber }: { weekId: number; weekNumber: number }) {
  const [showForm, setShowForm] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exercises } = useListExercises(weekId, {
    query: { queryKey: getListExercisesQueryKey(weekId) },
  });
  const createEx = useCreateExercise();
  const updateEx = useUpdateExercise();
  const deleteEx = useDeleteExercise();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ExForm>({
    resolver: zodResolver(exSchema),
    defaultValues: { setsRequired: 3, repsMin: 8, repsMax: 12 },
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", videoUrl: "", setsRequired: 3, repsMin: 8, repsMax: 12 });
    setShowForm(true);
  }

  function openEdit(ex: any) {
    setEditing(ex);
    setValue("name", ex.name);
    setValue("videoUrl", ex.videoUrl ?? "");
    setValue("setsRequired", ex.setsRequired);
    setValue("repsMin", ex.repsMin);
    setValue("repsMax", ex.repsMax);
    setShowForm(true);
  }

  function handleLibrarySelect(ex: { name: string; sets: number; repsMin: number; repsMax: number }) {
    createEx.mutate(
      { weekId, data: { name: ex.name, setsRequired: ex.sets, repsMin: ex.repsMin, repsMax: ex.repsMax } },
      {
        onSuccess: () => {
          toast({ title: `✓ تم إضافة: ${ex.name}` });
          queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey(weekId) });
        },
        onError: () => toast({ title: "خطأ في الإضافة", variant: "destructive" }),
      }
    );
  }

  function onSubmit(data: ExForm) {
    const payload = { ...data, videoUrl: data.videoUrl || undefined };
    const isEdit = !!editing;
    const mutation = isEdit
      ? updateEx.mutate({ exerciseId: editing.id, data: payload }, {
          onSuccess: () => {
            toast({ title: "تم تحديث التمرين" });
            queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey(weekId) });
            setShowForm(false);
          },
          onError: () => toast({ title: "خطأ", variant: "destructive" }),
        })
      : createEx.mutate({ weekId, data: payload }, {
          onSuccess: () => {
            toast({ title: "تم إضافة التمرين" });
            queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey(weekId) });
            setShowForm(false);
          },
          onError: () => toast({ title: "خطأ", variant: "destructive" }),
        });
    void mutation;
  }

  function handleDelete(exId: number) {
    if (!confirm("حذف التمرين؟")) return;
    deleteEx.mutate({ exerciseId: exId }, {
      onSuccess: () => {
        toast({ title: "تم الحذف" });
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey(weekId) });
      },
    });
  }

  const exList = Array.isArray(exercises) ? exercises : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-foreground">الأسبوع {weekNumber}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{exList.length} تمارين</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            مكتبة التمارين
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            style={{ background: "hsl(40 65% 48%)", color: "#000" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            إضافة يدوي
          </button>
        </div>
      </div>

      {/* Exercise cards */}
      {exList.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">🏋️</div>
          <p className="text-foreground font-medium mb-1">لا توجد تمارين لهذا الأسبوع</p>
          <p className="text-muted-foreground text-sm mb-4">اختر من مكتبة التمارين أو أضف يدوياً</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowLibrary(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              style={{ background: "hsl(40 65% 48%)", color: "#000" }}
            >
              مكتبة التمارين
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              إضافة يدوي
            </button>
          </div>
        </div>
      ) : (
        <div>
          {exList.map((ex: any, i: number) => (
            <ExerciseCard key={ex.id} ex={ex} index={i} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Library modal */}
      {showLibrary && (
        <ExerciseLibrary onSelect={handleLibrarySelect} onClose={() => setShowLibrary(false)} />
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">{editing ? "تعديل التمرين" : "إضافة تمرين"}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">اسم التمرين</label>
                <input
                  {...register("name")}
                  placeholder="مثال: بنش بريس بالبار"
                  className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">رابط فيديو (اختياري)</label>
                <input
                  {...register("videoUrl")}
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.videoUrl && <p className="text-destructive text-xs mt-1">{errors.videoUrl.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "عدد المجموعات", field: "setsRequired" as const },
                  { label: "تكرار (أدنى)", field: "repsMin" as const },
                  { label: "تكرار (أقصى)", field: "repsMax" as const },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
                    <input
                      {...register(field)}
                      type="number"
                      min={1}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createEx.isPending || updateEx.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: "hsl(40 65% 48%)", color: "#000" }}
                >
                  {editing ? "حفظ التعديلات" : "إضافة التمرين"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2.5 rounded-xl text-sm font-semibold"
                >إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminTrainingProgram() {
  const params = useParams<{ programId: string }>();
  const programId = parseInt(params.programId, 10);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { accessToken } = useAuthStore();

  const { data: program, isLoading } = useGetTrainingProgram(programId, {
    query: { queryKey: getGetTrainingProgramQueryKey(programId) },
  });
  const prog = program as any;
  const memberId = prog?.userId;

  const { data: memberUser } = useGetUser(memberId ?? 0, {
    query: { queryKey: getGetUserQueryKey(memberId ?? 0), enabled: !!memberId },
  });

  const createWeek = useCreateTrainingWeek();

  async function applyTemplate(templateId: string) {
    setApplyingTemplate(true);
    try {
      const res = await fetch(`/api/training-programs/${programId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل التطبيق");
      toast({ title: `✓ ${data.message}` });
      queryClient.invalidateQueries({ queryKey: getGetTrainingProgramQueryKey(programId) });
      setShowTemplatePicker(false);
      setActiveWeekIndex(0);
    } catch (err: any) {
      toast({ title: err.message ?? "خطأ في تطبيق القالب", variant: "destructive" });
    } finally {
      setApplyingTemplate(false);
    }
  }

  function addWeek() {
    const weeks = prog?.weeks ?? [];
    if (weeks.length >= 12) return;
    const nextWeek = weeks.length + 1;
    createWeek.mutate({ programId, data: { weekNumber: nextWeek } }, {
      onSuccess: () => {
        toast({ title: `تم إضافة الأسبوع ${nextWeek}` });
        queryClient.invalidateQueries({ queryKey: getGetTrainingProgramQueryKey(programId) });
        setActiveWeekIndex(nextWeek - 1);
      },
      onError: () => toast({ title: "خطأ في إضافة الأسبوع", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const weeks: any[] = prog?.weeks ?? [];
  const activeWeek = weeks[activeWeekIndex];
  const memberName = (memberUser as any)?.name;
  const totalExercises = weeks.reduce((a: number, w: any) => a + (w.exercises?.length ?? 0), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/admin/training">
          <span className="hover:text-foreground cursor-pointer transition-colors">برامج التدريب</span>
        </Link>
        <span>/</span>
        {memberName && memberId && (
          <>
            <Link href={`/admin/members/${memberId}`}>
              <span className="hover:text-foreground cursor-pointer transition-colors">{memberName}</span>
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground truncate max-w-40">{prog?.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{prog?.name}</h1>
          {memberName && (
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(40 65% 30%), hsl(40 65% 22%))", color: "hsl(40 65% 65%)" }}
              >
                {memberName[0]}
              </div>
              <p className="text-muted-foreground text-sm">{memberName}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">{weeks.length} أسابيع</span>
            <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">{totalExercises} تمرين</span>
          </div>
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            قوالب جاهزة
          </button>
        </div>
      </div>

      {/* Empty state — no weeks yet */}
      {weeks.length === 0 && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-lg font-bold text-foreground mb-2">البرنامج فارغ</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            ابدأ باختيار قالب جاهز يعبأ البرنامج تلقائياً بالأسابيع والتمارين، أو أضف أسابيعك يدوياً
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{ background: "hsl(40 65% 48%)", color: "#000" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              اختر قالب جاهز
            </button>
            <button
              onClick={addWeek}
              disabled={createWeek.isPending}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              إضافة أسبوع يدوياً
            </button>
          </div>
        </div>
      )}

      {/* Week tabs */}
      {weeks.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {weeks.map((w: any, i: number) => (
            <button
              key={w.id}
              onClick={() => setActiveWeekIndex(i)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={
                i === activeWeekIndex
                  ? { background: "hsl(40 65% 48%)", color: "#000" }
                  : { background: "hsl(0 0% 12%)", color: "hsl(40 15% 65%)" }
              }
            >
              الأسبوع {w.weekNumber}
              <span
                className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                style={
                  i === activeWeekIndex
                    ? { background: "rgba(0,0,0,0.2)", color: "#000" }
                    : { background: "hsl(0 0% 18%)", color: "hsl(40 65% 55%)" }
                }
              >
                {w.exercises?.length ?? 0}
              </span>
            </button>
          ))}
          {weeks.length < 12 && (
            <button
              onClick={addWeek}
              disabled={createWeek.isPending}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              أسبوع جديد
            </button>
          )}
        </div>
      )}

      {/* Active week exercises */}
      {activeWeek && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <ExerciseList weekId={activeWeek.id} weekNumber={activeWeek.weekNumber} />
        </div>
      )}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <TemplatePicker
          onApply={applyTemplate}
          onClose={() => setShowTemplatePicker(false)}
          applying={applyingTemplate}
        />
      )}
    </div>
  );
}
