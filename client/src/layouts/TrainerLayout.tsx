/**
 * Trainer-portal sidebar + chrome. Mirrors the visual language of
 * AdminLayout / MemberLayout so a trainer who's also a member of another
 * gym (rare, but) doesn't get whiplash. The nav is intentionally short —
 * a trainer should never need more than 5 destinations.
 */
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface NavItem {
  path: string;
  label: string;
  exact?: boolean;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    path: "/trainer",
    label: "اللوحة",
    exact: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: "/trainer/members",
    label: "أعضائي",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <circle cx="9" cy="7" r="4" />
        <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
        <circle cx="19" cy="8" r="3" />
        <path d="M22 21v-1a5 5 0 0 0-4-4.9" />
      </svg>
    ),
  },
  {
    path: "/trainer/schedule",
    label: "جدولي",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    path: "/trainer/performance",
    label: "أدائي",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    path: "/trainer/settings",
    label: "الإعدادات",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout.mutate(
      { data: { refreshToken: refreshToken ?? "" } },
      {
        onSettled: () => {
          clearAuth();
          queryClient.clear();
          window.location.href = "/login";
        },
      },
    );
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = item.exact ? location === item.path : location.startsWith(item.path);
    return (
      <Link href={item.path}>
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-sm font-medium relative"
          style={
            isActive
              ? {
                  background: "linear-gradient(135deg, hsl(40 65% 48% / 0.2), hsl(40 65% 48% / 0.08))",
                  color: "hsl(40 65% 65%)",
                  boxShadow: "inset 0 0 0 1px hsl(40 65% 48% / 0.25)",
                }
              : { color: "hsl(0 0% 50%)" }
          }
        >
          {isActive && (
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
              style={{ background: "hsl(40 65% 52%)" }}
            />
          )}
          <span style={{ color: isActive ? "hsl(40 65% 58%)" : "hsl(0 0% 38%)" }} className="flex-shrink-0">
            {item.icon}
          </span>
          <span className="truncate">{item.label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(0_0%_5%)]" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-[hsl(0_0%_3%)] border-l border-[hsl(0_0%_10%)]">
        <div
          className="flex items-center gap-3 px-4 py-4 relative border-b border-[hsl(0_0%_10%)]"
          style={{ minHeight: 72 }}
        >
          <div
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48%), transparent)" }}
          />
          <Link href="/trainer">
            <div className="flex items-center gap-3 cursor-pointer">
              <img
                src="/eagle-gym-logo.jpg"
                alt="Eagle Gym"
                className="flex-shrink-0 object-contain rounded-xl"
                style={{
                  width: 40,
                  height: 40,
                  background: "hsl(0 0% 7%)",
                  boxShadow: "0 0 0 1px hsl(40 65% 48% / 0.3), 0 0 16px hsl(40 65% 48% / 0.15)",
                }}
              />
              <div>
                <div className="font-black text-sm leading-tight tracking-widest uppercase text-[hsl(40_65%_55%)]">
                  Eagle Gym
                </div>
                <div className="text-xs text-[hsl(0_0%_35%)]">منطقة المدرب</div>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
          {navItems.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </nav>

        <div className="p-3 border-t border-[hsl(0_0%_10%)]">
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl bg-[hsl(0_0%_7%)]">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))",
                color: "hsl(40 65% 68%)",
                border: "1.5px solid hsl(40 65% 40% / 0.4)",
              }}
            >
              {user?.name?.[0] ?? "م"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-[hsl(40_20%_80%)]">{user?.name}</p>
              <p className="text-xs text-[hsl(40_65%_45%)]">مدرب</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs py-2 px-3 rounded-xl flex items-center gap-2 text-[hsl(0_0%_38%)] hover:bg-[hsl(0_72%_51%/0.1)] hover:text-[hsl(0_72%_60%)] transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile chrome */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0 bg-[hsl(0_0%_3%)] border-b border-[hsl(0_0%_10%)]">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[hsl(40_65%_52%)]"
            aria-label="القائمة"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="w-5 h-5"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/eagle-gym-logo.jpg"
              alt="Eagle Gym"
              className="w-8 h-8 rounded-lg object-contain bg-[hsl(0_0%_7%)]"
            />
            <span className="font-black text-sm tracking-widest uppercase text-[hsl(40_65%_55%)]">
              Eagle Gym
            </span>
          </div>
          <div className="w-9" />
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex" dir="rtl">
            <div className="absolute inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 flex flex-col h-full z-10 bg-[hsl(0_0%_3%)] border-l border-[hsl(0_0%_12%)]">
              <div className="flex items-center justify-between px-4 py-4 border-b border-[hsl(0_0%_10%)]">
                <div className="flex items-center gap-3">
                  <img
                    src="/eagle-gym-logo.jpg"
                    alt="Eagle Gym"
                    className="w-9 h-9 rounded-xl object-contain bg-[hsl(0_0%_7%)]"
                  />
                  <span className="font-black text-sm tracking-widest uppercase text-[hsl(40_65%_55%)]">
                    Eagle Gym
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[hsl(0_0%_40%)]"
                  aria-label="إغلاق"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="w-5 h-5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
                {navItems.map((item) => (
                  <NavLink key={item.path} item={item} />
                ))}
              </nav>
              <div className="p-3 border-t border-[hsl(0_0%_10%)]">
                <button
                  onClick={handleLogout}
                  className="w-full text-xs py-2.5 px-3 rounded-xl flex items-center gap-2"
                  style={{
                    background: "hsl(0 72% 51% / 0.08)",
                    color: "hsl(0 72% 55%)",
                    border: "1px solid hsl(0 72% 51% / 0.2)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0" dir="rtl">
          {children}
        </main>

        {/* Mobile bottom tab bar — only the 4 most-used destinations. */}
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-1 py-1 bg-[hsl(0_0%_3%)] border-t border-[hsl(0_0%_12%)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
        >
          {navItems.slice(0, 4).map((tab) => {
            const isActive = tab.exact ? location === tab.path : location.startsWith(tab.path);
            return (
              <Link key={tab.path} href={tab.path}>
                <div
                  className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors min-w-[48px]"
                  style={isActive ? { color: "hsl(40 65% 52%)" } : { color: "hsl(0 0% 42%)" }}
                >
                  {tab.icon}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                  {isActive && (
                    <div
                      className="w-4 h-0.5 rounded-full mt-0.5"
                      style={{ background: "hsl(40 65% 52%)" }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
