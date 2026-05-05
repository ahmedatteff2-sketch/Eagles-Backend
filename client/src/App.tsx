import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import MemberLayout from "@/layouts/MemberLayout";
import { useAuthStore } from "@/store/auth";

import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminMembers from "@/pages/admin/Members";
import AdminMemberProfile from "@/pages/admin/MemberProfile";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminExercises from "@/pages/admin/Exercises";
import AdminWorkoutTemplates from "@/pages/admin/WorkoutTemplates";
import AdminPayments from "@/pages/admin/Payments";
import AdminExpenses from "@/pages/admin/Expenses";
import AdminAttendance from "@/pages/admin/Attendance";
import AdminSchedule from "@/pages/admin/Schedule";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminExports from "@/pages/admin/Exports";
import AdminImports from "@/pages/admin/Imports";
import AdminSettings from "@/pages/admin/Settings";
import AdminReminders from "@/pages/admin/Reminders";
import MemberDashboard from "@/pages/member/Dashboard";
import MemberWorkouts from "@/pages/member/Workouts";
import MemberLog from "@/pages/member/Log";
import MemberStats from "@/pages/member/Stats";
import MemberAttendance from "@/pages/member/Attendance";
import MemberSchedule from "@/pages/member/Schedule";
import MemberQRCode from "@/pages/member/QRCode";
import MemberSettings from "@/pages/member/Settings";
import MemberReport from "@/pages/member/Report";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  if (user && user.role !== "admin") return <Redirect to="/member" />;
  return <AdminLayout>{children}</AdminLayout>;
}

function MemberRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  if (user && user.role === "admin") return <Redirect to="/admin" />;
  return <MemberLayout>{children}</MemberLayout>;
}

function RoleHomeRedirect() {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
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
import { useState } from "react";

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
    <>
      <ReminderPopup />
      <GlobalKeyboardShortcuts />
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
    </>
  );
}
