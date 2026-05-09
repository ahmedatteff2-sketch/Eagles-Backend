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
  { path: "/admin/exercises", label: "التمارين", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 12c0-1.5 1-2 2-2M3 12c0 1.5 1 2 2 2M21 12c0-1.5-1-2-2-2M21 12c0 1.5-1 2-2 2"/><circle cx="6.5" cy="6.5" r="1.5"/><circle cx="6.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></svg> },
  { path: "/admin/workout-templates", label: "قوالب التمرين", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="17.5" y1="14" x2="17.5" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg> },
  { path: "/admin/payments", label: "المدفوعات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2M13 15h4"/></svg> },
  { path: "/admin/expenses", label: "المصاريف", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { path: "/admin/attendance", label: "الحضور", badge: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { path: "/admin/schedule", label: "الجدول الأسبوعي", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { path: "/admin/analytics", label: "الإحصائيات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { path: "/admin/exports", label: "التصدير", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
  { path: "/admin/imports", label: "الاستيراد", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { path: "/admin/reminders", label: "الأذكار", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { path: "/admin/renewal-reminders", label: "تذكيرات التجديد", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
  { path: "/admin/wa-templates", label: "قوالب واتساب", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
  { path: "/admin/audit", label: "سجل العمليات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg> },
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

function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: usersData } = useListUsers(
    { status: "active", limit: 100 },
    { query: { queryKey: getListUsersQueryKey({ status: "active", limit: 100 }) } }
  );
  const allActive: any[] = (usersData as any)?.data ?? [];
  const now = new Date();
  const expiringSoon = allActive.filter((m: any) => {
    if (!m.currentSubscription?.endDate) return false;
    const diff = (new Date(m.currentSubscription.endDate).getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff <= 3;
  });
  const expiringToday = expiringSoon.filter((m: any) => {
    return new Date(m.currentSubscription.endDate).toDateString() === now.toDateString();
  });
  const count = expiringSoon.length;

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-xl transition-colors ${collapsed ? "" : ""}`}
        style={{ color: count > 0 ? GOLD : "hsl(0 0% 38%)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "hsl(0 0% 10%)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white"
            style={{ background: "hsl(0 72% 50%)", fontSize: "9px", fontWeight: "bold", minWidth: 16, height: 16, padding: "0 3px" }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
            <p className="text-sm font-bold text-foreground">التنبيهات</p>
            {count > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(0 72% 50% / 0.15)", color: "hsl(0 72% 60%)" }}>{count}</span>}
          </div>
          {count === 0 ? (
            <div className="px-4 py-6 text-center"><p className="text-xs text-muted-foreground">لا توجد تنبيهات</p></div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {expiringToday.length > 0 && (
                <div className="px-3 py-2">
                  <p className="text-xs font-bold mb-1.5" style={{ color: "hsl(0 72% 60%)" }}>⚠ تنتهي اليوم</p>
                  {expiringToday.map((m: any) => (
                    <Link key={m.id} href={`/admin/members/${m.id}`}>
                      <div onClick={() => setOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "hsl(0 72% 50% / 0.15)", color: "hsl(0 72% 60%)" }}>{m.name?.[0]}</div>
                        <p className="text-xs text-foreground truncate">{m.name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {expiringSoon.filter((m: any) => !expiringToday.includes(m)).length > 0 && (
                <div className="px-3 py-2" style={{ borderTop: expiringToday.length > 0 ? "1px solid hsl(0 0% 12%)" : "none" }}>
                  <p className="text-xs font-bold mb-1.5" style={{ color: "hsl(40 65% 52%)" }}>⏰ تنتهي قريباً</p>
                  {expiringSoon.filter((m: any) => !expiringToday.includes(m)).map((m: any) => {
                    const d = Math.ceil((new Date(m.currentSubscription.endDate).getTime() - now.getTime()) / 86400000);
                    return (
                      <Link key={m.id} href={`/admin/members/${m.id}`}>
                        <div onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 58%)" }}>{m.name?.[0]}</div>
                            <p className="text-xs text-foreground truncate">{m.name}</p>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{d} يوم</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const mobileBottomTabs = [
  { path: "/admin", label: "الرئيسية", exact: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { path: "/admin/members", label: "الأعضاء", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="9" cy="7" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/></svg> },
  { path: "/admin/attendance", label: "الحضور", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { path: "/admin/payments", label: "المدفوعات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
  { path: "/admin/analytics", label: "الإحصائيات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const NavItem = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => {
    const isActive = item.exact ? location === item.path : location.startsWith(item.path);
    const showBadge = item.badge && todayCount > 0;
    return (
      <Link href={item.path}>
        <div onClick={onClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-sm font-medium group relative"
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
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(0 0% 5%)" }} dir="rtl">
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {/* ═══════════ Desktop Sidebar ═══════════ */}
      <aside className={`hidden md:flex ${w} flex-shrink-0 flex-col transition-all duration-300`}
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
          {navItems.map((item) => <NavItem key={item.path} item={item} />)}
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
              <NotificationBell collapsed={false} />
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
              <NotificationBell collapsed={true} />
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

      {/* ═══════════ Mobile Layout ═══════════ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-3 py-2.5 flex-shrink-0"
          style={{ background: "hsl(0 0% 3%)", borderBottom: "1px solid hsl(0 0% 10%)" }}>
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg" style={{ color: GOLD }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/eagle-gym-logo.jpg" alt="Eagle Gym" className="w-7 h-7 rounded-lg object-contain" style={{ background: "hsl(0 0% 7%)" }} />
            <span className="font-black text-xs tracking-widest uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen(true)} className="p-2 rounded-lg" style={{ color: "hsl(0 0% 45%)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
            <NotificationBell collapsed={true} />
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex" dir="rtl">
            <div className="absolute inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-72 flex flex-col h-full z-10"
              style={{ background: "hsl(0 0% 3%)", borderLeft: "1px solid hsl(0 0% 12%)" }}>
              <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid hsl(0 0% 10%)" }}>
                <div className="flex items-center gap-3">
                  <img src="/eagle-gym-logo.jpg" alt="Eagle Gym" className="w-9 h-9 rounded-xl object-contain" style={{ background: "hsl(0 0% 7%)" }} />
                  <span className="font-black text-sm tracking-widest uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} style={{ color: "hsl(0 0% 40%)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {/* User info */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 8%)" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))", color: "hsl(40 65% 68%)", border: "1.5px solid hsl(40 65% 40% / 0.4)" }}>
                  {user?.name?.[0] ?? "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "hsl(40 20% 80%)" }}>{user?.name}</p>
                  <p className="text-xs" style={{ color: "hsl(40 65% 45%)" }}>مسؤول</p>
                </div>
              </div>
              <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
                {navItems.map(item => <NavItem key={item.path} item={item} onClick={() => setMobileMenuOpen(false)} />)}
              </nav>
              <div className="p-3 space-y-2" style={{ borderTop: "1px solid hsl(0 0% 10%)" }}>
                <div className="flex gap-2">
                  <button onClick={toggleTheme} className="flex-1 text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2"
                    style={{ background: "hsl(0 0% 7%)", color: "hsl(0 0% 55%)" }}>
                    {isDark ? "☀️ فاتح" : "🌙 داكن"}
                  </button>
                  <Link href="/admin/settings">
                    <button onClick={() => setMobileMenuOpen(false)} className="text-xs py-2.5 px-4 rounded-xl flex items-center gap-2"
                      style={{ background: "hsl(0 0% 7%)", color: "hsl(0 0% 55%)" }}>
                      ⚙️ إعدادات
                    </button>
                  </Link>
                </div>
                <button onClick={handleLogout} className="w-full text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2"
                  style={{ background: "hsl(0 72% 51% / 0.08)", color: "hsl(0 72% 55%)", border: "1px solid hsl(0 72% 51% / 0.2)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0" dir="rtl">{children}</main>

        {/* Mobile Bottom Tab Bar */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-1 py-1"
          style={{ background: "hsl(0 0% 3%)", borderTop: "1px solid hsl(0 0% 12%)", paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
          {mobileBottomTabs.map(tab => {
            const isActive = tab.exact ? location === tab.path : location.startsWith(tab.path);
            return (
              <Link key={tab.path} href={tab.path}>
                <div className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors min-w-[52px]"
                  style={isActive ? { color: GOLD } : { color: "hsl(0 0% 42%)" }}>
                  {tab.icon}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                  {isActive && <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: GOLD }} />}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
