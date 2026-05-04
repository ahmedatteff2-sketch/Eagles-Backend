import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import {
  useListCheckins, useCreateCheckin, useListUsers,
  getListCheckinsQueryKey, getListUsersQueryKey, getCreateCheckinMutationOptions
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";

type Tab = "qr" | "log";

const GOLD = "hsl(40 65% 52%)";
const inp = "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all";
const inpSt = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" };

const COLORS = ["hsl(40 65% 48%)","hsl(142 60% 45%)","hsl(220 70% 58%)","hsl(280 60% 55%)","hsl(0 60% 52%)","hsl(30 80% 52%)"];
function avatarColor(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % COLORS.length; return COLORS[Math.abs(h)]; }

export default function AdminAttendance() {
  const [tab, setTab] = useState<Tab>("qr");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // QR state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [manualUserId, setManualUserId] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Log state
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const { data: checkinsRaw, isLoading: logLoading } = useListCheckins(
    { from: dateFrom || undefined, to: dateTo || undefined },
    { query: { queryKey: getListCheckinsQueryKey({ from: dateFrom || undefined, to: dateTo || undefined }) } }
  );

  const { data: usersRaw } = useListUsers(
    { search: search || undefined, limit: 10 },
    { query: { queryKey: getListUsersQueryKey({ search: search || undefined, limit: 10 }), enabled: search.length > 0 } }
  );

  const createCheckin = useCreateCheckin({
    mutation: { mutationKey: ["createCheckin"] }
  });

  const allCheckins: any[] = Array.isArray(checkinsRaw) ? checkinsRaw : (checkinsRaw as any)?.data ?? [];
  const userList: any[] = (usersRaw as any)?.data ?? [];

  // Filter by date range and search
  const filteredCheckins = allCheckins.filter((c: any) => {
    const d = new Date(c.timestamp ?? "");
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    if (search) {
      const name = c.userName ?? "";
      return name.includes(search);
    }
    return true;
  });

  // Group by date for display
  const grouped: Record<string, any[]> = {};
  filteredCheckins.forEach((c: any) => {
    const key = new Date(c.timestamp ?? "").toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  function clearFilters() { setDateFrom(""); setDateTo(""); setSearch(""); }

  async function doCheckin(userId: string): Promise<{ ok: boolean; conflict: boolean; message?: string }> {
    try {
      await createCheckin.mutateAsync({ data: { userId } as any });
      queryClient.invalidateQueries({ queryKey: getListCheckinsQueryKey({}) });
      return { ok: true, conflict: false };
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;
      const msg = e?.response?.data?.message ?? e?.message ?? "";
      return { ok: false, conflict: status === 409, message: msg };
    }
  }

  // QR scanning
  useEffect(() => {
    if (!scanning || !cameraActive) return;
    const iv = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data !== lastScanned) {
        setLastScanned(code.data);
        const match = code.data.match(/userId[:=]([\w-]+)/i) || code.data.match(/^([\w-]+)$/);
        if (match) {
          const uid = match[1];
          const result = await doCheckin(uid);
          toast({ title: result.ok ? "✅ تم تسجيل الحضور" : "⚠️ حضور مسجل مسبقاً أو خطأ" });
          setTimeout(() => setLastScanned(null), 3000);
        }
      }
    }, 600);
    return () => clearInterval(iv);
  }, [scanning, cameraActive, lastScanned]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
      setScanning(true);
    } catch {
      toast({ title: "تعذّر تشغيل الكاميرا", variant: "destructive" });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setScanning(false);
    setLastScanned(null);
  }

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const d = canvas.getContext("2d")!.getImageData(0, 0, img.width, img.height);
      const code = jsQR(d.data, d.width, d.height);
      if (!code) { toast({ title: "لم يُعثر على QR في الصورة", variant: "destructive" }); return; }
      const match = code.data.match(/userId[:=]([\w-]+)/i) || code.data.match(/^([\w-]+)$/);
      if (!match) { toast({ title: "QR غير صالح", variant: "destructive" }); return; }
      const result = await doCheckin(match[1]);
      toast({ title: result.ok ? "✅ تم تسجيل الزياره بنجاح" : "⚠️ حضور مسجل مسبقاً أو خطأ" });
    };
    img.src = URL.createObjectURL(file);
  }

  async function handleManualCheckin() {
    const query = manualUserId.trim();
    if (!query) { toast({ title: "أدخل بيانات صحيحة", variant: "destructive" }); return; }
    setSavingManual(true);

    // Always search the API — it handles name / phone / memberCode / ID
    let userToHandle: any = null;
    try {
      const token = useAuthStore.getState().accessToken || "";
      const baseUrl = (import.meta.env.VITE_API_URL as string || "").replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/users?search=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: any[] = data?.data ?? data ?? [];
        userToHandle =
          list.find((u: any) => String(u.id) === query) ||
          list.find((u: any) => u.membershipNumber?.toLowerCase() === query.toLowerCase()) ||
          list.find((u: any) => u.phone === query) ||
          (list.length === 1 ? list[0] : null);
      }
    } catch { }

    if (!userToHandle) {
      toast({ title: `❌ العضو "${query}" غير موجود`, variant: "destructive" });
      setSavingManual(false);
      return;
    }

    const result = await doCheckin(String(userToHandle.id));
    setSavingManual(false);

    if (result.ok) {
      toast({ title: `✅ تم تسجيل الزياره بنجاح — ${userToHandle.name}` });
      setManualUserId("");
    } else if (result.conflict) {
      toast({ title: `⚠️ ${userToHandle.name} مسجل حضوره اليوم مسبقاً`, variant: "destructive" });
    } else {
      toast({ title: `❌ فشل التسجيل: ${result.message || "خطأ غير معروف"}`, variant: "destructive" });
    }
  }

  const hasFilters = !!(dateFrom || dateTo || search);

  return (
    <div className="p-6 space-y-4" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>الرئيسية</span><span>/</span><span style={{ color: GOLD }}>الحضور</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الحضور</h1>
          <p className="text-muted-foreground text-sm mt-0.5">تسجيل وتتبع حضور الأعضاء</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)", width: "fit-content" }}>
        {[{ id: "qr" as Tab, label: "مسح QR", icon: "📷" }, { id: "log" as Tab, label: "سجل الحضور", icon: "📋" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === t.id
              ? { background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }
              : { color: "hsl(0 0% 50%)" }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ─── QR TAB ─── */}
      {tab === "qr" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Camera */}
          <div className="rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
            <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
              <h2 className="text-sm font-semibold text-foreground">الكاميرا</h2>
              {cameraActive && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(142 60% 55%)" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "hsl(142 60% 55%)" }} />
                  مباشر
                </span>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center"
                style={{ background: "hsl(0 0% 6%)", border: "2px dashed hsl(0 0% 18%)" }}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
                  style={{ display: cameraActive ? "block" : "none" }} />
                <canvas ref={canvasRef} className="hidden" />
                {!cameraActive && (
                  <div className="text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-muted-foreground text-sm">الكاميرا متوقفة</p>
                  </div>
                )}
                {cameraActive && lastScanned && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
                    <div className="text-center p-6">
                      <div className="text-5xl mb-3">✅</div>
                      <p className="text-white font-bold text-lg">تم التسجيل!</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {!cameraActive
                  ? <button onClick={startCamera} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                      تشغيل الكاميرا
                    </button>
                  : <button onClick={stopCamera} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: "hsl(0 72% 51% / 0.15)", color: "hsl(0 72% 60%)" }}>
                      إيقاف
                    </button>
                }
                <label className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center cursor-pointer"
                  style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)", border: "1px solid hsl(0 0% 20%)" }}>
                  رفع صورة
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>
          </div>

          {/* Manual + quick list */}
          <div className="space-y-4">
            <div className="rounded-xl p-5 space-y-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
              <h2 className="text-sm font-semibold text-foreground">تسجيل يدوي</h2>
              <div className="flex gap-2">
                <input value={manualUserId} onChange={e => setManualUserId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManualCheckin()}
                  className={inp + " flex-1"} style={inpSt} placeholder="رقم العضوية أو الكود..." type="text" />
                <button onClick={handleManualCheckin} disabled={savingManual}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                  {savingManual ? "..." : "تسجيل"}
                </button>
              </div>
              <div>
                <input value={search} onChange={e => setSearch(e.target.value)} className={inp} style={inpSt} placeholder="ابحث باسم العضو..." />
                {search && userList.length > 0 && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0 0% 18%)" }}>
                    {userList.map((u: any) => (
                      <button key={u.id} onClick={async () => {
                        const ok = await doCheckin(u.id);
                        toast({ title: ok ? `✅ تم تسجيل حضور ${u.name}` : "⚠️ مسجل مسبقاً أو خطأ" });
                        setSearch("");
                      }} className="w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors"
                        style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "hsl(0 0% 12%)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ background: avatarColor(u.name ?? "") + "22", color: avatarColor(u.name ?? "") }}>
                          {u.name?.[0]}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-semibold text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.phone} • #{u.id}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD }}>تسجيل</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Today's checkins summary */}
            <div className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">إجمالي حضور اليوم</p>
                  <p className="text-3xl font-black" style={{ color: GOLD }}>
                    {allCheckins.filter((c: any) => new Date(c.timestamp ?? "").toDateString() === new Date().toDateString()).length}
                  </p>
                </div>
                <button onClick={() => setTab("log")} className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors" style={{ background: "hsl(0 0% 15%)", color: "hsl(0 0% 70%)" }}>عرض السجل</button>
              </div>
              <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                <p className="text-xs text-muted-foreground mb-2">آخر المسجلين اليوم:</p>
                {allCheckins
                  .filter((c: any) => new Date(c.timestamp ?? "").toDateString() === new Date().toDateString())
                  .slice(0, 5)
                  .map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: avatarColor(c.userName ?? "") + "22", color: avatarColor(c.userName ?? "") }}>
                          {(c.userName ?? "—")[0]}
                        </div>
                        <span className="text-sm text-foreground">{c.userName ?? "—"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums px-2 py-0.5 rounded" style={{ background: "hsl(0 0% 15%)" }}>اليوم</span>
                    </div>
                  ))}
                {allCheckins.filter((c: any) => new Date(c.timestamp ?? "").toDateString() === new Date().toDateString()).length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-2">لا يوجد حضور مسجل اليوم</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── LOG TAB ─── */}
      {tab === "log" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">تصفية السجلات</h2>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: "hsl(0 60% 50% / 0.1)", color: "hsl(0 60% 60%)" }}>
                  مسح الفلاتر ✕
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">بحث بالاسم</label>
                <input value={search} onChange={e => setSearch(e.target.value)} className={inp} style={inpSt} placeholder="اسم العضو أو الهاتف..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">من تاريخ</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} style={inpSt} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">إلى تاريخ</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} style={inpSt} />
              </div>
            </div>
            {/* Quick date shortcuts */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "اليوم", from: today, to: today },
                { label: "آخر 7 أيام", from: new Date(Date.now() - 7*86400000).toISOString().slice(0,10), to: today },
                { label: "هذا الشهر", from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), to: today },
              ].map(s => (
                <button key={s.label} onClick={() => { setDateFrom(s.from); setDateTo(s.to); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={dateFrom === s.from && dateTo === s.to
                    ? { background: "hsl(40 65% 48% / 0.2)", color: GOLD, border: "1px solid hsl(40 65% 48% / 0.4)" }
                    : { background: "hsl(0 0% 13%)", color: "hsl(0 0% 55%)", border: "1px solid hsl(0 0% 20%)" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{filteredCheckins.length} سجل</p>
          </div>

          {/* Grouped checkins */}
          {logLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "hsl(0 0% 9%)" }} />)}</div>
          ) : filteredCheckins.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm text-muted-foreground">{hasFilters ? "لا توجد سجلات بهذه الفلاتر" : "لا توجد سجلات حضور بعد"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([dateLabel, entries]) => (
                <div key={dateLabel} className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0 0% 15%)" }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: "hsl(0 0% 9%)", borderBottom: "1px solid hsl(0 0% 13%)" }}>
                    <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD }}>
                      {entries.length} حضور
                    </span>
                  </div>
                  <div style={{ background: "hsl(0 0% 8%)" }}>
                    {entries.map((c: any) => {
                      const name = c.userName ?? "—";
                      const time = new Date(c.timestamp ?? "").toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid hsl(0 0% 11%)" }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                            style={{ background: avatarColor(name) + "22", color: avatarColor(name) }}>
                            {name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{name}</p>
                            <p className="text-xs text-muted-foreground">ID: #{c.userId}</p>
                          </div>
                          <p className="text-xs tabular-nums" style={{ color: GOLD }}>{time}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
