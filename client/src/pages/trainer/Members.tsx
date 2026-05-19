/**
 * Trainer's members list. Search-as-you-type, surfaces last check-in and
 * subscription status so the trainer can spot at-risk members at a glance.
 *
 * Filtering is client-side because (a) the server only returns `assigned`
 * members so the result set is bounded, and (b) round-tripping for every
 * keystroke would feel laggy.
 */
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useTrainerMembers } from "@workspace/api-client-react";

type StatusFilter = "all" | "active" | "expiring" | "expired" | "no_sub";

export default function TrainerMembers() {
  const { data, isLoading, isError } = useTrainerMembers();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const members = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date().toISOString().split("T")[0];
    const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];

    return members.filter((m) => {
      if (q) {
        const hay = `${m.name} ${m.phone} ${m.membershipNumber ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const sub = m.currentSubscription;
      switch (filter) {
        case "all":
          return true;
        case "no_sub":
          return !sub;
        case "active":
          return Boolean(sub && sub.status === "active" && sub.endDate >= today);
        case "expiring":
          return Boolean(sub && sub.status === "active" && sub.endDate >= today && sub.endDate <= in7);
        case "expired":
          return Boolean(sub && sub.endDate < today);
      }
    });
  }, [members, query, filter]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl font-black text-[hsl(40_65%_60%)]">أعضائي</h1>
        <p className="text-sm text-[hsl(0_0%_50%)] mt-1">{data ? `${data.total} عضو مخصص لك` : "..."}</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف أو الكود..."
          className="flex-1 px-3 py-2 rounded-xl text-sm bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)] placeholder:text-[hsl(0_0%_40%)] focus:border-[hsl(40_65%_48%)] focus:outline-none"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 rounded-xl text-sm bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)] focus:border-[hsl(40_65%_48%)] focus:outline-none"
        >
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="expiring">قرب الانتهاء (7 أيام)</option>
          <option value="expired">منتهٍ</option>
          <option value="no_sub">بدون اشتراك</option>
        </select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-[hsl(0_0%_9%)] animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="p-6 rounded-2xl bg-[hsl(0_72%_51%/0.08)] border border-[hsl(0_72%_51%/0.25)] text-sm text-[hsl(0_72%_70%)] text-center">
          تعذّر تحميل قائمة الأعضاء.
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="p-8 rounded-2xl bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] text-center">
          <p className="text-sm text-[hsl(0_0%_50%)]">
            {query || filter !== "all"
              ? "لا توجد نتائج بهذا البحث."
              : "لم يتم تخصيص أي عضو لك بعد. كلّم الإدارة لإضافة الأعضاء."}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((m) => {
          const sub = m.currentSubscription;
          const today = new Date().toISOString().split("T")[0];
          const isActive = sub && sub.status === "active" && sub.endDate >= today;
          const lastCheckin = m.lastCheckinAt ? new Date(m.lastCheckinAt) : null;
          const daysSince = lastCheckin
            ? Math.floor((Date.now() - lastCheckin.getTime()) / 86_400_000)
            : null;
          return (
            <li key={m.id}>
              <Link href={`/trainer/members/${m.id}`}>
                <div className="rounded-2xl p-3 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] hover:border-[hsl(40_65%_48%/0.4)] cursor-pointer transition-colors flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{
                      background: "hsl(40 65% 48% / 0.15)",
                      color: "hsl(40 65% 65%)",
                    }}
                  >
                    {m.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(40_20%_88%)] truncate">{m.name}</p>
                    <p className="text-xs text-[hsl(0_0%_50%)] truncate">
                      {m.phone}
                      {m.membershipNumber ? ` • ${m.membershipNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={
                        !sub
                          ? { background: "hsl(0 0% 16%)", color: "hsl(0 0% 50%)" }
                          : isActive
                            ? {
                                background: "hsl(142 60% 50% / 0.15)",
                                color: "hsl(142 60% 65%)",
                              }
                            : sub.status === "frozen"
                              ? {
                                  background: "hsl(200 70% 55% / 0.15)",
                                  color: "hsl(200 70% 70%)",
                                }
                              : {
                                  background: "hsl(0 60% 50% / 0.15)",
                                  color: "hsl(0 60% 65%)",
                                }
                      }
                    >
                      {!sub ? "بدون اشتراك" : sub.status === "frozen" ? "مجمَّد" : isActive ? "نشط" : "منتهٍ"}
                    </span>
                    {daysSince !== null && (
                      <span className="text-[10px] text-[hsl(0_0%_45%)]">آخر حضور: منذ {daysSince} ي</span>
                    )}
                    {daysSince === null && (
                      <span className="text-[10px] text-[hsl(0_0%_45%)]">لم يحضر بعد</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
