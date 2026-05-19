import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";
const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

interface Report {
  month: number;
  year: number;
  totalSets: number;
  attendanceDays: number;
  trainingDays: number;
  maxWeight: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightChange: number | null;
}

export default function MonthlyReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    customFetch<Report>(`/api/analytics/monthly-report?month=${month}&year=${year}`)
      .then((d) => setReport(d))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [month, year]);

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">📊 التقرير الشهري</h1>
        <p className="text-muted-foreground text-sm">ملخص أدائك لكل شهر</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-foreground">
          {MONTHS_AR[month - 1]} {year}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl p-5 animate-pulse"
              style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
            >
              <div className="h-4 w-24 rounded bg-muted mb-2" />
              <div className="h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : report ? (
        <div className="space-y-3">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="أيام الحضور" value={report.attendanceDays} icon="✅" color="hsl(142 60% 55%)" />
            <StatCard label="أيام التمرين" value={report.trainingDays} icon="🏋️" color={GOLD} />
            <StatCard label="مجموعات مسجلة" value={report.totalSets} icon="💪" color="hsl(220 70% 65%)" />
            <StatCard label="أقصى وزن" value={`${report.maxWeight} كجم`} icon="🏆" color="hsl(0 70% 55%)" />
          </div>

          {/* Weight change */}
          {report.weightStart != null && report.weightEnd != null && (
            <div
              className="rounded-xl p-4"
              style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
            >
              <h3 className="text-sm font-bold text-foreground mb-3">⚖️ تغيّر الوزن</h3>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">بداية الشهر</p>
                  <p className="text-lg font-black text-foreground">{report.weightStart} كجم</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-2xl">→</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">نهاية الشهر</p>
                  <p className="text-lg font-black text-foreground">{report.weightEnd} كجم</p>
                </div>
              </div>
              {report.weightChange !== null && (
                <div className="text-center mt-3">
                  <span
                    className={`text-sm font-bold px-3 py-1 rounded-full ${report.weightChange < 0 ? "bg-green-500/15 text-green-400" : report.weightChange > 0 ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground"}`}
                  >
                    {report.weightChange > 0 ? "+" : ""}
                    {report.weightChange.toFixed(1)} كجم
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20` }}
          >
            <p className="text-sm text-muted-foreground">معدل التمرين</p>
            <p className="text-lg font-black" style={{ color: GOLD }}>
              {report.trainingDays > 0
                ? `${(report.trainingDays / 4.3).toFixed(1)} مرات/أسبوع`
                : "لم تتمرن هذا الشهر"}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <p className="text-muted-foreground text-sm">لا توجد بيانات</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
    >
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-xl font-black" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
