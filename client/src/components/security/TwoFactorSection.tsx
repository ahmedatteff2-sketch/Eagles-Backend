import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { setup2FA, enable2FA, disable2FA } from "@/lib/auth-extras";

const GOLD = "hsl(40 65% 52%)";
const inp = "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all";
const inpSt = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" };

/**
 * Render an otpauth:// URL as a QR code via the public api.qrserver.com
 * service. We deliberately avoid bundling a QR library to keep the JS
 * payload small — the secret is also shown as text below as a fallback.
 */
function qrSrc(otpauthUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
}

export default function TwoFactorSection() {
  const { toast } = useToast();
  const { data: me, refetch: refetchMe } = useGetMe();
  // useGetMe returns the user object — `totpEnabled` was added on the backend
  // but not yet typed in the OpenAPI schema, so we read it loosely here.
  const totpEnabled = (me as { totpEnabled?: boolean } | undefined)?.totpEnabled ?? false;

  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    // Reset transient form state whenever the toggle's "enabled" state changes
    // (e.g. after a successful enable/disable).
    setCode("");
    setPassword("");
    setMsg(null);
  }, [totpEnabled]);

  async function startSetup() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await setup2FA();
      setSetupData(res);
      setPhase("setup");
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "تعذّر بدء الإعداد" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    if (!/^\d{6}$/.test(code)) {
      setMsg({ type: "err", text: "أدخل رمز من 6 أرقام" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await enable2FA(code);
      toast({ title: "✅ تم تفعيل التحقق بخطوتين" });
      setPhase("idle");
      setSetupData(null);
      setCode("");
      await refetchMe();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "رمز التحقق غير صحيح" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    if (!password) {
      setMsg({ type: "err", text: "كلمة المرور مطلوبة" });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setMsg({ type: "err", text: "أدخل رمز من 6 أرقام" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await disable2FA(password, code);
      toast({ title: "✅ تم تعطيل التحقق بخطوتين" });
      setPhase("idle");
      setCode("");
      setPassword("");
      await refetchMe();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "بيانات غير صحيحة" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground tracking-wide">🔐 التحقق بخطوتين (2FA)</h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={
            totpEnabled
              ? { background: "hsl(142 60% 50% / 0.15)", color: "hsl(142 60% 60%)" }
              : { background: "hsl(0 0% 16%)", color: "hsl(0 0% 55%)" }
          }
        >
          {totpEnabled ? "مفعّل" : "غير مفعّل"}
        </span>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        طبقة حماية إضافية: عند تسجيل الدخول، هتحتاج رمز من تطبيق Google Authenticator أو Authy (أو أي تطبيق
        متوافق مع TOTP).
      </p>

      {msg && (
        <p
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            background: msg.type === "ok" ? "hsl(142 60% 50% / 0.1)" : "hsl(0 72% 50% / 0.1)",
            color: msg.type === "ok" ? "hsl(142 60% 60%)" : "hsl(0 72% 60%)",
            border: `1px solid ${msg.type === "ok" ? "hsl(142 60% 50% / 0.2)" : "hsl(0 72% 50% / 0.2)"}`,
          }}
        >
          {msg.text}
        </p>
      )}

      {/* Idle: show the right CTA depending on current state */}
      {phase === "idle" && !totpEnabled && (
        <button
          onClick={() => void startSetup()}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40 transition-all"
          style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD, border: "1px solid hsl(40 65% 48% / 0.25)" }}
        >
          {busy ? "..." : "تفعيل 2FA"}
        </button>
      )}

      {phase === "idle" && totpEnabled && (
        <button
          onClick={() => setPhase("disable")}
          className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={{ background: "hsl(0 72% 51% / 0.15)", color: "hsl(0 72% 60%)", border: "1px solid hsl(0 72% 51% / 0.25)" }}
        >
          تعطيل 2FA
        </button>
      )}

      {/* Setup phase: scan QR + enter code */}
      {phase === "setup" && setupData && (
        <div className="space-y-3 rounded-lg p-4" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 13%)" }}>
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">1) امسح الكود بتطبيق المصادقة</p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <img
              src={qrSrc(setupData.otpauthUrl)}
              alt="2FA QR"
              className="w-40 h-40 rounded-lg"
              style={{ background: "white", padding: 8 }}
            />
            <div className="flex-1 space-y-2 min-w-0">
              <p className="text-xs text-muted-foreground">لو مش قادر تمسح، أدخل الكود يدوياً:</p>
              <code
                className="block text-xs px-2 py-2 rounded font-mono break-all select-all"
                style={{ background: "hsl(0 0% 5%)", color: GOLD, border: "1px solid hsl(0 0% 14%)" }}
              >
                {setupData.secret}
              </code>
            </div>
          </div>

          <p className="text-xs font-bold text-foreground uppercase tracking-wide pt-2">2) أدخل الرمز اللي ظهر في التطبيق</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            className={inp + " font-mono tracking-[0.5em] text-center"}
            style={inpSt}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPhase("idle");
                setSetupData(null);
                setCode("");
                setMsg(null);
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium"
              style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
            >
              إلغاء
            </button>
            <button
              onClick={() => void confirmEnable()}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}
            >
              {busy ? "..." : "تأكيد التفعيل"}
            </button>
          </div>
        </div>
      )}

      {/* Disable phase: confirm with password + TOTP */}
      {phase === "disable" && (
        <div className="space-y-3 rounded-lg p-4" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 13%)" }}>
          <p className="text-xs text-muted-foreground">
            لتعطيل التحقق بخطوتين أدخل كلمة المرور والرمز الحالي من تطبيق المصادقة:
          </p>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inp}
              style={inpSt}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">رمز 2FA</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className={inp + " font-mono tracking-[0.5em] text-center"}
              style={inpSt}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPhase("idle");
                setCode("");
                setPassword("");
                setMsg(null);
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium"
              style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
            >
              إلغاء
            </button>
            <button
              onClick={() => void confirmDisable()}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
              style={{ background: "hsl(0 72% 51%)", color: "#fff" }}
            >
              {busy ? "..." : "تعطيل"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
