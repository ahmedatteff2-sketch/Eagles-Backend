import { GOLD, inp, parseNum, type MealItem } from "./helpers";

interface Props {
  memberName: string;
  planName: string;
  planNotes: string;
  planItems: MealItem[];
  saving: boolean;
  onPlanNameChange: (v: string) => void;
  onPlanNotesChange: (v: string) => void;
  onUpdateItem: (idx: number, patch: Partial<MealItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onSave: () => void;
  onClose: () => void;
}

export function CreateMealPlanModal({
  memberName,
  planName,
  planNotes,
  planItems,
  saving,
  onPlanNameChange,
  onPlanNotesChange,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-2xl shadow-xl my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">🍽️ خطة تغذية جديدة</h2>
          <p className="text-sm text-muted-foreground">{memberName}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">اسم الخطة</label>
            <input
              value={planName}
              onChange={(e) => onPlanNameChange(e.target.value)}
              placeholder="مثال: خطة بناء عضل — أسبوع 1"
              className={inp}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">ملاحظات (اختياري)</label>
            <textarea
              value={planNotes}
              onChange={(e) => onPlanNotesChange(e.target.value)}
              rows={2}
              placeholder="ملاحظات عامة عن الخطة..."
              className={inp + " resize-none"}
            />
          </div>

          <div className="border-t border-border pt-3 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">الوجبات ({planItems.length})</h3>
              <button
                type="button"
                onClick={onAddItem}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "hsl(40 65% 48% / 0.12)", color: GOLD }}
              >
                + وجبة
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pe-1">
              {planItems.map((it, idx) => (
                <div
                  key={idx}
                  className="rounded-lg p-3 space-y-2"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: GOLD }}>
                      وجبة {idx + 1}
                    </span>
                    {planItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(idx)}
                        className="text-xs text-destructive hover:underline"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={it.mealName}
                      onChange={(e) => onUpdateItem(idx, { mealName: e.target.value })}
                      placeholder="اسم الوجبة *"
                      className={inp}
                    />
                    <input
                      value={it.time ?? ""}
                      onChange={(e) => onUpdateItem(idx, { time: e.target.value })}
                      placeholder="الوقت (مثل 8:00 ص)"
                      className={inp}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={it.calories ?? ""}
                      onChange={(e) => onUpdateItem(idx, { calories: parseNum(e.target.value) })}
                      placeholder="سعرات"
                      className={inp}
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={it.protein ?? ""}
                      onChange={(e) => onUpdateItem(idx, { protein: parseNum(e.target.value) })}
                      placeholder="بروتين (g)"
                      className={inp}
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={it.carbs ?? ""}
                      onChange={(e) => onUpdateItem(idx, { carbs: parseNum(e.target.value) })}
                      placeholder="كارب (g)"
                      className={inp}
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={it.fats ?? ""}
                      onChange={(e) => onUpdateItem(idx, { fats: parseNum(e.target.value) })}
                      placeholder="دهون (g)"
                      className={inp}
                    />
                  </div>
                  <textarea
                    value={it.description ?? ""}
                    onChange={(e) => onUpdateItem(idx, { description: e.target.value })}
                    rows={2}
                    placeholder="وصف الوجبة (اختياري) — مثال: 200g صدور دجاج + 100g أرز"
                    className={inp + " resize-none"}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                color: "hsl(0 0% 5%)",
              }}
            >
              {saving ? "جاري الحفظ..." : "حفظ الخطة"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
