import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const navItems = [
  {
    path: "/member",
    label: "الرئيسية",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    path: "/member/workouts",
    label: "التمارين",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 12c0-1.5 1-2 2-2M3 12c0 1.5 1 2 2 2M21 12c0-1.5-1-2-2-2M21 12c0 1.5-1 2-2 2" />
        <circle cx="6.5" cy="6.5" r="1.5" /><circle cx="6.5" cy="17.5" r="1.5" />
        <circle cx="17.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" />
      </svg>
    ),
  },
  {
    path: "/member/log",
    label: "تسجيل الأداء",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    path: "/member/stats",
    label: "القياسات",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    path: "/member/attendance",
    label: "الحضور",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        <path d="M9 16l2 2 4-4" />
      </svg>
    ),
  },
  {
    path: "/member/schedule",
    label: "الجدول الأسبوعي",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="14" />
      </svg>
    ),
  },
  {
    path: "/member/qr",
    label: "كود الحضور",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="3" height="3" rx="0.5" /><rect x="19" y="19" width="2" height="2" rx="0.5" />
      </svg>
    ),
  },
  {
    path: "/member/settings",
    label: "الإعدادات",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();
  const logout = useLogout();

  function handleLogout() {
    logout.mutate({ data: { refreshToken: refreshToken ?? "" } }, {
      onSettled: () => {
        clearAuth();
        queryClient.clear();
        window.location.href = "/login";
      },
    });
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(0 0% 5%)" }}>
      <aside
        className="w-60 flex-shrink-0 flex flex-col"
        style={{
          background: "hsl(0 0% 3%)",
          borderLeft: "1px solid hsl(0 0% 12%)",
        }}
      >
        <div
          className="h-[72px] flex items-center px-5"
          style={{ borderBottom: "1px solid hsl(0 0% 12%)" }}
        >
          <Link href="/member">
            <div className="flex items-center gap-3 cursor-pointer">
              <img
                src="/eagle-gym-logo.jpg"
                alt="Eagle Gym"
                className="w-10 h-10 rounded-lg object-contain"
                style={{ background: "hsl(0 0% 6%)" }}
              />
              <div>
                <div className="font-black text-base leading-tight tracking-wider uppercase" style={{ color: "hsl(40 65% 48%)" }}>
                  Eagle Gym
                </div>
                <div className="text-xs font-medium" style={{ color: "hsl(0 0% 40%)" }}>
                  منطقة الأعضاء
                </div>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-3">
          {navItems.map((item) => {
            const isActive = item.path === "/member"
              ? location === "/member"
              : location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 text-sm font-medium"
                  style={
                    isActive
                      ? {
                          background: "linear-gradient(135deg, hsl(40 65% 48% / 0.18), hsl(40 65% 48% / 0.08))",
                          color: "hsl(40 65% 60%)",
                          borderLeft: "2px solid hsl(40 65% 48%)",
                          paddingLeft: "10px",
                        }
                      : {
                          color: "hsl(40 15% 65%)",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.background = "hsl(0 0% 10%)";
                      (e.currentTarget as HTMLDivElement).style.color = "hsl(40 20% 85%)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                      (e.currentTarget as HTMLDivElement).style.color = "hsl(40 15% 65%)";
                    }
                  }}
                >
                  <span style={{ color: isActive ? "hsl(40 65% 55%)" : "hsl(0 0% 40%)" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div
          className="p-4"
          style={{ borderTop: "1px solid hsl(0 0% 12%)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 30%), hsl(40 65% 22%))",
                color: "hsl(40 65% 65%)",
                border: "1px solid hsl(40 65% 48% / 0.3)",
              }}
            >
              {user?.name?.[0] ?? "E"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "hsl(40 20% 82%)" }}>
                {user?.name}
              </p>
              <p className="text-xs" style={{ color: "hsl(40 65% 48%)" }}>عضو</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs py-2 px-3 rounded-lg transition-all duration-150 text-right flex items-center gap-2"
            style={{ color: "hsl(0 0% 40%)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(0 72% 51% / 0.1)";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 72% 60%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 0% 40%)";
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
