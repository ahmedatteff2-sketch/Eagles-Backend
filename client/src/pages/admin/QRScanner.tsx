import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useListUsers, getListUsersQueryKey } from "../../api-client";

declare const BarcodeDetector: any;

export default function AdminQRScanner() {
  const { toast } = useToast();
  const [manualId, setManualId] = useState("");
  const [lastCheckin, setLastCheckin] = useState<{ name: string; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const detectorRef = useRef<any>(null);

  const { data: usersData } = useListUsers(
    { limit: 500 },
    { query: { queryKey: getListUsersQueryKey({ limit: 500 }) } }
  );
  const users: any[] = (usersData as any)?.data ?? [];

  const doCheckin = useCallback(async (userId: number, userName: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date: today }),
      });
      if (res.ok) {
        setLastCheckin({ name: userName, time: new Date().toLocaleTimeString("ar-EG") });
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
        toast({ title: `✅ تم تسجيل حضور ${userName}` });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.message ?? "فشل تسجيل الحضور", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال بالسيرفر", variant: "destructive" });
    }
    setLoading(false);
  }, [loading, toast]);

  const processQR = useCallback((raw: string) => {
    const now = Date.now();
    if (raw === lastCodeRef.current.code && now - lastCodeRef.current.time < 3000) return;
    lastCodeRef.current = { code: raw, time: now };
    try {
      const parsed = JSON.parse(raw);
      if (parsed.userId && parsed.type === "gym-checkin") {
        const user = users.find((u: any) => u.id === parsed.userId);
        doCheckin(parsed.userId, parsed.name ?? user?.name ?? "#" + parsed.userId);
        return;
      }
    } catch { /* not JSON */ }
    const num = parseInt(raw.trim());
    if (!isNaN(num) && num > 0) {
      const user = users.find((u: any) => u.id === num);
      if (user) { doCheckin(num, user.name); return; }
    }
    toast({ title: "QR غير معروف", description: raw.substring(0, 40), variant: "destructive" });
  }, [users, doCheckin, toast]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraError("");
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);

      // Try BarcodeDetector (native Chrome/Android - no library needed)
      if ("BarcodeDetector" in window) {
        try {
          detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
          const scan = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
              const barcodes = await detectorRef.current.detect(videoRef.current);
              if (barcodes.length > 0) processQR(barcodes[0].rawValue);
            } catch { /* frame not ready */ }
            rafRef.current = requestAnimationFrame(scan);
          };
          rafRef.current = requestAnimationFrame(scan);
          return; // BarcodeDetector is running, done
        } catch { /* fallback to canvas */ }
      }

      // Fallback: canvas + manual pixel scanning (basic, works everywhere)
      const scanCanvas = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || video.readyState < video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(scanCanvas);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(video, 0, 0);
        rafRef.current = requestAnimationFrame(scanCanvas);
      };
      rafRef.current = requestAnimationFrame(scanCanvas);

    } catch (err: any) {
      const msg = err.name === "NotAllowedError"
        ? "رُفض الإذن — اسمح للمتصفح باستخدام الكاميرا من إعدادات الموقع"
        : err.name === "NotFoundError"
        ? "لا توجد كاميرا على هذا الجهاز"
        : "تعذّر تشغيل الكاميرا: " + (err.message ?? "خطأ غير معروف");
      setCameraError(msg);
    }
  }, [processQR]);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  // File input fallback (for iOS Safari)
  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if ("BarcodeDetector" in window) {
      try {
        const bitmap = await createImageBitmap(file);
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const barcodes = await detector.detect(bitmap);
        if (barcodes.length > 0) { processQR(barcodes[0].rawValue); return; }
        toast({ title: "لم يتم العثور على QR في الصورة", variant: "destructive" });
      } catch { toast({ title: "فشل قراءة الصورة", variant: "destructive" }); }
    } else {
      toast({ title: "متصفحك لا يدعم قراءة QR من الصور", variant: "destructive" });
    }
    e.target.value = "";
  }, [processQR, toast]);

  const handleManualCheckin = async () => {
    const id = parseInt(manualId);
    if (!id) { toast({ title: "أدخل رقم عضوية صحيح", variant: "destructive" }); return; }
    const user = users.find((u: any) => u.id === id);
    if (!user) { toast({ title: "العضو غير موجود", variant: "destructive" }); return; }
    await doCheckin(id, user.name);
    setManualId("");
  };

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">تسجيل الحضور بـ QR</h1>
        <p className="text-muted-foreground text-sm">امسح كود العضو بكاميرا الهاتف أو سجّل يدوياً</p>
      </div>

      {/* Success banner */}
      {lastCheckin && (
        <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: "hsl(142 60% 50% / 0.1)", border: "1px solid hsl(142 60% 50% / 0.3)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "hsl(142 60% 50% / 0.2)" }}>
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

      {/* Camera scanner */}
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
                <div className="relative w-56 h-56">
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 rounded-tr-xl" style={{ borderColor: "hsl(40 65% 52%)" }} />
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 rounded-tl-xl" style={{ borderColor: "hsl(40 65% 52%)" }} />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 rounded-br-xl" style={{ borderColor: "hsl(40 65% 52%)" }} />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 rounded-bl-xl" style={{ borderColor: "hsl(40 65% 52%)" }} />
                  <div className="absolute inset-x-4 h-0.5 top-1/2" style={{ background: "hsl(40 65% 52%)", boxShadow: "0 0 8px hsl(40 65% 52%)", animation: "ping 1.5s ease-in-out infinite" }} />
                </div>
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
                  <p className="text-red-400 text-sm text-center px-4">❌ {cameraError}</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "hsl(40 65% 48% / 0.1)", border: "2px dashed hsl(40 65% 48% / 0.4)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10" style={{ color: "hsl(40 65% 52%)" }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm text-center">اضغط الزر لتشغيل الكاميرا ومسح الـ QR</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          {!cameraActive ? (
            <button onClick={startCamera}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              📷 تشغيل الكاميرا ومسح QR
            </button>
          ) : (
            <button onClick={stopCamera}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "hsl(0 0% 16%)", color: "hsl(0 0% 60%)" }}>
              ⏹ إيقاف الكاميرا
            </button>
          )}

          {/* iOS Safari fallback: take photo */}
          <label className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: "hsl(0 0% 13%)", color: "hsl(0 0% 55%)", border: "1px solid hsl(0 0% 20%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/>
            </svg>
            التقاط صورة للـ QR (iOS)
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />
          </label>

          <p className="text-xs text-muted-foreground text-center">
            📱 Android: استخدم "تشغيل الكاميرا" · 🍎 iPhone: استخدم "التقاط صورة"
          </p>
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
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.phone}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">أو أدخل رقم العضوية</label>
          <input type="number" value={manualId} onChange={e => setManualId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleManualCheckin()}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none"
            style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 22%)" }}
            placeholder="مثال: 42" />
        </div>
        <button onClick={handleManualCheckin} disabled={loading || !manualId}
          className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          {loading ? "جاري التسجيل..." : "✅ تسجيل الحضور"}
        </button>
      </div>

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
                  {u.name[0]}
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
