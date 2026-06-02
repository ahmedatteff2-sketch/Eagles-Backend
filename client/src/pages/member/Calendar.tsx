import { useAuthStore } from "@/store/auth";
import {
  useListCheckins,
  useListExerciseLogs,
  getListCheckinsQueryKey,
  getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";

const GOLD = "hsl(40 65% 52%)";
const DAYS_AR = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

export default function WorkoutCalendar() {
  const { user } = useAuthStore();
  const userId = user?.id ?? "";
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  const { data: checkins } = useListCheckins(
    { userId },
    { query: { queryKey: getListCheckinsQueryKey({ userId }), enabled: !!userId } },
  );
  const { data: logs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } },
  );

  const checkinList: any[] = Array.isArray(checkins) ? checkins : ((checkins as any)?.data ?? []);
  const logList: any[] = Array.isArray(logs) ? logs : [];

  const checkinDates = new Set(
    checkinList.map((c: any) => {
      const d = new Date(c.timestamp ?? c.date ?? "");
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  );
  const logDates = new Set(logList.map((l: any) => l.date));

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = firstDay.getDay();
  const monthName = firstDay.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Stats
  const monthCheckins = checkinList.filter((c: any) => {
    const d = new Date(c.timestamp ?? c.date ?? "");
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;
  const monthLogs = logList.filter((l: any) => {
    const d = new Date(l.date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">📅 تقويم التمارين</h1>
        <p className="text-muted-foreground text-sm">متابعة أيام التمرين والحضور</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-foreground">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-3 text-center"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <p className="text-lg font-black" style={{ color: "hsl(142 60% 55%)" }}>
            {monthCheckins}
          </p>
          <p className="text-[10px] text-muted-foreground">يوم حضور</p>
        </div>
        <div
          className="rounded-xl p-3 text-center"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <p className="text-lg font-black" style={{ color: GOLD }}>
            {monthLogs}
          </p>
          <p className="text-[10px] text-muted-foreground">مجموعة مسجلة</p>
        </div>
      </div>

      {/* Calendar grid */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
      >
        <div className="grid grid-cols-7 gap-0">
          {DAYS_AR.map((d) => (
            <div
              key={d}
              className="text-center py-2 text-xs font-bold text-muted-foreground"
              style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
            >
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="py-3" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasCheckin = checkinDates.has(dateStr);
            const hasLog = logDates.has(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <div key={day} className="py-2.5 text-center relative">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                    isToday ? "ring-2 ring-primary" : ""
                  }`}
                  style={{
                    background:
                      hasCheckin && hasLog
                        ? `${GOLD}25`
                        : hasCheckin
                          ? "hsl(142 60% 55% / 0.15)"
                          : hasLog
                            ? "hsl(220 70% 65% / 0.15)"
                            : "transparent",
                    color:
                      hasCheckin || hasLog
                        ? hasCheckin && hasLog
                          ? GOLD
                          : hasCheckin
                            ? "hsl(142 60% 60%)"
                            : "hsl(220 70% 70%)"
                        : "hsl(0 0% 50%)",
                  }}
                >
                  {day}
                </span>
                {(hasCheckin || hasLog) && (
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {hasCheckin && (
                      <div className="w-1 h-1 rounded-full" style={{ background: "hsl(142 60% 55%)" }} />
                    )}
                    {hasLog && <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "hsl(142 60% 55%)" }} /> حضور
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: GOLD }} /> تمرين
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: `${GOLD}60` }} /> حضور + تمرين
        </div>
      </div>
    </div>
  );
}
