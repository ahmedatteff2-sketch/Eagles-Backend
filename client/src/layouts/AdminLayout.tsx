import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const navItems = [
  {
    path: "/admin",
    label: "لوحة التحكم",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: "/admin/members",
    label: "الأعضاء",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="9" cy="7" r="4" /><path d="M2 21v-1a7 7 0 0 1 14 0v1" />
        <circle cx="19" cy="8" r="3" /><path d="M22 21v-1a5 5 0 0 0-4-4.9" />
      </svg>
    ),
  },
  {
    path: "/admin/subscriptions",
    label: "الاشتراكات",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    path: "/admin/training",
    label: "برامج التدريب",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 12c0-1.5 1-2 2-2M3 12c0 1.5 1 2 2 2M21 12c0-1.5-1-2-2-2M21 12c0 1.5-1 2-2 2" />
        <circle cx="6.5" cy="6.5" r="1.5" /><circle cx="6.5" cy="17.5" r="1.5" />
        <circle cx="17.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" />
      </svg>
    ),
  },
  {
    path: "/admin/payments",
    label: "المدفوعات",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
        <path d="M7 15h2M13 15h4" />
      </svg>
    ),
  },
  {
    path: "/admin/expenses",
    label: "المصاريف",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    path: "/admin/checkins",
    label: "الحضور",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    path: "/admin/qr-scanner",
    label: "مسح QR",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="3" height="3" rx="0.5" /><rect x="19" y="14" width="2" height="2" rx="0.5" />
        <rect x="14" y="19" width="2" height="2" rx="0.5" /><rect x="18" y="18" width="3" height="3" rx="0.5" />
      </svg>
    ),
  },
  {
    path: "/admin/schedule",
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
    path: "/admin/analytics",
    label: "الإحصائيات",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    path: "/admin/exports",
    label: "التصدير",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    path: "/admin/imports",
    label: "الاستيراد",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
        className="w-64 flex-shrink-0 flex flex-col"
        style={{
          background: "hsl(0 0% 3%)",
          borderLeft: "1px solid hsl(0 0% 12%)",
        }}
      >
        <div
          className="h-[72px] flex items-center px-5"
          style={{ borderBottom: "1px solid hsl(0 0% 12%)" }}
        >
          <Link href="/admin">
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
                  إدارة النادي
                </div>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-3">
          {navItems.map((item) => {
            const isActive = item.path === "/admin"
              ? location === "/admin"
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
              {user?.name?.[0] ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "hsl(40 20% 82%)" }}>
                {user?.name}
              </p>
              <p className="text-xs" style={{ color: "hsl(40 65% 48%)" }}>مسؤول</p>
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
