import { useChangePassword } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";
import TwoFactorSection from "@/components/security/TwoFactorSection";
import SessionsSection from "@/components/security/SessionsSection";

const schema = z
  .object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: z.string().min(6, "كلمة المرور الجديدة 6 أحرف على الأقل"),
    confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

export default function MemberSettings() {
  const { toast } = useToast();
  const { user } = useAuthStore();

  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const handler = () => setCanInstall(true);
    window.addEventListener("pwa-installable", handler);
    return () => window.removeEventListener("pwa-installable", handler);
  }, []);

  // Track Notification permission in state seeded by a guarded read.
  // The Notification global is absent in iOS Safari < 16.4 and several
  // WebView/PWA wrappers — reading it bare (even with `?.`) throws a
  // ReferenceError, which the top-level ErrorBoundary then turns into
  // "حصل خطأ غير متوقع". Guard with `"Notification" in window` first.
  type NotifState = NotificationPermission | "unsupported";
  const [notifPermission, setNotifPermission] = useState<NotifState>(() => {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  });

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
    return "dark";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);
  const changePassword = useChangePassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    changePassword.mutate(
      { data: { currentPassword: data.currentPassword, newPassword: data.newPassword } },
      {
        onSuccess: () => {
          toast({ title: "تم تغيير كلمة المرور بنجاح" });
          reset();
        },
        onError: () =>
          toast({
            title: "خطأ في تغيير كلمة المرور",
            description: "تحقق من كلمة المرور الحالية",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-4">
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

      {/* Theme toggle */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">المظهر</h2>
        <div className="flex gap-3">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                theme === t ? "shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              style={theme === t ? { background: "hsl(40 65% 52%)", color: "#000" } : {}}
            >
              {t === "dark" ? "🌙 داكن" : "☀️ فاتح"}
            </button>
          ))}
        </div>
      </div>

      <TwoFactorSection />
      <SessionsSection />

      {/* Change password */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">تغيير كلمة المرور</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">كلمة المرور الحالية</label>
            <input
              {...register("currentPassword")}
              type="password"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.currentPassword && (
              <p className="text-destructive text-xs mt-1">{errors.currentPassword.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">كلمة المرور الجديدة</label>
            <input
              {...register("newPassword")}
              type="password"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.newPassword && (
              <p className="text-destructive text-xs mt-1">{errors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">تأكيد كلمة المرور</label>
            <input
              {...register("confirmPassword")}
              type="password"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.confirmPassword && (
              <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {changePassword.isPending ? "جاري التحديث..." : "تحديث كلمة المرور"}
          </button>
        </form>
      </div>
      {/* Push Notifications */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">الإشعارات</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">تنبيهات المتصفح</p>
              <p className="text-xs text-muted-foreground">استلم تنبيهات لموعد التمرين والتذكيرات</p>
            </div>
            <button
              disabled={notifPermission === "unsupported"}
              onClick={async () => {
                if (!("Notification" in window)) {
                  setNotifPermission("unsupported");
                  toast({ title: "المتصفح لا يدعم الإشعارات", variant: "destructive" });
                  return;
                }
                const perm = await Notification.requestPermission();
                setNotifPermission(perm);
                if (perm === "granted") {
                  toast({ title: "تم تفعيل الإشعارات" });
                  localStorage.setItem("push-enabled", "1");
                } else {
                  toast({ title: "تم رفض الإشعارات", variant: "destructive" });
                  localStorage.setItem("push-enabled", "0");
                }
              }}
              className="px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              style={
                notifPermission === "granted"
                  ? { background: "hsl(142 60% 45%)", color: "#fff" }
                  : { background: "hsl(40 65% 52%)", color: "#000" }
              }
            >
              {notifPermission === "granted"
                ? "مفعّل ✓"
                : notifPermission === "unsupported"
                  ? "غير مدعوم"
                  : "تفعيل"}
            </button>
          </div>
        </div>
      </div>

      {/* PWA Install */}
      {canInstall && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">تثبيت التطبيق</h2>
          <p className="text-xs text-muted-foreground mb-3">ثبّت التطبيق على جهازك للوصول السريع</p>
          <button
            onClick={() => (window as any).__pwaInstall?.()}
            className="w-full py-2.5 rounded-lg text-sm font-bold transition-colors"
            style={{ background: "hsl(40 65% 52%)", color: "#000" }}
          >
            📲 تثبيت التطبيق
          </button>
        </div>
      )}
    </div>
  );
}
