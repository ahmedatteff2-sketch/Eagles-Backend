import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const DAYS: Record<string, string> = {
  saturday: "السبت", sunday: "الأحد", monday: "الاثنين",
  tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة",
};
const DAY_ORDER = ["saturday","sunday","monday","tuesday","wednesday","thursday","friday"];
const COLORS = ["#C9A84C","#60a5fa","#34d399","#f472b6","#fb923c","#a78bfa","#38bdf8"];

type ScheduleEntry = {
  id: number; dayOfWeek: string; startTime: string; endTime: string;
  className: string; trainerName?: string|null; capacity?: number|null; location?: string|null;
};
type FormData = {
  dayOfWeek: string; startTime: string; endTime: string; className: string;
  trainerName: string; capacity: string; location: string;
};

export default function AdminSchedule() {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number|null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    dayOfWeek: "saturday", startTime: "08:00", endTime: "09:00",
    className: "", trainerName: "", capacity: "", location: "",
  });

  const fetchSchedule = async () => {
    setLoading(true);
    try { const res = await fetch("/api/schedule"); const json = await res.json(); setSchedule(Array.isArray(json) ? json : []); }
    catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchSchedule(); }, []);

  const handleSave = async () => {
    if (!form.className || !form.startTime || !form.endTime) {
      toast({ title: "يرجى تعبئة الحقول الإلزامية", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body: Record<string,unknown> = { dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime, className: form.className };
      if (form.trainerName) body.trainerName = form.trainerName;
      if (form.capacity) body.capacity = Number(form.capacity);
      if (form.location) body.location = form.location;
      const url = editingId ? `/api/schedule/${editingId}` : "/api/schedule";
      const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { toast({ title: editingId ? "تم التحديث" : "تمت الإضافة" }); setShowForm(false); setEditingId(null); fetchSchedule(); }
      else toast({ title: "فشل في الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("تأكيد حذف الحصة؟")) return;
    await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    fetchSchedule();
  };

  const handleEdit = (e: ScheduleEntry) => {
    setForm({ dayOfWeek: e.dayOfWeek, startTime: e.startTime, endTime: e.endTime, className: e.className,
      trainerName: e.trainerName ?? "", capacity: e.capacity?.toString() ?? "", location: e.location ?? "" });
    setEditingId(e.id); setShowForm(true);
  };

  const handlePrint = () => {
    const printContent = DAY_ORDER.map(day => {
      const entries = schedule.filter(s => s.dayOfWeek === day);
      if (!entries.length) return "";
      return `<div class="day-block"><h3>${DAYS[day]}</h3>${entries.map(e =>
        `<div class="entry"><strong>${e.className}</strong> — ${e.startTime}–${e.endTime}${e.trainerName ? " | " + e.trainerName : ""}${e.location ? " | " + e.location : ""}</div>`
      ).join("")}</div>`;
    }).filter(Boolean).join("");
    const gymName = (() => { try { return JSON.parse(localStorage.getItem("gym-settings") ?? "{}").gymName ?? "Eagle Gym"; } catch { return "Eagle Gym"; } })();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>الجدول الأسبوعي — ${gymName}</title><style>
      body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 30px; color: #111; }
      h1 { text-align: center; margin-bottom: 4px; font-size: 22px; }
      .sub { text-align: center; color: #777; font-size: 12px; margin-bottom: 24px; }
      .day-block { margin-bottom: 20px; page-break-inside: avoid; }
      h3 { background: #C9A84C; color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 14px; margin-bottom: 8px; display: inline-block; }
      .entry { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 14px; margin-bottom: 6px; font-size: 13px; }
      @media print { button { display: none; } }
    </style></head><body>
    <h1>🦅 ${gymName} — الجدول الأسبوعي</h1>
    <div class="sub">طُبع في: ${new Date().toLocaleDateString("ar-EG")}</div>
    ${printContent}
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`);
    win.document.close();
  };

  const inp = "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all";
  const inpSt = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <span>الرئيسية</span><span>/</span><span style={{ color: "hsl(40 65% 52%)" }}>الجدول الأسبوعي</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الجدول الأسبوعي</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة الحصص والمدربين</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)", border: "1px solid hsl(0 0% 20%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            طباعة
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ dayOfWeek: "saturday", startTime: "08:00", endTime: "09:00", className: "", trainerName: "", capacity: "", location: "" }); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            إضافة حصة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: "hsl(0 0% 9%)" }} />)}
        </div>
      ) : schedule.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-sm">الجدول فارغ — ابدأ بإضافة حصة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAY_ORDER.map((day, di) => {
            const entries = schedule.filter(s => s.dayOfWeek === day);
            if (!entries.length) return null;
            return (
              <div key={day} className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0 0% 15%)" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: "hsl(0 0% 9%)", borderBottom: "1px solid hsl(0 0% 13%)" }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[di % COLORS.length] }} />
                  <span className="text-sm font-bold text-foreground">{DAYS[day]}</span>
                  <span className="mr-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 50%)" }}>{entries.length}</span>
                </div>
                <div className="space-y-0" style={{ background: "hsl(0 0% 8%)" }}>
                  {entries.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(entry => (
                    <div key={entry.id} className="px-4 py-3 group" style={{ borderBottom: "1px solid hsl(0 0% 11%)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{entry.className}</p>
                          <p className="text-xs text-muted-foreground">{entry.startTime} – {entry.endTime}</p>
                          {entry.trainerName && <p className="text-xs mt-0.5" style={{ color: "hsl(40 65% 52%)" }}>{entry.trainerName}</p>}
                          {entry.location && <p className="text-xs text-muted-foreground">{entry.location}</p>}
                          {entry.capacity && <p className="text-xs text-muted-foreground">سعة: {entry.capacity}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => handleEdit(entry)} className="p-1.5 rounded-lg transition-colors" style={{ color: "hsl(0 0% 45%)" }} onMouseEnter={e=>(e.currentTarget.style.color="hsl(40 65% 55%)")} onMouseLeave={e=>(e.currentTarget.style.color="hsl(0 0% 45%)")}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: "hsl(0 0% 45%)" }} onMouseEnter={e=>(e.currentTarget.style.color="hsl(0 60% 60%)")} onMouseLeave={e=>(e.currentTarget.style.color="hsl(0 0% 45%)")}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
              <h2 className="text-base font-bold text-foreground">{editingId ? "تعديل الحصة" : "إضافة حصة جديدة"}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1 rounded-lg" style={{ color: "hsl(0 0% 45%)" }}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">اليوم *</label>
                  <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))} className={inp} style={inpSt}>
                    {DAY_ORDER.map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">اسم الحصة *</label>
                  <input value={form.className} onChange={e => setForm(f => ({ ...f, className: e.target.value }))} className={inp} style={inpSt} placeholder="مثال: يوغا" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">من</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className={inp} style={inpSt} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">إلى</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className={inp} style={inpSt} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">المدرب</label>
                  <input value={form.trainerName} onChange={e => setForm(f => ({ ...f, trainerName: e.target.value }))} className={inp} style={inpSt} placeholder="اختياري" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">السعة</label>
                  <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className={inp} style={inpSt} placeholder="عدد الأشخاص" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">الموقع</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inp} style={inpSt} placeholder="قاعة A" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                  {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة"}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)" }}>
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
