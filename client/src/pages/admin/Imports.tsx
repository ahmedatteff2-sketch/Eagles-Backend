import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      {children}
    </div>
  );
}

async function postCSV(url: string, csvText: string, token: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ csv: csvText }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "خطأ في الاستيراد");
  return res.json();
}

interface ImportResult {
  message: string;
  created: number;
  skipped?: number;
  errors: string[];
}

function ImportSection({
  title,
  description,
  endpoint,
  sampleCsv,
  sampleFileName,
}: {
  title: string;
  description: string;
  endpoint: string;
  sampleCsv: string;
  sampleFileName: string;
}) {
  const { accessToken } = useAuthStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string ?? "");
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (!csvText.trim()) {
      toast({ title: "يرجى اختيار ملف CSV أو كتابة البيانات", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await postCSV(endpoint, csvText, accessToken ?? "");
      setResult(data);
      toast({ title: data.message });
    } catch (err: any) {
      toast({ title: err.message ?? "فشل الاستيراد", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function downloadSample() {
    const blob = new Blob(["\uFEFF" + sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sampleFileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
        </div>
        <button
          onClick={downloadSample}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          تحميل نموذج CSV
        </button>
      </div>

      <div
        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors mb-3"
        onClick={() => fileRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 mx-auto mb-2 text-muted-foreground">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <p className="text-sm text-muted-foreground">
          {csvText ? "✓ تم تحميل الملف" : "اضغط لاختيار ملف CSV"}
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      </div>

      <div className="mb-3">
        <label className="block text-xs text-muted-foreground mb-1">أو الصق بيانات CSV مباشرة:</label>
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          rows={4}
          dir="ltr"
          placeholder={sampleCsv}
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <button
        onClick={handleImport}
        disabled={loading || !csvText.trim()}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? "جاري الاستيراد..." : "استيراد البيانات"}
      </button>

      {result && (
        <div className={`mt-4 p-4 rounded-lg border ${result.errors.length > 0 ? "border-yellow-500/30 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"}`}>
          <p className="text-sm font-semibold text-foreground mb-2">{result.message}</p>
          <div className="flex gap-4 text-xs mb-2">
            <span className="text-green-400">✓ تم إضافة: {result.created}</span>
            {result.skipped !== undefined && <span className="text-muted-foreground">↷ مكرر: {result.skipped}</span>}
            {result.errors.length > 0 && <span className="text-red-400">✗ أخطاء: {result.errors.length}</span>}
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AdminImports() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">استيراد البيانات</h1>
        <p className="text-muted-foreground text-sm">استيراد بيانات الأعضاء والمدفوعات من ملفات CSV</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImportSection
          title="استيراد الأعضاء"
          description="أضف أعضاء متعددين دفعة واحدة من ملف CSV. سيتم تخطي الأرقام المكررة."
          endpoint="/api/imports/members"
          sampleFileName="نموذج-الأعضاء.csv"
          sampleCsv={`name,phone,password,role\nأحمد محمد,01012345678,Gym@2024,member\nسارة علي,01098765432,Gym@2024,member\nعمر حسن,01155554444,Gym@2024,member`}
        />

        <ImportSection
          title="استيراد المدفوعات"
          description="استيراد سجلات المدفوعات. يجب أن يكون رقم الهاتف مسجلاً مسبقاً."
          endpoint="/api/imports/payments"
          sampleFileName="نموذج-المدفوعات.csv"
          sampleCsv={`phone,amount,date,method\n01012345678,500,2026-05-01,cash\n01098765432,750,2026-05-01,card\n01155554444,500,2026-05-02,transfer`}
        />
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-3">تنسيق ملف CSV</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">ملف الأعضاء</p>
            <div className="bg-input rounded-lg p-3 font-mono" dir="ltr">
              <p>name, phone, password, role</p>
              <p className="text-muted-foreground">الاسم, الهاتف, كلمة المرور, الدور</p>
              <p className="text-primary mt-1">الدور: member أو admin</p>
              <p className="text-primary">كلمة المرور الافتراضية: Gym@2024</p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">ملف المدفوعات</p>
            <div className="bg-input rounded-lg p-3 font-mono" dir="ltr">
              <p>phone, amount, date, method</p>
              <p className="text-muted-foreground">الهاتف, المبلغ, التاريخ, الطريقة</p>
              <p className="text-primary mt-1">الطريقة: cash, card, transfer</p>
              <p className="text-primary">التاريخ: YYYY-MM-DD</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
