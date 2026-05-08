interface Props {
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteMealPlanModal({ onConfirm, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold text-foreground mb-2">حذف خطة التغذية؟</h2>
        <p className="text-sm text-muted-foreground mb-5">
          سيتم حذف الخطة وكل وجباتها. لا يمكن التراجع.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "hsl(0 60% 50%)", color: "#fff" }}
          >
            حذف نهائي
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
