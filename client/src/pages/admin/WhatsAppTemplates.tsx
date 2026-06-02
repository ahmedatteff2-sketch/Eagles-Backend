import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  WaTemplate,
  getWaTemplates,
  createWaTemplate,
  updateWaTemplate,
  deleteWaTemplate,
  applyTemplateVars,
} from "@/api-client/wa-templates";

const GOLD = "hsl(40 65% 52%)";

const SUPPORTED_VARS = [
  { key: "name", label: "اسم العضو" },
  { key: "phone", label: "رقم الهاتف" },
  { key: "membership_number", label: "رقم العضوية" },
  { key: "end_date", label: "تاريخ انتهاء الاشتراك" },
  { key: "gym_name", label: "اسم النادي" },
];

const PREVIEW_SAMPLE = {
  name: "أحمد محمد",
  phone: "01012345678",
  membership_number: "EG-1042",
  end_date: new Date(Date.now() + 7 * 86400000).toLocaleDateString("ar-EG"),
  gym_name: "Eagle Gym",
};

interface FormState {
  name: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
}

const EMPTY_FORM: FormState = { name: "", body: "", enabled: true, sortOrder: 0 };

export default function AdminWhatsAppTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WaTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WaTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const data = await getWaTemplates();
      setTemplates(data);
    } catch {
      toast({ title: "خطأ في تحميل القوالب", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAll();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: templates.length });
    setShowForm(true);
  }

  function openEdit(t: WaTemplate) {
    setEditing(t);
    setForm({ name: t.name, body: t.body, enabled: t.enabled, sortOrder: t.sortOrder });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function insertVarAtCursor(varKey: string) {
    const ta = document.getElementById("wa-tpl-body") as HTMLTextAreaElement | null;
    const placeholder = `{${varKey}}`;
    if (!ta) {
      setForm((f) => ({ ...f, body: f.body + placeholder }));
      return;
    }
    const start = ta.selectionStart ?? form.body.length;
    const end = ta.selectionEnd ?? form.body.length;
    const next = form.body.slice(0, start) + placeholder + form.body.slice(end);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + placeholder.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  // Loose validation: warn on unmatched braces. Server still has the final say.
  function validate(): string | null {
    if (!form.name.trim()) return "اسم القالب مطلوب";
    if (form.name.length > 100) return "اسم القالب طويل جداً (الحد 100)";
    if (!form.body.trim()) return "نص القالب مطلوب";
    if (form.body.length > 2000) return "نص القالب طويل جداً (الحد 2000)";
    const opens = (form.body.match(/\{/g) ?? []).length;
    const closes = (form.body.match(/\}/g) ?? []).length;
    if (opens !== closes) return "أقواس المتغيّرات غير مكتملة (تحقّق من { و })";
    return null;
  }

  async function save() {
    const err = validate();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateWaTemplate(editing.id, form);
        toast({ title: "تم تحديث القالب" });
      } else {
        await createWaTemplate(form);
        toast({ title: "تم إضافة القالب" });
      }
      closeForm();
      void fetchAll();
    } catch {
      toast({ title: "خطأ في حفظ القالب", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(t: WaTemplate) {
    try {
      await updateWaTemplate(t.id, { enabled: !t.enabled });
      void fetchAll();
    } catch {
      toast({ title: "خطأ في تحديث القالب", variant: "destructive" });
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await deleteWaTemplate(confirmDelete.id);
      toast({ title: "تم حذف القالب" });
      setConfirmDelete(null);
      void fetchAll();
    } catch {
      toast({ title: "خطأ في الحذف", variant: "destructive" });
    }
  }

  const enabledCount = templates.filter((t) => t.enabled).length;
  const previewBody = applyTemplateVars(form.body, PREVIEW_SAMPLE);

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3"
            style={{ color: "hsl(0 0% 90%)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)" }}
            >
              <svg viewBox="0 0 24 24" fill="#25D366" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            قوالب واتساب
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "hsl(0 0% 45%)" }}>
            خصّص الرسائل اللي بتبعتها للأعضاء • {enabledCount} قالب مفعّل من أصل {templates.length}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{
            background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
            color: "hsl(0 0% 5%)",
            boxShadow: "0 4px 20px hsl(40 65% 48% / 0.3)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="w-4 h-4"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          إضافة قالب جديد
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-5 animate-pulse"
              style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}
            >
              <div className="h-4 w-40 rounded mb-3" style={{ background: "hsl(0 0% 14%)" }} />
              <div className="h-3 w-full rounded mb-2" style={{ background: "hsl(0 0% 11%)" }} />
              <div className="h-3 w-3/4 rounded" style={{ background: "hsl(0 0% 11%)" }} />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "hsl(0 0% 7%)", border: "1px dashed hsl(0 0% 15%)" }}
        >
          <div className="text-5xl mb-4">💬</div>
          <h3 className="text-lg font-bold mb-2" style={{ color: "hsl(0 0% 70%)" }}>
            لا توجد قوالب بعد
          </h3>
          <p className="text-sm mb-6" style={{ color: "hsl(0 0% 40%)" }}>
            أنشئ أول قالب واستخدم متغيّرات زي {"{name}"} و {"{end_date}"} عشان الرسائل تتخصّص لكل عضو
            تلقائياً.
          </p>
          <button
            onClick={openCreate}
            className="px-5 py-2 rounded-xl text-sm font-bold"
            style={{
              background: "hsl(40 65% 48% / 0.15)",
              color: GOLD,
              border: "1px solid hsl(40 65% 48% / 0.3)",
            }}
          >
            إضافة أول قالب
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl p-5"
              style={{
                background: t.enabled ? "hsl(0 0% 7%)" : "hsl(0 0% 5%)",
                border: t.enabled ? "1px solid hsl(40 65% 48% / 0.15)" : "1px solid hsl(0 0% 10%)",
                opacity: t.enabled ? 1 : 0.65,
              }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="text-base font-bold" style={{ color: "hsl(0 0% 88%)" }}>
                      {t.name}
                    </h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded-lg"
                      style={{
                        background: t.enabled ? "hsl(142 60% 50% / 0.12)" : "hsl(0 0% 12%)",
                        color: t.enabled ? "hsl(142 60% 60%)" : "hsl(0 0% 40%)",
                      }}
                    >
                      {t.enabled ? "مفعّل" : "معطّل"}
                    </span>
                  </div>
                  <pre
                    className="text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ fontFamily: "inherit", color: "hsl(0 0% 65%)" }}
                  >
                    {t.body}
                  </pre>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggleEnabled(t)}
                    className="relative"
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 999,
                      background: t.enabled ? "hsl(142 60% 45%)" : "hsl(0 0% 20%)",
                    }}
                  >
                    <div
                      className="absolute top-0.5 rounded-full bg-white transition-all"
                      style={{ width: 20, height: 20, left: t.enabled ? 20 : 2 }}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="p-2 rounded-lg"
                    style={{ color: "hsl(0 0% 50%)" }}
                    title="تعديل"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(t)}
                    className="p-2 rounded-lg"
                    style={{ color: "hsl(0 60% 55%)" }}
                    title="حذف"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)" }}
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{editing ? "تعديل القالب" : "إضافة قالب جديد"}</h2>
                <button
                  onClick={closeForm}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "hsl(0 0% 14%)" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="w-4 h-4"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "hsl(0 0% 55%)" }}>
                  اسم القالب
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  placeholder="مثال: تذكير قبل انتهاء الاشتراك"
                  style={{
                    background: "hsl(0 0% 12%)",
                    border: "1px solid hsl(0 0% 22%)",
                    color: "hsl(0 0% 90%)",
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold" style={{ color: "hsl(0 0% 55%)" }}>
                    نص الرسالة
                  </label>
                  <span className="text-xs" style={{ color: "hsl(0 0% 40%)" }}>
                    {form.body.length} / 2000
                  </span>
                </div>
                <textarea
                  id="wa-tpl-body"
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={6}
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none font-mono"
                  placeholder={"أهلاً {name}، اشتراكك ينتهي يوم {end_date}..."}
                  style={{
                    background: "hsl(0 0% 12%)",
                    border: "1px solid hsl(0 0% 22%)",
                    color: "hsl(0 0% 90%)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: "hsl(0 0% 55%)" }}>
                  المتغيّرات المتاحة (اضغط للإدراج)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_VARS.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVarAtCursor(v.key)}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono transition-colors"
                      style={{
                        background: "hsl(40 65% 48% / 0.12)",
                        color: "hsl(40 65% 60%)",
                        border: "1px solid hsl(40 65% 48% / 0.25)",
                      }}
                      title={v.label}
                    >
                      {`{${v.key}}`}
                    </button>
                  ))}
                </div>
              </div>

              {form.body.trim() && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "hsl(0 0% 55%)" }}>
                    معاينة (بقيم تجريبية)
                  </label>
                  <pre
                    className="rounded-lg px-3 py-2.5 text-sm whitespace-pre-wrap leading-relaxed"
                    style={{
                      background: "rgba(37,211,102,0.06)",
                      border: "1px solid rgba(37,211,102,0.2)",
                      fontFamily: "inherit",
                      color: "hsl(0 0% 80%)",
                    }}
                  >
                    {previewBody}
                  </pre>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                <span style={{ color: "hsl(0 0% 75%)" }}>مفعّل (يظهر في قائمة قوالب الأعضاء)</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)" }}
                >
                  إلغاء
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{
                    background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                    color: "hsl(0 0% 5%)",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "..." : editing ? "حفظ التعديلات" : "إضافة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden p-5"
            style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)" }}
          >
            <h3 className="font-bold text-center mb-2">حذف القالب؟</h3>
            <p className="text-center text-sm mb-5" style={{ color: "hsl(0 0% 55%)" }}>
              سيتم حذف "{confirmDelete.name}" نهائياً.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)" }}
              >
                إلغاء
              </button>
              <button
                onClick={doDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "hsl(0 72% 51%)", color: "#fff" }}
              >
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
