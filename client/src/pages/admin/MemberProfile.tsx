import { useParams, Link } from "wouter";
import {
  useGetUser, useGetMemberCurrentSubscription, useGetMemberSubscriptionHistory,
  useListCheckins, useListBodyStats, useAssignSubscription, useListSubscriptions,
  useListTrainingPrograms, useCreateTrainingProgram, useDeleteTrainingProgram,
  useListExerciseLogs,
  getGetUserQueryKey, getGetMemberCurrentSubscriptionQueryKey,
  getGetMemberSubscriptionHistoryQueryKey, getListCheckinsQueryKey,
  getListBodyStatsQueryKey, getListSubscriptionsQueryKey,
  getListTrainingProgramsQueryKey, getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const assignSchema = z.object({
  subscriptionId: z.coerce.number().min(1, "اختر خطة"),
  startDate: z.string().min(1, "التاريخ مطلوب"),
  paymentAmount: z.coerce.number().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});
type AssignForm = z.infer<typeof assignSchema>;

const programSchema = z.object({
  name: z.string().min(1, "اسم البرنامج مطلوب"),
});
type ProgramForm = z.infer<typeof programSchema>;

type Tab = "overview" | "training" | "progress";

export default function AdminMemberProfile() {
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id, 10);
  const [showAssign, setShowAssign] = useState(false);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useGetUser(userId, { query: { queryKey: getGetUserQueryKey(userId), enabled: !!userId } });
  const { data: currentSub } = useGetMemberCurrentSubscription(userId, {
    query: { queryKey: getGetMemberCurrentSubscriptionQueryKey(userId), enabled: !!userId },
  });
  const { data: subHistory } = useGetMemberSubscriptionHistory(userId, {
    query: { queryKey: getGetMemberSubscriptionHistoryQueryKey(userId), enabled: !!userId },
  });
  const { data: checkins } = useListCheckins(
    { userId },
    { query: { queryKey: getListCheckinsQueryKey({ userId }), enabled: !!userId } }
  );
  const { data: bodyStats } = useListBodyStats(
    { userId },
    { query: { queryKey: getListBodyStatsQueryKey({ userId }), enabled: !!userId } }
  );
  const { data: subscriptions } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() },
  });
  const { data: programs, isLoading: programsLoading } = useListTrainingPrograms(
    { userId },
    { query: { queryKey: getListTrainingProgramsQueryKey({ userId }), enabled: !!userId } }
  );
  const { data: exerciseLogs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } }
  );

  const assignSub = useAssignSubscription();
  const createProgram = useCreateTrainingProgram();
  const deleteProgram = useDeleteTrainingProgram();

  const assignForm = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
    defaultValues: { startDate: new Date().toISOString().split("T")[0], paymentMethod: "cash" },
  });
  const programForm = useForm<ProgramForm>({ resolver: zodResolver(programSchema) });

  function onAssign(data: AssignForm) {
    assignSub.mutate({ data: { ...data, userId } }, {
      onSuccess: () => {
        toast({ title: "تم تعيين الاشتراك" });
        queryClient.invalidateQueries({ queryKey: getGetMemberCurrentSubscriptionQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getGetMemberSubscriptionHistoryQueryKey(userId) });
        assignForm.reset();
        setShowAssign(false);
      },
      onError: () => toast({ title: "خطأ في تعيين الاشتراك", variant: "destructive" }),
    });
  }

  function onCreateProgram(data: ProgramForm) {
    createProgram.mutate({ data: { name: data.name, userId } }, {
      onSuccess: () => {
        toast({ title: "تم إنشاء البرنامج التدريبي" });
        queryClient.invalidateQueries({ queryKey: getListTrainingProgramsQueryKey({ userId }) });
        programForm.reset();
        setShowCreateProgram(false);
      },
      onError: () => toast({ title: "خطأ في إنشاء البرنامج", variant: "destructive" }),
    });
  }

  function handleDeleteProgram(programId: number) {
    if (!confirm("هل تريد حذف هذا البرنامج؟")) return;
    deleteProgram.mutate({ programId }, {
      onSuccess: () => {
        toast({ title: "تم حذف البرنامج" });
        queryClient.invalidateQueries({ queryKey: getListTrainingProgramsQueryKey({ userId }) });
      },
      onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
    });
  }

  const subList = Array.isArray(subscriptions) ? subscriptions : [];
  const checkinList = Array.isArray(checkins) ? checkins : (checkins as any)?.checkins ?? [];
  const statsList = Array.isArray(bodyStats) ? bodyStats : (bodyStats as any)?.stats ?? [];
  const historyList = Array.isArray(subHistory) ? subHistory : [];
  const programList = Array.isArray(programs) ? programs : [];
  const logList = Array.isArray(exerciseLogs) ? exerciseLogs : [];

  const chartData = statsList
    .slice()
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((s: any) => ({
      date: new Date(s.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
      weight: s.weight ? parseFloat(s.weight) : null,
      bodyFat: s.bodyFat ? parseFloat(s.bodyFat) : null,
    }));

  const activeSub = currentSub as any;
  const isActive = activeSub?.status === "active";
  const memberName = (user as any)?.name ?? "...";
  const memberPhone = (user as any)?.phone ?? "";

  const recentLogs = logList.slice(0, 10);
  const logsByExercise: Record<string, any[]> = {};
  for (const log of logList) {
    const key = log.exercise?.name ?? String(log.exerciseId);
    if (!logsByExercise[key]) logsByExercise[key] = [];
    logsByExercise[key].push(log);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "نظرة عامة" },
    { id: "training", label: `برامج التدريب (${programList.length})` },
    { id: "progress", label: "التطور والتقدم" },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/members">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </Link>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 30%), hsl(40 65% 22%))",
              color: "hsl(40 65% 65%)",
              border: "1px solid hsl(40 65% 48% / 0.3)",
            }}
          >
            {memberName[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{memberName}</h1>
            <p className="text-muted-foreground text-sm">{memberPhone}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAssign(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          تعيين اشتراك
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Current subscription */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">الاشتراك الحالي</h2>
              {activeSub ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-foreground">{activeSub.subscription?.name ?? "—"}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {isActive ? "نشط" : "منتهي"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    من {new Date(activeSub.startDate).toLocaleDateString("ar-EG")} إلى {new Date(activeSub.endDate).toLocaleDateString("ar-EG")}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">لا يوجد اشتراك نشط</p>
              )}
            </div>

            {/* Stats summary */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">ملخص النشاط</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{checkinList.length}</p>
                  <p className="text-xs text-muted-foreground">حضور</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{programList.length}</p>
                  <p className="text-xs text-muted-foreground">برامج</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{logList.length}</p>
                  <p className="text-xs text-muted-foreground">تمرين مسجل</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent check-ins */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">آخر الحضور</h2>
            {checkinList.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا يوجد سجل حضور</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {checkinList.slice(0, 14).map((c: any) => (
                  <span key={c.id} className="px-3 py-1.5 bg-muted rounded-lg text-xs text-foreground">
                    {new Date(c.date).toLocaleDateString("ar-EG", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Subscription history */}
          {historyList.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">تاريخ الاشتراكات</h2>
              <div className="space-y-2">
                {historyList.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.subscription?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.startDate).toLocaleDateString("ar-EG")} — {new Date(s.endDate).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {s.status === "active" ? "نشط" : "منتهي"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TRAINING TAB ===== */}
      {activeTab === "training" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">برامج التدريب المعينة لـ {memberName}</p>
            <button
              onClick={() => setShowCreateProgram(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              إضافة برنامج
            </button>
          </div>

          {programsLoading ? (
            <div className="bg-card border border-card-border rounded-xl p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : programList.length === 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-10 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mx-auto mb-3 text-muted-foreground">
                <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18" />
                <circle cx="6.5" cy="6.5" r="1.5" /><circle cx="6.5" cy="17.5" r="1.5" />
                <circle cx="17.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" />
              </svg>
              <p className="text-muted-foreground text-sm mb-3">لا يوجد برامج تدريب لهذا العضو</p>
              <button
                onClick={() => setShowCreateProgram(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold"
              >
                إنشاء أول برنامج
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {programList.map((p: any) => (
                <div key={p.id} className="bg-card border border-card-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-foreground">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("ar-EG") : "—"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                      {p.weekCount ?? 0} أسابيع
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/training/${p.id}`}>
                      <button className="flex-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors font-medium">
                        إدارة التمارين
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDeleteProgram(p.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              💡 بعد إنشاء البرنامج اضغط "إدارة التمارين" لإضافة الأسابيع والتمارين لكل أسبوع
            </p>
          </div>
        </div>
      )}

      {/* ===== PROGRESS TAB ===== */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          {/* Body stats chart */}
          {chartData.length > 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">تطور القياسات</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="الوزن (كجم)" connectNulls />
                  <Line type="monotone" dataKey="bodyFat" stroke="#60a5fa" strokeWidth={2} dot={false} name="دهون الجسم (%)" connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> الوزن (كجم)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> دهون الجسم (%)</span>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm">لا يوجد قياسات جسم مسجلة بعد</p>
            </div>
          )}

          {/* Latest body stats */}
          {statsList.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">آخر القياسات</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-right text-muted-foreground font-medium py-2 px-2">التاريخ</th>
                      <th className="text-right text-muted-foreground font-medium py-2 px-2">الوزن</th>
                      <th className="text-right text-muted-foreground font-medium py-2 px-2">الدهون%</th>
                      <th className="text-right text-muted-foreground font-medium py-2 px-2">ملاحظة الأداء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsList.slice().reverse().slice(0, 8).map((s: any) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-2 px-2 text-muted-foreground">{new Date(s.date).toLocaleDateString("ar-EG")}</td>
                        <td className="py-2 px-2 font-medium text-foreground">{s.weight ? `${parseFloat(s.weight)} كجم` : "—"}</td>
                        <td className="py-2 px-2 text-foreground">{s.bodyFat ? `${parseFloat(s.bodyFat)}%` : "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">{s.performanceNote ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exercise logs */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">سجل التمارين ({logList.length})</h2>
            {logList.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا يوجد تمارين مسجلة بعد</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(logsByExercise).slice(0, 6).map(([exerciseName, logs]) => {
                  const latest = logs[0];
                  const maxWeight = Math.max(...logs.map((l: any) => parseFloat(l.weight) || 0));
                  return (
                    <div key={exerciseName} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-foreground">{exerciseName}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{logs.length} سيت</span>
                          <span className="text-primary font-medium">أعلى وزن: {maxWeight} كجم</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {logs.slice(0, 5).map((l: any) => (
                          <span key={l.id} className="px-2 py-1 bg-muted rounded text-xs">
                            {l.reps} × {parseFloat(l.weight)} كجم
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        آخر تسجيل: {new Date(latest.date).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                  );
                })}
                {recentLogs.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">آخر 10 تسجيلات</h3>
                    <div className="space-y-1">
                      {recentLogs.map((l: any) => (
                        <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-xs">
                          <span className="text-foreground">{l.exercise?.name ?? "—"}</span>
                          <div className="flex gap-3 text-muted-foreground">
                            <span>سيت {l.setNumber}</span>
                            <span>{l.reps} × {parseFloat(l.weight)} كجم</span>
                            <span>{new Date(l.date).toLocaleDateString("ar-EG")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Subscription Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">تعيين اشتراك</h2>
            <form onSubmit={assignForm.handleSubmit(onAssign)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">خطة الاشتراك</label>
                <select {...assignForm.register("subscriptionId")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">اختر خطة</option>
                  {subList.map((s: any) => <option key={s.id} value={s.id}>{s.name} - {s.price} ج.م</option>)}
                </select>
                {assignForm.formState.errors.subscriptionId && <p className="text-destructive text-xs mt-1">{assignForm.formState.errors.subscriptionId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">تاريخ البداية</label>
                <input {...assignForm.register("startDate")} type="date" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">مبلغ الدفع (اختياري)</label>
                <input {...assignForm.register("paymentAmount")} type="number" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">طريقة الدفع</label>
                <select {...assignForm.register("paymentMethod")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="transfer">تحويل</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={assignSub.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {assignSub.isPending ? "جاري التعيين..." : "تعيين"}
                </button>
                <button type="button" onClick={() => setShowAssign(false)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Training Program Modal */}
      {showCreateProgram && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-1">إنشاء برنامج تدريبي</h2>
            <p className="text-muted-foreground text-sm mb-4">سيتم تعيينه لـ {memberName}</p>
            <form onSubmit={programForm.handleSubmit(onCreateProgram)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">اسم البرنامج</label>
                <input
                  {...programForm.register("name")}
                  placeholder="مثال: برنامج تضخيم - 4 أسابيع"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {programForm.formState.errors.name && (
                  <p className="text-destructive text-xs mt-1">{programForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createProgram.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {createProgram.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </button>
                <button type="button" onClick={() => setShowCreateProgram(false)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
