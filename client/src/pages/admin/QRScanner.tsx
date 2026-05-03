import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useListUsers, getListUsersQueryKey } from "../../api-client";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminQRScanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [manualId, setManualId] = useState("");
  const [lastCheckin, setLastCheckin] = useState<{ name: string; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const jsQRRef = useRef<any>(null);

  const { data: usersData } = useListUsers(
    { limit: 500 },
    { query: { queryKey: getListUsersQueryKey({ limit: 500 }) } }
  );
  const users = (usersData as any)?.data ?? [];

  const doCheckin = async (userId: number, userName: string) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const token = localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken") || "";
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, date: today }),
      });
      if (res.ok) {
        setLastCheckin({ name: userName, time: new Date().toLocaleTimeString("ar-EG") });
        toast({ title: `✅ تم تسجيل حضور ${userName}` });
        // Flash effect on video
        setScanning(true);
        setTimeout(() => setScanning(false), 800);
      } else {
        const err = await res.json();
        toast({ title: err.message ?? "فشل تسجيل الحضور", variant: "destructive" });
      }
    } catch {
      toast({ title: "حدث خطأ في الاتصال", variant: "destructive" });
    }
    setLoading(false);
  };

  const processQRCode = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.userId && parsed.type === "gym-checkin") {
        const user = users.find((u: any) => u.id === parsed.userId);
        doCheckin(parsed.userId, parsed.name ?? user?.name ?? `#${parsed.userId}`);
        return;
      }
    } catch { /* not JSON */ }
    // Try plain number (member ID)
    const numId = parseInt(data);
    if (!isNaN(numId) && numId > 0) {
      const user = users.find((u: any) => u.id === numId);
      if (user) { doCheckin(numId, user.name); return; }
    }
    toast({ title: "QR غير معروف: " + data.substring(0, 30), variant: "destructive" });
  }, [users, loading]);

  // Load jsQR dynamically
  const loadJsQR = useCallback(async () => {
    if (jsQRRef.current) return jsQRRef.current;
    try {
      const mod = await import("jsqr" as any);
      jsQRRef.current = mod.default ?? mod;
      return jsQRRef.current;
    } catch {
      // fallback: use BarcodeDetector if available
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraError("");
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);

      const jsQR = await loadJsQR();
      let lastCode = "";
      let lastTime = 0;

      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
          animFrameRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let code: string | null = null;

        if (jsQR) {
          const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (result) code = result.data;
        } else if ("BarcodeDetector" in window) {
          // BarcodeDetector is async, skip for now in the sync loop
        }

        if (code && code !== lastCode && Date.now() - lastTime > 2000) {
          lastCode = code;
          lastTime = Date.now();
          processQRCode(code);
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };

      animFrameRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setCameraError("تم رفض الإذن. يرجى السماح للمتصفح باستخدام الكاميرا من إعدادات الموقع.");
      } else if (err.name === "NotFoundError") {
        setCameraError("لا توجد كاميرا متاحة على هذا الجهاز.");
      } else {
        setCameraError("تعذّر تشغيل الكاميرا: " + (err.message ?? "خطأ غير معروف"));
      }
    }
  }, [loadJsQR, processQRCode]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const handleManualCheckin = async () => {
    const id = parseInt(manualId);
    if (!id) { toast({ title: "يرجى إدخال رقم عضوية صحيح", variant: "destructive" }); return; }
    const user = users.find((u: any) => u.id === id);
    if (!user) { toast({ title: "لم يتم العثور على العضو", variant: "destructive" }); return; }
    await doCheckin(id, user.name);
    setManualId("");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">تسجيل الحضور بـ QR</h1>
        <p className="text-muted-foreground text-sm">امسح كود العضو بكاميرا الهاتف أو أدخل رقمه يدوياً</p>
      </div>

      {/* Success banner */}
      {lastCheckin && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-green-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-green-400 font-bold text-lg">{lastCheckin.name}</p>
            <p className="text-green-400/70 text-sm">تم تسجيل الحضور • {lastCheckin.time}</p>
          </div>
          <button onClick={() => setLastCheckin(null)} className="mr-auto text-green-400/50 hover:text-green-400 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera QR Scanner */}
        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">مسح QR بالكاميرا</h2>
            {cameraActive && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                كاميرا نشطة
              </span>
            )}
          </div>

          {/* Camera view */}
          <div className="relative rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 6%)", minHeight: 240 }}>
            <video
              ref={videoRef}
              className="w-full rounded-xl"
              style={{ display: cameraActive ? "block" : "none", maxHeight: 360, objectFit: "cover" }}
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* QR frame overlay */}
            {cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`relative w-52 h-52 ${scanning ? "opacity-0" : "opacity-100"} transition-opacity`}>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg" style={{ borderColor: "hsl(40 65% 52%)" }} />
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg" style={{ borderColor: "hsl(40 65% 52%)" }} />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-lg" style={{ borderColor: "hsl(40 65% 52%)" }} />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg" style={{ borderColor: "hsl(40 65% 52%)" }} />
                </div>
                {scanning && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.25)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Idle state */}
            {!cameraActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "hsl(40 65% 48% / 0.1)", border: "2px dashed hsl(40 65% 48% / 0.4)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10" style={{ color: "hsl(40 65% 52%)" }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm text-center">اضغط لتشغيل الكاميرا ومسح QR Code</p>
              </div>
            )}

            {/* Error state */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-red-400">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-red-400 text-sm text-center">{cameraError}</p>
              </div>
            )}
          </div>

          {/* Camera controls */}
          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
              style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              تشغيل الكاميرا
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "hsl(0 0% 16%)", color: "hsl(0 0% 60%)" }}
            >
              إيقاف الكاميرا
            </button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            📱 على الهاتف: اضغط "تشغيل الكاميرا" ثم وجّه الكاميرا الخلفية للـ QR Code
          </p>
        </div>

        {/* Manual checkin */}
        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">تسجيل يدوي</h2>

          <div>
            <label className="block text-xs text-muted-foreground mb-2">اختر العضو من القائمة</label>
            <select
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
            >
              <option value="">-- اختر عضو --</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} — {u.phone}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">أو</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-2">أدخل رقم العضوية</label>
            <input
              type="number"
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleManualCheckin()}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
              placeholder="رقم العضوية"
            />
          </div>

          <button
            onClick={handleManualCheckin}
            disabled={loading || !manualId}
            className="w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}
          >
            {loading ? "جاري التسجيل..." : "✅ تسجيل الحضور"}
          </button>
        </div>
      </div>

      {/* Quick checkin grid */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">تسجيل سريع — أول 12 عضو</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {users.slice(0, 12).map((u: any) => (
            <button
              key={u.id}
              onClick={() => doCheckin(u.id, u.name)}
              disabled={loading}
              className="bg-muted/30 hover:bg-primary/10 border border-border hover:border-primary/40 rounded-xl p-3 text-right transition-all disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2" style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 55%)" }}>
                {u.name[0]}
              </div>
              <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
              <p className="text-xs text-muted-foreground">#{u.id}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
