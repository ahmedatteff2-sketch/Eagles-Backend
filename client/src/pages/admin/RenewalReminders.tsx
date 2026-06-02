import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  bulkLogRenewalReminders,
  getExpiringMembers,
  getRenewalReminderLog,
  runRenewalRemindersNow,
  type ExpiringMember,
  type RenewalReminderLog,
} from "@/api-client/renewal-reminders";
import { toInternationalPhone } from "@/lib/phone";

const GOLD = "hsl(40 65% 52%)";
const GREEN = "#25D366";

/**
 * Admin "Renewal Reminders" page.
 *
 * Two stacked sections:
 *   1. Expiring soon — members whose subscription ends within the configured
 *      window (default 3 days). Admin picks recipients, hits "Send WhatsApp",
 *      and we open one wa.me tab per member while logging the send to the
 *      backend dedupe table so the cron job won't re-spam them.
 *   2. Recent log — last 200 reminder rows (system + manual) for an audit
 *      trail. Useful when a member calls and asks "did you remind me?".
 */
export default function AdminRenewalReminders() {
  const { toast } = useToast();
  const [days, setDays] = useState(3);
  const [items, setItems] = useState<ExpiringMember[]>([]);
  const [log, setLog] = useState<RenewalReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  async function refresh(withDays = days) {
    setLoading(true);
    try {
      const [exp, recent] = await Promise.all([getExpiringMembers(withDays), getRenewalReminderLog(200)]);
      setItems(exp.items);
      setLog(recent);
    } catch (err) {
      console.error(err);
      toast({ title: "فشل تحميل البيانات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDaysChange(n: number) {
    const clamped = Math.max(1, Math.min(30, n || 3));
    setDays(clamped);
    void refresh(clamped);
  }

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(items.map((m) => m.userId)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  /**
   * Send WhatsApp messages to selected expiring members.
   *
   * We open one wa.me tab per phone using a generic Arabic renewal
   * template, and once all tabs are queued we log the sends to the
   * dedupe table so the cron job won't re-target the same members
   * for the next 23h.
   */
  async function sendSelected() {
    const targets = items.filter((m) => selected.has(m.userId));
    if (!targets.length) return;
    setSending(true);
    try {
      for (const m of targets) {
        const phone = (m.phone ?? "").replace(/\D/g, "");
        if (!phone) continue;
        const intl = toInternationalPhone(phone);
        const text = `أهلاً ${m.name} 👋\n\nاشتراكك في Eagle Gym ينتهي يوم ${new Date(m.endDate).toLocaleDateString("ar-EG")} (باقي ${m.daysLeft} يوم).\n\nنتمنى تجديد اشتراكك للاستمرار في تحقيق أهدافك 💪`;
        const url = `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }
      await bulkLogRenewalReminders(
        targets.map((m) => m.userId),
        "Sent manually from RenewalReminders page",
      );
      toast({ title: `تم إرسال ${targets.length} رسالة` });
      clearSelection();
      void refresh();
    } catch (err) {
      console.error(err);
      toast({ title: "فشل تسجيل الإرسال", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function runJob() {
    setRunning(true);
    try {
      const summary = await runRenewalRemindersNow();
      toast({
        title: "تم تشغيل المهمة",
        description: `${summary.logged} تذكير تم تسجيله / ${summary.skipped} تم تخطيه`,
      });
      void refresh();
    } catch (err) {
      console.error(err);
      toast({ title: "فشل تشغيل المهمة", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  const allSelected = items.length > 0 && items.every((m) => selected.has(m.userId));
  const stats = useMemo(() => {
    const today = items.filter((m) => m.daysLeft <= 0).length;
    const reminded = items.filter((m) => m.lastReminderAt).length;
    return {
      total: items.length,
      today,
      reminded,
      pending: items.length - reminded,
    };
  }, [items]);

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3"
            style={{ color: "hsl(0 0% 90%)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 48% / 0.2), hsl(40 65% 48% / 0.05))",
                border: "1px solid hsl(40 65% 48% / 0.2)",
              }}
            >
              <span style={{ color: GOLD }}>🔔</span>
            </div>
            تذكيرات التجديد
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "hsl(0 0% 45%)" }}>
            متابعة الأعضاء قبل انتهاء الاشتراك وتشغيل المهمة الدورية يدويًا.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs" style={{ color: "hsl(0 0% 60%)" }}>
            خلال
            <input
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => onDaysChange(Number(e.target.value))}
              className="w-16 rounded-lg px-2 py-1.5 text-foreground focus:outline-none text-center"
              style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)" }}
            />
            يوم
          </label>
          <button
            onClick={runJob}
            disabled={running}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
              color: "hsl(0 0% 5%)",
            }}
          >
            {running ? "جاري التشغيل..." : "🚀 شغّل المهمة الآن"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "أعضاء قاربوا الانتهاء", value: stats.total, icon: "📊" },
          { label: "ينتهي اليوم/متأخر", value: stats.today, icon: "⚠️" },
          { label: "تم التذكير", value: stats.reminded, icon: "✅" },
          { label: "معلق", value: stats.pending, icon: "⏳" },
        ].map((s, i) => (
          <div
            key={i}
            className="rounded-xl p-4 text-center"
            style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}
          >
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold" style={{ color: "hsl(40 65% 60%)" }}>
              {s.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(0 0% 40%)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Expiring members section */}
      <section
        className="rounded-2xl"
        style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}
      >
        <header
          className="flex items-center justify-between flex-wrap gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid hsl(0 0% 12%)" }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: "hsl(0 0% 85%)" }}>
              قائمة الأعضاء ({items.length})
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 45%)" }}>
              يتم تخطي الاشتراكات المجمدة. {selected.size} محدد.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              disabled={items.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{
                background: "hsl(0 0% 14%)",
                color: "hsl(0 0% 75%)",
                border: "1px solid hsl(0 0% 22%)",
              }}
            >
              تحديد الكل
            </button>
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: "hsl(0 0% 60%)" }}
              >
                مسح ({selected.size})
              </button>
            )}
            <button
              onClick={sendSelected}
              disabled={sending || selected.size === 0}
              className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
              style={{
                background: "rgba(37,211,102,0.15)",
                color: GREEN,
                border: "1px solid rgba(37,211,102,0.3)",
              }}
            >
              {sending ? "جاري الإرسال..." : `📲 إرسال (${selected.size})`}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none" style={{ color: GOLD }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-sm" style={{ color: "hsl(0 0% 60%)" }}>
              لا يوجد أعضاء قاربوا على انتهاء الاشتراك خلال الـ {days} أيام القادمة.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "hsl(0 0% 12%)" }}>
            {items.map((m) => {
              const isSelected = selected.has(m.userId);
              const isOverdue = m.daysLeft <= 0;
              const isFresh =
                m.lastReminderAt && Date.now() - new Date(m.lastReminderAt).getTime() < 23 * 3600 * 1000;
              return (
                <li
                  key={m.memberSubscriptionId}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    background: isSelected ? "hsl(40 65% 48% / 0.06)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(m.userId)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: GOLD }}
                    aria-label={`تحديد ${m.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {m.name}
                      {m.membershipNumber && (
                        <span className="text-xs ml-2" style={{ color: "hsl(0 0% 45%)" }}>
                          · #{m.membershipNumber}
                        </span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: "hsl(0 0% 50%)" }}>
                      {m.phone} · {m.subName} · ينتهي {new Date(m.endDate).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0"
                    style={
                      isOverdue
                        ? { background: "hsl(0 70% 50% / 0.15)", color: "hsl(0 70% 65%)" }
                        : m.daysLeft === 1
                          ? { background: "hsl(30 90% 55% / 0.15)", color: "hsl(30 90% 65%)" }
                          : { background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 65%)" }
                    }
                  >
                    {isOverdue ? "متأخر" : `${m.daysLeft} يوم`}
                  </span>
                  {isFresh && (
                    <span
                      className="text-xs px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: "hsl(142 60% 45% / 0.15)", color: "hsl(142 60% 65%)" }}
                      title={m.lastReminderAt ?? ""}
                    >
                      ✓ تم التذكير
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent log section */}
      <section
        className="rounded-2xl"
        style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 12%)" }}
      >
        <header className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 12%)" }}>
          <h2 className="text-base font-bold" style={{ color: "hsl(0 0% 85%)" }}>
            سجل التذكيرات (آخر {log.length})
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 45%)" }}>
            يشمل المهمة التلقائية والإرسالات اليدوية.
          </p>
        </header>
        {log.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm" style={{ color: "hsl(0 0% 60%)" }}>
              لا توجد تذكيرات مسجلة بعد.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "hsl(0 0% 12%)" }}>
            {log.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {row.userName ?? row.userId}
                    <span className="text-xs ml-2" style={{ color: "hsl(0 0% 45%)" }}>
                      {row.userPhone}
                    </span>
                  </p>
                  {row.note && (
                    <p className="text-xs truncate" style={{ color: "hsl(0 0% 50%)" }}>
                      {row.note}
                    </p>
                  )}
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full flex-shrink-0"
                  style={
                    row.channel === "whatsapp"
                      ? { background: "rgba(37,211,102,0.15)", color: GREEN }
                      : { background: "hsl(0 0% 14%)", color: "hsl(0 0% 65%)" }
                  }
                >
                  {row.channel === "whatsapp" ? "واتساب" : "نظام"}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: "hsl(0 0% 45%)" }}>
                  {new Date(row.sentAt).toLocaleString("ar-EG", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
