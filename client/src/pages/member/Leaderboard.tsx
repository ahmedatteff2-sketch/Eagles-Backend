import { customFetch } from "@/api-client/custom-fetch";
import { useAuthStore } from "@/store/auth";
import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";

interface LeaderEntry {
  id: string;
  name: string;
  sessions: number;
  volume: number;
}

export default function MemberLeaderboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"volume" | "sessions">("volume");

  useEffect(() => {
    customFetch<LeaderEntry[]>("/api/leaderboard")
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...data].sort((a, b) =>
    sort === "volume" ? b.volume - a.volume : b.sessions - a.sessions,
  );
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">🏅 لوحة الأوائل</h1>
        <p className="text-muted-foreground text-sm">ترتيب المتدربين حسب الأداء</p>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["volume", "الحجم التدريبي"],
            ["sessions", "عدد الجلسات"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              sort === key ? "" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={sort === key ? { background: GOLD, color: "#000" } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center p-8">
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">لا يوجد بيانات</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {sorted.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 items-end">
              {[1, 0, 2].map((idx) => {
                const entry = sorted[idx];
                if (!entry) return null;
                const isMe = entry.id === user?.id;
                const height = idx === 0 ? "h-28" : idx === 1 ? "h-24" : "h-20";
                return (
                  <div key={entry.id} className="text-center">
                    <div className="text-2xl mb-1">{medals[idx]}</div>
                    <p
                      className={`text-xs font-bold truncate mb-1 ${isMe ? "" : "text-foreground"}`}
                      style={isMe ? { color: GOLD } : {}}
                    >
                      {entry.name}
                    </p>
                    <div
                      className={`${height} rounded-t-xl flex flex-col items-center justify-center`}
                      style={{
                        background: isMe ? "hsl(40 65% 48% / 0.15)" : "hsl(0 0% 9%)",
                        border: `1px solid ${isMe ? "hsl(40 65% 48% / 0.3)" : "hsl(0 0% 14%)"}`,
                        borderBottom: "none",
                      }}
                    >
                      <p className="text-lg font-black" style={{ color: GOLD }}>
                        {sort === "volume"
                          ? entry.volume > 1000
                            ? `${(entry.volume / 1000).toFixed(0)}K`
                            : entry.volume
                          : entry.sessions}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {sort === "volume" ? "كجم" : "جلسة"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full list */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {sorted.map((entry, idx) => {
              const isMe = entry.id === user?.id;
              return (
                <div
                  key={entry.id}
                  className="px-4 py-3 flex items-center gap-3"
                  style={{
                    borderBottom: "1px solid hsl(0 0% 13%)",
                    background: isMe ? "hsl(40 65% 48% / 0.05)" : undefined,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                    style={{
                      background: idx < 3 ? "hsl(40 65% 48% / 0.15)" : "hsl(0 0% 14%)",
                      color: idx < 3 ? GOLD : "hsl(0 0% 50%)",
                    }}
                  >
                    {idx < 3 ? medals[idx] : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${isMe ? "" : "text-foreground"}`}
                      style={isMe ? { color: GOLD } : {}}
                    >
                      {entry.name} {isMe ? "(أنت)" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.sessions} جلسة</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-base font-black tabular-nums" style={{ color: GOLD }}>
                      {sort === "volume"
                        ? entry.volume > 1000
                          ? `${(entry.volume / 1000).toFixed(1)}K`
                          : entry.volume
                        : entry.sessions}
                    </p>
                    <p className="text-[10px] text-muted-foreground text-left">
                      {sort === "volume" ? "كجم" : "جلسة"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
