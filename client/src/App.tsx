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

export default function App() {
  // Apply saved theme on mount
  useEffect(() => {
    const theme = localStorage.getItem("gym-theme") ?? "dark";
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

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
