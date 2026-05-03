import { useState } from "react";
import {
  useListCheckins, useCreateCheckin, useListUsers,
  getListCheckinsQueryKey, getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const checkinSchema = z.object({
  userId: z.coerce.number().min(1, "اختر عضو"),
  date: z.string().min(1, "التاريخ مطلوب"),
});
type CheckinForm = z.infer<typeof checkinSchema>;

export default function AdminCheckins() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: checkins, isLoading } = useListCheckins(
    {},
    { query: { queryKey: getListCheckinsQueryKey({}) } }
  );
  const { data: users } = useListUsers({}, { query: { queryKey: getListUsersQueryKey({}) } });

  const createCheckin = useCreateCheckin();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CheckinForm>({
    resolver: zodResolver(checkinSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0] },
  });

  function onSubmit(data: CheckinForm) {
    createCheckin.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "تم تسجيل الحضور" });
        queryClient.invalidateQueries({ queryKey: getListCheckinsQueryKey() });
        reset({ date: new Date().toISOString().split("T")[0] });
        setShowForm(false);
      },
      onError: () => toast({ title: "خطأ في تسجيل الحضور", variant: "destructive" }),
    });
  }

  const checkinList = Array.isArray(checkins) ? checkins : (checkins as any)?.checkins ?? [];
  const userList = Array.isArray(users) ? users : (users as any)?.users ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الحضور</h1>
          <p className="text-muted-foreground text-sm">تسجيل ومتابعة الحضور</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          تسجيل حضور
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">العضو</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={2} className="text-center py-8 text-muted-foreground">جاري التحميل...</td></tr>
            ) : checkinList.length === 0 ? (
              <tr><td colSpan={2} className="text-center py-8 text-muted-foreground">لا يوجد سجل حضور</td></tr>
            ) : (
              checkinList.map((c: any) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.userName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(c.date).toLocaleDateString("ar-EG")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">تسجيل حضور</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">العضو</label>
                <select {...register("userId")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">اختر عضو</option>
                  {userList.filter((u: any) => u.role !== "admin").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {errors.userId && <p className="text-destructive text-xs mt-1">{errors.userId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">التاريخ</label>
                <input {...register("date")} type="date" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                {errors.date && <p className="text-destructive text-xs mt-1">{errors.date.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createCheckin.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {createCheckin.isPending ? "جاري التسجيل..." : "تسجيل"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold transition-colors">
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
