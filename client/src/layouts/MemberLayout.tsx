import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const navItems = [
  { path: "/member", label: "الرئيسية", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { path: "/member/workouts", label: "التمارين", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 12c0-1.5 1-2 2-2M3 12c0 1.5 1 2 2 2M21 12c0-1.5-1-2-2-2M21 12c0 1.5-1 2-2 2"/><circle cx="6.5" cy="6.5" r="1.5"/><circle cx="6.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></svg> },
  { path: "/member/log", label: "تسجيل الأداء", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
  { path: "/member/stats", label: "القياسات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> },
  { path: "/member/attendance", label: "الحضور", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg> },
  { path: "/member/schedule", label: "الجدول الأسبوعي", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg> },
  { path: "/member/qr", label: "كود الحضور", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="19" y="19" width="2" height="2" rx="0.5"/></svg> },
  { path: "/member/settings", label: "الإعدادات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout.mutate({ data: { refreshToken: refreshToken ?? "" } }, {
      onSettled: () => {
        clearAuth();
        queryClient.clear();
        window.location.href = "/login";
      },
    });
  }

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = item.path === "/member" ? location === "/member" : location.startsWith(item.path);
    return (
      <Link href={item.path}>
        <div onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-sm font-medium relative"
          style={isActive
            ? { background: "linear-gradient(135deg, hsl(40 65% 48% / 0.2), hsl(40 65% 48% / 0.08))", color: "hsl(40 65% 65%)", boxShadow: "inset 0 0 0 1px hsl(40 65% 48% / 0.25)" }
            : { color: "hsl(0 0% 50%)" }}
          onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "hsl(0 0% 8%)"; e.currentTarget.style.color = "hsl(0 0% 80%)"; } }}
          onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(0 0% 50%)"; } }}>
          {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: "hsl(40 65% 52%)" }} />}
          <span style={{ color: isActive ? "hsl(40 65% 58%)" : "hsl(0 0% 38%)" }} className="flex-shrink-0">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(0 0% 5%)" }} dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col"
        style={{ background: "hsl(0 0% 3%)", borderLeft: "1px solid hsl(0 0% 10%)" }}>
        <div className="flex items-center gap-3 px-4 py-4 relative" style={{ borderBottom: "1px solid hsl(0 0% 10%)", minHeight: 72 }}>
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48%), transparent)" }} />
          <Link href="/member">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="/eagle-gym-logo.jpg" alt="Eagle Gym"
                className="flex-shrink-0 object-contain rounded-xl"
                style={{ width: 40, height: 40, background: "hsl(0 0% 7%)", boxShadow: "0 0 0 1px hsl(40 65% 48% / 0.3), 0 0 16px hsl(40 65% 48% / 0.15)" }} />
              <div>
                <div className="font-black text-sm leading-tight tracking-widest uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</div>
                <div className="text-xs" style={{ color: "hsl(0 0% 35%)" }}>منطقة الأعضاء</div>
              </div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
          {navItems.map(item => <NavLink key={item.path} item={item} />)}
        </nav>
        <div className="p-3" style={{ borderTop: "1px solid hsl(0 0% 10%)" }}>
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl" style={{ background: "hsl(0 0% 7%)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))", color: "hsl(40 65% 68%)", border: "1.5px solid hsl(40 65% 40% / 0.4)" }}>
              {user?.name?.[0] ?? "م"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "hsl(40 20% 80%)" }}>{user?.name}</p>
              <p className="text-xs" style={{ color: "hsl(40 65% 45%)" }}>عضو</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full text-xs py-2 px-3 rounded-xl transition-all duration-150 flex items-center gap-2"
            style={{ color: "hsl(0 0% 38%)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "hsl(0 72% 51% / 0.1)"; e.currentTarget.style.color = "hsl(0 72% 60%)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(0 0% 38%)"; }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-col flex-1 overflow-hidden md:mr-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: "hsl(0 0% 3%)", borderBottom: "1px solid hsl(0 0% 10%)" }}>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg" style={{ color: "hsl(40 65% 52%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/eagle-gym-logo.jpg" alt="Eagle Gym" className="w-8 h-8 rounded-lg object-contain" style={{ background: "hsl(0 0% 7%)" }} />
            <span className="font-black text-sm tracking-widest uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex" dir="rtl">
            <div className="absolute inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 flex flex-col h-full z-10" style={{ background: "hsl(0 0% 3%)", borderLeft: "1px solid hsl(0 0% 12%)" }}>
              <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid hsl(0 0% 10%)" }}>
                <div className="flex items-center gap-3">
                  <img src="/eagle-gym-logo.jpg" alt="Eagle Gym" className="w-9 h-9 rounded-xl object-contain" style={{ background: "hsl(0 0% 7%)" }} />
                  <span className="font-black text-sm tracking-widest uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} style={{ color: "hsl(0 0% 40%)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
                {navItems.map(item => <NavLink key={item.path} item={item} />)}
              </nav>
              <div className="p-3" style={{ borderTop: "1px solid hsl(0 0% 10%)" }}>
                <button onClick={handleLogout} className="w-full text-xs py-2.5 px-3 rounded-xl flex items-center gap-2"
                  style={{ background: "hsl(0 72% 51% / 0.08)", color: "hsl(0 72% 55%)", border: "1px solid hsl(0 72% 51% / 0.2)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto" dir="rtl">{children}</main>
      </div>
    </div>
  );
}
