import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  getGetMemberCurrentSubscriptionQueryKey,
  getGetMemberSubscriptionHistoryQueryKey,
  getGetUserQueryKey,
  getListBodyStatsQueryKey,
  getListCheckinsQueryKey,
  getListExerciseLogsQueryKey,
  getListSubscriptionsQueryKey,
  useAssignSubscription,
  useGetMemberCurrentSubscription,
  useGetMemberSubscriptionHistory,
  useGetUser,
  useListBodyStats,
  useListCheckins,
  useListExerciseLogs,
  useListSubscriptions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { customFetch } from "@/api-client/custom-fetch";
import { freezeMemberSubscription, unfreezeMemberSubscription } from "@/api-client/member-subscriptions";
import { useToast } from "@/hooks/use-toast";
import { memberNotesKey } from "@/lib/storage";

import {
  assignSchema,
  avatarColor,
  emptyMealItem,
  GOLD,
  type AssignForm,
  type MealItem,
  type MealPlan,
  type Tab,
} from "./member-profile/helpers";
import { exportMemberPdf } from "./member-profile/exportPdf";
import { downloadQR, printQR } from "./member-profile/qrTools";
import { OverviewTab } from "./member-profile/OverviewTab";
import { QRTab } from "./member-profile/QRTab";
import { TrainingTab } from "./member-profile/TrainingTab";
import { MealPlansTab } from "./member-profile/MealPlansTab";
import { ProgressTab } from "./member-profile/ProgressTab";
import { NotesTab } from "./member-profile/NotesTab";
import { AssignSubscriptionModal } from "./member-profile/AssignSubscriptionModal";
import { CreateMealPlanModal } from "./member-profile/CreateMealPlanModal";
import { ConfirmDeleteMealPlanModal } from "./member-profile/ConfirmDeleteMealPlanModal";
import { QuickCheckinModal } from "./member-profile/QuickCheckinModal";
import { AssignTemplateModal } from "./member-profile/AssignTemplateModal";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "نظرة عامة" },
  { id: "qr", label: "QR الشخصي" },
  { id: "training", label: "التدريب" },
  { id: "meals", label: "خطة التغذية" },
  { id: "progress", label: "التقدم" },
  { id: "notes", label: "ملاحظات" },
];

/**
 * Admin "Member Profile" page.
 *
 * Holds all the queries, mutations and shared state, then delegates each
 * tab body and modal to a focused sub-component under `./member-profile/`.
 * This file is intentionally just orchestration — render logic lives in
 * the per-tab components so each piece is small enough to read and edit
 * without scrolling through siblings.
 */
export default function AdminMemberProfile() {
  const params = useParams<{ id: string }>();
  const userId = params.id;

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showAssign, setShowAssign] = useState(false);
  const [showAssignTemplate, setShowAssignTemplate] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [showQuickCheckin, setShowQuickCheckin] = useState(false);
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Templates assigned to this member + the full template catalogue.
  const [memberTemplates, setMemberTemplates] = useState<any[]>([]);
  const [allTemplates, setAllTemplates] = useState<any[]>([]);

  // Per-admin scratchpad notes (persisted to localStorage).
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  // Coach notes (visible to the member).
  const [coachNotes, setCoachNotes] = useState<any[]>([]);
  const [newCoachNote, setNewCoachNote] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  // Meal plans.
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [mealPlansLoading, setMealPlansLoading] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [planItems, setPlanItems] = useState<MealItem[]>([emptyMealItem()]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState<number | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  const qrRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: user } = useGetUser(userId, {
    query: { queryKey: getGetUserQueryKey(userId), enabled: !!userId },
  });
  const { data: currentSub } = useGetMemberCurrentSubscription(userId, {
    query: { queryKey: getGetMemberCurrentSubscriptionQueryKey(userId), enabled: !!userId },
  });
  const { data: subHistory } = useGetMemberSubscriptionHistory(userId, {
    query: { queryKey: getGetMemberSubscriptionHistoryQueryKey(userId), enabled: !!userId },
  });
  const { data: checkins } = useListCheckins(
    { userId },
    { query: { queryKey: getListCheckinsQueryKey({ userId }), enabled: !!userId } },
  );
  const { data: bodyStats } = useListBodyStats(
    { userId },
    { query: { queryKey: getListBodyStatsQueryKey({ userId }), enabled: !!userId } },
  );
  const { data: subscriptions } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() },
  });
  const { data: exerciseLogs } = useListExerciseLogs(
    { userId },
    { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } },
  );

  const assignSub = useAssignSubscription();
  const assignForm = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      startDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
    },
  });

  // ── Side-effect-heavy fetchers ───────────────────────────────────────
  // Templates aren't auto-fetched per-user, so we cross-reference all
  // templates with their assignments to filter to ones owned by this user.
  async function fetchMemberTemplates() {
    if (!userId) return;
    try {
      const [templates, all] = await Promise.all([
        customFetch<any[]>(`/api/workout-templates`),
        customFetch<any[]>(`/api/workout-templates`),
      ]);
      const assigned: any[] = [];
      for (const t of templates) {
        try {
          const assignments = await customFetch<any[]>(`/api/workout-templates/${t.id}/assignments`);
          const match = assignments.find((a: any) => a.userId === userId);
          if (match) assigned.push({ ...t, assignmentId: match.id });
        } catch {
          /* ignore */
        }
      }
      setMemberTemplates(assigned);
      setAllTemplates(all);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (activeTab === "training") void fetchMemberTemplates();
    // `fetchMemberTemplates` closes over `userId` so include it directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId]);

  function fetchCoachNotes() {
    if (!userId) return;
    customFetch<any[]>(`/api/coach-notes/${userId}`)
      .then((d) => setCoachNotes(Array.isArray(d) ? d : []))
      .catch(() => {});
  }
  useEffect(() => {
    if (activeTab === "notes") fetchCoachNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId]);

  function fetchMealPlans() {
    if (!userId) return;
    setMealPlansLoading(true);
    customFetch<MealPlan[]>(`/api/meal-plans?userId=${encodeURIComponent(userId)}`)
      .then((d) => setMealPlans(Array.isArray(d) ? d : []))
      .catch(() => setMealPlans([]))
      .finally(() => setMealPlansLoading(false));
  }
  useEffect(() => {
    if (activeTab === "meals") fetchMealPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId]);

  // ── Meal plan form helpers ───────────────────────────────────────────
  function resetPlanForm() {
    setPlanName("");
    setPlanNotes("");
    setPlanItems([emptyMealItem()]);
  }

  function updateItem(idx: number, patch: Partial<MealItem>) {
    setPlanItems((items) => items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setPlanItems((items) => [...items, emptyMealItem()]);
  }
  function removeItem(idx: number) {
    setPlanItems((items) => (items.length <= 1 ? items : items.filter((_, i) => i !== idx)));
  }

  async function savePlan() {
    if (!userId) return;
    if (!planName.trim()) {
      toast({ title: "اسم الخطة مطلوب", variant: "destructive" });
      return;
    }
    const items = planItems
      .map((it) => ({ ...it, mealName: it.mealName.trim() }))
      .filter((it) => it.mealName.length > 0);
    if (items.length === 0) {
      toast({ title: "أضف وجبة واحدة على الأقل", variant: "destructive" });
      return;
    }
    setSavingPlan(true);
    try {
      await customFetch("/api/meal-plans", {
        method: "POST",
        body: JSON.stringify({
          userId,
          name: planName.trim(),
          notes: planNotes.trim() || undefined,
          items: items.map((it) => ({
            mealName: it.mealName,
            time: it.time?.trim() || undefined,
            calories: it.calories ?? undefined,
            protein: it.protein ?? undefined,
            carbs: it.carbs ?? undefined,
            fats: it.fats ?? undefined,
            description: it.description?.trim() || undefined,
          })),
        }),
      });
      toast({ title: "تم حفظ خطة التغذية" });
      resetPlanForm();
      setShowCreatePlan(false);
      fetchMealPlans();
    } catch {
      toast({ title: "فشل في حفظ الخطة", variant: "destructive" });
    }
    setSavingPlan(false);
  }

  async function deletePlan(id: number) {
    try {
      await customFetch(`/api/meal-plans/${id}`, { method: "DELETE" });
      toast({ title: "تم حذف الخطة" });
      setConfirmDeletePlanId(null);
      setMealPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast({ title: "فشل في الحذف", variant: "destructive" });
    }
  }

  async function sendCoachNote() {
    if (!newCoachNote.trim() || !userId) return;
    setSendingNote(true);
    try {
      await customFetch("/api/coach-notes", {
        method: "POST",
        body: JSON.stringify({ userId, note: newCoachNote.trim() }),
      });
      toast({ title: "تم إرسال الملاحظة" });
      setNewCoachNote("");
      fetchCoachNotes();
    } catch {
      toast({ title: "فشل", variant: "destructive" });
    }
    setSendingNote(false);
  }

  async function deleteCoachNote(id: number) {
    try {
      await customFetch(`/api/coach-notes/${id}`, { method: "DELETE" });
      setCoachNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      /* ignore */
    }
  }

  async function updateCategory(cat: string) {
    try {
      await customFetch(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ category: cat }),
      });
      toast({ title: "تم تحديث فئة العضو" });
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
    } catch {
      toast({ title: "فشل", variant: "destructive" });
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────
  const userData: any = user;
  const memberName: string = userData?.name ?? "—";
  const memberPhone: string = userData?.phone ?? "—";
  const activeSub: any = (currentSub as any)?.data ?? currentSub;
  const isFrozen = activeSub?.status === "frozen";
  // "Active" here means the subscription is in good standing — both
  // active *and* frozen count, since a frozen sub is not expired and the
  // member's account should still feel valid in the UI.
  const isActive = activeSub?.endDate ? isFrozen || new Date(activeSub.endDate) >= new Date() : false;
  const [freezeBusy, setFreezeBusy] = useState(false);
  const historyList: any[] = (subHistory as any)?.data ?? (Array.isArray(subHistory) ? subHistory : []);
  const checkinList: any[] = Array.isArray(checkins) ? checkins : ((checkins as any)?.data ?? []);
  const statsList: any[] = Array.isArray(bodyStats) ? bodyStats : ((bodyStats as any)?.data ?? []);
  const subList: any[] = Array.isArray(subscriptions) ? subscriptions : ((subscriptions as any)?.data ?? []);
  const logList: any[] = Array.isArray(exerciseLogs) ? exerciseLogs : ((exerciseLogs as any)?.data ?? []);

  const qrValue = JSON.stringify({ userId, name: memberName });
  const color = avatarColor(memberName);

  // Notes from localStorage (per-admin private scratchpad). Wrapped in
  // try/catch so disabled or full storage doesn't crash the page.
  useEffect(() => {
    if (!userId) return;
    try {
      setNotes(localStorage.getItem(memberNotesKey(userId)) ?? "");
    } catch {
      setNotes("");
    }
  }, [userId]);

  function saveNotes() {
    if (!userId) return;
    try {
      localStorage.setItem(memberNotesKey(userId), notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      toast({ title: "✅ تم حفظ الملاحظات" });
    } catch {
      toast({ title: "تعذر حفظ الملاحظات", variant: "destructive" });
    }
  }

  // Check-in roll-ups for the overview KPI cards.
  const now = new Date();
  const thisMonth = checkinList.filter((c: any) => {
    const d = new Date(c.timestamp ?? "");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const thisWeek = checkinList.filter((c: any) => {
    const d = new Date(c.timestamp ?? "");
    const diff = (now.getTime() - d.getTime()) / 86400000;
    return diff <= 7;
  }).length;

  const daysLeft = activeSub?.endDate
    ? Math.ceil((new Date(activeSub.endDate).getTime() - now.getTime()) / 86400000)
    : null;

  const chartData = [...statsList]
    .reverse()
    .slice(-10)
    .map((s: any) => ({
      date: new Date(s.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
      وزن: s.weight ? parseFloat(s.weight) : null,
    }))
    .filter((d: any) => d.وزن !== null);

  const logsByExercise = logList.reduce((acc: Record<string, any[]>, l: any) => {
    const k = l.exercise?.name ?? "غير معروف";
    if (!acc[k]) acc[k] = [];
    acc[k].push(l);
    return acc;
  }, {});
  const recentLogs = [...logList]
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // ── Action handlers ──────────────────────────────────────────────────
  function onAssign(data: AssignForm) {
    if (!userId) return;
    assignSub.mutate(
      {
        data: {
          userId,
          subscriptionId: data.subscriptionId,
          startDate: data.startDate,
          paymentAmount: data.paymentAmount,
          paymentMethod: data.paymentMethod,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "✅ تم تعيين الاشتراك" });
          setShowAssign(false);
          queryClient.invalidateQueries({
            queryKey: getGetMemberCurrentSubscriptionQueryKey(userId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetMemberSubscriptionHistoryQueryKey(userId),
          });
        },
        onError: () => toast({ title: "فشل في تعيين الاشتراك", variant: "destructive" }),
      },
    );
  }

  async function assignTemplate() {
    if (!assignTemplateId || !userId) return;
    try {
      await customFetch(`/api/workout-templates/${assignTemplateId}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      toast({ title: "تم تعيين القالب" });
      setShowAssignTemplate(false);
      setAssignTemplateId("");
      fetchMemberTemplates();
    } catch {
      toast({ title: "فشل في التعيين", variant: "destructive" });
    }
  }

  async function unassignTemplate(assignmentId: number) {
    try {
      await customFetch(`/api/workout-assignments/${assignmentId}`, { method: "DELETE" });
      toast({ title: "تم إلغاء التعيين" });
      fetchMemberTemplates();
    } catch {
      toast({ title: "فشل", variant: "destructive" });
    }
  }

  async function quickCheckin() {
    if (!userId) return;
    setSavingCheckin(true);
    try {
      await customFetch("/api/checkins", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      toast({ title: "✅ تم تسجيل الحضور" });
      setShowQuickCheckin(false);
      queryClient.invalidateQueries({ queryKey: getListCheckinsQueryKey({ userId }) });
    } catch (err: any) {
      const msg = err?.payload?.message ?? err?.response?.data?.message ?? "فشل في تسجيل الحضور";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSavingCheckin(false);
    }
  }

  async function handleFreeze() {
    if (!activeSub?.id) return;
    setFreezeBusy(true);
    try {
      await freezeMemberSubscription(activeSub.id);
      toast({ title: "❄️ تم تجميد الاشتراك" });
      queryClient.invalidateQueries({ queryKey: getGetMemberCurrentSubscriptionQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: getGetMemberSubscriptionHistoryQueryKey(userId) });
    } catch (err: any) {
      toast({
        title: err?.data?.message ?? "فشل التجميد",
        variant: "destructive",
      });
    } finally {
      setFreezeBusy(false);
    }
  }

  async function handleUnfreeze() {
    if (!activeSub?.id) return;
    setFreezeBusy(true);
    try {
      const res = await unfreezeMemberSubscription(activeSub.id);
      toast({ title: `☀️ تم إلغاء التجميد (+${res.addedDays} يوم)` });
      queryClient.invalidateQueries({ queryKey: getGetMemberCurrentSubscriptionQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: getGetMemberSubscriptionHistoryQueryKey(userId) });
    } catch (err: any) {
      toast({
        title: err?.data?.message ?? "فشل إلغاء التجميد",
        variant: "destructive",
      });
    } finally {
      setFreezeBusy(false);
    }
  }

  function handleExportPdf() {
    exportMemberPdf({
      userId,
      memberName,
      memberPhone,
      activeSub,
      isActive,
      daysLeft,
      totalCheckins: checkinList.length,
      thisMonth,
      thisWeek,
      templateCount: memberTemplates.length,
      history: historyList,
      notesText: localStorage.getItem(memberNotesKey(userId)) ?? "",
    });
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin">
          <span className="hover:text-foreground cursor-pointer">الرئيسية</span>
        </Link>
        <span>/</span>
        <Link href="/admin/members">
          <span className="hover:text-foreground cursor-pointer">الأعضاء</span>
        </Link>
        <span>/</span>
        <span style={{ color: GOLD }}>{memberName}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/admin/members">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </Link>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl flex-shrink-0"
            style={{
              background: color + "22",
              color,
              border: `2px solid ${color}44`,
              boxShadow: `0 0 20px ${color}18`,
            }}
          >
            {memberName[0] ?? "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{memberName}</h1>
            <p className="text-muted-foreground text-sm">
              {memberPhone} • #{userId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuickCheckin(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "hsl(142 60% 45% / 0.15)",
              color: "hsl(142 60% 60%)",
              border: "1px solid hsl(142 60% 45% / 0.35)",
            }}
            title="تسجيل حضور الآن"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            سجّل حضور الآن
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "hsl(0 0% 14%)",
              color: "hsl(0 0% 65%)",
              border: "1px solid hsl(0 0% 20%)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF
          </button>
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: isActive
                ? "hsl(0 0% 14%)"
                : "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
              color: isActive ? "hsl(0 0% 65%)" : "hsl(0 0% 5%)",
            }}
          >
            {isActive ? "🔄 تجديد الاشتراك" : "✅ تعيين اشتراك"}
          </button>
        </div>
      </div>

      {/* Subscription status bar. Includes a freeze/unfreeze action so
          admins can pause an active sub (e.g. member is travelling) and
          resume it later — endDate is automatically extended by the elapsed
          frozen days on the server. */}
      {activeSub && (
        <div
          className="rounded-xl px-5 py-3 flex items-center justify-between flex-wrap gap-3"
          style={{
            background: isFrozen
              ? "hsl(210 80% 55% / 0.08)"
              : isActive
                ? "hsl(142 60% 50% / 0.08)"
                : "hsl(0 60% 50% / 0.08)",
            border: `1px solid ${
              isFrozen
                ? "hsl(210 80% 55% / 0.25)"
                : isActive
                  ? "hsl(142 60% 50% / 0.25)"
                  : "hsl(0 60% 50% / 0.25)"
            }`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{isFrozen ? "❄️" : isActive ? "✅" : "⚠️"}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {activeSub.subscription?.name ?? "—"}
                {isFrozen && (
                  <span className="text-xs font-bold ml-2" style={{ color: "hsl(210 80% 65%)" }}>
                    · مجمد
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(activeSub.startDate).toLocaleDateString("ar-EG")} ←{" "}
                {new Date(activeSub.endDate).toLocaleDateString("ar-EG")}
                {activeSub.totalFrozenDays > 0 && (
                  <span className="ml-2">· إجمالي أيام التجميد: {activeSub.totalFrozenDays}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isFrozen ? (
              <button
                onClick={handleUnfreeze}
                disabled={freezeBusy}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                  color: "hsl(0 0% 5%)",
                }}
              >
                ☀️ إلغاء التجميد
              </button>
            ) : (
              isActive && (
                <button
                  onClick={handleFreeze}
                  disabled={freezeBusy}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                  style={{
                    background: "hsl(210 80% 55% / 0.15)",
                    color: "hsl(210 80% 65%)",
                    border: "1px solid hsl(210 80% 55% / 0.3)",
                  }}
                >
                  ❄️ تجميد
                </button>
              )
            )}
            <p
              className="text-sm font-bold"
              style={{
                color: isFrozen ? "hsl(210 80% 65%)" : isActive ? "hsl(142 60% 60%)" : "hsl(0 60% 60%)",
              }}
            >
              {isFrozen ? "متوقف" : isActive && daysLeft !== null ? `باقي ${daysLeft} يوم` : "منتهي"}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          totalCheckins={checkinList.length}
          thisMonth={thisMonth}
          thisWeek={thisWeek}
          templateCount={memberTemplates.length}
          history={historyList}
          checkins={checkinList}
        />
      )}

      {activeTab === "qr" && (
        <QRTab
          ref={qrRef}
          userId={userId}
          memberName={memberName}
          qrValue={qrValue}
          activeSub={activeSub}
          isActive={isActive}
          onDownload={() => downloadQR(qrRef.current, userId)}
          onPrint={() => printQR(qrRef.current, memberName, userId)}
        />
      )}

      {activeTab === "training" && (
        <TrainingTab
          memberTemplates={memberTemplates}
          logsByExercise={logsByExercise}
          recentLogs={recentLogs}
          totalLogCount={logList.length}
          onAssignTemplate={() => setShowAssignTemplate(true)}
          onUnassignTemplate={unassignTemplate}
        />
      )}

      {activeTab === "meals" && (
        <MealPlansTab
          plans={mealPlans}
          loading={mealPlansLoading}
          expandedPlanId={expandedPlanId}
          onToggleExpand={(id) => setExpandedPlanId(expandedPlanId === id ? null : id)}
          onCreate={() => {
            resetPlanForm();
            setShowCreatePlan(true);
          }}
          onConfirmDelete={(id) => setConfirmDeletePlanId(id)}
        />
      )}

      {activeTab === "progress" && <ProgressTab chartData={chartData} stats={statsList} />}

      {activeTab === "notes" && (
        <NotesTab
          notes={notes}
          notesSaved={notesSaved}
          onNotesChange={setNotes}
          onSaveNotes={saveNotes}
          category={userData?.category}
          onUpdateCategory={updateCategory}
          newCoachNote={newCoachNote}
          onNewCoachNoteChange={setNewCoachNote}
          onSendCoachNote={sendCoachNote}
          sendingNote={sendingNote}
          coachNotes={coachNotes}
          onDeleteCoachNote={deleteCoachNote}
        />
      )}

      {showAssign && (
        <AssignSubscriptionModal
          isActive={isActive}
          isPending={assignSub.isPending}
          subscriptions={subList}
          form={assignForm}
          onSubmit={onAssign}
          onClose={() => setShowAssign(false)}
        />
      )}

      {showCreatePlan && (
        <CreateMealPlanModal
          memberName={memberName}
          planName={planName}
          planNotes={planNotes}
          planItems={planItems}
          saving={savingPlan}
          onPlanNameChange={setPlanName}
          onPlanNotesChange={setPlanNotes}
          onUpdateItem={updateItem}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onSave={savePlan}
          onClose={() => {
            setShowCreatePlan(false);
            resetPlanForm();
          }}
        />
      )}

      {confirmDeletePlanId !== null && (
        <ConfirmDeleteMealPlanModal
          onConfirm={() => deletePlan(confirmDeletePlanId)}
          onClose={() => setConfirmDeletePlanId(null)}
        />
      )}

      {showQuickCheckin && (
        <QuickCheckinModal
          memberName={memberName}
          saving={savingCheckin}
          onConfirm={quickCheckin}
          onClose={() => setShowQuickCheckin(false)}
        />
      )}

      {showAssignTemplate && (
        <AssignTemplateModal
          memberName={memberName}
          templates={allTemplates}
          templateId={assignTemplateId}
          onChange={setAssignTemplateId}
          onAssign={assignTemplate}
          onClose={() => setShowAssignTemplate(false)}
        />
      )}
    </div>
  );
}
