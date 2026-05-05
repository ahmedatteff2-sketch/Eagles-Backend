import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";

interface Notif { id: number; title: string; body: string | null; type: string; read: number; createdAt: string; }

const TYPE_ICONS: Record<string, string> = {
  general: "🔔", workout: "🏋️", subscription: "💳", achievement: "🏆", reminder: "⏰",
};

export default function MemberNotifications() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<Notif[]>("/api/notifications")
      .then(d => setNotifs(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function markAllRead() {
    customFetch("/api/notifications/read-all", { method: "POST" })
      .then(() => setNotifs(prev => prev.map(n => ({ ...n, read: 1 }))))
      .catch(() => {});
  }

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">🔔 الإشعارات</h1>
          <p className="text-muted-foreground text-sm">{unread > 0 ? `${unread} إشعار جديد` : "لا يوجد إشعارات جديدة"}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "hsl(40 65% 48% / 0.1)", color: GOLD }}>
            قراءة الكل
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center p-8"><p className="text-muted-foreground text-sm">جاري التحميل...</p></div>
      ) : notifs.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🔕</div>
          <p className="text-foreground font-medium mb-1">لا توجد إشعارات</p>
          <p className="text-muted-foreground text-sm">ستظهر هنا إشعاراتك</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div key={n.id} className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{
                background: n.read ? "hsl(0 0% 9%)" : "hsl(40 65% 48% / 0.05)",
                border: `1px solid ${n.read ? "hsl(0 0% 14%)" : "hsl(40 65% 48% / 0.15)"}`,
              }}>
              <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${n.read ? "text-foreground" : ""}`}
                    style={!n.read ? { color: GOLD } : {}}>{n.title}</p>
                  {!n.read && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GOLD }} />}
                </div>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.createdAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
