import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect, useState, lazy, Suspense } from "react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CommandPalette from "@/components/CommandPalette";
import AdminLayout from "@/layouts/AdminLayout";
import MemberLayout from "@/layouts/MemberLayout";
import TrainerLayout from "@/layouts/TrainerLayout";
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
const AdminAbsentMembers = lazy(() => import("@/pages/admin/AbsentMembers"));
const AdminWhatsAppTemplates = lazy(() => import("@/pages/admin/WhatsAppTemplates"));
const AdminAuditLog = lazy(() => import("@/pages/admin/AuditLog"));
const MemberDashboard = lazy(() => import("@/pages/member/Dashboard"));
const MemberWorkouts = lazy(() => import("@/pages/member/Workouts"));
const MemberMyWorkouts = lazy(() => import("@/pages/member/MyWorkouts"));
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

// Trainer portal pages — separate bundle so admins/members never download
// them, and the trainer's first paint is fast (just the dashboard chunk).
const TrainerDashboard = lazy(() => import("@/pages/trainer/Dashboard"));
const TrainerMembers = lazy(() => import("@/pages/trainer/Members"));
const TrainerMemberProfile = lazy(() => import("@/pages/trainer/MemberProfile"));
const TrainerSchedule = lazy(() => import("@/pages/trainer/Schedule"));
const TrainerPerformance = lazy(() => import("@/pages/trainer/Performance"));
const TrainerSettings = lazy(() => import("@/pages/trainer/Settings"));

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  if (user && user.role !== "admin") {
    // Bounce non-admins to their own home rather than /member, so trainers
    // who follow a stale /admin/* link land on /trainer instead of getting
    // dumped into the member portal.
    return <Redirect to={user.role === "trainer" ? "/trainer" : "/member"} />;
  }
  return (
    <AdminLayout>
      <LazyPage>{children}</LazyPage>
    </AdminLayout>
  );
}

function MemberRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  if (user) {
    if (user.role === "admin") return <Redirect to="/admin" />;
    if (user.role === "trainer") return <Redirect to="/trainer" />;
  }
  return (
    <MemberLayout>
      <LazyPage>{children}</LazyPage>
    </MemberLayout>
  );
}

/**
 * Trainer-only route guard. Trainers have a strictly separate UI from
 * admins and members; an admin who lands on /trainer/* is bounced to /admin
 * (they have their own admin views), and a member is bounced to /member.
 */
function TrainerRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  if (user) {
    if (user.role === "admin") return <Redirect to="/admin" />;
    if (user.role !== "trainer") return <Redirect to="/member" />;
  }
  return (
    <TrainerLayout>
      <LazyPage>{children}</LazyPage>
    </TrainerLayout>
  );
}

// The site root shows the public marketing landing page (an isolated static
// build served at /landing/) to anyone who isn't signed in. Authenticated
// users skip it and go straight to their role home.
function HomeRoute() {
  const { accessToken } = useAuthStore();
  useEffect(() => {
    if (!accessToken) window.location.replace("/landing/");
  }, [accessToken]);
  if (!accessToken) return null;
  return <RoleHomeRedirect />;
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
  // Three roles → three landing pages. Default to /member for any future
  // role we add (safe least-privilege fallback).
  if (user?.role === "admin") return <Redirect to="/admin" />;
  if (user?.role === "trainer") return <Redirect to="/trainer" />;
  return <Redirect to="/member" />;
}

function GlobalKeyboardShortcuts() {
  // Keyboard shortcuts moved into CommandPalette so they're centralized,
  // discoverable (Ctrl/Cmd+K), and visible in the palette's hint column.
  // This wrapper is kept so the existing call site below still compiles —
  // remove once the palette is verified in production.
  return null;
}

import { ReminderPopup } from "@/components/ReminderPopup";
import { Toaster } from "@/components/ui/toaster";

function SplashScreen({ onDone }: { onDone: () => void }) {
  // Cap the splash to ~1.4s. We use the first paint as the "started" marker
  // and only wait long enough to finish the logo glow animation; once the
  // user has seen the splash on this device we'll skip it next time
  // (see `splashDone` initializer).
  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[hsl(0_0%_4%)]">
      <style>{`
        @keyframes splashIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes splashGlow { 0%,100%{box-shadow:0 0 20px hsl(40 65% 48% / 0.2)} 50%{box-shadow:0 0 60px hsl(40 65% 48% / 0.5)} }
        @keyframes splashFadeOut { from{opacity:1} to{opacity:0} }
        .splash-wrapper { animation: splashIn 0.5s ease-out, splashFadeOut 0.3s ease-in 1.1s forwards; }
        .splash-logo { animation: splashGlow 1.2s ease-in-out infinite; }
      `}</style>
      <div className="splash-wrapper flex flex-col items-center gap-4">
        <img
          src="/eagle-gym-logo.jpg"
          alt="Eagle Gym"
          className="splash-logo w-24 h-24 rounded-2xl object-contain bg-[hsl(0_0%_6%)] border border-[hsl(40_65%_48%/0.3)]"
        />
        <div className="text-center">
          <h1 className="text-xl font-black tracking-[0.25em] uppercase text-[hsl(40_65%_55%)]">Eagle Gym</h1>
          <div className="w-12 h-0.5 rounded mx-auto mt-2 bg-gradient-to-r from-transparent via-[hsl(40_65%_48%)] to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Show the splash only on the first visit per device (localStorage). After
  // that, sessionStorage takes over so the splash doesn't flash on every
  // tab. Set ?splash=1 in the URL to force-show the splash for QA.
  const [splashDone, setSplashDone] = useState(() => {
    try {
      const force = new URLSearchParams(window.location.search).has("splash");
      if (force) return false;
      if (sessionStorage.getItem(STORAGE_KEYS.SPLASH_DONE) === "1") return true;
      if (localStorage.getItem(STORAGE_KEYS.SPLASH_DONE) === "1") return true;
      return false;
    } catch {
      return false;
    }
  });

  // Apply saved theme on mount
  useEffect(() => {
    const theme = localStorage.getItem("gym-theme") ?? "dark";
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  function handleSplashDone() {
    try {
      sessionStorage.setItem(STORAGE_KEYS.SPLASH_DONE, "1");
      // Mark "seen on this device" so subsequent visits skip the splash
      // entirely (not just within the same browser session).
      localStorage.setItem(STORAGE_KEYS.SPLASH_DONE, "1");
    } catch {
      /* ignore */
    }
    setSplashDone(true);
  }

  if (!splashDone) return <SplashScreen onDone={handleSplashDone} />;

  return (
    <ErrorBoundary>
      <ReminderPopup />
      <CommandPalette />
      <GlobalKeyboardShortcuts />
      <PWAInstallPrompt />
      <Toaster />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/admin">
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        </Route>
        <Route path="/admin/members">
          <AdminRoute>
            <AdminMembers />
          </AdminRoute>
        </Route>
        <Route path="/admin/members/:id">
          {(params) => (
            <AdminRoute>
              <AdminMemberProfile />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/subscriptions">
          <AdminRoute>
            <AdminSubscriptions />
          </AdminRoute>
        </Route>
        <Route path="/admin/exercises">
          <AdminRoute>
            <AdminExercises />
          </AdminRoute>
        </Route>
        <Route path="/admin/workout-templates">
          <AdminRoute>
            <AdminWorkoutTemplates />
          </AdminRoute>
        </Route>
        <Route path="/admin/payments">
          <AdminRoute>
            <AdminPayments />
          </AdminRoute>
        </Route>
        <Route path="/admin/expenses">
          <AdminRoute>
            <AdminExpenses />
          </AdminRoute>
        </Route>
        <Route path="/admin/attendance">
          <AdminRoute>
            <AdminAttendance />
          </AdminRoute>
        </Route>
        {/* Legacy redirects */}
        <Route path="/admin/checkins">
          <Redirect to="/admin/attendance" />
        </Route>
        <Route path="/admin/qr-scanner">
          <Redirect to="/admin/attendance" />
        </Route>
        <Route path="/admin/schedule">
          <AdminRoute>
            <AdminSchedule />
          </AdminRoute>
        </Route>
        <Route path="/admin/analytics">
          <AdminRoute>
            <AdminAnalytics />
          </AdminRoute>
        </Route>
        <Route path="/admin/exports">
          <AdminRoute>
            <AdminExports />
          </AdminRoute>
        </Route>
        <Route path="/admin/imports">
          <AdminRoute>
            <AdminImports />
          </AdminRoute>
        </Route>
        <Route path="/admin/settings">
          <AdminRoute>
            <AdminSettings />
          </AdminRoute>
        </Route>
        <Route path="/admin/reminders">
          <AdminRoute>
            <AdminReminders />
          </AdminRoute>
        </Route>
        <Route path="/admin/renewal-reminders">
          <AdminRoute>
            <AdminRenewalReminders />
          </AdminRoute>
        </Route>
        <Route path="/admin/absent-members">
          <AdminRoute>
            <AdminAbsentMembers />
          </AdminRoute>
        </Route>
        <Route path="/admin/wa-templates">
          <AdminRoute>
            <AdminWhatsAppTemplates />
          </AdminRoute>
        </Route>
        <Route path="/admin/audit">
          <AdminRoute>
            <AdminAuditLog />
          </AdminRoute>
        </Route>
        {/* Trainer portal */}
        <Route path="/trainer">
          <TrainerRoute>
            <TrainerDashboard />
          </TrainerRoute>
        </Route>
        <Route path="/trainer/members">
          <TrainerRoute>
            <TrainerMembers />
          </TrainerRoute>
        </Route>
        <Route path="/trainer/members/:id">
          {() => (
            <TrainerRoute>
              <TrainerMemberProfile />
            </TrainerRoute>
          )}
        </Route>
        <Route path="/trainer/schedule">
          <TrainerRoute>
            <TrainerSchedule />
          </TrainerRoute>
        </Route>
        <Route path="/trainer/performance">
          <TrainerRoute>
            <TrainerPerformance />
          </TrainerRoute>
        </Route>
        <Route path="/trainer/settings">
          <TrainerRoute>
            <TrainerSettings />
          </TrainerRoute>
        </Route>
        {/* Member routes */}
        <Route path="/member">
          <MemberRoute>
            <MemberDashboard />
          </MemberRoute>
        </Route>
        <Route path="/member/workouts">
          <MemberRoute>
            <MemberWorkouts />
          </MemberRoute>
        </Route>
        <Route path="/member/my-workouts">
          <MemberRoute>
            <MemberMyWorkouts />
          </MemberRoute>
        </Route>
        <Route path="/member/log">
          <MemberRoute>
            <MemberLog />
          </MemberRoute>
        </Route>
        <Route path="/member/report">
          <MemberRoute>
            <MemberReport />
          </MemberRoute>
        </Route>
        <Route path="/member/photos">
          <MemberRoute>
            <MemberProgressPhotos />
          </MemberRoute>
        </Route>
        <Route path="/member/leaderboard">
          <MemberRoute>
            <MemberLeaderboard />
          </MemberRoute>
        </Route>
        <Route path="/member/notifications">
          <MemberRoute>
            <MemberNotifications />
          </MemberRoute>
        </Route>
        <Route path="/member/meals">
          <MemberRoute>
            <MemberMealPlan />
          </MemberRoute>
        </Route>
        <Route path="/member/badges">
          <MemberRoute>
            <MemberBadges />
          </MemberRoute>
        </Route>
        <Route path="/member/stats">
          <MemberRoute>
            <MemberStats />
          </MemberRoute>
        </Route>
        <Route path="/member/attendance">
          <MemberRoute>
            <MemberAttendance />
          </MemberRoute>
        </Route>
        <Route path="/member/schedule">
          <MemberRoute>
            <MemberSchedule />
          </MemberRoute>
        </Route>
        <Route path="/member/qr">
          <MemberRoute>
            <MemberQRCode />
          </MemberRoute>
        </Route>
        <Route path="/member/personal-records">
          <MemberRoute>
            <MemberPersonalRecords />
          </MemberRoute>
        </Route>
        <Route path="/member/calendar">
          <MemberRoute>
            <MemberCalendar />
          </MemberRoute>
        </Route>
        <Route path="/member/coach-notes">
          <MemberRoute>
            <MemberCoachNotes />
          </MemberRoute>
        </Route>
        <Route path="/member/monthly-report">
          <MemberRoute>
            <MemberMonthlyReport />
          </MemberRoute>
        </Route>
        <Route path="/member/settings">
          <MemberRoute>
            <MemberSettings />
          </MemberRoute>
        </Route>
        <Route path="/">
          <HomeRoute />
        </Route>
        <Route>
          <RoleHomeRedirect />
        </Route>
      </Switch>
    </ErrorBoundary>
  );
}
