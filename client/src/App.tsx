import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { useAuthStore } from "@/store/auth";

import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminMembers from "@/pages/admin/Members";
import AdminMemberProfile from "@/pages/admin/MemberProfile";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminTraining from "@/pages/admin/Training";
import AdminPayments from "@/pages/admin/Payments";
import AdminExpenses from "@/pages/admin/Expenses";
import AdminAttendance from "@/pages/admin/Attendance";
import AdminSchedule from "@/pages/admin/Schedule";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminExports from "@/pages/admin/Exports";
import AdminImports from "@/pages/admin/Imports";
import AdminSettings from "@/pages/admin/Settings";
import AdminReminders from "@/pages/admin/Reminders";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore();
  if (!accessToken) return <Redirect to="/login" />;
  return <AdminLayout>{children}</AdminLayout>;
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
          <ProtectedRoute><AdminDashboard /></ProtectedRoute>
        </Route>
        <Route path="/admin/members">
          <ProtectedRoute><AdminMembers /></ProtectedRoute>
        </Route>
        <Route path="/admin/members/:id">
          {(params) => <ProtectedRoute><AdminMemberProfile /></ProtectedRoute>}
        </Route>
        <Route path="/admin/subscriptions">
          <ProtectedRoute><AdminSubscriptions /></ProtectedRoute>
        </Route>
        <Route path="/admin/training">
          <ProtectedRoute><AdminTraining /></ProtectedRoute>
        </Route>
        <Route path="/admin/payments">
          <ProtectedRoute><AdminPayments /></ProtectedRoute>
        </Route>
        <Route path="/admin/expenses">
          <ProtectedRoute><AdminExpenses /></ProtectedRoute>
        </Route>
        <Route path="/admin/attendance">
          <ProtectedRoute><AdminAttendance /></ProtectedRoute>
        </Route>
        {/* Legacy redirects */}
        <Route path="/admin/checkins">
          <Redirect to="/admin/attendance" />
        </Route>
        <Route path="/admin/qr-scanner">
          <Redirect to="/admin/attendance" />
        </Route>
        <Route path="/admin/schedule">
          <ProtectedRoute><AdminSchedule /></ProtectedRoute>
        </Route>
        <Route path="/admin/analytics">
          <ProtectedRoute><AdminAnalytics /></ProtectedRoute>
        </Route>
        <Route path="/admin/exports">
          <ProtectedRoute><AdminExports /></ProtectedRoute>
        </Route>
        <Route path="/admin/imports">
          <ProtectedRoute><AdminImports /></ProtectedRoute>
        </Route>
        <Route path="/admin/settings">
          <ProtectedRoute><AdminSettings /></ProtectedRoute>
        </Route>
        <Route path="/admin/reminders">
          <ProtectedRoute><AdminReminders /></ProtectedRoute>
        </Route>
        <Route path="/">
          <Redirect to="/admin" />
        </Route>
      </Switch>
    </>
  );
}
