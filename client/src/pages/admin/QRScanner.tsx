import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminQRScanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [manualId, setManualId] = useState("");
  const [lastCheckin, setLastCheckin] = useState<{ name: string; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrInput, setQrInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: usersData } = useListUsers(
    { limit: 500 },
    { query: { queryKey: getListUsersQueryKey({ limit: 500 }) } }
  );
  const users = (usersData as any)?.data ?? [];

  const doCheckin = async (userId: number, userName: string) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date: today }),
      });
      if (res.ok) {
        setLastCheckin({
          name: userName,
          time: new Date().toLocaleTimeString("ar-EG"),
        });
        toast({ title: `✅ تم تسجيل حضور ${userName}` });
      } else {
        const err = await res.json();
        toast({ title: err.message ?? "فشل تسجيل الحضور", variant: "destructive" });
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleQRInput = (val: string) => {
    setQrInput(val);
    try {
      const parsed = JSON.parse(val);
      if (parsed.userId && parsed.type === "gym-checkin") {
        const user = users.find((u: any) => u.id === parsed.userId);
        doCheckin(parsed.userId, parsed.name ?? user?.name ?? `#${parsed.userId}`);
        setQrInput("");
      }
    } catch { /* not valid JSON yet, keep typing */ }
  };

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
        <p className="text-muted-foreground text-sm">امسح كود العضو أو أدخل رقمه يدوياً</p>
      </div>

      {/* Last checkin banner */}
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
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Scanner area */}
        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">مسح QR Code</h2>
          <div
            className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors"
            style={{ borderColor: "hsl(40 65% 48% / 0.4)", background: "hsl(40 65% 48% / 0.05)" }}
            onClick={() => inputRef.current?.focus()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14" style={{ color: "hsl(40 65% 48%)" }}>
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" rx="0.5" />
              <rect x="19" y="14" width="2" height="2" rx="0.5" /><rect x="14" y="19" width="2" height="2" rx="0.5" />
              <rect x="18" y="18" width="3" height="3" rx="0.5" />
            </svg>
            <p className="text-muted-foreground text-sm text-center">اضغط هنا ثم امسح الـ QR بماسح الباركود</p>
            <input
              ref={inputRef}
              value={qrInput}
              onChange={e => handleQRInput(e.target.value)}
              className="opacity-0 h-0 w-0 absolute"
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">يعمل مع ماسح باركود USB أو كاميرا الهاتف</p>
        </div>

        {/* Manual checkin */}
        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">تسجيل يدوي</h2>

          <div>
            <label className="block text-xs text-muted-foreground mb-2">اختر العضو</label>
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

          <div>
            <label className="block text-xs text-muted-foreground mb-2">أو أدخل رقم العضوية</label>
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
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {loading ? "جاري التسجيل..." : "✅ تسجيل الحضور"}
          </button>
        </div>
      </div>

      {/* Today's checkins summary */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">الأعضاء المتاحون للتسجيل</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {users.slice(0, 8).map((u: any) => (
            <button
              key={u.id}
              onClick={() => doCheckin(u.id, u.name)}
              disabled={loading}
              className="bg-muted/30 hover:bg-primary/10 border border-border hover:border-primary/40 rounded-xl p-3 text-right transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm mb-2">
                {u.name[0]}
              </div>
              <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
              <p className="text-xs text-muted-foreground truncate">#{u.id}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
