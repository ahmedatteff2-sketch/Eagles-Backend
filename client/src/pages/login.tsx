import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { PHONE_INPUT_REGEX } from "@/lib/phone";
import { STORAGE_KEYS } from "@/lib/storage";
import { verify2FA } from "@/lib/auth-extras";
import { ApiError } from "@/api-client/custom-fetch";

/**
 * Map the backend's HTTP status + JSON body to a precise Arabic error
 * message. The server already returns localized strings via `message`, but
 * we still pick our own copy per status so:
 *   - 401 stays a generic "phone or password wrong" (don't leak which one)
 *   - 423 surfaces the lockout duration prominently
 *   - 429 nudges the user to wait, not to keep retrying
 *   - 5xx + offline get distinct copy so the user knows the issue isn't them
 */
function loginErrorMessage(err: unknown): string {
  // No response at all → almost always a connectivity problem.
  if (err instanceof TypeError) {
    return "تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مجدداً";
  }
  if (!(err instanceof ApiError)) {
    return "حدث خطأ غير متوقع. حاول مجدداً";
  }
  const data = err.data as { message?: string; error?: string } | null;
  const serverMsg = typeof data?.message === "string" ? data.message : null;

  switch (err.status) {
    case 400:
      return serverMsg ?? "بيانات الدخول غير صالحة";
    case 401:
      return "رقم الهاتف أو كلمة المرور غير صحيحة";
    case 423:
      // Server already includes the remaining minutes — prefer its message.
      return serverMsg ?? "الحساب مغلق مؤقتاً بسبب محاولات دخول فاشلة. حاول لاحقاً";
    case 429:
      return serverMsg ?? "تم تجاوز عدد المحاولات المسموح به. حاول بعد ١٥ دقيقة";
    default:
      if (err.status >= 500) {
        return "خطأ في الخادم. حاول مجدداً بعد قليل";
      }
      return serverMsg ?? "تعذّر تسجيل الدخول. حاول مجدداً";
  }
}

const cssAnimations = `
@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
@keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-40px) scale(1.2)} }
@keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,30px) scale(0.8)} }
@keyframes float3 { 0%,100%{transform:translate(0,0) scale(1.1)} 50%{transform:translate(40px,20px) scale(0.9)} }
@keyframes pulseGlow { 0%,100%{opacity:0.15;transform:scale(1)} 50%{opacity:0.3;transform:scale(1.15)} }
@keyframes fadeInUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
@keyframes gridMove { from{background-position:0 0} to{background-position:40px 40px} }
`;

const schema = z.object({
  phone: z
    .string()
    .min(1, "رقم الهاتف مطلوب")
    .regex(PHONE_INPUT_REGEX, "صيغة رقم الهاتف غير صحيحة (5 أرقام على الأقل)"),
  password: z.string().min(1, "كلمة المرور مطلوبة").max(72, "كلمة المرور طويلة جداً (الحد الأقصى 72 حرفاً)"),
});

type FormData = z.infer<typeof schema>;

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { role: "admin" | "member" | "trainer"; [k: string]: unknown };
}

interface LoginRequires2FAResponse {
  requires2FA: true;
  partialToken: string;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  // Toast hook is intentionally unused on login — errors render inline.
  void useToast;
  const login = useLogin();
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [partialToken, setPartialToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function completeLogin(r: LoginResponse) {
    setAuth(r.accessToken, r.refreshToken, r.user as never);
    let next: string | null = null;
    try {
      next = sessionStorage.getItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN);
      if (next) sessionStorage.removeItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN);
    } catch {
      /* ignore */
    }
    if (next && !next.startsWith("/login")) {
      setLocation(next);
      return;
    }
    // Three roles → three landing pages. Keep this in sync with
    // RoleHomeRedirect in App.tsx.
    if (r.user?.role === "admin") setLocation("/admin");
    else if (r.user?.role === "trainer") setLocation("/trainer");
    else setLocation("/member");
  }

  function onSubmit(data: FormData) {
    setLoginError("");
    login.mutate(
      { data },
      {
        onSuccess: (res) => {
          // Backend returns either a full token pair OR a 2FA challenge with a
          // short-lived partial token. We dispatch on which one we got.
          const r = res as unknown as LoginResponse | LoginRequires2FAResponse;
          if ("requires2FA" in r && r.requires2FA) {
            setPartialToken(r.partialToken);
            setTotpCode("");
            return;
          }
          completeLogin(r as LoginResponse);
        },
        onError: (err) => {
          setLoginError(loginErrorMessage(err));
          setShaking(true);
          setTimeout(() => setShaking(false), 500);
        },
      },
    );
  }

  async function on2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partialToken) return;
    if (!/^\d{6}$/.test(totpCode)) {
      setLoginError("أدخل رمز من 6 أرقام");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    setVerifying(true);
    setLoginError("");
    try {
      const r = await verify2FA(partialToken, totpCode);
      completeLogin(r as unknown as LoginResponse);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "رمز التحقق غير صحيح";
      // The partial token expires after 5 minutes — kick the user back to the
      // password form when that happens so they can re-authenticate.
      if (/انتهت/.test(msg) || /expired/i.test(msg)) {
        setPartialToken(null);
        setTotpCode("");
        setLoginError("انتهت جلسة التحقق. يرجى تسجيل الدخول مجدداً");
      } else {
        setLoginError("رمز التحقق غير صحيح");
      }
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "hsl(0 0% 4%)" }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Moving grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(40 65% 48%) 1px, transparent 1px), linear-gradient(90deg, hsl(40 65% 48%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            animation: "gridMove 20s linear infinite",
          }}
        />
        {/* Top glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(ellipse, hsl(40 65% 48%) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-1/4 w-[300px] h-[200px] rounded-full opacity-10"
          style={{
            background: "radial-gradient(ellipse, hsl(40 65% 48%) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        {/* Floating particles */}
        <div
          className="absolute w-3 h-3 rounded-full top-[20%] left-[15%]"
          style={{
            background: "hsl(40 65% 48%)",
            opacity: 0.15,
            filter: "blur(1px)",
            animation: "float1 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-2 h-2 rounded-full top-[60%] right-[20%]"
          style={{
            background: "hsl(40 65% 48%)",
            opacity: 0.12,
            filter: "blur(1px)",
            animation: "float2 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-2.5 h-2.5 rounded-full top-[35%] right-[10%]"
          style={{
            background: "hsl(40 65% 48%)",
            opacity: 0.1,
            filter: "blur(1px)",
            animation: "float3 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-1.5 h-1.5 rounded-full top-[75%] left-[30%]"
          style={{
            background: "hsl(40 65% 48%)",
            opacity: 0.18,
            filter: "blur(1px)",
            animation: "float2 7s ease-in-out infinite 1s",
          }}
        />
        <div
          className="absolute w-2 h-2 rounded-full top-[10%] right-[35%]"
          style={{
            background: "hsl(40 65% 48%)",
            opacity: 0.08,
            filter: "blur(1px)",
            animation: "float1 9s ease-in-out infinite 2s",
          }}
        />
      </div>

      <div className="w-full max-w-sm relative z-10" style={{ animation: "fadeInUp 0.7s ease-out" }}>
        {/* Logo section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: "radial-gradient(circle, hsl(40 65% 48% / 0.3) 0%, transparent 70%)",
                filter: "blur(20px)",
                transform: "scale(1.3)",
                animation: "pulseGlow 4s ease-in-out infinite",
              }}
            />
            <img
              src="/eagle-gym-logo.jpg"
              alt="Eagle Gym"
              className="relative w-32 h-32 rounded-2xl object-contain"
              style={{
                background: "hsl(0 0% 6%)",
                boxShadow:
                  "0 0 0 1px hsl(40 65% 48% / 0.25), 0 0 40px hsl(40 65% 48% / 0.20), 0 20px 40px rgba(0,0,0,0.6)",
              }}
            />
          </div>
          <h1
            className="text-2xl font-black tracking-[0.2em] uppercase mb-1"
            style={{ color: "hsl(40 65% 55%)" }}
          >
            Eagle <span style={{ color: "hsl(0 0% 88%)" }}>Gym</span>
          </h1>
          <p className="text-sm" style={{ color: "hsl(0 0% 40%)" }}>
            نظام إدارة الصالة الرياضية
          </p>
        </div>

        <style>{cssAnimations}</style>
        {/* Card */}
        <div
          className="rounded-2xl p-7 relative overflow-hidden"
          style={{
            background: "hsl(0 0% 8%)",
            border: loginError ? "1px solid hsl(0 72% 50% / 0.4)" : "1px solid hsl(0 0% 14%)",
            boxShadow: loginError
              ? "0 0 20px hsl(0 72% 50% / 0.1), 0 32px 64px rgba(0,0,0,0.5)"
              : "0 0 0 1px hsl(40 65% 48% / 0.06), 0 32px 64px rgba(0,0,0,0.5)",
            animation: shaking ? "shake 0.4s ease-in-out" : "none",
          }}
        >
          {/* Top gold line */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, hsl(40 65% 48% / 0.8) 50%, transparent 100%)",
            }}
          />

          <h2 className="text-base font-bold mb-6" style={{ color: "hsl(0 0% 78%)" }}>
            {partialToken ? "🔐 التحقق بخطوتين" : "مرحباً بك 👋"}
          </h2>

          {loginError && (
            <div
              className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm"
              style={{
                background: "hsl(0 72% 50% / 0.1)",
                border: "1px solid hsl(0 72% 50% / 0.2)",
                color: "hsl(0 72% 65%)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 flex-shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {loginError}
            </div>
          )}

          {partialToken ? (
            <form onSubmit={on2FASubmit} className="space-y-4">
              <p className="text-xs" style={{ color: "hsl(0 0% 60%)" }}>
                أدخل الرمز الحالي من تطبيق المصادقة (Google Authenticator / Authy):
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "hsl(0 0% 55%)" }}>
                  رمز التحقق
                </label>
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  className="w-full rounded-xl px-4 py-3 text-center text-lg font-mono tracking-[0.5em] transition-all focus:outline-none"
                  style={{
                    background: "hsl(0 0% 12%)",
                    border: "1px solid hsl(0 0% 18%)",
                    color: "hsl(0 0% 90%)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "hsl(40 65% 48% / 0.6)";
                    e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.10)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "hsl(0 0% 18%)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={verifying || totpCode.length !== 6}
                className="w-full font-bold py-3.5 rounded-xl transition-all duration-200 mt-2 disabled:opacity-50 text-sm tracking-wide"
                style={{
                  background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
                  color: "hsl(0 0% 5%)",
                  boxShadow: verifying
                    ? "none"
                    : "0 4px 24px hsl(40 65% 48% / 0.35), 0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {verifying ? "جاري التحقق..." : "تأكيد"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPartialToken(null);
                  setTotpCode("");
                  setLoginError("");
                }}
                className="w-full text-xs py-2 transition-colors"
                style={{ color: "hsl(0 0% 50%)" }}
              >
                ← العودة لتسجيل الدخول
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "hsl(0 0% 55%)" }}>
                  رقم الهاتف
                </label>
                <input
                  {...register("phone")}
                  type="tel"
                  placeholder="مثال: 01025754947"
                  autoComplete="username"
                  className="w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
                  style={{
                    background: "hsl(0 0% 12%)",
                    border: "1px solid hsl(0 0% 18%)",
                    color: "hsl(0 0% 90%)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "hsl(40 65% 48% / 0.6)";
                    e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.10)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "hsl(0 0% 18%)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                {errors.phone && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "hsl(0 72% 55%)" }}>
                    ⚠ {errors.phone.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "hsl(0 0% 55%)" }}>
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none pl-10"
                    style={{
                      background: "hsl(0 0% 12%)",
                      border: "1px solid hsl(0 0% 18%)",
                      color: "hsl(0 0% 90%)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "hsl(40 65% 48% / 0.6)";
                      e.target.style.boxShadow = "0 0 0 3px hsl(40 65% 48% / 0.10)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "hsl(0 0% 18%)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "hsl(0 0% 35%)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(40 65% 52%)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(0 0% 35%)")}
                  >
                    {showPass ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "hsl(0 72% 55%)" }}>
                    ⚠ {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={login.isPending}
                className="w-full font-bold py-3.5 rounded-xl transition-all duration-200 mt-2 disabled:opacity-50 text-sm tracking-wide relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
                  color: "hsl(0 0% 5%)",
                  boxShadow: login.isPending
                    ? "none"
                    : "0 4px 24px hsl(40 65% 48% / 0.35), 0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "linear-gradient(135deg, hsl(40 65% 58%), hsl(40 65% 46%))" }}
                />
                <span className="relative">
                  {login.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>{" "}
                      جاري الدخول...
                    </span>
                  ) : (
                    "دخول →"
                  )}
                </span>
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "hsl(0 0% 28%)" }}>
          🦅 Eagle Gym © {new Date().getFullYear()} — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
