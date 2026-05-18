/**
 * Trainer settings — minimal scaffolding. The trainer can:
 *   - change their password (reuses existing /auth/change-password endpoint)
 *   - manage 2FA (planned: link to existing 2FA setup flow)
 *
 * Most settings (gym name, schedule, etc.) are admin-owned and don't belong
 * here.
 */
import { useState } from "react";
import { useChangePassword } from "@workspace/api-client-react";

export default function TrainerSettings() {
  const change = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPassword.length < 8) {
      setMsg({ type: "err", text: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." });
      return;
    }
    if (newPassword !== confirm) {
      setMsg({ type: "err", text: "تأكيد كلمة المرور لا يطابق." });
      return;
    }
    change.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          setMsg({
            type: "ok",
            text: "تم تغيير كلمة المرور. سيتم تسجيل خروجك من الأجهزة الأخرى.",
          });
          setCurrentPassword("");
          setNewPassword("");
          setConfirm("");
        },
        onError: () => {
          setMsg({ type: "err", text: "كلمة المرور الحالية غير صحيحة." });
        },
      },
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-black text-[hsl(40_65%_60%)]">الإعدادات</h1>
      </header>

      <section className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
        <h2 className="text-sm font-bold text-[hsl(40_20%_85%)] mb-3">تغيير كلمة المرور</h2>
        <form onSubmit={submit} className="space-y-2">
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="كلمة المرور الحالية"
            required
            className="w-full px-3 py-2 rounded-xl text-sm bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)] focus:border-[hsl(40_65%_48%)] focus:outline-none"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)"
            required
            minLength={8}
            className="w-full px-3 py-2 rounded-xl text-sm bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)] focus:border-[hsl(40_65%_48%)] focus:outline-none"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="تأكيد كلمة المرور"
            required
            className="w-full px-3 py-2 rounded-xl text-sm bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)] focus:border-[hsl(40_65%_48%)] focus:outline-none"
          />
          {msg && (
            <p
              className="text-xs"
              style={{ color: msg.type === "ok" ? "hsl(142 60% 65%)" : "hsl(0 72% 70%)" }}
            >
              {msg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={change.isPending}
            className="w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50 text-[hsl(0_0%_5%)] bg-gradient-to-br from-[hsl(40_65%_52%)] to-[hsl(40_65%_40%)]"
          >
            {change.isPending ? "..." : "حفظ كلمة المرور الجديدة"}
          </button>
        </form>
      </section>
    </div>
  );
}
