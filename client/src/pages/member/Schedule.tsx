import { useState, useEffect } from "react";

const DAYS: Record<string, string> = {
  saturday: "السبت", sunday: "الأحد", monday: "الاثنين",
  tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة",
};
const DAY_ORDER = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];
const TODAY_MAP: Record<number, string> = { 6: "saturday", 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };

const COLORS = ["#C9A84C", "#60a5fa", "#34d399", "#f472b6", "#fb923c", "#a78bfa", "#38bdf8"];

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

export default function MemberSchedule() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(TODAY_MAP[new Date().getDay()] ?? "saturday");

  useEffect(() => {
    fetch("/api/schedule")
      .then(r => r.json())
      .then(d => setSchedule(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const daySchedule = schedule.filter(s => s.dayOfWeek === activeDay);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">الجدول الأسبوعي</h1>
        <p className="text-muted-foreground text-sm">مواعيد الحصص والدروس</p>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DAY_ORDER.map((day, i) => {
          const isToday = TODAY_MAP[new Date().getDay()] === day;
          const isActive = activeDay === day;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: isActive ? "hsl(40 65% 48% / 0.18)" : "hsl(0 0% 8%)",
                color: isActive ? "hsl(40 65% 60%)" : "hsl(0 0% 55%)",
                border: isActive ? "1px solid hsl(40 65% 48% / 0.4)" : "1px solid hsl(0 0% 12%)",
              }}
            >
              {DAYS[day]}
              {isToday && <span className="mr-1 text-xs opacity-70">• اليوم</span>}
            </button>
          );
        })}
      </div>

      {/* Schedule for selected day */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
      ) : daySchedule.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground">لا توجد حصص هذا اليوم</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daySchedule.map((entry, i) => (
            <div key={entry.id} className="bg-card border border-card-border rounded-xl p-5 flex items-start gap-4">
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-3 h-3 rounded-full mt-1" style={{ background: COLORS[i % COLORS.length] }} />
                <div className="w-0.5 flex-1 my-1" style={{ background: `${COLORS[i % COLORS.length]}44`, minHeight: 20 }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <p className="text-primary text-sm font-bold">{entry.startTime} - {entry.endTime}</p>
                  <p className="text-lg font-bold text-foreground text-right">{entry.className}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 justify-end">
                  {entry.trainerName && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">{entry.trainerName}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 text-muted-foreground">
                        <circle cx="12" cy="8" r="4" /><path d="M4 20v-1a8 8 0 0 1 16 0v1" />
                      </svg>
                    </div>
                  )}
                  {entry.capacity && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">{entry.capacity} مقعد</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 text-muted-foreground">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                  )}
                  {entry.location && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">{entry.location}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 text-muted-foreground">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
