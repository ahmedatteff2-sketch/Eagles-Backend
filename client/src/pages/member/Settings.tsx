import { useChangePassword } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
  newPassword: z.string().min(6, "كلمة المرور الجديدة 6 أحرف على الأقل"),
  confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "كلمتا المرور غير متطابقتين",
  path: ["confirmPassword"],
});
type FormData = z.infer<typeof schema>;

export default function MemberSettings() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const changePassword = useChangePassword();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    changePassword.mutate({ data: { currentPassword: data.currentPassword, newPassword: data.newPassword } }, {
      onSuccess: () => {
        toast({ title: "تم تغيير كلمة المرور بنجاح" });
        reset();
      },
      onError: () => toast({ title: "خطأ في تغيير كلمة المرور", description: "تحقق من كلمة المرور الحالية", variant: "destructive" }),
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground text-sm">إدارة حسابك</p>
      </div>

      {/* Profile info */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">معلومات الحساب</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground text-sm">الاسم</span>
            <span className="text-foreground text-sm font-medium">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground text-sm">رقم الهاتف</span>
            <span className="text-foreground text-sm font-medium">{user?.phone}</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">تغيير كلمة المرور</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">كلمة المرور الحالية</label>
            <input {...register("currentPassword")} type="password" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            {errors.currentPassword && <p className="text-destructive text-xs mt-1">{errors.currentPassword.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">كلمة المرور الجديدة</label>
            <input {...register("newPassword")} type="password" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            {errors.newPassword && <p className="text-destructive text-xs mt-1">{errors.newPassword.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">تأكيد كلمة المرور</label>
            <input {...register("confirmPassword")} type="password" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            {errors.confirmPassword && <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>
          <button type="submit" disabled={changePassword.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {changePassword.isPending ? "جاري التحديث..." : "تحديث كلمة المرور"}
          </button>
        </form>
      </div>
    </div>
  );
}
