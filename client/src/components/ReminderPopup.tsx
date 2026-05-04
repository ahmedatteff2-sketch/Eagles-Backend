import { useState, useEffect, useCallback } from "react";
import { getActiveReminders, Reminder } from "@/api-client/reminders";
import { useAuthStore } from "@/store/auth";

const GOLD = "hsl(40 65% 52%)";

export function ReminderPopup() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [currentReminder, setCurrentReminder] = useState<Reminder | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;

    getActiveReminders().then(data => {
      setReminders(data);
    }).catch(console.error);
  }, [accessToken]);

  useEffect(() => {
    if (reminders.length === 0) return;

    // Pick a random reminder every interval
    const intervals = reminders.map(reminder => {
      return setInterval(() => {
        setCurrentReminder(prev => prev ? prev : reminder);
      }, reminder.intervalMinutes * 60 * 1000);
    });

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [reminders]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setCurrentReminder(null);
      setIsClosing(false);
    }, 300);
  }, []);

  if (!currentReminder) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        animation: isClosing ? "fadeOut 0.3s ease-out" : "fadeIn 0.3s ease-out",
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideDown { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(30px) scale(0.95); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
      `}</style>

      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden relative"
        style={{
          background: "hsl(0 0% 7%)",
          border: "1px solid hsl(40 65% 48% / 0.25)",
          boxShadow: "0 0 80px hsl(40 65% 48% / 0.15), 0 32px 64px rgba(0,0,0,0.6)",
          animation: isClosing ? "slideDown 0.3s ease-out" : "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Glow effect */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, hsl(40 65% 48% / 0.2) 0%, transparent 70%)", filter: "blur(30px)", animation: "pulse-glow 3s ease-in-out infinite" }} />
        
        {/* Top gold line */}
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 55%), transparent)" }} />

        {/* Content */}
        <div className="relative p-8 text-center" dir="rtl">
          {/* Decorative icon */}
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 48% / 0.2), hsl(40 65% 48% / 0.05))",
              border: "1px solid hsl(40 65% 48% / 0.2)",
              boxShadow: "0 0 30px hsl(40 65% 48% / 0.1)"
            }}>
            <span className="text-3xl">🤲</span>
          </div>

          {/* Title */}
          <h2 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ color: GOLD, letterSpacing: "0.15em" }}>
            تذكير بذكر الله
          </h2>

          {/* Divider */}
          <div className="w-12 h-px mx-auto mb-5" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48% / 0.5), transparent)" }} />

          {/* Dhikr text */}
          <p className="text-xl font-bold leading-[2] mb-6" style={{ color: "hsl(0 0% 92%)", fontFamily: "'Amiri', 'Traditional Arabic', serif" }}>
            {currentReminder.content}
          </p>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide relative overflow-hidden group transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
              color: "hsl(0 0% 5%)",
              boxShadow: "0 4px 24px hsl(40 65% 48% / 0.35)"
            }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg, hsl(40 65% 58%), hsl(40 65% 46%))" }} />
            <span className="relative">جزاك الله خيراً ✨</span>
          </button>

          <p className="text-xs mt-4" style={{ color: "hsl(0 0% 30%)" }}>
            يتكرر كل {currentReminder.intervalMinutes} دقيقة
          </p>
        </div>
      </div>
    </div>
  );
}
