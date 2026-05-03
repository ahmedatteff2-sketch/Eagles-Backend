import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  phone: z.string().min(1, "رقم الهاتف مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const login = useLogin();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    login.mutate({ data }, {
      onSuccess: (res: any) => {
        setAuth(res.accessToken, res.refreshToken, res.user);
        if (res.user.role === "admin") {
          setLocation("/admin");
        } else {
          setLocation("/member");
        }
      },
      onError: () => {
        toast({ title: "خطأ في تسجيل الدخول", description: "رقم الهاتف أو كلمة المرور غير صحيحة", variant: "destructive" });
      },
    });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(201,164,60,0.08) 0%, transparent 60%), hsl(0 0% 5%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <img
                src="/eagle-gym-logo.jpg"
                alt="Eagle Gym"
                className="w-36 h-36 object-contain rounded-2xl"
                style={{ filter: "drop-shadow(0 0 24px rgba(201,164,60,0.4))" }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-wider text-foreground uppercase">
            Eagle <span style={{ color: "hsl(40 65% 48%)" }}>Gym</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 font-medium">نظام إدارة الصالة الرياضية</p>
        </div>

        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: "hsl(0 0% 9%)",
            border: "1px solid hsl(40 65% 48% / 0.2)",
            boxShadow: "0 0 0 1px hsl(40 65% 48% / 0.08), 0 20px 60px rgba(0,0,0,0.6)",
          }}
        >
          <h2
            className="text-lg font-bold mb-6 pb-4"
            style={{
              borderBottom: "1px solid hsl(0 0% 16%)",
              color: "hsl(40 20% 90%)",
            }}
          >
            تسجيل الدخول
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                رقم الهاتف
              </label>
              <input
                {...register("phone")}
                type="tel"
                placeholder="01025754947"
                autoComplete="username"
                className="w-full rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm transition-all focus:outline-none"
                style={{
                  background: "hsl(0 0% 14%)",
                  border: "1px solid hsl(0 0% 20%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(40 65% 48% / 0.6)";
                  e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(0 0% 20%)";
                  e.target.style.boxShadow = "none";
                }}
              />
              {errors.phone && (
                <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                كلمة المرور
              </label>
              <input
                {...register("password")}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm transition-all focus:outline-none"
                style={{
                  background: "hsl(0 0% 14%)",
                  border: "1px solid hsl(0 0% 20%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(40 65% 48% / 0.6)";
                  e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(0 0% 20%)";
                  e.target.style.boxShadow = "none";
                }}
              />
              {errors.password && (
                <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full font-bold py-3 rounded-lg transition-all duration-200 mt-2 disabled:opacity-50 text-sm tracking-wide uppercase"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                color: "hsl(0 0% 5%)",
                boxShadow: login.isPending ? "none" : "0 4px 20px rgba(201,164,60,0.35)",
              }}
            >
              {login.isPending ? "جاري تسجيل الدخول..." : "دخول"}
            </button>
          </form>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Eagle Gym &copy; {new Date().getFullYear()} — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
