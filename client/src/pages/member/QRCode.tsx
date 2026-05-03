import { useAuthStore } from "@/store/auth";
import { QRCodeSVG } from "qrcode.react";

export default function MemberQRCode() {
  const { user } = useAuthStore();

  const qrData = JSON.stringify({ userId: user?.id, name: user?.name, type: "gym-checkin" });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">كود الحضور</h1>
        <p className="text-muted-foreground text-sm">اعرض هذا الكود للمسؤول لتسجيل حضورك</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-8 flex flex-col items-center gap-6">
        <div className="p-4 bg-white rounded-2xl shadow-lg">
          <QRCodeSVG
            value={qrData}
            size={220}
            bgColor="#ffffff"
            fgColor="#0A0A0A"
            level="M"
          />
        </div>

        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{user?.name}</p>
          <p className="text-muted-foreground text-sm mt-1">{user?.phone}</p>
          <div className="mt-3 px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full inline-block">
            <p className="text-primary text-xs font-semibold">ID: {user?.id}</p>
          </div>
        </div>

        <div className="w-full bg-muted/30 rounded-xl p-4 text-center border border-border/50">
          <p className="text-muted-foreground text-xs leading-relaxed">
            امسح هذا الكود بكاميرا المسؤول لتسجيل حضورك تلقائياً. الكود خاص بك ولا تشاركه مع أحد.
          </p>
        </div>
      </div>
    </div>
  );
}
