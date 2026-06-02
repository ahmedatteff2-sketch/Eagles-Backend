/**
 * Trainer's weekly schedule. The backend matches sessions whose `trainer_name`
 * field equals the trainer's User.name (the schedule table currently stores
 * trainer as free text — see services/trainer.service.ts).
 */
import { useTrainerSchedule } from "@workspace/api-client-react";

const DAYS_AR: Record<string, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
};

const DAY_ORDER = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

export default function TrainerSchedule() {
  const { data, isLoading, isError } = useTrainerSchedule();

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-[hsl(0_0%_9%)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <div className="p-6 text-center text-sm text-[hsl(0_72%_70%)]">تعذّر تحميل الجدول.</div>;
  }

  const sessions = data?.data ?? [];

  if (sessions.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-black text-[hsl(40_65%_60%)]">جدولي الأسبوعي</h1>
        </header>
        <div className="p-8 rounded-2xl bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] text-center text-sm text-[hsl(0_0%_50%)]">
          لا توجد جلسات مسجّلة لك في الجدول. كلّم الإدارة لإضافة حصصك.
        </div>
      </div>
    );
  }

  // Group by day, in week order.
  const grouped = new Map<string, typeof sessions>();
  for (const s of sessions) {
    if (!grouped.has(s.dayOfWeek)) grouped.set(s.dayOfWeek, []);
    grouped.get(s.dayOfWeek)!.push(s);
  }
  const sortedDays = DAY_ORDER.filter((d) => grouped.has(d));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-black text-[hsl(40_65%_60%)]">جدولي الأسبوعي</h1>
        <p className="text-sm text-[hsl(0_0%_50%)] mt-1">{sessions.length} جلسة</p>
      </header>

      {sortedDays.map((day) => (
        <section key={day} className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
          <h2 className="text-sm font-bold text-[hsl(40_65%_60%)] mb-3">{DAYS_AR[day]}</h2>
          <ul className="space-y-2">
            {grouped
              .get(day)!
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl p-3 bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_12%)]"
                >
                  <div className="flex-shrink-0 text-xs font-mono text-[hsl(40_65%_55%)] tabular-nums">
                    {s.startTime}
                    <br />
                    <span className="text-[hsl(0_0%_40%)]">{s.endTime}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(40_20%_88%)] truncate">{s.className}</p>
                    {(s.location || s.capacity != null) && (
                      <p className="text-[11px] text-[hsl(0_0%_50%)] mt-0.5">
                        {s.location ?? ""}
                        {s.location && s.capacity != null ? " • " : ""}
                        {s.capacity != null ? `سعة ${s.capacity}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
