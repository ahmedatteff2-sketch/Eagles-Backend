import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect, useState, lazy, Suspense } from "react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AdminLayout from "@/layouts/AdminLayout";
import MemberLayout from "@/layouts/MemberLayout";
import { useAuthStore } from "@/store/auth";
import { STORAGE_KEYS } from "@/lib/storage";
import { PageSkeleton } from "@/components/Skeleton";

// Login is loaded eagerly: it's the entry point for unauthenticated users
// and inlining it avoids a Suspense flash on the most common first paint.
import Login from "@/pages/login";

// Every other page is route-split into its own JS chunk and fetched lazily
// on first navigation. Admins don't pay for member pages and vice versa.
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminMembers = lazy(() => import("@/pages/admin/Members"));
const AdminMemberProfile = lazy(() => import("@/pages/admin/MemberProfile"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/Subscriptions"));
const AdminExercises = lazy(() => import("@/pages/admin/Exercises"));
const AdminWorkoutTemplates = lazy(() => import("@/pages/admin/WorkoutTemplates"));
const AdminPayments = lazy(() => import("@/pages/admin/Payments"));
const AdminExpenses = lazy(() => import("@/pages/admin/Expenses"));
const AdminAttendance = lazy(() => import("@/pages/admin/Attendance"));
const AdminSchedule = lazy(() => import("@/pages/admin/Schedule"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminExports = lazy(() => import("@/pages/admin/Exports"));
const AdminImports = lazy(() => import("@/pages/admin/Imports"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminReminders = lazy(() => import("@/pages/admin/Reminders"));
const AdminRenewalReminders = lazy(() => import("@/pages/admin/RenewalReminders"));
const AdminWhatsAppTemplates = lazy(() => import("@/pages/admin/WhatsAppTemplates"));
const AdminAuditLog = lazy(() => import("@/pages/admin/AuditLog"));
const MemberDashboard = lazy(() => import("@/pages/member/Dashboard"));
const MemberWorkouts = lazy(() => import("@/pages/member/Workouts"));
const MemberLog = lazy(() => import("@/pages/member/Log"));
const MemberStats = lazy(() => import("@/pages/member/Stats"));
const MemberAttendance = lazy(() => import("@/pages/member/Attendance"));
const MemberSchedule = lazy(() => import("@/pages/member/Schedule"));
const MemberQRCode = lazy(() => import("@/pages/member/QRCode"));
const MemberSettings = lazy(() => import("@/pages/member/Settings"));
const MemberReport = lazy(() => import("@/pages/member/Report"));
const MemberProgressPhotos = lazy(() => import("@/pages/member/ProgressPhotos"));
const MemberLeaderboard = lazy(() => import("@/pages/member/Leaderboard"));
const MemberNotifications = lazy(() => import("@/pages/member/Notifications"));
const MemberMealPlan = lazy(() => import("@/pages/member/MealPlan"));
const MemberBadges = lazy(() => import("@/pages/member/Badges"));
const MemberPersonalRecords = lazy(() => import("@/pages/member/PersonalRecords"));
const MemberCalendar = lazy(() => import("@/pages/member/Calendar"));
const MemberCoachNotes = lazy(() => import("@/pages/member/CoachNotes"));
const MemberMonthlyReport = lazy(() => import("@/pages/member/MonthlyReport"));

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  if (user && user.role !== "admin") return <Redirect to="/member" />;
  return (
    <AdminLayout>
      <LazyPage>{children}</LazyPage>
    </AdminLayout>
  );
}

function MemberRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  if (user && user.role === "admin") return <Redirect to="/admin" />;
  return (
    <MemberLayout>
      <LazyPage>{children}</LazyPage>
    </MemberLayout>
  );
}

function RoleHomeRedirect() {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  // After re-login, restore the original location if we stashed one before
  // forcing the user to the login page.
  try {
    const target = sessionStorage.getItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN);
    if (target && !target.startsWith("/login")) {
      sessionStorage.removeItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN);
      return <Redirect to={target} />;
    }
  } catch {
    /* ignore */
  }
  return <Redirect to={user?.role === "admin" ? "/admin" : "/member"} />;
}

function GlobalKeyboardShortcuts() {
  const [, nav] = useLocation();
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case "m": e.preventDefault(); nav("/admin/members"); break;
          case "a": e.preventDefault(); nav("/admin/attendance"); break;
          case "d": e.preventDefault(); nav("/admin"); break;
          case "p": e.preventDefault(); nav("/admin/payments"); break;
          case "s": e.preventDefault(); nav("/admin/subscriptions"); break;
          case ",": e.preventDefault(); nav("/admin/settings"); break;
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nav]);
  return null;
}

import { ReminderPopup } from "@/components/ReminderPopup";

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 1800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
      <style>{`
        @keyframes splashIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes splashGlow { 0%,100%{box-shadow:0 0 20px hsl(40 65% 48% / 0.2)} 50%{box-shadow:0 0 60px hsl(40 65% 48% / 0.5)} }
        @keyframes splashFadeOut { from{opacity:1} to{opacity:0} }
        .splash-wrapper { animation: splashIn 0.6s ease-out, splashFadeOut 0.4s ease-in 1.4s forwards; }
        .splash-logo { animation: splashGlow 1.2s ease-in-out infinite; }
      `}</style>
      <div className="splash-wrapper flex flex-col items-center gap-4">
        <img src="/eagle-gym-logo.jpg" alt="Eagle Gym" className="splash-logo w-24 h-24 rounded-2xl object-contain"
          style={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(40 65% 48% / 0.3)" }} />
        <div className="text-center">
          <h1 className="text-xl font-black tracking-[0.25em] uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</h1>
          <div className="w-12 h-0.5 rounded mx-auto mt-2" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48%), transparent)" }} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem("splash-done") === "1");

  // Apply saved theme on mount
  useEffect(() => {
    const theme = localStorage.getItem("gym-theme") ?? "dark";
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  function handleSplashDone() {
    sessionStorage.setItem("splash-done", "1");
    setSplashDone(true);
  }

  if (!splashDone) return <SplashScreen onDone={handleSplashDone} />;

  return (
    <ErrorBoundary>
      <ReminderPopup />
      <GlobalKeyboardShortcuts />
      <PWAInstallPrompt />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/admin">
          <AdminRoute><AdminDashboard /></AdminRoute>
        </Route>
        <Route path="/admin/members">
          <AdminRoute><AdminMembers /></AdminRoute>
        </Route>
        <Route path="/admin/members/:id">
          {(params) => <AdminRoute><AdminMemberProfile /></AdminRoute>}
        </Route>
        <Route path="/admin/subscriptions">
          <AdminRoute><AdminSubscriptions /></AdminRoute>
        </Route>
        <Route path="/admin/exercises">
          <AdminRoute><AdminExercises /></AdminRoute>
        </Route>
        <Route path="/admin/workout-templates">
          <AdminRoute><AdminWorkoutTemplates /></AdminRoute>
        </Route>
        <Route path="/admin/payments">
          <AdminRoute><AdminPayments /></AdminRoute>
        </Route>
        <Route path="/admin/expenses">
          <AdminRoute><AdminExpenses /></AdminRoute>
        </Route>
        <Route path="/admin/attendance">
          <AdminRoute><AdminAttendance /></AdminRoute>
        </Route>
        {/* Legacy redirects */}
        <Route path="/admin/checkins">
          <Redirect to="/admin/attendance" />
        </Route>
        <Route path="/admin/qr-scanner">
          <Redirect to="/admin/attendance" />
        </Route>
        <Route path="/admin/schedule">
          <AdminRoute><AdminSchedule /></AdminRoute>
        </Route>
        <Route path="/admin/analytics">
          <AdminRoute><AdminAnalytics /></AdminRoute>
        </Route>
        <Route path="/admin/exports">
          <AdminRoute><AdminExports /></AdminRoute>
        </Route>
        <Route path="/admin/imports">
          <AdminRoute><AdminImports /></AdminRoute>
        </Route>
        <Route path="/admin/settings">
          <AdminRoute><AdminSettings /></AdminRoute>
        </Route>
        <Route path="/admin/reminders">
          <AdminRoute><AdminReminders /></AdminRoute>
        </Route>
        <Route path="/admin/renewal-reminders">
          <AdminRoute><AdminRenewalReminders /></AdminRoute>
        </Route>
        <Route path="/admin/wa-templates">
          <AdminRoute><AdminWhatsAppTemplates /></AdminRoute>
        </Route>
        <Route path="/admin/audit">
          <AdminRoute><AdminAuditLog /></AdminRoute>
        </Route>
        {/* Member routes */}
        <Route path="/member">
          <MemberRoute><MemberDashboard /></MemberRoute>
        </Route>
        <Route path="/member/workouts">
          <MemberRoute><MemberWorkouts /></MemberRoute>
        </Route>
        <Route path="/member/log">
          <MemberRoute><MemberLog /></MemberRoute>
        </Route>
        <Route path="/member/report">
          <MemberRoute><MemberReport /></MemberRoute>
        </Route>
        <Route path="/member/photos">
          <MemberRoute><MemberProgressPhotos /></MemberRoute>
        </Route>
        <Route path="/member/leaderboard">
          <MemberRoute><MemberLeaderboard /></MemberRoute>
        </Route>
        <Route path="/member/notifications">
          <MemberRoute><MemberNotifications /></MemberRoute>
        </Route>
        <Route path="/member/meals">
          <MemberRoute><MemberMealPlan /></MemberRoute>
        </Route>
        <Route path="/member/badges">
          <MemberRoute><MemberBadges /></MemberRoute>
        </Route>
        <Route path="/member/stats">
          <MemberRoute><MemberStats /></MemberRoute>
        </Route>
        <Route path="/member/attendance">
          <MemberRoute><MemberAttendance /></MemberRoute>
        </Route>
        <Route path="/member/schedule">
          <MemberRoute><MemberSchedule /></MemberRoute>
        </Route>
        <Route path="/member/qr">
          <MemberRoute><MemberQRCode /></MemberRoute>
        </Route>
        <Route path="/member/personal-records">
          <MemberRoute><MemberPersonalRecords /></MemberRoute>
        </Route>
        <Route path="/member/calendar">
          <MemberRoute><MemberCalendar /></MemberRoute>
        </Route>
        <Route path="/member/coach-notes">
          <MemberRoute><MemberCoachNotes /></MemberRoute>
        </Route>
        <Route path="/member/monthly-report">
          <MemberRoute><MemberMonthlyReport /></MemberRoute>
        </Route>
        <Route path="/member/settings">
          <MemberRoute><MemberSettings /></MemberRoute>
        </Route>
        <Route path="/">
          <RoleHomeRedirect />
        </Route>
        <Route>
          <RoleHomeRedirect />
        </Route>
      </Switch>
    </ErrorBoundary>
  );
}
