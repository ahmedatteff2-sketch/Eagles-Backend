import { useState } from "react";
import {
  useListUsers, useCreateUser, getListUsersQueryKey,
  useListSubscriptions, useAssignSubscription, getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  phone: z.string().min(10, "رقم الهاتف يجب أن يكون 10 أرقام على الأقل"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  role: z.enum(["member", "admin"]).default("member"),
  subscriptionId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  paymentAmount: z.coerce.number().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const METHOD_LABELS: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل" };

const inputClass =
  "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all";
const inputStyle = {
  background: "hsl(0 0% 12%)",
  border: "1px solid hsl(0 0% 22%)",
};

function FieldInput({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-destructive text-xs mt-1 flex items-center gap-1"><span>⚠</span>{error}</p>}
    </div>
  );
}

export default function AdminMembers() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users, isLoading } = useListUsers(
    { search: search || undefined },
    { query: { queryKey: getListUsersQueryKey({ search: search || undefined }) } }
  );
  const { data: subsData } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() },
  });

  const createUser = useCreateUser();
  const assignSub = useAssignSubscription();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      role: "member",
      startDate: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
    },
  });

  const selectedSubId = watch("subscriptionId");

  function onSubmit(data: CreateForm) {
    const { subscriptionId, startDate, paymentAmount, paymentMethod, ...userPayload } = data;

    createUser.mutate({ data: userPayload }, {
      onSuccess: (newUser: any) => {
        const userId = newUser?.id ?? newUser?.user?.id;

        if (subscriptionId && startDate && userId) {
          assignSub.mutate({
            data: {
              userId,
              subscriptionId,
              startDate,
              ...(paymentAmount ? { paymentAmount } : {}),
              ...(paymentMethod ? { paymentMethod } : {}),
            },
          }, {
            onSuccess: () => {
              toast({ title: "✅ تم إضافة العضو وتعيين الاشتراك بنجاح" });
            },
            onError: () => {
              toast({ title: "⚠ تم إضافة العضو ولكن فشل تعيين الاشتراك", variant: "destructive" });
            },
          });
        } else {
          toast({ title: "✅ تم إضافة العضو بنجاح" });
        }

        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        reset();
        setShowCreate(false);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "تحقق من البيانات المُدخلة";
        toast({ title: "خطأ في إضافة العضو", description: msg, variant: "destructive" });
      },
    });
  }

  const userList = Array.isArray(users) ? users : (users as any)?.data ?? (users as any)?.users ?? [];
  const subList = Array.isArray(subsData) ? subsData : [];

  const selectedPlan = subList.find((s: any) => s.id === Number(selectedSubId));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الأعضاء</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            إجمالي {(users as any)?.total ?? userList.length} عضو
          </p>
        </div>
        <button
          onClick={() => { reset(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all"
          style={{
            background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
            color: "hsl(0 0% 5%)",
            boxShadow: "0 4px 15px rgba(201,164,60,0.3)",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          إضافة عضو
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف..."
          className="w-full rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}
        />
      </div>

      {/* Members table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">الاسم</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">الهاتف</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">الاشتراك الحالي</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">تاريخ الانضمام</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    جاري التحميل...
                  </div>
                </td>
              </tr>
            ) : userList.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-muted-foreground">
                  {search ? `لا توجد نتائج لـ "${search}"` : "لا يوجد أعضاء بعد"}
                </td>
              </tr>
            ) : (
              userList.map((u: any) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
                  className="last:border-0 transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(0 0% 11%)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 55%)" }}
                      >
                        {u.name?.[0]}
                      </div>
                      <span className="font-medium text-foreground">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.phone}</td>
                  <td className="px-4 py-3">
                    {u.currentSubscription ? (
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: u.currentSubscription.status === "active"
                            ? "hsl(142 60% 50% / 0.15)"
                            : "hsl(0 0% 20%)",
                          color: u.currentSubscription.status === "active"
                            ? "hsl(142 60% 60%)"
                            : "hsl(0 0% 50%)",
                        }}
                      >
                        {u.currentSubscription.subscription?.name ?? "—"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">بدون اشتراك</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-EG") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/members/${u.id}`}>
                      <span
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        style={{ color: "hsl(40 65% 55%)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.background = "hsl(40 65% 48% / 0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.background = "transparent"; }}
                      >
                        عرض الملف
                      </span>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" style={{ backdropFilter: "blur(4px)" }}>
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(40 65% 48% / 0.2)" }}
          >
            {/* Modal header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
            >
              <div>
                <h2 className="text-base font-bold text-foreground">إضافة عضو جديد</h2>
                <p className="text-xs text-muted-foreground mt-0.5">أدخل بيانات العضو وحدد الاشتراك إذا أردت</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground transition-colors"
                style={{ background: "hsl(0 0% 14%)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Section: بيانات العضو */}
              <div
                className="text-xs font-bold uppercase tracking-widest pb-2"
                style={{ color: "hsl(40 65% 48%)", borderBottom: "1px solid hsl(40 65% 48% / 0.2)" }}
              >
                بيانات العضو
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="الاسم الكامل" error={errors.name?.message}>
                  <input
                    {...register("name")}
                    placeholder="أحمد محمد"
                    className={inputClass}
                    style={inputStyle}
                  />
                </FieldInput>
                <FieldInput label="رقم الهاتف" error={errors.phone?.message}>
                  <input
                    {...register("phone")}
                    placeholder="01xxxxxxxxx"
                    className={inputClass}
                    style={inputStyle}
                  />
                </FieldInput>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="كلمة المرور" error={errors.password?.message}>
                  <input
                    {...register("password")}
                    type="password"
                    placeholder="••••••"
                    className={inputClass}
                    style={inputStyle}
                  />
                </FieldInput>
                <FieldInput label="الدور">
                  <select
                    {...register("role")}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="member">عضو</option>
                    <option value="admin">مسؤول</option>
                  </select>
                </FieldInput>
              </div>

              {/* Section: الاشتراك */}
              <div
                className="text-xs font-bold uppercase tracking-widest pb-2 mt-2"
                style={{ color: "hsl(40 65% 48%)", borderBottom: "1px solid hsl(40 65% 48% / 0.2)" }}
              >
                الاشتراك (اختياري)
              </div>

              <FieldInput label="خطة الاشتراك">
                <select
                  {...register("subscriptionId")}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">— بدون اشتراك الآن —</option>
                  {subList.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.duration} يوم — {s.price} ج.م
                    </option>
                  ))}
                </select>
              </FieldInput>

              {selectedSubId && (
                <>
                  {selectedPlan && (
                    <div
                      className="rounded-lg px-3 py-2.5 text-xs flex items-center gap-2"
                      style={{ background: "hsl(142 60% 50% / 0.08)", border: "1px solid hsl(142 60% 50% / 0.2)", color: "hsl(142 60% 60%)" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>
                        سيتم تعيين اشتراك <strong>{selectedPlan.name}</strong> — {selectedPlan.duration} يوم بسعر <strong>{selectedPlan.price} ج.م</strong>
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FieldInput label="تاريخ البداية">
                      <input
                        {...register("startDate")}
                        type="date"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </FieldInput>
                    <FieldInput label="المبلغ المدفوع">
                      <input
                        {...register("paymentAmount")}
                        type="number"
                        placeholder={selectedPlan?.price?.toString() ?? "0"}
                        className={inputClass}
                        style={inputStyle}
                      />
                    </FieldInput>
                  </div>

                  <FieldInput label="طريقة الدفع">
                    <select
                      {...register("paymentMethod")}
                      className={inputClass}
                      style={inputStyle}
                    >
                      {Object.entries(METHOD_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </FieldInput>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createUser.isPending || assignSub.isPending}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                    color: "hsl(0 0% 5%)",
                  }}
                >
                  {createUser.isPending || assignSub.isPending ? "جاري الحفظ..." : "إضافة العضو"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)" }}
                >
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
