import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";

const shakeKeyframes = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`;
const pulseGlow = `@keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px hsl(40 65% 48% / 0.2), 0 0 60px hsl(40 65% 48% / 0.1)} 50%{box-shadow:0 0 30px hsl(40 65% 48% / 0.35), 0 0 80px hsl(40 65% 48% / 0.15)} }`;
const fadeSlide = `@keyframes fadeSlide { 0%{opacity:0;transform:translateY(8px)} 15%{opacity:1;transform:translateY(0)} 85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-8px)} }`;
const float1 = `@keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,-20px)} }`;
const float2 = `@keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-10px,15px)} }`;

const MOTIVATIONAL = [
  "قوّتك الحقيقية تبدأ من هنا 💪",
  "كل يوم فرصة جديدة لتكون أقوى",
  "الاستمرارية هي سر التحوّل 🔥",
  "اصنع نسختك الأفضل",
  "لا حدود إلا اللي تحطها لنفسك",
];

const FEATURES = [
  { icon: "🏋️", text: "متابعة التمارين والأوزان" },
  { icon: "📊", text: "إحصائيات وتقارير متقدمة" },
  { icon: "📅", text: "جدولة ومتابعة الحضور" },
  { icon: "🎯", text: "أهداف تدريب شخصية" },
];

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
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [motIdx, setMotIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMotIdx(i => (i + 1) % MOTIVATIONAL.length), 3500);
    return () => clearInterval(t);
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    setLoginError("");
    login.mutate({ data }, {
      onSuccess: (res: any) => {
        setAuth(res.accessToken, res.refreshToken, res.user);
        setLocation(res.user?.role === "admin" ? "/admin" : "/member");
      },
      onError: () => {
        setLoginError("رقم الهاتف أو كلمة المرور غير صحيحة");
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
      },
    });
  }

  return (
    <div dir="rtl" className="min-h-screen flex relative overflow-hidden" style={{ background: "hsl(0 0% 4%)" }}>
      <style>{shakeKeyframes}{pulseGlow}{fadeSlide}{float1}{float2}</style>

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-15"
          style={{ background: "radial-gradient(ellipse, hsl(40 65% 48%) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[200px] rounded-full opacity-8"
          style={{ background: "radial-gradient(ellipse, hsl(40 65% 48%) 0%, transparent 70%)", filter: "blur(80px)" }} />
        {/* Floating particles */}
        <div className="absolute top-[15%] right-[10%] w-2 h-2 rounded-full opacity-20" style={{ background: GOLD, animation: "float1 6s ease-in-out infinite" }} />
        <div className="absolute top-[60%] right-[80%] w-1.5 h-1.5 rounded-full opacity-15" style={{ background: GOLD, animation: "float2 8s ease-in-out infinite" }} />
        <div className="absolute top-[30%] right-[70%] w-1 h-1 rounded-full opacity-25" style={{ background: GOLD, animation: "float1 7s ease-in-out infinite 1s" }} />
        <div className="absolute top-[75%] right-[25%] w-2.5 h-2.5 rounded-full opacity-10" style={{ background: GOLD, animation: "float2 9s ease-in-out infinite 2s" }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(hsl(40 65% 48%) 1px, transparent 1px), linear-gradient(90deg, hsl(40 65% 48%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Left side — features (desktop only) */}
      <div className="hidden lg:flex flex-col justify-center items-center flex-1 relative z-10 px-12">
        <div className="max-w-md">
          <div className="mb-10">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(circle, hsl(40 65% 48% / 0.2) 0%, transparent 70%)", filter: "blur(25px)", transform: "scale(1.5)" }} />
              <img src="/eagle-gym-logo.jpg" alt="Eagle Gym" className="relative w-24 h-24 rounded-3xl object-contain"
                style={{ background: "hsl(0 0% 6%)", animation: "pulseGlow 3s ease-in-out infinite", border: "1px solid hsl(40 65% 48% / 0.2)" }} />
            </div>
            <h1 className="text-4xl font-black tracking-wider uppercase mb-2">
              <span style={{ color: "hsl(40 65% 58%)" }}>Eagle</span>{" "}
              <span className="text-foreground">Gym</span>
            </h1>
            <p className="text-muted-foreground text-base mb-6">نظام متكامل لإدارة الصالة الرياضية</p>
            {/* Rotating motivational text */}
            <div className="h-8 overflow-hidden">
              <p key={motIdx} className="text-sm font-medium" style={{ color: "hsl(40 50% 65%)", animation: "fadeSlide 3.5s ease-in-out" }}>
                {MOTIVATIONAL[motIdx]}
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-xl p-4 flex items-center gap-3 transition-all duration-300"
                style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(40 65% 48% / 0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(0 0% 12%)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
                <span className="text-xl">{f.icon}</span>
                <span className="text-xs text-muted-foreground font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-sm">
          {/* Logo (mobile only) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-2xl opacity-50"
                style={{ background: "radial-gradient(circle, hsl(40 65% 48% / 0.3) 0%, transparent 70%)", filter: "blur(20px)", transform: "scale(1.3)" }} />
              <img src="/eagle-gym-logo.jpg" alt="Eagle Gym"
                className="relative w-28 h-28 rounded-2xl object-contain"
                style={{ background: "hsl(0 0% 6%)", animation: "pulseGlow 3s ease-in-out infinite", border: "1px solid hsl(40 65% 48% / 0.2)" }} />
            </div>
            <h1 className="text-2xl font-black tracking-[0.2em] uppercase mb-1" style={{ color: "hsl(40 65% 55%)" }}>
              Eagle <span style={{ color: "hsl(0 0% 88%)" }}>Gym</span>
            </h1>
            {/* Rotating motivational (mobile) */}
            <div className="h-6 overflow-hidden mt-1">
              <p key={motIdx} className="text-xs font-medium text-center" style={{ color: "hsl(40 50% 60%)", animation: "fadeSlide 3.5s ease-in-out" }}>
                {MOTIVATIONAL[motIdx]}
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-7 relative overflow-hidden"
            style={{
              background: "hsl(0 0% 8%)",
              border: loginError ? "1px solid hsl(0 72% 50% / 0.4)" : "1px solid hsl(0 0% 14%)",
              boxShadow: loginError ? "0 0 20px hsl(0 72% 50% / 0.1), 0 32px 64px rgba(0,0,0,0.5)" : "0 0 0 1px hsl(40 65% 48% / 0.06), 0 32px 64px rgba(0,0,0,0.5)",
              animation: shaking ? "shake 0.4s ease-in-out" : "none",
            }}>
            {/* Top gold line */}
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent 0%, hsl(40 65% 48% / 0.8) 50%, transparent 100%)" }} />

            <h2 className="text-base font-bold mb-1" style={{ color: "hsl(0 0% 78%)" }}>تسجيل الدخول</h2>
            <p className="text-xs text-muted-foreground mb-6">أدخل بياناتك للوصول لحسابك</p>

            {loginError && (
              <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm" style={{ background: "hsl(0 72% 50% / 0.1)", border: "1px solid hsl(0 72% 50% / 0.2)", color: "hsl(0 72% 65%)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {loginError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "hsl(0 0% 55%)" }}>رقم الهاتف</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </span>
                  <input {...register("phone")} type="tel" placeholder="مثال: 01025754947" autoComplete="username"
                    className="w-full rounded-xl pr-10 pl-4 py-3 text-sm transition-all focus:outline-none"
                    style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 90%)" }}
                    onFocus={e => { e.target.style.borderColor = "hsl(40 65% 48% / 0.6)"; e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.10)"; }}
                    onBlur={e => { e.target.style.borderColor = "hsl(0 0% 18%)"; e.target.style.boxShadow = "none"; }} />
                </div>
                {errors.phone && <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "hsl(0 72% 55%)" }}>⚠ {errors.phone.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "hsl(0 0% 55%)" }}>كلمة المرور</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <input {...register("password")} type={showPass ? "text" : "password"} placeholder="••••••••" autoComplete="current-password"
                    className="w-full rounded-xl pr-10 pl-10 py-3 text-sm transition-all focus:outline-none"
                    style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 90%)" }}
                    onFocus={e => { e.target.style.borderColor = "hsl(40 65% 48% / 0.6)"; e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.10)"; }}
                    onBlur={e => { e.target.style.borderColor = "hsl(0 0% 18%)"; e.target.style.boxShadow = "none"; }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "hsl(0 0% 35%)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "hsl(40 65% 52%)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "hsl(0 0% 35%)")}>
                    {showPass
                      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {errors.password && <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "hsl(0 72% 55%)" }}>⚠ {errors.password.message}</p>}
              </div>

              <button type="submit" disabled={login.isPending}
                className="w-full font-bold py-3.5 rounded-xl transition-all duration-200 mt-2 disabled:opacity-50 text-sm tracking-wide relative overflow-hidden group"
                style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))", color: "hsl(0 0% 5%)", boxShadow: login.isPending ? "none" : "0 4px 24px hsl(40 65% 48% / 0.35), 0 2px 8px rgba(0,0,0,0.3)" }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg, hsl(40 65% 58%), hsl(40 65% 46%))" }} />
                <span className="relative">
                  {login.isPending
                    ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> جاري الدخول...</span>
                    : "تسجيل الدخول →"}
                </span>
              </button>
            </form>
          </div>

          {/* Mobile features */}
          <div className="grid grid-cols-4 gap-2 mt-5 lg:hidden">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-lg p-2.5 flex flex-col items-center gap-1 text-center" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 11%)" }}>
                <span className="text-lg">{f.icon}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{f.text}</span>
              </div>
            ))}
          </div>

          <p className="text-center mt-6 text-xs" style={{ color: "hsl(0 0% 28%)" }}>
            🦅 Eagle Gym © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
