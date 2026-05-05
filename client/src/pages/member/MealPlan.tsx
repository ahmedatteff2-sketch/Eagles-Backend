import { useAuthStore } from "@/store/auth";
import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";

interface MealItem {
  id: number; mealName: string; time: string | null; calories: number | null;
  protein: number | null; carbs: number | null; fats: number | null; description: string | null;
}
interface MealPlan { id: number; name: string; notes: string | null; items: MealItem[]; }

const MACRO_COLORS = { calories: "#f39c12", protein: "#e74c3c", carbs: "#3498db", fats: "#2ecc71" };

export default function MemberMealPlan() {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState(0);

  useEffect(() => {
    customFetch<MealPlan[]>(`/api/meal-plans?userId=${user?.id}`)
      .then(d => setPlans(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const plan = plans[activePlan];
  const totalCal = plan?.items.reduce((s, m) => s + (m.calories ?? 0), 0) ?? 0;
  const totalProtein = plan?.items.reduce((s, m) => s + (m.protein ?? 0), 0) ?? 0;
  const totalCarbs = plan?.items.reduce((s, m) => s + (m.carbs ?? 0), 0) ?? 0;
  const totalFats = plan?.items.reduce((s, m) => s + (m.fats ?? 0), 0) ?? 0;

  if (loading) return <div className="p-6 text-center"><p className="text-muted-foreground text-sm">جاري التحميل...</p></div>;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">🍽️ خطة التغذية</h1>
        <p className="text-muted-foreground text-sm">وجباتك اليومية والسعرات</p>
      </div>

      {plans.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-foreground font-medium mb-1">لا توجد خطة تغذية بعد</p>
          <p className="text-muted-foreground text-sm">تواصل مع المدرب لتعيين خطة تغذية لك</p>
        </div>
      ) : (
        <>
          {/* Plan selector */}
          {plans.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {plans.map((p, i) => (
                <button key={p.id} onClick={() => setActivePlan(i)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    i === activePlan ? "" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  style={i === activePlan ? { background: GOLD, color: "#000" } : {}}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Macros summary */}
          {plan && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "سعرات", value: totalCal, unit: "kcal", color: MACRO_COLORS.calories },
                { label: "بروتين", value: totalProtein, unit: "g", color: MACRO_COLORS.protein },
                { label: "كربوهيدرات", value: totalCarbs, unit: "g", color: MACRO_COLORS.carbs },
                { label: "دهون", value: totalFats, unit: "g", color: MACRO_COLORS.fats },
              ].map(m => (
                <div key={m.label} className="rounded-xl p-3 text-center" style={{ background: "hsl(0 0% 9%)", border: `1px solid ${m.color}20` }}>
                  <p className="text-lg font-black tabular-nums" style={{ color: m.color }}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {plan?.notes && (
            <div className="rounded-lg px-3 py-2" style={{ background: "hsl(40 65% 48% / 0.06)", border: "1px solid hsl(40 65% 48% / 0.12)" }}>
              <p className="text-xs" style={{ color: "hsl(40 65% 60%)" }}>📝 {plan.notes}</p>
            </div>
          )}

          {/* Meals */}
          {plan?.items.map((item, idx) => (
            <div key={item.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: "hsl(40 65% 48% / 0.12)", color: GOLD }}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{item.mealName}</p>
                  {item.time && <p className="text-xs text-muted-foreground">🕐 {item.time}</p>}
                </div>
                {item.calories && (
                  <span className="text-xs font-bold tabular-nums" style={{ color: MACRO_COLORS.calories }}>{item.calories} kcal</span>
                )}
              </div>
              {(item.description || item.protein) && (
                <div className="px-4 py-2.5">
                  {item.description && <p className="text-xs text-muted-foreground mb-2">{item.description}</p>}
                  <div className="flex gap-3 text-xs">
                    {item.protein != null && <span style={{ color: MACRO_COLORS.protein }}>بروتين: {item.protein}g</span>}
                    {item.carbs != null && <span style={{ color: MACRO_COLORS.carbs }}>كارب: {item.carbs}g</span>}
                    {item.fats != null && <span style={{ color: MACRO_COLORS.fats }}>دهون: {item.fats}g</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
