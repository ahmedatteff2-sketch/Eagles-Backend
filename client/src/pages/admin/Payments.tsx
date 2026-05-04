import { useState } from "react";
import {
  useListPayments, useCreatePayment, useListUsers,
  getListPaymentsQueryKey, getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const METHOD_LABELS: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل" };

const paySchema = z.object({
  userId: z.string().min(1, "اختر عضو"),
  amount: z.coerce.number().min(1, "المبلغ مطلوب"),
  date: z.string().min(1, "التاريخ مطلوب"),
  method: z.enum(["cash", "card", "transfer"]),
});
type PayForm = z.infer<typeof paySchema>;

export default function AdminPayments() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: payments, isLoading } = useListPayments(
    { page: 1, limit: 50 },
    { query: { queryKey: getListPaymentsQueryKey({ page: 1, limit: 50 }) } }
  );
  const { data: users } = useListUsers({}, { query: { queryKey: getListUsersQueryKey({}) } });

  const createPayment = useCreatePayment();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { method: "cash", date: new Date().toISOString().split("T")[0] },
  });

  function onSubmit(data: PayForm) {
    createPayment.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "تم تسجيل الدفعة" });
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        reset();
        setShowForm(false);
      },
      onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
    });
  }

  const payList = (payments as any)?.payments ?? (Array.isArray(payments) ? payments : []);
  const userList = Array.isArray(users) ? users : (users as any)?.users ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">المدفوعات</h1>
          <p className="text-muted-foreground text-sm">سجل المدفوعات</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          تسجيل دفعة
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">العضو</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">المبلغ</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">طريقة الدفع</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">جاري التحميل...</td></tr>
            ) : payList.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد مدفوعات</td></tr>
            ) : (
              payList.map((p: any) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{p.userName ?? "—"}</td>
                  <td className="px-4 py-3 text-primary font-bold">{p.amount} ج.م</td>
                  <td className="px-4 py-3">
                    <span className="bg-muted px-2 py-0.5 rounded-full text-xs text-muted-foreground">
                      {METHOD_LABELS[p.method] ?? p.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(p.date).toLocaleDateString("ar-EG")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">تسجيل دفعة جديدة</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">العضو</label>
                <select {...register("userId")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">اختر عضو</option>
                  {userList.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                {errors.userId && <p className="text-destructive text-xs mt-1">{errors.userId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">المبلغ (ج.م)</label>
                <input {...register("amount")} type="number" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                {errors.amount && <p className="text-destructive text-xs mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">طريقة الدفع</label>
                <select {...register("method")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="transfer">تحويل</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">التاريخ</label>
                <input {...register("date")} type="date" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                {errors.date && <p className="text-destructive text-xs mt-1">{errors.date.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createPayment.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {createPayment.isPending ? "جاري التسجيل..." : "تسجيل"}
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
