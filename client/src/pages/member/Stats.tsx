import { useAuthStore } from "@/store/auth";
import {
  useListBodyStats, useCreateBodyStat, useDeleteBodyStat,
  getListBodyStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const statSchema = z.object({
  date: z.string().min(1),
  weight: z.coerce.number().optional(),
  bodyFat: z.coerce.number().optional(),
  dietNote: z.string().optional(),
  performanceNote: z.string().optional(),
});
type StatForm = z.infer<typeof statSchema>;

export default function MemberStats() {
  const { user } = useAuthStore();
  const userId = user?.id ?? 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bodyStats, isLoading } = useListBodyStats(
    { userId },
    { query: { queryKey: getListBodyStatsQueryKey({ userId }), enabled: !!userId } }
  );

  const createStat = useCreateBodyStat();
  const deleteStat = useDeleteBodyStat();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StatForm>({
    resolver: zodResolver(statSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0] },
  });

  function onSubmit(data: StatForm) {
    createStat.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "تم تسجيل القياسات" });
        queryClient.invalidateQueries({ queryKey: getListBodyStatsQueryKey({ userId }) });
        reset({ date: new Date().toISOString().split("T")[0] });
      },
      onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteStat.mutate({ statId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBodyStatsQueryKey({ userId }) });
      },
    });
  }

  const statList = Array.isArray(bodyStats) ? bodyStats : (bodyStats as any)?.stats ?? [];
  const chartData = statList
    .slice()
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((s: any) => ({
      date: new Date(s.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
      weight: s.weight,
      bodyFat: s.bodyFat,
    }))
    .filter((d: any) => d.weight || d.bodyFat);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">القياسات</h1>
        <p className="text-muted-foreground text-sm">متابعة الوزن والدهون وملاحظات التغذية</p>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">تطور القياسات</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              <Legend />
              <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={true} name="الوزن (كجم)" />
              <Line type="monotone" dataKey="bodyFat" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={true} name="الدهون (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Add stat form */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">إضافة قياس جديد</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">التاريخ</label>
            <input {...register("date")} type="date" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">الوزن (كجم)</label>
              <input {...register("weight")} type="number" step={0.1} placeholder="75.5" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">الدهون (%)</label>
              <input {...register("bodyFat")} type="number" step={0.1} placeholder="18.5" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">ملاحظات التغذية</label>
            <textarea {...register("dietNote")} rows={2} placeholder="سعرات حرارية، وجبات..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">ملاحظات الأداء</label>
            <textarea {...register("performanceNote")} rows={2} placeholder="شعرت بالقوة، زدت الوزن..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <button type="submit" disabled={createStat.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {createStat.isPending ? "جاري الحفظ..." : "حفظ القياس"}
          </button>
        </form>
      </div>

      {/* History */}
      {statList.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">سجل القياسات</h2>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          ) : (
            <div className="space-y-2">
              {statList.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((s: any) => (
                <div key={s.id} className="py-3 border-b border-border last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground">{new Date(s.date).toLocaleDateString("ar-EG", { weekday: "short", month: "short", day: "numeric" })}</p>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-destructive hover:underline">حذف</button>
                  </div>
                  <div className="flex gap-4">
                    {s.weight && <span className="text-primary text-sm font-bold">{s.weight} كجم</span>}
                    {s.bodyFat && <span className="text-chart-2 text-sm font-bold">{s.bodyFat}% دهون</span>}
                  </div>
                  {s.dietNote && <p className="text-muted-foreground text-xs mt-1">التغذية: {s.dietNote}</p>}
                  {s.performanceNote && <p className="text-muted-foreground text-xs">الأداء: {s.performanceNote}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
