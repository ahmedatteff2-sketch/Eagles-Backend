import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useListUsers, getListUsersQueryKey, useCreateCheckin } from "@workspace/api-client-react";

export default function AdminQRScanner() {
  const { toast } = useToast();
  const createCheckin = useCreateCheckin();
  const [manualId, setManualId] = useState("");
  const [lastCheckin, setLastCheckin] = useState<{ name: string; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [flash, setFlash] = useState(false);
  const [scanStatus, setScanStatus] = useState("جاهز للمسح...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const jsQRRef = useRef<any>(null);

  const { data: usersData } = useListUsers(
    { limit: 500 },
    { query: { queryKey: getListUsersQueryKey({ limit: 500 }) } }
  );
  const users: any[] = (usersData as any)?.data ?? [];

  // Load jsQR dynamically
  useEffect(() => {
    import("jsqr").then((m) => {
      jsQRRef.current = m.default;
    });
  }, []);

  const doCheckin = useCallback(async (userId: string, userName: string) => {
    if (loading) return;
    setLoading(true);
    try {
      await createCheckin.mutateAsync({ data: { userId } });
      setLastCheckin({ name: userName, time: new Date().toLocaleTimeString("ar-EG") });
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
      toast({ title: `✅ تم تسجيل حضور ${userName}` });
    } catch (err: any) {
      toast({ title: err?.response?.data?.message ?? "فشل تسجيل الحضور", variant: "destructive" });
    }
    setLoading(false);
  }, [loading, toast, createCheckin]);

  const processQR = useCallback((raw: string) => {
    const now = Date.now();
    if (raw === lastCodeRef.current.code && now - lastCodeRef.current.time < 3000) return;
    lastCodeRef.current = { code: raw, time: now };
    setScanStatus(`✅ تم اكتشاف QR`);
    try {
      const parsed = JSON.parse(raw);
      if (parsed.userId && parsed.type === "gym-checkin") {
        const uid = String(parsed.userId);
        const user = users.find((u: any) => String(u.id) === uid);
        doCheckin(uid, parsed.name ?? user?.name ?? "#" + uid);
        return;
      }
    } catch { }
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const user = users.find((u: any) => String(u.id) === trimmed);
      if (user) { doCheckin(String(user.id), user.name); return; }
    }
    toast({ title: "⚠ QR غير معروف", description: raw.substring(0, 50), variant: "destructive" });
  }, [users, doCheckin, toast]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraError("");
    setScanStatus("جاهز للمسح...");
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const jsQR = jsQRRef.current;
    if (!video || !canvas || !jsQR || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(scanFrame); return; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code) {
        processQR(code.data);
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [processQR]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    if (!jsQRRef.current) {
      try {
        const m = await import("jsqr");
        jsQRRef.current = m.default;
      } catch {
        setCameraError("فشل تحميل مكتبة المسح");
        return;
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);
      setScanStatus("جاري المسح...");
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      const msg =
        err.name === "NotAllowedError" ? "رُفض إذن الكاميرا — اسمح للمتصفح من الإعدادات ثم أعد المحاولة" :
        err.name === "NotFoundError" ? "لا توجد كاميرا على هذا الجهاز" :
        err.name === "NotReadableError" ? "الكاميرا مستخدمة من تطبيق آخر — أغلقه وأعد المحاولة" :
        "تعذّر تشغيل الكاميرا: " + (err.message ?? "خطأ غير معروف");
      setCameraError(msg);
    }
  }, [scanFrame]);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  // File input fallback (mobile / any browser)
  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const jsQR = jsQRRef.current;
    if (!jsQR) { toast({ title: "المكتبة لم تُحمَّل بعد، انتظر ثانية", variant: "destructive" }); return; }
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        URL.revokeObjectURL(url);
        if (code) { processQR(code.data); }
        else { toast({ title: "لم يتم العثور على QR في الصورة", variant: "destructive" }); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast({ title: "فشل تحميل الصورة", variant: "destructive" }); };
      img.src = url;
    } catch { toast({ title: "فشل قراءة الصورة", variant: "destructive" }); }
    e.target.value = "";
  }, [processQR, toast]);

  const handleManualCheckin = async () => {
    if (!manualId.trim()) { toast({ title: "أدخل بيانات صحيحة", variant: "destructive" }); return; }
    const searchVal = manualId.trim().toLowerCase();
    const user = users.find((u: any) => String(u.id) === manualId.trim() || u.membershipNumber?.toLowerCase() === searchVal || u.phone === searchVal);
    if (!user) { toast({ title: "العضو غير موجود", variant: "destructive" }); return; }
    await doCheckin(String(user.id), user.name);
    setManualId("");
  };

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">تسجيل الحضور بـ QR</h1>
        <p className="text-muted-foreground text-sm">يعمل على جميع المتصفحات — Chrome & Firefox & Safari</p>
      </div>

      {lastCheckin && (
        <div className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: "hsl(142 60% 50% / 0.1)", border: "1px solid hsl(142 60% 50% / 0.3)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(142 60% 50% / 0.2)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-green-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-green-400 font-bold">{lastCheckin.name}</p>
            <p className="text-green-400/70 text-sm">تم تسجيل الحضور • {lastCheckin.time}</p>
          </div>
          <button onClick={() => setLastCheckin(null)} className="text-green-400/40 hover:text-green-400 text-lg">✕</button>
        </div>
      )}

      {/* Camera section */}
      <div className="rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}>
        <div className="relative" style={{ minHeight: cameraActive ? 0 : 240, background: "hsl(0 0% 6%)" }}>
          <video ref={videoRef} playsInline muted className="w-full block"
            style={{ display: cameraActive ? "block" : "none", maxHeight: 380, objectFit: "cover" }} />
          <canvas ref={canvasRef} className="hidden" />

          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {flash ? (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(37,211,102,0.3)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-20 h-20">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <>
                  <div className="relative w-56 h-56">
                    {[["top-0 right-0","border-t-2 border-r-2 rounded-tr-xl"],["top-0 left-0","border-t-2 border-l-2 rounded-tl-xl"],["bottom-0 right-0","border-b-2 border-r-2 rounded-br-xl"],["bottom-0 left-0","border-b-2 border-l-2 rounded-bl-xl"]].map(([pos,cls],i)=>(
                      <div key={i} className={`absolute ${pos} w-8 h-8 ${cls}`} style={{ borderColor: "hsl(40 65% 52%)" }} />
                    ))}
                    {/* Scanning line animation */}
                    <div className="absolute inset-x-2 h-0.5 animate-bounce" style={{ background: "hsl(40 65% 52% / 0.8)", top: "50%" }} />
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <span className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: "rgba(0,0,0,0.6)", color: "hsl(40 65% 55%)" }}>
                      {scanStatus}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              {cameraError ? (
                <>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "hsl(0 60% 50% / 0.1)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7 text-red-400">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <p className="text-red-400 text-sm text-center px-6">{cameraError}</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "hsl(40 65% 48% / 0.1)", border: "2px dashed hsl(40 65% 48% / 0.4)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10" style={{ color: "hsl(40 65% 52%)" }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm text-center px-6">اضغط الزر لتشغيل الكاميرا — يعمل على Chrome و Firefox و Safari</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 space-y-2.5">
          {!cameraActive ? (
            <button onClick={startCamera}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
              📷 تشغيل الكاميرا ومسح QR
            </button>
          ) : (
            <button onClick={stopCamera}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "hsl(0 0% 16%)", color: "hsl(0 0% 60%)" }}>
              ⏹ إيقاف الكاميرا
            </button>
          )}

          <label className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: "hsl(0 0% 13%)", color: "hsl(0 0% 55%)", border: "1px solid hsl(0 0% 20%)" }}>
            🖼 اختر صورة QR من الجهاز
            <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </label>
          <p className="text-xs text-muted-foreground text-center">✅ يعمل على Android · iPhone · كمبيوتر</p>
        </div>
      </div>

      {/* Manual checkin */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}>
        <h2 className="text-sm font-semibold text-foreground">تسجيل يدوي</h2>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">اختر العضو</label>
          <select value={manualId} onChange={e => setManualId(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none"
            style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 22%)" }}>
            <option value="">-- اختر عضو --</option>
            {users.map((u: any) => <option key={u.id} value={u.memberCode || u.id}>{u.name} — {u.phone} {u.memberCode ? `(${u.memberCode})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">أو أدخل الكود التعريفي، رقم الهاتف، أو ID</label>
          <input type="text" value={manualId} onChange={e => setManualId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleManualCheckin()}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none"
            style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 22%)" }}
            placeholder="مثال: EAGLE-001 أو رقم الموبايل" />
        </div>
        <button onClick={handleManualCheckin} disabled={loading || !manualId}
          className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          {loading ? "جاري التسجيل..." : "✅ تسجيل الحضور"}
        </button>
      </div>

      {/* Quick checkin grid */}
      {users.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-3">تسجيل سريع</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {users.slice(0, 9).map((u: any) => (
              <button key={u.id} onClick={() => doCheckin(u.id, u.name)} disabled={loading}
                className="rounded-xl p-3 text-right transition-all disabled:opacity-50"
                style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(40 65% 48% / 0.5)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(0 0% 20%)")}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5"
                  style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 55%)" }}>
                  {u.name?.[0] ?? "?"}
                </div>
                <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">#{u.id}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
