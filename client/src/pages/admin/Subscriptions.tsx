import { useState } from "react";
import {
  useListSubscriptions, useCreateSubscription, useUpdateSubscription, useDeleteSubscription,
  getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const subSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  duration: z.coerce.number().min(1, "المدة مطلوبة"),
  price: z.coerce.number().min(0, "السعر مطلوب"),
});
type SubForm = z.infer<typeof subSchema>;

export default function AdminSubscriptions() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subs, isLoading } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() },
  });

  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();
  const deleteSub = useDeleteSubscription();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<SubForm>({
    resolver: zodResolver(subSchema),
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", duration: 30, price: 0 });
    setShowForm(true);
  }

  function openEdit(sub: any) {
    setEditing(sub);
    setValue("name", sub.name);
    setValue("duration", sub.duration);
    setValue("price", sub.price);
    setShowForm(true);
  }

  function onSubmit(data: SubForm) {
    if (editing) {
      updateSub.mutate({ subscriptionId: editing.id, data }, {
        onSuccess: () => {
          toast({ title: "تم تحديث الاشتراك" });
          queryClient.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
          setShowForm(false);
        },
        onError: () => toast({ title: "خطأ في التحديث", variant: "destructive" }),
      });
    } else {
      createSub.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "تم إضافة الاشتراك" });
          queryClient.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
          setShowForm(false);
        },
        onError: () => toast({ title: "خطأ في الإضافة", variant: "destructive" }),
      });
    }
  }

  function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا الاشتراك؟")) return;
    deleteSub.mutate({ subscriptionId: id }, {
      onSuccess: () => {
        toast({ title: "تم حذف الاشتراك" });
        queryClient.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
      },
      onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
    });
  }

  const subList = Array.isArray(subs) ? subs : [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الاشتراكات</h1>
          <p className="text-muted-foreground text-sm">إدارة خطط الاشتراك</p>
        </div>
        <button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          إضافة خطة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-muted-foreground col-span-3 py-8 text-center">جاري التحميل...</p>
        ) : subList.length === 0 ? (
          <p className="text-muted-foreground col-span-3 py-8 text-center">لا توجد خطط اشتراك</p>
        ) : (
          subList.map((sub: any) => (
            <div key={sub.id} className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-foreground">{sub.name}</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">{sub.duration} يوم</p>
                </div>
                <span className="text-primary font-bold text-lg">{sub.price} ج.م</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openEdit(sub)} className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-1.5 rounded-lg text-xs font-medium transition-colors">
                  تعديل
                </button>
                <button onClick={() => handleDelete(sub.id)} className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive py-1.5 rounded-lg text-xs font-medium transition-colors">
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">{editing ? "تعديل الخطة" : "إضافة خطة جديدة"}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">اسم الخطة</label>
                <input {...register("name")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">المدة (أيام)</label>
                <input {...register("duration")} type="number" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                {errors.duration && <p className="text-destructive text-xs mt-1">{errors.duration.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">السعر (ج.م)</label>
                <input {...register("price")} type="number" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                {errors.price && <p className="text-destructive text-xs mt-1">{errors.price.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createSub.isPending || updateSub.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {editing ? "حفظ" : "إضافة"}
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
