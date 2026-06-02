import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";

interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: string;
  earned: boolean;
}

export default function MemberBadges() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<Badge[]>("/api/badges")
      .then((d) => setBadges(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  if (loading)
    return (
      <div className="p-3 sm:p-6 text-center">
        <p className="text-muted-foreground text-sm">جاري التحميل...</p>
      </div>
    );

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">🏅 الإنجازات</h1>
        <p className="text-muted-foreground text-sm">
          {earned.length} من {badges.length} إنجاز محقق
        </p>
      </div>

      {/* Progress */}
      <div
        className="rounded-xl p-4"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-foreground">التقدم</span>
          <span className="text-sm font-black tabular-nums" style={{ color: GOLD }}>
            {Math.round((earned.length / badges.length) * 100)}%
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "hsl(0 0% 14%)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${(earned.length / badges.length) * 100}%`, background: GOLD }}
          />
        </div>
      </div>

      {/* Earned badges */}
      {earned.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3">✨ محقق</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {earned.map((b) => (
              <div
                key={b.id}
                className="rounded-xl p-3 text-center"
                style={{ background: "hsl(40 65% 48% / 0.08)", border: "1px solid hsl(40 65% 48% / 0.2)" }}
              >
                <div className="text-3xl mb-1">{b.icon}</div>
                <p className="text-xs font-bold" style={{ color: GOLD }}>
                  {b.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked badges */}
      {locked.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3">🔒 لم يُحقق بعد</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {locked.map((b) => (
              <div
                key={b.id}
                className="rounded-xl p-3 text-center opacity-50"
                style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
              >
                <div className="text-3xl mb-1 grayscale">{b.icon}</div>
                <p className="text-xs font-bold text-muted-foreground">{b.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
