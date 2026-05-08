import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { GOLD } from "./helpers";

interface ActiveSub {
  subscription?: { name?: string };
}

interface Props {
  userId: string;
  memberName: string;
  qrValue: string;
  activeSub: ActiveSub | null;
  isActive: boolean;
  onDownload: () => void;
  onPrint: () => void;
}

/**
 * "QR" tab body. Forwards a ref to the inner container so the parent
 * can grab the rendered <svg> for download / print without crossing
 * tab boundaries.
 */
export const QRTab = forwardRef<HTMLDivElement, Props>(function QRTab(
  { userId, memberName, qrValue, activeSub, isActive, onDownload, onPrint },
  ref,
) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div
        className="rounded-2xl p-8 flex flex-col items-center gap-5 w-full max-w-sm"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(40 65% 48% / 0.3)" }}
      >
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>
            🦅 Eagle Gym
          </p>
          <h2 className="text-lg font-bold text-foreground">{memberName}</h2>
          <p className="text-xs text-muted-foreground">رقم العضوية: #{userId}</p>
        </div>
        <div ref={ref} className="p-4 rounded-xl" style={{ background: "#ffffff" }}>
          <QRCodeSVG value={qrValue} size={200} level="H" includeMargin={false} />
        </div>
        {activeSub ? (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={
              isActive
                ? {
                    background: "hsl(142 60% 50% / 0.15)",
                    color: "hsl(142 60% 60%)",
                    border: "1px solid hsl(142 60% 50% / 0.3)",
                  }
                : {
                    background: "hsl(0 60% 50% / 0.15)",
                    color: "hsl(0 60% 60%)",
                    border: "1px solid hsl(0 60% 50% / 0.3)",
                  }
            }
          >
            {isActive ? "✅" : "⚠️"} {activeSub.subscription?.name ?? "—"} —{" "}
            {isActive ? "نشط" : "منتهي"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">بدون اشتراك</span>
        )}
        <div className="flex gap-3 w-full">
          <button
            onClick={onDownload}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
              color: "hsl(0 0% 5%)",
            }}
          >
            ⬇ تحميل
          </button>
          <button
            onClick={onPrint}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "hsl(0 0% 16%)", color: "hsl(0 0% 70%)" }}
          >
            🖨 طباعة
          </button>
        </div>
      </div>
    </div>
  );
});
