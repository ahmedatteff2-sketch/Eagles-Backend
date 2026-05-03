import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  rent: { label: "إيجار", color: "#C9A84C" },
  utilities: { label: "مرافق", color: "#60a5fa" },
  salaries: { label: "رواتب", color: "#34d399" },
  equipment: { label: "معدات", color: "#f472b6" },
  maintenance: { label: "صيانة", color: "#fb923c" },
  marketing: { label: "تسويق", color: "#a78bfa" },
  other: { label: "أخرى", color: "#94a3b8" },
};

type Expense = {
  id: number;
  description: string;
  amount: string;
  date: string;
  category: string;
  notes?: string | null;
};

type ExpenseForm = {
  description: string;
  amount: string;
  date: string;
  category: string;
  notes: string;
};

function useExpenses(from?: string, to?: string) {
  const [data, setData] = useState<{ data: Expense[]; totalAmount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/expenses?${params}`);
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return { data, loading, refetch };
}

export default function AdminExpenses() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [form, setForm] = useState<ExpenseForm>({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0]!,
    category: "other",
    notes: "",
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      const res = await fetch(`/api/expenses?${params}`);
      const json = await res.json();
      setExpenses(json.data ?? []);
      setTotalAmount(json.totalAmount ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useState(() => { fetchExpenses(); });

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) {
      toast({ title: "يرجى تعبئة الحقول الإلزامية", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/expenses/${editingId}` : "/api/expenses";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      if (res.ok) {
        toast({ title: editingId ? "تم تحديث المصروف" : "تم إضافة المصروف" });
        setShowForm(false);
        setEditingId(null);
        setForm({ description: "", amount: "", date: new Date().toISOString().split("T")[0]!, category: "other", notes: "" });
        fetchExpenses();
      } else {
        toast({ title: "فشل في الحفظ", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("تأكيد حذف المصروف؟")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchExpenses();
  };

  const handleEdit = (e: Expense) => {
    setForm({ description: e.description, amount: String(Number(e.amount)), date: e.date, category: e.category, notes: e.notes ?? "" });
    setEditingId(e.id);
    setShowForm(true);
  };

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categoryTotals).map(([cat, val]) => ({
    name: CATEGORIES[cat]?.label ?? cat,
    value: val,
    color: CATEGORIES[cat]?.color ?? "#94a3b8",
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">المصاريف</h1>
          <p className="text-muted-foreground text-sm">تتبع مصاريف النادي</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ description: "", amount: "", date: new Date().toISOString().split("T")[0]!, category: "other", notes: "" }); }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          + إضافة مصروف
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5 col-span-2 lg:col-span-1">
          <p className="text-muted-foreground text-xs mb-1">إجمالي المصاريف</p>
          <p className="text-2xl font-bold text-destructive">{totalAmount.toLocaleString()} ج.م</p>
        </div>
        {Object.entries(categoryTotals).slice(0, 3).map(([cat, val]) => (
          <div key={cat} className="bg-card border border-card-border rounded-xl p-5">
            <p className="text-muted-foreground text-xs mb-1">{CATEGORIES[cat]?.label}</p>
            <p className="text-xl font-bold" style={{ color: CATEGORIES[cat]?.color }}>{Number(val).toLocaleString()} ج</p>
          </div>
        ))}
      </div>

      {/* Chart + Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieData.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">توزيع المصاريف</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} formatter={(v: number) => [`${Number(v).toLocaleString()} ج`, ""]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">تصفية بالتاريخ</h2>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">من</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">إلى</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <button onClick={fetchExpenses} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold">تطبيق</button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{editingId ? "تعديل المصروف" : "إضافة مصروف جديد"}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">الوصف *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="مثال: فاتورة كهرباء يناير" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">المبلغ (ج.م) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">التاريخ *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">الفئة</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                {Object.entries(CATEGORIES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">ملاحظات</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground" placeholder="اختياري" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-muted hover:bg-muted/80 text-muted-foreground py-2 rounded-lg text-sm font-medium">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "hsl(0 0% 8%)" }}>
            <tr>
              {["التاريخ", "الوصف", "الفئة", "المبلغ", "ملاحظات", ""].map(h => (
                <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا توجد مصاريف</td></tr>
            ) : expenses.map(e => (
              <tr key={e.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-foreground">{new Date(e.date).toLocaleDateString("ar-EG")}</td>
                <td className="px-4 py-3 text-foreground font-medium">{e.description}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: `${CATEGORIES[e.category]?.color}22`, color: CATEGORIES[e.category]?.color }}>
                    {CATEGORIES[e.category]?.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-destructive font-bold">{Number(e.amount).toLocaleString()} ج</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{e.notes ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => handleEdit(e)} className="text-xs text-primary hover:underline">تعديل</button>
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-destructive hover:underline">حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
