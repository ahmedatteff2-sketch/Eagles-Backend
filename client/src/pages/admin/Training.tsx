import { useState } from "react";
import {
  useListTrainingPrograms, useCreateTrainingProgram, useDeleteTrainingProgram,
  useListUsers, getListTrainingProgramsQueryKey, getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  userId: z.string().min(1, "اختر عضو"),
});
type FormData = z.infer<typeof schema>;

export default function AdminTraining() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: programs, isLoading } = useListTrainingPrograms(
    {},
    { query: { queryKey: getListTrainingProgramsQueryKey({}) } }
  );
  const { data: users } = useListUsers({}, { query: { queryKey: getListUsersQueryKey({}) } });

  const createProgram = useCreateTrainingProgram();
  const deleteProgram = useDeleteTrainingProgram();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    createProgram.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "تم إنشاء البرنامج" });
        queryClient.invalidateQueries({ queryKey: getListTrainingProgramsQueryKey() });
        reset();
        setShowForm(false);
      },
      onError: () => toast({ title: "خطأ في الإنشاء", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا البرنامج؟")) return;
    deleteProgram.mutate({ programId: id }, {
      onSuccess: () => {
        toast({ title: "تم حذف البرنامج" });
        queryClient.invalidateQueries({ queryKey: getListTrainingProgramsQueryKey() });
      },
      onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
    });
  }

  const programList = Array.isArray(programs) ? programs : (programs as any)?.programs ?? [];
  const userList = Array.isArray(users) ? users : (users as any)?.users ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">برامج التدريب</h1>
          <p className="text-muted-foreground text-sm">إدارة برامج التدريب للأعضاء</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          إنشاء برنامج
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">اسم البرنامج</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">العضو</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">تاريخ الإنشاء</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">جاري التحميل...</td></tr>
            ) : programList.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد برامج تدريب</td></tr>
            ) : (
              programList.map((p: any) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {userList.find((u: any) => u.id === p.userId)?.name ?? p.userId}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString("ar-EG") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/training/${p.id}`}>
                        <span className="text-primary text-xs hover:underline cursor-pointer">تفاصيل</span>
                      </Link>
                      <button onClick={() => handleDelete(p.id)} className="text-destructive text-xs hover:underline">
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">إنشاء برنامج تدريبي</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">اسم البرنامج</label>
                <input {...register("name")} placeholder="برنامج تضخيم - 4 أسابيع" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>
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
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createProgram.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {createProgram.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm font-semibold">
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
