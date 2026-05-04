import { useParams, Link, useLocation } from "wouter";
import {
  useGetUser, useGetMemberCurrentSubscription, useGetMemberSubscriptionHistory,
  useListCheckins, useListBodyStats, useAssignSubscription, useListSubscriptions,
  useListTrainingPrograms, useCreateTrainingProgram, useDeleteTrainingProgram,
  useListExerciseLogs,
  getGetUserQueryKey, getGetMemberCurrentSubscriptionQueryKey,
  getGetMemberSubscriptionHistoryQueryKey, getListCheckinsQueryKey,
  getListBodyStatsQueryKey, getListSubscriptionsQueryKey,
  getListTrainingProgramsQueryKey, getListExerciseLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOLD = "hsl(40 65% 52%)";
const AVATAR_COLORS = ["hsl(40 65% 48%)","hsl(142 60% 45%)","hsl(220 70% 58%)","hsl(280 60% 55%)","hsl(0 60% 52%)","hsl(30 80% 52%)","hsl(180 60% 45%)"];
function avatarColor(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

const assignSchema = z.object({
  subscriptionId: z.coerce.number().min(1, "اختر خطة"),
  startDate: z.string().min(1, "التاريخ مطلوب"),
  paymentAmount: z.coerce.number().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});
type AssignForm = z.infer<typeof assignSchema>;
const programSchema = z.object({ name: z.string().min(1, "اسم البرنامج مطلوب") });
type ProgramForm = z.infer<typeof programSchema>;
type Tab = "overview" | "qr" | "training" | "progress" | "notes";

const inp = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export default function AdminMemberProfile() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const [showAssign, setShowAssign] = useState(false);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useGetUser(userId, { query: { queryKey: getGetUserQueryKey(userId), enabled: !!userId } });
  const { data: currentSub } = useGetMemberCurrentSubscription(userId, { query: { queryKey: getGetMemberCurrentSubscriptionQueryKey(userId), enabled: !!userId } });
  const { data: subHistory } = useGetMemberSubscriptionHistory(userId, { query: { queryKey: getGetMemberSubscriptionHistoryQueryKey(userId), enabled: !!userId } });
  const { data: checkins } = useListCheckins({ userId }, { query: { queryKey: getListCheckinsQueryKey({ userId }), enabled: !!userId } });
  const { data: bodyStats } = useListBodyStats({ userId }, { query: { queryKey: getListBodyStatsQueryKey({ userId }), enabled: !!userId } });
  const { data: subscriptions } = useListSubscriptions({ query: { queryKey: getListSubscriptionsQueryKey() } });
  const { data: programs, isLoading: programsLoading } = useListTrainingPrograms({ userId }, { query: { queryKey: getListTrainingProgramsQueryKey({ userId }), enabled: !!userId } });
  const { data: exerciseLogs } = useListExerciseLogs({ userId }, { query: { queryKey: getListExerciseLogsQueryKey({ userId }), enabled: !!userId } });

  const assignSub = useAssignSubscription();
  const createProgram = useCreateTrainingProgram();
  const deleteProgram = useDeleteTrainingProgram();

  const assignForm = useForm<AssignForm>({ resolver: zodResolver(assignSchema), defaultValues: { startDate: new Date().toISOString().slice(0,10), paymentMethod: "cash" } });
  const programForm = useForm<ProgramForm>({ resolver: zodResolver(programSchema) });

  const userData: any = user;
  const memberName = userData?.name ?? "—";
  const memberPhone = userData?.phone ?? "—";
  const activeSub: any = (currentSub as any)?.data ?? currentSub;
  const isActive = activeSub?.endDate ? new Date(activeSub.endDate) >= new Date() : false;
  const historyList: any[] = (subHistory as any)?.data ?? (Array.isArray(subHistory) ? subHistory : []);
  const checkinList: any[] = Array.isArray(checkins) ? checkins : (checkins as any)?.data ?? [];
  const statsList: any[] = Array.isArray(bodyStats) ? bodyStats : (bodyStats as any)?.data ?? [];
  const subList: any[] = Array.isArray(subscriptions) ? subscriptions : (subscriptions as any)?.data ?? [];
  const programList: any[] = Array.isArray(programs) ? programs : (programs as any)?.data ?? [];
  const logList: any[] = Array.isArray(exerciseLogs) ? exerciseLogs : (exerciseLogs as any)?.data ?? [];

  const qrValue = JSON.stringify({ userId, name: memberName });
  const color = avatarColor(memberName);

  // Notes from localStorage
  useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`member-notes-${userId}`) ?? "";
      setNotes(saved);
    }
  }, [userId]);

  function saveNotes() {
    localStorage.setItem(`member-notes-${userId}`, notes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
    toast({ title: "✅ تم حفظ الملاحظات" });
  }

  // Checkin stats
  const now = new Date();
  const thisMonth = checkinList.filter((c: any) => {
    const d = new Date(c.date ?? "");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const thisWeek = checkinList.filter((c: any) => {
    const d = new Date(c.date ?? "");
    const diff = (now.getTime() - d.getTime()) / 86400000;
    return diff <= 7;
  }).length;

  // Days left in subscription
  const daysLeft = activeSub?.endDate
    ? Math.ceil((new Date(activeSub.endDate).getTime() - now.getTime()) / 86400000)
    : null;

  // Body stats chart
  const chartData = [...statsList].reverse().slice(-10).map((s: any) => ({
    date: new Date(s.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
    وزن: s.weight ? parseFloat(s.weight) : null,
  })).filter((d: any) => d.وزن !== null);

  const logsByExercise = logList.reduce((acc: any, l: any) => {
    const k = l.exercise?.name ?? "غير معروف";
    if (!acc[k]) acc[k] = [];
    acc[k].push(l);
    return acc;
  }, {});
  const recentLogs = [...logList].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "نظرة عامة" },
    { id: "qr", label: "QR الشخصي" },
    { id: "training", label: "التدريب" },
    { id: "progress", label: "التقدم" },
    { id: "notes", label: "ملاحظات" },
  ];

  function downloadQR() {
    const svgEl = qrRef.current?.querySelector("svg");
    if (!svgEl) return;
    const canvas = document.createElement("canvas");
    canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 300, 300);
    const img = new Image();
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
    img.onload = () => { ctx.drawImage(img, 0, 0, 300, 300); const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `qr-${userId}.png`; a.click(); };
    img.src = URL.createObjectURL(blob);
  }

  function printQR() {
    const svgEl = qrRef.current?.querySelector("svg");
    if (!svgEl) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>QR - ${memberName}</title>
    <style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;direction:rtl;}h2{color:#C9A84C;}p{color:#666;font-size:13px;}@media print{button{display:none}}</style></head>
    <body><h2>🦅 Eagle Gym</h2><h3>${memberName}</h3><p>رقم العضوية: #${userId}</p><div style="display:inline-block;padding:16px;background:#fff;border:2px solid #C9A84C;border-radius:12px;margin:16px 0">${svgEl.outerHTML}</div><p>امسح الكود لتسجيل الحضور</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  }

  function exportPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFillColor(201, 164, 60);
    doc.rect(0, 0, 210, 18, "F");
    doc.setTextColor(10,10,10); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Eagle Gym — Member Profile", 105, 12, { align: "center" });
    doc.setTextColor(180,180,180); doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 105, 22, { align: "center" });

    autoTable(doc, {
      startY: 28,
      head: [["Field", "Value"]],
      body: [
        ["Name", memberName], ["Phone", memberPhone], ["Member ID", "#" + userId],
        ["Current Plan", activeSub?.subscription?.name ?? "None"],
        ["Status", isActive ? "Active" : activeSub ? "Expired" : "No Subscription"],
        ["Subscription Start", activeSub?.startDate ? new Date(activeSub.startDate).toLocaleDateString("en-GB") : "—"],
        ["Subscription End", activeSub?.endDate ? new Date(activeSub.endDate).toLocaleDateString("en-GB") : "—"],
        ["Days Left", daysLeft !== null ? (daysLeft > 0 ? daysLeft + " days" : "Expired") : "—"],
        ["Total Checkins", checkinList.length],
        ["Checkins This Month", thisMonth],
        ["Checkins This Week", thisWeek],
        ["Training Programs", programList.length],
      ],
      styles: { fontSize: 9 }, headStyles: { fillColor: [30,30,30], textColor: [201,164,60] },
      alternateRowStyles: { fillColor: [20,20,20] }, bodyStyles: { fillColor: [14,14,14], textColor: [200,200,200] }, theme: "plain",
    });

    if (historyList.length > 0) {
      const prev = (doc as any).lastAutoTable?.finalY ?? 80;
      autoTable(doc, {
        startY: prev + 8,
        head: [["Plan", "Start", "End", "Amount", "Method"]],
        body: historyList.map((h: any) => [
          h.subscription?.name ?? "—",
          h.startDate ? new Date(h.startDate).toLocaleDateString("en-GB") : "—",
          h.endDate ? new Date(h.endDate).toLocaleDateString("en-GB") : "—",
          h.paymentAmount ? h.paymentAmount + " EGP" : "—",
          h.paymentMethod ?? "—",
        ]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [30,30,30], textColor: [201,164,60] },
        bodyStyles: { fillColor: [14,14,14], textColor: [200,200,200] }, theme: "plain",
      });
    }

    const notesText = localStorage.getItem(`member-notes-${userId}`) ?? "";
    if (notesText) {
      const prev2 = (doc as any).lastAutoTable?.finalY ?? 140;
      doc.setTextColor(201,164,60); doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text("Notes:", 14, prev2 + 10);
      doc.setTextColor(180,180,180); doc.setFontSize(9); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(notesText, 180);
      doc.text(lines, 14, prev2 + 17);
    }

    doc.save(`member-${userId}-${memberName.replace(/s+/g, "-")}.pdf`);
  }

  function onAssign(data: AssignForm) {
    if (!userId) return;
    assignSub.mutate({ data: { userId, subscriptionId: data.subscriptionId, startDate: data.startDate, paymentAmount: data.paymentAmount, paymentMethod: data.paymentMethod } }, {
      onSuccess: () => {
        toast({ title: "✅ تم تعيين الاشتراك" }); setShowAssign(false);
        queryClient.invalidateQueries({ queryKey: getGetMemberCurrentSubscriptionQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getGetMemberSubscriptionHistoryQueryKey(userId) });
      },
      onError: () => toast({ title: "فشل في تعيين الاشتراك", variant: "destructive" }),
    });
  }

  function onCreateProgram(data: ProgramForm) {
    createProgram.mutate({ data: { userId, name: data.name } }, {
      onSuccess: () => {
        toast({ title: "✅ تم إنشاء البرنامج" }); setShowCreateProgram(false); programForm.reset();
        queryClient.invalidateQueries({ queryKey: getListTrainingProgramsQueryKey({ userId }) });
      },
      onError: () => toast({ title: "فشل في إنشاء البرنامج", variant: "destructive" }),
    });
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin"><span className="hover:text-foreground cursor-pointer">الرئيسية</span></Link>
        <span>/</span>
        <Link href="/admin/members"><span className="hover:text-foreground cursor-pointer">الأعضاء</span></Link>
        <span>/</span>
        <span style={{ color: GOLD }}>{memberName}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/admin/members">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          </Link>
          {/* Colored avatar with initials */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl flex-shrink-0"
            style={{ background: color + "22", color, border: `2px solid ${color}44`, boxShadow: `0 0 20px ${color}18` }}>
            {memberName[0] ?? "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{memberName}</h1>
            <p className="text-muted-foreground text-sm">{memberPhone} • #{userId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 65%)", border: "1px solid hsl(0 0% 20%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            PDF
          </button>
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: isActive ? "hsl(0 0% 14%)" : "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: isActive ? "hsl(0 0% 65%)" : "hsl(0 0% 5%)" }}>
            {isActive ? "🔄 تجديد الاشتراك" : "✅ تعيين اشتراك"}
          </button>
        </div>
      </div>

      {/* Subscription status bar */}
      {activeSub && (
        <div className="rounded-xl px-5 py-3 flex items-center justify-between flex-wrap gap-3"
          style={{ background: isActive ? "hsl(142 60% 50% / 0.08)" : "hsl(0 60% 50% / 0.08)", border: `1px solid ${isActive ? "hsl(142 60% 50% / 0.25)" : "hsl(0 60% 50% / 0.25)"}` }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">{isActive ? "✅" : "⚠️"}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{activeSub.subscription?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(activeSub.startDate).toLocaleDateString("ar-EG")} ← {new Date(activeSub.endDate).toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold" style={{ color: isActive ? "hsl(142 60% 60%)" : "hsl(0 60% 60%)" }}>
              {isActive && daysLeft !== null ? `باقي ${daysLeft} يوم` : "منتهي"}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "إجمالي الحضور", value: checkinList.length, color: GOLD },
              { label: "حضور الشهر", value: thisMonth, color: "hsl(142 60% 55%)" },
              { label: "حضور الأسبوع", value: thisWeek, color: "hsl(220 70% 65%)" },
              { label: "برامج التدريب", value: programList.length, color: "hsl(280 60% 60%)" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
                <p className="text-2xl font-black mb-0.5" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Subscription history */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">تاريخ الاشتراكات والمدفوعات</h2>
              {historyList.length === 0 ? (
                <p className="text-muted-foreground text-sm">لا يوجد سجل اشتراكات</p>
              ) : (
                <div className="space-y-2">
                  {historyList.slice(0, 5).map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{h.subscription?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.startDate ? new Date(h.startDate).toLocaleDateString("ar-EG") : "—"} → {h.endDate ? new Date(h.endDate).toLocaleDateString("ar-EG") : "—"}
                        </p>
                      </div>
                      <div className="text-left">
                        {h.paymentAmount && <p className="text-sm font-bold" style={{ color: GOLD }}>{Number(h.paymentAmount).toLocaleString()} ج</p>}
                        {h.paymentMethod && <p className="text-xs text-muted-foreground">{h.paymentMethod === "cash" ? "نقدي" : h.paymentMethod === "card" ? "بطاقة" : "تحويل"}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent checkins */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">آخر زيارات ({checkinList.length})</h2>
              {checkinList.length === 0 ? (
                <p className="text-muted-foreground text-sm">لا يوجد حضور مسجل</p>
              ) : (
                <div className="space-y-1.5">
                  {[...checkinList].sort((a: any, b: any) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime()).slice(0, 8).map((c: any) => {
                    const d = new Date(c.date ?? "");
                    return (
                      <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <p className="text-sm text-foreground">{d.toLocaleDateString("ar-EG", { weekday: "short", month: "short", day: "numeric" })}</p>
                        <p className="text-xs tabular-nums" style={{ color: GOLD }}>{d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ QR TAB ═══ */}
      {activeTab === "qr" && (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="rounded-2xl p-8 flex flex-col items-center gap-5 w-full max-w-sm"
            style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(40 65% 48% / 0.3)" }}>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>🦅 Eagle Gym</p>
              <h2 className="text-lg font-bold text-foreground">{memberName}</h2>
              <p className="text-xs text-muted-foreground">رقم العضوية: #{userId}</p>
            </div>
            <div ref={qrRef} className="p-4 rounded-xl" style={{ background: "#ffffff" }}>
              <QRCodeSVG value={qrValue} size={200} level="H" includeMargin={false} />
            </div>
            {activeSub ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={isActive ? { background: "hsl(142 60% 50% / 0.15)", color: "hsl(142 60% 60%)", border: "1px solid hsl(142 60% 50% / 0.3)" }
                  : { background: "hsl(0 60% 50% / 0.15)", color: "hsl(0 60% 60%)", border: "1px solid hsl(0 60% 50% / 0.3)" }}>
                {isActive ? "✅" : "⚠️"} {activeSub.subscription?.name ?? "—"} — {isActive ? "نشط" : "منتهي"}
              </span>
            ) : <span className="text-xs text-muted-foreground">بدون اشتراك</span>}
            <div className="flex gap-3 w-full">
              <button onClick={downloadQR} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                ⬇ تحميل
              </button>
              <button onClick={printQR} className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "hsl(0 0% 16%)", color: "hsl(0 0% 70%)" }}>
                🖨 طباعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRAINING TAB ═══ */}
      {activeTab === "training" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreateProgram(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
              + إنشاء برنامج
            </button>
          </div>
          {programsLoading ? <div className="h-20 rounded-xl animate-pulse" style={{ background: "hsl(0 0% 9%)" }} /> :
           programList.length === 0 ? <p className="text-muted-foreground text-sm text-center py-10">لا توجد برامج تدريبية</p> : (
            <div className="grid gap-3">
              {programList.map((p: any) => (
                <div key={p.id} className="bg-card border border-card-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.createdAt ?? "").toLocaleDateString("ar-EG")}</p>
                  </div>
                  <button onClick={() => deleteProgram.mutate({ programId: p.id }, { onSuccess: () => { toast({ title: "تم الحذف" }); queryClient.invalidateQueries({ queryKey: getListTrainingProgramsQueryKey({ userId }) }); } })}
                    className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "hsl(0 60% 50% / 0.1)", color: "hsl(0 60% 60%)" }}>
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ PROGRESS TAB ═══ */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          {chartData.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">تطور الوزن</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="وزن" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {statsList.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">آخر القياسات</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">التاريخ</th>
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">الوزن</th>
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">الدهون%</th>
                    <th className="text-right text-muted-foreground font-medium py-2 px-2">ملاحظة</th>
                  </tr></thead>
                  <tbody>
                    {statsList.slice().reverse().slice(0, 8).map((s: any) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-2 px-2 text-muted-foreground">{new Date(s.date).toLocaleDateString("ar-EG")}</td>
                        <td className="py-2 px-2 font-medium text-foreground">{s.weight ? parseFloat(s.weight) + " كجم" : "—"}</td>
                        <td className="py-2 px-2">{s.bodyFat ? parseFloat(s.bodyFat) + "%" : "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">{s.performanceNote ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {statsList.length === 0 && chartData.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm">لا توجد قياسات مسجلة بعد</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ NOTES TAB ═══ */}
      {activeTab === "notes" && (
        <div className="space-y-4 max-w-2xl">
          <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">ملاحظات خاصة</h2>
              <button onClick={saveNotes}
                className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
                style={{ background: notesSaved ? "hsl(142 60% 45%)" : "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                {notesSaved ? "✅ محفوظ" : "💾 حفظ"}
              </button>
            </div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={12} placeholder={"اكتب ملاحظاتك عن العضو هنا...\nمثال:\n- إصابة في الركبة — تجنب تمارين القرفصاء\n- مستوى متقدم — يحتاج تحدي أكبر\n- يفضل التدريب الصباحي"}
              className="w-full resize-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed bg-transparent" />
            <p className="text-xs text-muted-foreground mt-3">
              💡 الملاحظات محفوظة محلياً على هذا الجهاز — مرئية للمسؤول فقط
            </p>
          </div>
          {notes && (
            <div className="rounded-xl p-4" style={{ background: "hsl(40 65% 48% / 0.06)", border: "1px solid hsl(40 65% 48% / 0.2)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>معاينة</p>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{notes}</pre>
            </div>
          )}
        </div>
      )}

      {/* Assign Subscription Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-4">{isActive ? "🔄 تجديد الاشتراك" : "✅ تعيين اشتراك"}</h2>
            <form onSubmit={assignForm.handleSubmit(onAssign)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">خطة الاشتراك</label>
                <select {...assignForm.register("subscriptionId")} className={inp}>
                  <option value="">اختر خطة</option>
                  {subList.map((s: any) => <option key={s.id} value={s.id}>{s.name} - {s.price} ج.م</option>)}
                </select>
                {assignForm.formState.errors.subscriptionId && <p className="text-destructive text-xs mt-1">{assignForm.formState.errors.subscriptionId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">تاريخ البداية</label>
                <input {...assignForm.register("startDate")} type="date" className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">مبلغ الدفع (اختياري)</label>
                <input {...assignForm.register("paymentAmount")} type="number" className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">طريقة الدفع</label>
                <select {...assignForm.register("paymentMethod")} className={inp}>
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="transfer">تحويل</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={assignSub.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                  {assignSub.isPending ? "جاري التعيين..." : "تعيين"}
                </button>
                <button type="button" onClick={() => setShowAssign(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Training Program Modal */}
      {showCreateProgram && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-1">إنشاء برنامج تدريبي</h2>
            <p className="text-muted-foreground text-sm mb-4">سيتم تعيينه لـ {memberName}</p>
            <form onSubmit={programForm.handleSubmit(onCreateProgram)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">اسم البرنامج</label>
                <input {...programForm.register("name")} placeholder="مثال: برنامج تضخيم - 4 أسابيع" className={inp} />
                {programForm.formState.errors.name && <p className="text-destructive text-xs mt-1">{programForm.formState.errors.name.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createProgram.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                  {createProgram.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </button>
                <button type="button" onClick={() => setShowCreateProgram(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
