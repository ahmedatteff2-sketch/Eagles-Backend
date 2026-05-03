import { useAuthStore } from "@/store/auth";
import { useGetMemberCurrentSubscription, getGetMemberCurrentSubscriptionQueryKey } from "@workspace/api-client-react";

export default function MemberDashboard() {
  const { user } = useAuthStore();
  const userId = user?.id ?? 0;

  const { data: sub, isLoading } = useGetMemberCurrentSubscription(userId, {
    query: { queryKey: getGetMemberCurrentSubscriptionQueryKey(userId), enabled: !!userId },
  });

  const subData = sub as any;
  const isActive = subData?.status === "active";

  const daysLeft = subData?.endDate
    ? Math.max(0, Math.ceil((new Date(subData.endDate).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
            {user?.name?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">مرحباً، {user?.name}</h1>
            <p className="text-muted-foreground text-sm">{user?.phone}</p>
          </div>
        </div>
      </div>

      {/* Subscription card */}
      <div className={`bg-card border rounded-xl p-6 ${isActive ? "border-green-500/40" : "border-red-500/40"}`}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">اشتراكك الحالي</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {isLoading ? "..." : isActive ? "نشط" : "منتهي"}
          </span>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        ) : subData ? (
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-bold text-foreground">{subData.subscription?.name ?? "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">تاريخ البدء</p>
                <p className="text-foreground text-sm font-medium">
                  {new Date(subData.startDate).toLocaleDateString("ar-EG")}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">تاريخ الانتهاء</p>
                <p className="text-foreground text-sm font-medium">
                  {new Date(subData.endDate).toLocaleDateString("ar-EG")}
                </p>
              </div>
            </div>
            {daysLeft !== null && isActive && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                <p className="text-primary text-sm font-bold">
                  {daysLeft === 0 ? "ينتهي اليوم" : `متبقي ${daysLeft} يوم`}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">لا يوجد اشتراك نشط. تواصل مع المسؤول.</p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "برنامج التمارين", desc: "اطلع على تمارين هذا الأسبوع", href: "/member/workouts" },
          { label: "سجّل أداءك", desc: "تسجيل جلسة التمرين الحالية", href: "/member/log" },
          { label: "قياساتك", desc: "متابعة الوزن والدهون", href: "/member/stats" },
          { label: "سجل الحضور", desc: "مشاهدة تاريخ حضورك", href: "/member/attendance" },
        ].map((item) => (
          <a key={item.href} href={item.href} className="bg-card border border-card-border rounded-xl p-4 hover:border-primary/50 transition-colors block">
            <p className="font-semibold text-foreground text-sm">{item.label}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{item.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
