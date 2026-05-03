import { useAuthStore } from "@/store/auth";
import { useListCheckins, getListCheckinsQueryKey } from "@workspace/api-client-react";

export default function MemberAttendance() {
  const { user } = useAuthStore();
  const userId = user?.id ?? 0;

  const { data: checkins, isLoading } = useListCheckins(
    { userId },
    { query: { queryKey: getListCheckinsQueryKey({ userId }), enabled: !!userId } }
  );

  const checkinList = Array.isArray(checkins) ? checkins : (checkins as any)?.checkins ?? [];
  const sorted = checkinList.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group by month
  const grouped: Record<string, any[]> = {};
  for (const c of sorted) {
    const key = new Date(c.date).toLocaleDateString("ar-EG", { year: "numeric", month: "long" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">الحضور</h1>
        <p className="text-muted-foreground text-sm">سجل حضورك في النادي</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <p className="text-muted-foreground text-xs mb-1">إجمالي الحضور</p>
          <p className="text-2xl font-bold text-primary">{checkinList.length}</p>
          <p className="text-muted-foreground text-xs mt-1">يوم</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <p className="text-muted-foreground text-xs mb-1">هذا الشهر</p>
          <p className="text-2xl font-bold text-foreground">
            {checkinList.filter((c: any) => {
              const d = new Date(c.date);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </p>
          <p className="text-muted-foreground text-xs mt-1">يوم</p>
        </div>
      </div>

      {/* Attendance list */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">جاري التحميل...</p>
        ) : checkinList.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">لا يوجد سجل حضور</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([month, items]) => (
              <div key={month}>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{month} ({items.length})</h3>
                <div className="space-y-1">
                  {items.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        {new Date(c.date).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
