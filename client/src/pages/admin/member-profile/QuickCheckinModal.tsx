import { GOLD } from "./helpers";

interface Props {
  memberName: string;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function QuickCheckinModal({ memberName, saving, onConfirm, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
      style={{ backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden p-5"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "hsl(142 60% 45% / 0.15)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
            style={{ color: "hsl(142 60% 60%)" }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-center font-bold mb-2">تسجيل حضور</h3>
        <p className="text-center text-sm mb-5" style={{ color: "hsl(0 0% 60%)" }}>
          تسجيل حضور <span style={{ color: GOLD, fontWeight: 600 }}>{memberName}</span> الآن؟
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)" }}
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "hsl(142 60% 45%)", color: "#fff", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "..." : "تسجيل الآن"}
          </button>
        </div>
      </div>
    </div>
  );
}
