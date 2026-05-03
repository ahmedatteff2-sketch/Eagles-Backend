import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth";
import LoginPage from "@/pages/login";
import AdminLayout from "@/layouts/AdminLayout";
import MemberLayout from "@/layouts/MemberLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminMembers from "@/pages/admin/Members";
import AdminMemberProfile from "@/pages/admin/MemberProfile";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminTraining from "@/pages/admin/Training";
import AdminTrainingProgram from "@/pages/admin/TrainingProgram";
import AdminPayments from "@/pages/admin/Payments";
import AdminCheckins from "@/pages/admin/Checkins";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminExports from "@/pages/admin/Exports";
import AdminImports from "@/pages/admin/Imports";
import AdminExpenses from "@/pages/admin/Expenses";
import AdminSchedule from "@/pages/admin/Schedule";
import AdminQRScanner from "@/pages/admin/QRScanner";
import MemberDashboard from "@/pages/member/Dashboard";
import MemberWorkouts from "@/pages/member/Workouts";
import MemberLog from "@/pages/member/Log";
import MemberStats from "@/pages/member/Stats";
import MemberAttendance from "@/pages/member/Attendance";
import MemberSettings from "@/pages/member/Settings";
import MemberQRCode from "@/pages/member/QRCode";
import MemberSchedule from "@/pages/member/Schedule";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, accessToken } = useAuthStore();
  if (!accessToken || !user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/member" />;
  return <Component />;
}

function ProtectedMemberRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, accessToken } = useAuthStore();
  if (!accessToken || !user) return <Redirect to="/login" />;
  if (user.role === "admin") return <Redirect to="/admin" />;
  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AdminLayout>
      <ProtectedAdminRoute component={Component} />
    </AdminLayout>
  );
}

function MemberRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <MemberLayout>
      <ProtectedMemberRoute component={Component} />
    </MemberLayout>
  );
}

function Router() {
  const { user, accessToken } = useAuthStore();

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      {/* Admin routes */}
      <Route path="/admin">{() => <AdminRoute component={AdminDashboard} />}</Route>
      <Route path="/admin/members">{() => <AdminRoute component={AdminMembers} />}</Route>
      <Route path="/admin/members/:id">{() => <AdminRoute component={AdminMemberProfile} />}</Route>
      <Route path="/admin/subscriptions">{() => <AdminRoute component={AdminSubscriptions} />}</Route>
      <Route path="/admin/training">{() => <AdminRoute component={AdminTraining} />}</Route>
      <Route path="/admin/training/:programId">{() => <AdminRoute component={AdminTrainingProgram} />}</Route>
      <Route path="/admin/payments">{() => <AdminRoute component={AdminPayments} />}</Route>
      <Route path="/admin/checkins">{() => <AdminRoute component={AdminCheckins} />}</Route>
      <Route path="/admin/analytics">{() => <AdminRoute component={AdminAnalytics} />}</Route>
      <Route path="/admin/exports">{() => <AdminRoute component={AdminExports} />}</Route>
      <Route path="/admin/imports">{() => <AdminRoute component={AdminImports} />}</Route>
      <Route path="/admin/expenses">{() => <AdminRoute component={AdminExpenses} />}</Route>
      <Route path="/admin/schedule">{() => <AdminRoute component={AdminSchedule} />}</Route>
      <Route path="/admin/qr-scanner">{() => <AdminRoute component={AdminQRScanner} />}</Route>

      {/* Member routes */}
      <Route path="/member">{() => <MemberRoute component={MemberDashboard} />}</Route>
      <Route path="/member/workouts">{() => <MemberRoute component={MemberWorkouts} />}</Route>
      <Route path="/member/log">{() => <MemberRoute component={MemberLog} />}</Route>
      <Route path="/member/stats">{() => <MemberRoute component={MemberStats} />}</Route>
      <Route path="/member/attendance">{() => <MemberRoute component={MemberAttendance} />}</Route>
      <Route path="/member/settings">{() => <MemberRoute component={MemberSettings} />}</Route>
      <Route path="/member/qr">{() => <MemberRoute component={MemberQRCode} />}</Route>
      <Route path="/member/schedule">{() => <MemberRoute component={MemberSchedule} />}</Route>

      {/* Root redirect */}
      <Route path="/">
        {() => {
          if (!accessToken || !user) return <Redirect to="/login" />;
          if (user.role === "admin") return <Redirect to="/admin" />;
          return <Redirect to="/member" />;
        }}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
