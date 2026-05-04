import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useChangePassword } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth";
import { customFetch } from "@/api-client/custom-fetch";

const GOLD = "hsl(40 65% 52%)";
const inp = "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all";
const inpSt = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
      <h2 className="text-sm font-bold text-foreground tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
        style={{ background: value ? GOLD : "hsl(0 0% 20%)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{ right: value ? "2px" : "auto", left: value ? "auto" : "2px" }} />
      </button>
    </div>
  );
}

const SHORTCUTS = [
  { keys: "Ctrl + K", desc: "بحث سريع عن أي عضو" },
  { keys: "Escape", desc: "إغلاق أي نافذة مفتوحة" },
  { keys: "Alt + M", desc: "الانتقال لصفحة الأعضاء" },
  { keys: "Alt + A", desc: "الانتقال لصفحة الحضور" },
  { keys: "Alt + D", desc: "الانتقال للوحة التحكم" },
  { keys: "Alt + P", desc: "الانتقال للمدفوعات" },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const { user, clearAuth } = useAuthStore();
  const changePassword = useChangePassword();

  const [gymName, setGymName] = useState("Eagle Gym");
  const [gymPhone, setGymPhone] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [gymAbout, setGymAbout] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [saved, setSaved] = useState(false);

  // Change password
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  // Change phone
  const [newPhone, setNewPhone] = useState("");
  const [phonePass, setPhonePass] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("gym-settings");
    if (s) {
      const p = JSON.parse(s);
      setGymName(p.gymName ?? "Eagle Gym");
      setGymPhone(p.gymPhone ?? "");
      setGymAddress(p.gymAddress ?? "");
      setGymAbout(p.gymAbout ?? "");
    }
    const theme = localStorage.getItem("gym-theme") ?? "dark";
    setDarkMode(theme === "dark");
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, []);

  function applyTheme(dark: boolean) {
    setDarkMode(dark);
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("gym-theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("gym-theme", "light"); }
  }

  async function enableNotifs() {
    if (!("Notification" in window)) { toast({ title: "المتصفح لا يدعم الإشعارات", variant: "destructive" }); return; }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      new Notification("Eagle Gym 🦅", { body: "تم تفعيل الإشعارات بنجاح!", icon: "/eagle-gym-logo.jpg" });
      toast({ title: "✅ تم تفعيل الإشعارات" });
    } else {
      toast({ title: "لم يتم السماح بالإشعارات", variant: "destructive" });
    }
  }

  function save() {
    localStorage.setItem("gym-settings", JSON.stringify({ gymName, gymPhone, gymAddress, gymAbout }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast({ title: "✅ تم حفظ الإعدادات" });
  }

  async function handleChangePassword() {
    if (!currentPass || !newPass) { setPassMsg({ type: "err", text: "يرجى ملء جميع الحقول" }); return; }
    if (newPass.length < 8) { setPassMsg({ type: "err", text: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }); return; }
    setPassLoading(true);
    setPassMsg(null);
    changePassword.mutate({ data: { currentPassword: currentPass, newPassword: newPass } }, {
      onSuccess: () => {
        setPassMsg({ type: "ok", text: "تم تغيير كلمة المرور بنجاح! سيتم تسجيل خروجك..." });
        setCurrentPass(""); setNewPass("");
        setTimeout(() => { clearAuth(); window.location.replace("/login"); }, 2000);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || "كلمة المرور الحالية غير صحيحة";
        setPassMsg({ type: "err", text: msg });
      },
      onSettled: () => setPassLoading(false),
    });
  }

  async function handleChangePhone() {
    if (!newPhone || !phonePass) { setPhoneMsg({ type: "err", text: "يرجى ملء جميع الحقول" }); return; }
    setPhoneLoading(true);
    setPhoneMsg(null);
    try {
      await customFetch("/api/auth/update-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPhone, password: phonePass }),
      });
      setPhoneMsg({ type: "ok", text: "تم تحديث رقم الهاتف بنجاح!" });
      setNewPhone(""); setPhonePass("");
    } catch (err: any) {
      setPhoneMsg({ type: "err", text: err?.message || "كلمة المرور غير صحيحة" });
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الإعدادات</h1>
          <p className="text-muted-foreground text-sm mt-0.5">تخصيص النادي والتطبيق</p>
        </div>
        <button onClick={save}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{ background: saved ? "hsl(142 60% 45%)" : "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          {saved ? "✅ تم الحفظ" : "💾 حفظ"}
        </button>
      </div>

      {/* My Account */}
      <Section title="👤 حسابي">
        <p className="text-xs text-muted-foreground -mt-2">مسجّل دخول كـ: <span style={{ color: GOLD }}>{user?.name || "Admin"}</span> ({user?.phone || "—"})</p>
        
        {/* Change Password */}
        <div className="rounded-lg p-4 space-y-3" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 13%)" }}>
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">🔒 تغيير كلمة المرور</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">كلمة المرور الحالية</label>
              <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                className={inp} style={inpSt} placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">كلمة المرور الجديدة</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                className={inp} style={inpSt} placeholder="8 أحرف على الأقل" />
            </div>
          </div>
          {passMsg && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{
              background: passMsg.type === "ok" ? "hsl(142 60% 50% / 0.1)" : "hsl(0 72% 50% / 0.1)",
              color: passMsg.type === "ok" ? "hsl(142 60% 60%)" : "hsl(0 72% 60%)",
              border: `1px solid ${passMsg.type === "ok" ? "hsl(142 60% 50% / 0.2)" : "hsl(0 72% 50% / 0.2)"}`,
            }}>{passMsg.text}</p>
          )}
          <button onClick={handleChangePassword} disabled={passLoading}
            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40 transition-all"
            style={{ background: "hsl(0 72% 51% / 0.15)", color: "hsl(0 72% 60%)", border: "1px solid hsl(0 72% 51% / 0.25)" }}>
            {passLoading ? "جاري التغيير..." : "تغيير كلمة المرور"}
          </button>
        </div>

        {/* Change Phone */}
        <div className="rounded-lg p-4 space-y-3" style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 13%)" }}>
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">📱 تغيير رقم الهاتف</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">رقم الهاتف الجديد</label>
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                className={inp} style={inpSt} placeholder="01xxxxxxxxx" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">كلمة المرور (للتأكيد)</label>
              <input type="password" value={phonePass} onChange={e => setPhonePass(e.target.value)}
                className={inp} style={inpSt} placeholder="••••••••" />
            </div>
          </div>
          {phoneMsg && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{
              background: phoneMsg.type === "ok" ? "hsl(142 60% 50% / 0.1)" : "hsl(0 72% 50% / 0.1)",
              color: phoneMsg.type === "ok" ? "hsl(142 60% 60%)" : "hsl(0 72% 60%)",
              border: `1px solid ${phoneMsg.type === "ok" ? "hsl(142 60% 50% / 0.2)" : "hsl(0 72% 50% / 0.2)"}`,
            }}>{phoneMsg.text}</p>
          )}
          <button onClick={handleChangePhone} disabled={phoneLoading}
            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40 transition-all"
            style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD, border: "1px solid hsl(40 65% 48% / 0.25)" }}>
            {phoneLoading ? "جاري التحديث..." : "تحديث رقم الهاتف"}
          </button>
        </div>
      </Section>

      <Section title="هوية النادي">
        <div className="flex items-center gap-5">
          <img src="/eagle-gym-logo.jpg" alt="Eagle Gym"
            className="w-20 h-20 rounded-2xl object-contain flex-shrink-0"
            style={{ background: "hsl(0 0% 7%)", boxShadow: "0 0 0 1px hsl(40 65% 48% / 0.3), 0 0 20px hsl(40 65% 48% / 0.2)" }} />
          <div className="flex-1">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">اسم النادي</label>
            <input value={gymName} onChange={e => setGymName(e.target.value)} className={inp} style={inpSt} placeholder="Eagle Gym" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">رقم الهاتف</label>
            <input value={gymPhone} onChange={e => setGymPhone(e.target.value)} className={inp} style={inpSt} placeholder="01xxxxxxxxx" type="tel" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">العنوان</label>
            <input value={gymAddress} onChange={e => setGymAddress(e.target.value)} className={inp} style={inpSt} placeholder="القاهرة، مصر" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">نبذة عن النادي</label>
          <textarea value={gymAbout} onChange={e => setGymAbout(e.target.value)} rows={3}
            className={inp + " resize-none"} style={inpSt} placeholder="اكتب نبذة مختصرة عن النادي..." />
        </div>
      </Section>

      <Section title="المظهر">
        <div className="flex gap-3">
          {[{ label: "داكن 🌙", dark: true }, { label: "فاتح ☀️", dark: false }].map(opt => (
            <button key={String(opt.dark)} onClick={() => applyTheme(opt.dark)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
              style={darkMode === opt.dark
                ? { background: "hsl(40 65% 48% / 0.2)", color: "hsl(40 65% 58%)", border: "1.5px solid hsl(40 65% 48% / 0.5)" }
                : { background: "hsl(0 0% 12%)", color: "hsl(0 0% 50%)", border: "1px solid hsl(0 0% 20%)" }}>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">يتم حفظ الاختيار تلقائياً ويُطبق عند كل تسجيل دخول</p>
      </Section>

      <Section title="إشعارات المتصفح">
        <Toggle value={notifPermission === "granted"}
          onChange={v => { if (v) enableNotifs(); }}
          label="تفعيل الإشعارات"
          sub="تلقّ إشعارات عند انتهاء اشتراكات الأعضاء" />
        {notifPermission === "denied" && (
          <div className="rounded-lg p-3 text-xs" style={{ background: "hsl(0 60% 50% / 0.1)", border: "1px solid hsl(0 60% 50% / 0.2)", color: "hsl(0 60% 60%)" }}>
            ⚠️ رُفض إذن الإشعارات — اسمح للموقع يدوياً من إعدادات المتصفح
          </div>
        )}
        {notifPermission === "granted" && (
          <button onClick={() => new Notification("Eagle Gym 🦅", { body: "إشعار تجريبي ✅", icon: "/eagle-gym-logo.jpg" })}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 55%)" }}>
            اختبار إشعار
          </button>
        )}
      </Section>

      <Section title="اختصارات لوحة المفاتيح">
        <div className="space-y-1">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "hsl(0 0% 13%)" }}>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              <kbd className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(40 65% 55%)", border: "1px solid hsl(0 0% 22%)" }}>
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </Section>

      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/eagle-gym-logo.jpg" alt="" className="w-6 h-6 rounded object-contain" />
          <span className="text-sm font-bold" style={{ color: GOLD }}>Eagle Gym</span>
        </div>
        <p className="text-xs text-muted-foreground">نظام إدارة النادي — v2.0</p>
        <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 28%)" }}>PWA — قابل للتثبيت على الهاتف والكمبيوتر</p>
      </div>
    </div>
  );
}
