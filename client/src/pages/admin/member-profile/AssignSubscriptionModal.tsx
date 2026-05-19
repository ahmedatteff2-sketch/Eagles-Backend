import type { UseFormReturn } from "react-hook-form";
import type { AssignForm } from "./helpers";
import { inp } from "./helpers";

interface SubscriptionOption {
  id: number;
  name: string;
  price: number | string;
}

interface Props {
  isActive: boolean;
  isPending: boolean;
  subscriptions: SubscriptionOption[];
  form: UseFormReturn<AssignForm>;
  onSubmit: (data: AssignForm) => void;
  onClose: () => void;
}

export function AssignSubscriptionModal({
  isActive,
  isPending,
  subscriptions,
  form,
  onSubmit,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold text-foreground mb-4">
          {isActive ? "🔄 تجديد الاشتراك" : "✅ تعيين اشتراك"}
        </h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">خطة الاشتراك</label>
            <select {...form.register("subscriptionId")} className={inp}>
              <option value="">اختر خطة</option>
              {subscriptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} - {s.price} ج.م
                </option>
              ))}
            </select>
            {form.formState.errors.subscriptionId && (
              <p className="text-destructive text-xs mt-1">{form.formState.errors.subscriptionId.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">تاريخ البداية</label>
            <input {...form.register("startDate")} type="date" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">مبلغ الدفع (اختياري)</label>
            <input {...form.register("paymentAmount")} type="number" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">طريقة الدفع</label>
            <select {...form.register("paymentMethod")} className={inp}>
              <option value="cash">نقدي</option>
              <option value="card">بطاقة</option>
              <option value="transfer">تحويل</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                color: "hsl(0 0% 5%)",
              }}
            >
              {isPending ? "جاري التعيين..." : "تعيين"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
