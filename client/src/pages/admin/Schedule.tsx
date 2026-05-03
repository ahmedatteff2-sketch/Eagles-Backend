import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const DAYS: Record<string, string> = {
  saturday: "السبت", sunday: "الأحد", monday: "الاثنين",
  tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة",
};
const DAY_ORDER = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

const COLORS = [
  "#C9A84C", "#60a5fa", "#34d399", "#f472b6", "#fb923c", "#a78bfa", "#38bdf8",
];

type ScheduleEntry = {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  className: string;
  trainerName?: string | null;
  capacity?: number | null;
  location?: string | null;
};

type FormData = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  className: string;
  trainerName: string;
  capacity: string;
  location: string;
};

export default function AdminSchedule() {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    dayOfWeek: "saturday", startTime: "08:00", endTime: "09:00",
    className: "", trainerName: "", capacity: "", location: "",
  });

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule");
      const json = await res.json();
      setSchedule(Array.isArray(json) ? json : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchSchedule(); }, []);

  const handleSave = async () => {
    if (!form.className || !form.startTime || !form.endTime) {
      toast({ title: "يرجى تعبئة الحقول الإلزامية", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        className: form.className,
      };
      if (form.trainerName) body.trainerName = form.trainerName;
      if (form.capacity) body.capacity = Number(form.capacity);
      if (form.location) body.location = form.location;

      const url = editingId ? `/api/schedule/${editingId}` : "/api/schedule";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast({ title: editingId ? "تم التحديث" : "تمت الإضافة" });
        setShowForm(false);
        setEditingId(null);
        fetchSchedule();
      } else {
        toast({ title: "فشل في الحفظ", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("تأكيد حذف الحصة؟")) return;
    await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchSchedule();
  };

  const handleEdit = (e: ScheduleEntry) => {
    setForm({
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
      className: e.className,
      trainerName: e.trainerName ?? "",
      capacity: e.capacity ? String(e.capacity) : "",
      location: e.location ?? "",
    });
    setEditingId(e.id);
    setShowForm(true);
  };

  const grouped = DAY_ORDER.reduce((acc, day) => {
    acc[day] = schedule.filter(s => s.dayOfWeek === day);
    return acc;
  }, {} as Record<string, ScheduleEntry[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الجدول الأسبوعي</h1>
          <p className="text-muted-foreground text-sm">إدارة حصص ودروس النادي</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ dayOfWeek: "saturday", startTime: "08:00", endTime: "09:00", className: "", trainerName: "", capacity: "", location: "" }); }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + إضافة حصة
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{editingId ? "تعديل الحصة" : "إضافة حصة جديدة"}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">اليوم *</label>
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                {DAY_ORDER.map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">من *</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">إلى *</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">اسم الحصة *</label>
              <input value={form.className} onChange={e => setForm(f => ({ ...f, className: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="مثال: CrossFit" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">المدرب</label>
              <input value={form.trainerName} onChange={e => setForm(f => ({ ...f, trainerName: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="اسم المدرب" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">السعة</label>
              <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="20" />
            </div>
            <div className="col-span-2 lg:col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">المكان</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="الصالة الرئيسية" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-muted text-muted-foreground py-2 rounded-lg text-sm">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAY_ORDER.map((day, di) => (
            <div key={day} className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid hsl(0 0% 12%)", background: "hsl(0 0% 7%)" }}>
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[di % COLORS.length] }} />
                <h3 className="text-sm font-bold text-foreground">{DAYS[day]}</h3>
                <span className="text-xs text-muted-foreground mr-auto">{grouped[day]?.length ?? 0} حصص</span>
              </div>
              <div className="p-3 space-y-2 min-h-[80px]">
                {grouped[day]?.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد حصص</p>
                ) : grouped[day]?.map(entry => (
                  <div key={entry.id} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(entry)} className="text-xs text-primary hover:underline">تعديل</button>
                        <span className="text-muted-foreground">·</span>
                        <button onClick={() => handleDelete(entry.id)} className="text-xs text-destructive hover:underline">حذف</button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{entry.className}</p>
                        <p className="text-xs text-primary font-medium">{entry.startTime} - {entry.endTime}</p>
                      </div>
                    </div>
                    {(entry.trainerName || entry.capacity || entry.location) && (
                      <div className="mt-2 flex flex-wrap gap-2 justify-end">
                        {entry.trainerName && <span className="text-xs text-muted-foreground">{entry.trainerName}</span>}
                        {entry.capacity && <span className="text-xs text-muted-foreground">· {entry.capacity} مقعد</span>}
                        {entry.location && <span className="text-xs text-muted-foreground">· {entry.location}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
