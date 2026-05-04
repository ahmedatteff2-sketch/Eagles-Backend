import { Link, useLocation, useLocation as useNav } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useLogout, useListUsers, useListCheckins, getListUsersQueryKey, getListCheckinsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";

const GOLD = "hsl(40 65% 52%)";

const navItems = [
  { path: "/admin", label: "لوحة التحكم", exact: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { path: "/admin/members", label: "الأعضاء", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="9" cy="7" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><circle cx="19" cy="8" r="3"/><path d="M22 21v-1a5 5 0 0 0-4-4.9"/></svg> },
  { path: "/admin/subscriptions", label: "الاشتراكات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg> },
  { path: "/admin/training", label: "برامج التدريب", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 12c0-1.5 1-2 2-2M3 12c0 1.5 1 2 2 2M21 12c0-1.5-1-2-2-2M21 12c0 1.5-1 2-2 2"/><circle cx="6.5" cy="6.5" r="1.5"/><circle cx="6.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></svg> },
  { path: "/admin/payments", label: "المدفوعات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2M13 15h4"/></svg> },
  { path: "/admin/expenses", label: "المصاريف", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { path: "/admin/attendance", label: "الحضور", badge: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { path: "/admin/schedule", label: "الجدول الأسبوعي", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { path: "/admin/analytics", label: "الإحصائيات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { path: "/admin/exports", label: "التصدير", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
  { path: "/admin/imports", label: "الاستيراد", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { path: "/admin/reminders", label: "الأذكار", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
];

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [, nav] = useNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data } = useListUsers(
    { search: q || undefined, limit: 8 },
    { query: { queryKey: getListUsersQueryKey({ search: q || undefined, limit: 8 }), enabled: q.length > 0 } }
  );
  const results: any[] = q ? ((data as any)?.data ?? []) : [];

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function goTo(id: number) { nav("/admin/members/" + id); onClose(); }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(40 65% 48% / 0.25)" }}>
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0" style={{ color: GOLD }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
            placeholder="ابحث عن عضو بالاسم أو الهاتف..." />
          <kbd className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 45%)" }}>ESC</kbd>
        </div>
        {q.length === 0 && <div className="px-4 py-8 text-center"><p className="text-muted-foreground text-sm">اكتب اسم العضو أو رقم الهاتف</p></div>}
        {q.length > 0 && results.length === 0 && <div className="px-4 py-8 text-center"><p className="text-muted-foreground text-sm">لا توجد نتائج لـ "{q}"</p></div>}
        {results.length > 0 && (
          <div className="py-2">
            {results.map((u: any) => {
              const isActive = u.currentSubscription?.endDate ? new Date(u.currentSubscription.endDate) >= new Date() : false;
              const hasSub = !!u.currentSubscription;
              return (
                <button key={u.id} onClick={() => goTo(u.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-right"
                  style={{ borderBottom: "1px solid hsl(0 0% 11%)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "hsl(0 0% 12%)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 58%)" }}>
                    {u.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.phone}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={hasSub && isActive ? { background: "hsl(142 60% 50% / 0.15)", color: "hsl(142 60% 60%)" }
                      : hasSub ? { background: "hsl(0 60% 50% / 0.15)", color: "hsl(0 60% 60%)" }
                      : { background: "hsl(0 0% 16%)", color: "hsl(0 0% 45%)" }}>
                    {hasSub && isActive ? "نشط" : hasSub ? "منتهي" : "بدون اشتراك"}
                  </span>
                </button>
              );
            })}
            <div className="px-4 py-2">
              <button onClick={() => { nav("/admin/members?search=" + q); onClose(); }}
                className="text-xs w-full text-center py-1.5" style={{ color: GOLD }}>
                عرض كل النتائج ←
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Today's checkins for badge
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayCheckins } = useListCheckins(
    { from: today, to: today },
    { query: { queryKey: getListCheckinsQueryKey({ from: today, to: today }) } }
  );
  const todayCount: number = Array.isArray(todayCheckins) ? todayCheckins.length : ((todayCheckins as any)?.data?.length ?? (todayCheckins as any)?.total ?? 0);

  useEffect(() => {
    const theme = localStorage.getItem("gym-theme") ?? "dark";
    setIsDark(theme === "dark");
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) { document.documentElement.classList.add("dark"); localStorage.setItem("gym-theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("gym-theme", "light"); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function handleLogout() {
    logout.mutate({ data: { refreshToken: refreshToken ?? "" } }, {
      onSettled: () => { clearAuth(); queryClient.clear(); window.location.href = "/login"; },
    });
  }

  const w = collapsed ? "w-[68px]" : "w-64";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(0 0% 5%)" }} dir="rtl">
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      <aside className={`${w} flex-shrink-0 flex flex-col transition-all duration-300`}
        style={{ background: "hsl(0 0% 3%)", borderLeft: "1px solid hsl(0 0% 10%)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 relative" style={{ borderBottom: "1px solid hsl(0 0% 10%)", minHeight: 72 }}>
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48%), transparent)" }} />
          <Link href="/admin">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="/eagle-gym-logo.jpg" alt="Eagle Gym" className="flex-shrink-0 object-contain rounded-xl"
                style={{ width: 40, height: 40, background: "hsl(0 0% 7%)", boxShadow: "0 0 0 1px hsl(40 65% 48% / 0.3), 0 0 16px hsl(40 65% 48% / 0.15)" }} />
              {!collapsed && (
                <div>
                  <div className="font-black text-sm leading-tight tracking-widest uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</div>
                  <div className="text-xs" style={{ color: "hsl(0 0% 35%)" }}>إدارة النادي</div>
                </div>
              )}
            </div>
          </Link>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="mr-auto p-1 rounded-lg transition-colors" style={{ color: "hsl(0 0% 35%)" }}
              onMouseEnter={e => (e.currentTarget.style.color = GOLD)} onMouseLeave={e => (e.currentTarget.style.color = "hsl(0 0% 35%)")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-lg"
              style={{ background: GOLD, color: "hsl(0 0% 5%)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="w-3 h-3"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-3 py-2.5" style={{ borderBottom: "1px solid hsl(0 0% 8%)" }}>
          <button onClick={() => setSearchOpen(true)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${collapsed ? "justify-center" : ""}`}
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 13%)", color: "hsl(0 0% 40%)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "hsl(40 65% 48% / 0.3)"; e.currentTarget.style.color = "hsl(0 0% 60%)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "hsl(0 0% 13%)"; e.currentTarget.style.color = "hsl(0 0% 40%)"; }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {!collapsed && (
              <>
                <span className="flex-1 text-right text-xs">بحث سريع...</span>
                <kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 35%)" }}>⌘K</kbd>
              </>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = item.exact ? location === item.path : location.startsWith(item.path);
            const showBadge = item.badge && todayCount > 0;
            return (
              <Link key={item.path} href={item.path}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-sm font-medium group relative"
                  style={isActive
                    ? { background: "linear-gradient(135deg, hsl(40 65% 48% / 0.2), hsl(40 65% 48% / 0.08))", color: "hsl(40 65% 65%)", boxShadow: "inset 0 0 0 1px hsl(40 65% 48% / 0.25)" }
                    : { color: "hsl(0 0% 50%)" }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "hsl(0 0% 8%)"; e.currentTarget.style.color = "hsl(0 0% 80%)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(0 0% 50%)"; } }}>
                  {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: GOLD }} />}
                  <span style={{ color: isActive ? "hsl(40 65% 58%)" : "hsl(0 0% 38%)" }} className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                  {!collapsed && showBadge && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{ background: "hsl(142 60% 50% / 0.2)", color: "hsl(142 60% 60%)", fontSize: "10px" }}>
                      {todayCount}
                    </span>
                  )}
                  {collapsed && showBadge && (
                    <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full text-center text-white flex items-center justify-center"
                      style={{ background: "hsl(142 60% 45%)", fontSize: "9px", fontWeight: "bold" }}>
                      {todayCount > 9 ? "9+" : todayCount}
                    </span>
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                      style={{ background: "hsl(0 0% 12%)", color: "hsl(40 65% 58%)", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", border: "1px solid hsl(0 0% 18%)" }}>
                      {item.label}{showBadge ? ` (${todayCount})` : ""}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3" style={{ borderTop: "1px solid hsl(0 0% 10%)" }}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl" style={{ background: "hsl(0 0% 7%)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))", color: "hsl(40 65% 68%)", border: "1.5px solid hsl(40 65% 40% / 0.4)" }}>
                {user?.name?.[0] ?? "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "hsl(40 20% 80%)" }}>{user?.name}</p>
                <p className="text-xs" style={{ color: "hsl(40 65% 45%)" }}>مسؤول</p>
              </div>
              {/* Theme toggle */}
              <button onClick={toggleTheme} className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                style={{ color: "hsl(0 0% 40%)" }}
                onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
                onMouseLeave={e => (e.currentTarget.style.color = "hsl(0 0% 40%)")}>
                {isDark ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
              {/* Settings link */}
              <Link href="/admin/settings">
                <button className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                  style={{ color: "hsl(0 0% 40%)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(0 0% 40%)")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </button>
              </Link>
            </div>
          )}
          {collapsed && (
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))", color: "hsl(40 65% 68%)", border: "1.5px solid hsl(40 65% 40% / 0.4)" }}>
                {user?.name?.[0] ?? "A"}
              </div>
              <button onClick={toggleTheme} className="p-1.5 rounded-lg" style={{ color: "hsl(0 0% 40%)" }}
                onMouseEnter={e => (e.currentTarget.style.color = GOLD)} onMouseLeave={e => (e.currentTarget.style.color = "hsl(0 0% 40%)")}>
                {isDark ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
              </button>
            </div>
          )}
          <button onClick={handleLogout}
            className={`${collapsed ? "justify-center" : ""} w-full text-xs py-2 px-3 rounded-xl transition-all duration-150 flex items-center gap-2`}
            style={{ color: "hsl(0 0% 38%)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "hsl(0 72% 51% / 0.1)"; e.currentTarget.style.color = "hsl(0 72% 60%)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(0 0% 38%)"; }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {!collapsed && "تسجيل الخروج"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" dir="rtl">{children}</main>
    </div>
  );
}
