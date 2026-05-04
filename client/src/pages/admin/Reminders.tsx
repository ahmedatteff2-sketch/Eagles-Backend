import { useState, useEffect } from "react";
import { getReminders, createReminder, updateReminder, deleteReminder, Reminder } from "@/api-client/reminders";

const GOLD = "hsl(40 65% 52%)";

export default function AdminReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ content: "", intervalMinutes: 60, isActive: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const data = await getReminders();
      setReminders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReminders(); }, []);

  const handleSave = async () => {
    if (!formData.content.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateReminder(editingId, formData);
      } else {
        await createReminder(formData);
      }
      closeModal();
      fetchReminders();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteReminder(id);
      setDeleteConfirm(null);
      fetchReminders();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleActive = async (reminder: Reminder) => {
    try {
      await updateReminder(reminder.id, { isActive: !reminder.isActive });
      fetchReminders();
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = (r: Reminder) => {
    setEditingId(r.id);
    setFormData({ content: r.content, intervalMinutes: r.intervalMinutes, isActive: r.isActive });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({ content: "", intervalMinutes: 60, isActive: true });
  };

  const activeCount = reminders.filter(r => r.isActive).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3" style={{ color: "hsl(0 0% 90%)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(40 65% 48% / 0.2), hsl(40 65% 48% / 0.05))", border: "1px solid hsl(40 65% 48% / 0.2)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" style={{ color: GOLD }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            إدارة الأذكار
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "hsl(0 0% 45%)" }}>
            أضف أذكاراً تظهر كإشعارات للمستخدمين بشكل دوري • {activeCount} ذكر مفعّل
          </p>
        </div>
        <button
          onClick={() => { closeModal(); setIsOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 group relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
            color: "hsl(0 0% 5%)",
            boxShadow: "0 4px 20px hsl(40 65% 48% / 0.3)"
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg, hsl(40 65% 58%), hsl(40 65% 46%))" }} />
          <span className="relative flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            إضافة ذكر جديد
          </span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الأذكار", value: reminders.length, icon: "📿" },
          { label: "مفعّلة", value: activeCount, icon: "✅" },
          { label: "معطّلة", value: reminders.length - activeCount, icon: "⏸️" },
          { label: "أقصر تكرار", value: reminders.length > 0 ? `${Math.min(...reminders.map(r => r.intervalMinutes))} د` : "—", icon: "⏱️" },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl p-4 text-center" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}>
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className="text-xl font-bold" style={{ color: "hsl(40 65% 60%)" }}>{stat.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(0 0% 40%)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Reminders List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none" style={{ color: GOLD }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : reminders.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "hsl(0 0% 7%)", border: "1px dashed hsl(0 0% 15%)" }}>
          <div className="text-5xl mb-4">🤲</div>
          <h3 className="text-lg font-bold mb-2" style={{ color: "hsl(0 0% 70%)" }}>لا توجد أذكار حالياً</h3>
          <p className="text-sm mb-6" style={{ color: "hsl(0 0% 40%)" }}>أضف أذكاراً ليتم تذكير المستخدمين بها بشكل دوري</p>
          <button onClick={() => setIsOpen(true)} className="px-5 py-2 rounded-xl text-sm font-bold transition-colors" style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD, border: "1px solid hsl(40 65% 48% / 0.3)" }}>
            إضافة أول ذكر
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <div key={r.id} className="rounded-xl p-5 transition-all duration-200 group relative overflow-hidden"
              style={{
                background: r.isActive ? "hsl(0 0% 7%)" : "hsl(0 0% 5%)",
                border: r.isActive ? "1px solid hsl(40 65% 48% / 0.15)" : "1px solid hsl(0 0% 10%)",
                opacity: r.isActive ? 1 : 0.6,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = r.isActive ? "hsl(40 65% 48% / 0.35)" : "hsl(0 0% 18%)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = r.isActive ? "hsl(40 65% 48% / 0.15)" : "hsl(0 0% 10%)"; }}
            >
              {r.isActive && <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48% / 0.4), transparent)" }} />}
              
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{
                  background: r.isActive ? "linear-gradient(135deg, hsl(40 65% 48% / 0.15), hsl(40 65% 48% / 0.05))" : "hsl(0 0% 8%)",
                  border: `1px solid ${r.isActive ? "hsl(40 65% 48% / 0.2)" : "hsl(0 0% 12%)"}`,
                }}>
                  <span className="text-xl">📿</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold leading-relaxed mb-2" style={{ color: r.isActive ? "hsl(0 0% 88%)" : "hsl(0 0% 50%)" }}>
                    {r.content}
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg" style={{
                      background: "hsl(0 0% 10%)", color: "hsl(0 0% 50%)"
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-3 h-3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      يتكرر كل {r.intervalMinutes} دقيقة
                    </span>
                    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg" style={{
                      background: r.isActive ? "hsl(142 60% 50% / 0.1)" : "hsl(0 0% 10%)",
                      color: r.isActive ? "hsl(142 60% 60%)" : "hsl(0 0% 40%)",
                    }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.isActive ? "hsl(142 60% 50%)" : "hsl(0 0% 30%)" }} />
                      {r.isActive ? "مفعّل" : "معطّل"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle */}
                  <button onClick={() => toggleActive(r)} className="relative w-10 h-5.5 rounded-full transition-all duration-300 cursor-pointer"
                    style={{
                      width: 42, height: 24,
                      background: r.isActive ? "hsl(142 60% 45%)" : "hsl(0 0% 20%)",
                      boxShadow: r.isActive ? "0 0 12px hsl(142 60% 45% / 0.3)" : "none",
                    }}>
                    <div className="absolute top-0.5 rounded-full transition-all duration-300 bg-white shadow-md"
                      style={{ width: 20, height: 20, left: r.isActive ? 20 : 2 }} />
                  </button>

                  {/* Edit */}
                  <button onClick={() => openEdit(r)} className="p-2 rounded-lg transition-colors"
                    style={{ color: "hsl(0 0% 35%)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = GOLD; e.currentTarget.style.background = "hsl(40 65% 48% / 0.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "hsl(0 0% 35%)"; e.currentTarget.style.background = "transparent"; }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>

                  {/* Delete */}
                  {deleteConfirm === r.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(r.id)} className="px-2 py-1 rounded-lg text-xs font-bold transition-colors" style={{ background: "hsl(0 72% 51% / 0.15)", color: "hsl(0 72% 60%)" }}>
                        حذف
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded-lg text-xs transition-colors" style={{ color: "hsl(0 0% 40%)" }}>
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(r.id)} className="p-2 rounded-lg transition-colors"
                      style={{ color: "hsl(0 0% 35%)" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "hsl(0 72% 55%)"; e.currentTarget.style.background = "hsl(0 72% 51% / 0.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "hsl(0 0% 35%)"; e.currentTarget.style.background = "transparent"; }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden relative"
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" }}>
            {/* Top gold line */}
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48% / 0.8), transparent)" }} />
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "hsl(0 0% 85%)" }}>
                <span className="text-xl">📿</span>
                {editingId ? "تعديل الذكر" : "إضافة ذكر جديد"}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg transition-colors" style={{ color: "hsl(0 0% 40%)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "hsl(0 0% 70%)")}
                onMouseLeave={e => (e.currentTarget.style.color = "hsl(0 0% 40%)")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Form */}
            <div className="px-6 pb-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: "hsl(0 0% 55%)" }}>نص الذكر</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="مثال: سبحان الله وبحمده، سبحان الله العظيم..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none transition-all focus:outline-none"
                  style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 90%)" }}
                  onFocus={e => { e.target.style.borderColor = "hsl(40 65% 48% / 0.6)"; e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.1)"; }}
                  onBlur={e => { e.target.style.borderColor = "hsl(0 0% 18%)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: "hsl(0 0% 55%)" }}>التكرار (بالدقائق)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={formData.intervalMinutes}
                    onChange={e => setFormData({ ...formData, intervalMinutes: parseInt(e.target.value) || 1 })}
                    className="flex-1 rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
                    style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 90%)" }}
                    onFocus={e => { e.target.style.borderColor = "hsl(40 65% 48% / 0.6)"; e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "hsl(0 0% 18%)"; e.target.style.boxShadow = "none"; }}
                  />
                  <div className="flex gap-1.5">
                    {[15, 30, 60].map(mins => (
                      <button key={mins} onClick={() => setFormData({ ...formData, intervalMinutes: mins })}
                        className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: formData.intervalMinutes === mins ? "hsl(40 65% 48% / 0.2)" : "hsl(0 0% 12%)",
                          color: formData.intervalMinutes === mins ? GOLD : "hsl(0 0% 45%)",
                          border: `1px solid ${formData.intervalMinutes === mins ? "hsl(40 65% 48% / 0.3)" : "hsl(0 0% 18%)"}`,
                        }}>
                        {mins} د
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 14%)" }}>
                <div>
                  <span className="text-sm font-semibold" style={{ color: "hsl(0 0% 75%)" }}>تفعيل الذكر</span>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 40%)" }}>سيظهر للمستخدمين فور التفعيل</p>
                </div>
                <button onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className="relative rounded-full transition-all duration-300 cursor-pointer"
                  style={{
                    width: 42, height: 24,
                    background: formData.isActive ? "hsl(142 60% 45%)" : "hsl(0 0% 20%)",
                    boxShadow: formData.isActive ? "0 0 12px hsl(142 60% 45% / 0.3)" : "none",
                  }}>
                  <div className="absolute top-0.5 rounded-full transition-all duration-300 bg-white shadow-md"
                    style={{ width: 20, height: 20, left: formData.isActive ? 20 : 2 }} />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !formData.content.trim()}
                className="w-full font-bold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 text-sm tracking-wide relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
                  color: "hsl(0 0% 5%)",
                  boxShadow: "0 4px 20px hsl(40 65% 48% / 0.3)",
                }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg, hsl(40 65% 58%), hsl(40 65% 46%))" }} />
                <span className="relative">
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      جاري الحفظ...
                    </span>
                  ) : editingId ? "حفظ التعديلات" : "إضافة الذكر ✨"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
