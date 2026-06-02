import { GOLD, type MealPlan } from "./helpers";

interface Props {
  plans: MealPlan[];
  loading: boolean;
  expandedPlanId: number | null;
  onToggleExpand: (id: number) => void;
  onCreate: () => void;
  onConfirmDelete: (id: number) => void;
}

const MACRO_ROWS = [
  { label: "سعرات", key: "cal", unit: "kcal", color: "#f39c12" },
  { label: "بروتين", key: "protein", unit: "g", color: "#e74c3c" },
  { label: "كارب", key: "carbs", unit: "g", color: "#3498db" },
  { label: "دهون", key: "fats", unit: "g", color: "#2ecc71" },
] as const;

/**
 * "Meal plans" tab body — list of meal plans assigned to this member,
 * each expandable to show the per-meal breakdown and totals.
 */
export function MealPlansTab({
  plans,
  loading,
  expandedPlanId,
  onToggleExpand,
  onCreate,
  onConfirmDelete,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">🍽️ خطط التغذية المعيّنة ({plans.length})</h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
            color: "hsl(0 0% 5%)",
          }}
        >
          + خطة تغذية جديدة
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-10">جاري التحميل...</p>
      ) : plans.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-foreground font-medium mb-1">لا توجد خطط تغذية لهذا العضو</p>
          <p className="text-muted-foreground text-sm">اضغط على "خطة تغذية جديدة" لإنشاء أول خطة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => {
            const totals = {
              cal: p.items.reduce((s, m) => s + (m.calories ?? 0), 0),
              protein: p.items.reduce((s, m) => s + (m.protein ?? 0), 0),
              carbs: p.items.reduce((s, m) => s + (m.carbs ?? 0), 0),
              fats: p.items.reduce((s, m) => s + (m.fats ?? 0), 0),
            };
            const expanded = expandedPlanId === p.id;
            return (
              <div key={p.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
                  onClick={() => onToggleExpand(p.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.items.length} وجبة · {totals.cal} kcal · {totals.protein}g بروتين
                      {p.createdAt && ` · ${new Date(p.createdAt).toLocaleDateString("ar-EG")}`}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmDelete(p.id);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: "hsl(0 60% 50% / 0.1)", color: "hsl(0 60% 60%)" }}
                  >
                    حذف
                  </button>
                </div>
                {expanded && (
                  <div className="px-4 pb-4 border-t border-border space-y-3">
                    {p.notes && (
                      <div
                        className="rounded-lg px-3 py-2 mt-3"
                        style={{
                          background: "hsl(40 65% 48% / 0.06)",
                          border: "1px solid hsl(40 65% 48% / 0.12)",
                        }}
                      >
                        <p className="text-xs" style={{ color: "hsl(40 65% 60%)" }}>
                          📝 {p.notes}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {MACRO_ROWS.map((m) => (
                        <div
                          key={m.label}
                          className="rounded-lg p-2 text-center"
                          style={{ background: "hsl(0 0% 11%)", border: `1px solid ${m.color}20` }}
                        >
                          <p className="text-base font-black tabular-nums" style={{ color: m.color }}>
                            {totals[m.key]}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                          <p className="text-[10px] text-muted-foreground">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {p.items.map((it, idx) => (
                        <div
                          key={it.id ?? idx}
                          className="rounded-lg p-3"
                          style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)" }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span
                                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: "hsl(40 65% 48% / 0.12)", color: GOLD }}
                              >
                                {idx + 1}
                              </span>
                              <p className="text-sm font-semibold text-foreground truncate">{it.mealName}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {it.time && <span className="text-muted-foreground">🕐 {it.time}</span>}
                              {it.calories != null && (
                                <span className="font-bold tabular-nums" style={{ color: "#f39c12" }}>
                                  {it.calories} kcal
                                </span>
                              )}
                            </div>
                          </div>
                          {(it.description || it.protein != null || it.carbs != null || it.fats != null) && (
                            <div className="mt-2 ms-8 space-y-1">
                              {it.description && (
                                <p className="text-xs text-muted-foreground">{it.description}</p>
                              )}
                              <div className="flex gap-3 text-xs">
                                {it.protein != null && (
                                  <span style={{ color: "#e74c3c" }}>بروتين: {it.protein}g</span>
                                )}
                                {it.carbs != null && (
                                  <span style={{ color: "#3498db" }}>كارب: {it.carbs}g</span>
                                )}
                                {it.fats != null && (
                                  <span style={{ color: "#2ecc71" }}>دهون: {it.fats}g</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
