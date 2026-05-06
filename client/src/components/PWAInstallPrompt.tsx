import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-sm mx-auto rounded-2xl p-4 shadow-2xl flex items-center gap-3"
        style={{ background: "hsl(0 0% 8%)", border: `1px solid hsl(40 65% 48% / 0.3)` }}>
        <img src="/eagle-gym-logo.jpg" alt="" className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">حمّل التطبيق</p>
          <p className="text-xs text-muted-foreground">أضف Eagle Gym للشاشة الرئيسية</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleDismiss} className="px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors">
            لاحقاً
          </button>
          <button onClick={handleInstall} className="px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={{ background: GOLD, color: "#000" }}>
            تثبيت
          </button>
        </div>
      </div>
    </div>
  );
}
