import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExportCard({
  icon,
  title,
  desc,
  label,
  format,
  onExport,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  label: string;
  format: string;
  onExport: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "hsl(40 65% 48% / 0.12)", color: "hsl(40 65% 55%)" }}
      >
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-foreground mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 58%)" }}
        >
          {format}
        </span>
      </div>
      <button
        onClick={onExport}
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-bold transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{
          background: loading ? "hsl(0 0% 16%)" : "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
          color: loading ? "hsl(0 0% 50%)" : "hsl(0 0% 5%)",
        }}
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            جاري التصدير...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {label}
          </>
        )}
      </button>
    </div>
  );
}

export default function AdminExports() {
  const { toast } = useToast();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function doExport(path: string, filename: string, key: string) {
    setLoading((l) => ({ ...l, [key]: true }));
    try {
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "فشل التصدير");
      }
      const blob = await res.blob();
      downloadFile(blob, filename);
      toast({ title: "✅ تم التصدير بنجاح", description: filename });
    } catch (e: any) {
      toast({ title: "خطأ في التصدير", description: e.message, variant: "destructive" });
    } finally {
      setLoading((l) => ({ ...l, [key]: false }));
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">التصدير والنسخ الاحتياطي</h1>
        <p className="text-muted-foreground text-sm mt-0.5">تصدير بيانات النادي وإنشاء نسخ احتياطية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ExportCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <circle cx="9" cy="7" r="4" /><path d="M2 21v-1a7 7 0 0 1 14 0v1" />
              <circle cx="19" cy="8" r="3" /><path d="M22 21v-1a5 5 0 0 0-4-4.9" />
            </svg>
          }
          title="تصدير الأعضاء"
          desc="قائمة كاملة بجميع الأعضاء مع بيانات الاشتراكات الحالية"
          label="تحميل CSV"
          format="CSV"
          loading={loading["members"] ?? false}
          onExport={() => doExport("/api/exports/members-csv", `members-${today}.csv`, "members")}
        />

        <ExportCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
              <path d="M7 15h2M13 15h4" />
            </svg>
          }
          title="تصدير المدفوعات"
          desc="سجل كامل بجميع المدفوعات والمعاملات المالية"
          label="تحميل CSV"
          format="CSV"
          loading={loading["payments"] ?? false}
          onExport={() => doExport("/api/exports/payments-csv", `payments-${today}.csv`, "payments")}
        />

        <ExportCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M12 3v12" /><path d="M7 8l5-5 5 5" />
              <rect x="3" y="18" width="18" height="3" rx="1" />
            </svg>
          }
          title="نسخة احتياطية كاملة"
          desc="نسخة شاملة لجميع بيانات النادي — الأعضاء، التدريب، المدفوعات، الحضور"
          label="تحميل JSON"
          format="JSON"
          loading={loading["backup"] ?? false}
          onExport={() => doExport("/api/exports/full-backup", `eagle-gym-backup-${today}.json`, "backup")}
        />
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: "hsl(40 65% 48% / 0.06)", border: "1px solid hsl(40 65% 48% / 0.15)" }}
      >
        <div className="flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "hsl(40 65% 55%)" }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">ملاحظات مهمة</p>
            <ul className="text-muted-foreground text-sm space-y-1 list-disc list-inside">
              <li>جميع البيانات المُصدَّرة حقيقية وتعكس الوضع الحالي وقت التصدير</li>
              <li>ملفات CSV يمكن فتحها في Excel أو Google Sheets مباشرةً</li>
              <li>النسخة الاحتياطية JSON تحتوي على كامل بيانات النظام ويمكن استخدامها للاستعادة</li>
              <li>يُنصح بأخذ نسخة احتياطية دورية على الأقل مرة أسبوعياً</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
