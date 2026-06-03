import { useState, useEffect, useCallback, useMemo } from "react";
import {
  searchFoods,
  getFoodLog,
  addFoodLog,
  deleteFoodLog,
  type Food,
  type FoodLogDay,
} from "@/api-client/nutrition";
import { useToast } from "@/hooks/use-toast";

const GOLD = "hsl(40 65% 52%)";
const CARD = { background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" };
const INPUT =
  "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none";
const INPUT_ST = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" } as const;

const todayStr = () => new Date().toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

const MACROS = [
  { key: "calories", label: "سعرات", unit: "", color: GOLD },
  { key: "protein", label: "بروتين", unit: "ج", color: "hsl(142 60% 55%)" },
  { key: "carbs", label: "كارب", unit: "ج", color: "hsl(210 80% 60%)" },
  { key: "fats", label: "دهون", unit: "ج", color: "hsl(30 90% 58%)" },
] as const;

export default function MemberNutrition() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [day, setDay] = useState<FoodLogDay | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [custom, setCustom] = useState(false);
  const [cf, setCf] = useState({ name: "", calories: "", protein: "", carbs: "", fats: "" });
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setDay(await getFoodLog(date));
    } catch {
      setDay(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Debounced catalog search (skipped while entering a custom food).
  useEffect(() => {
    if (custom || selected) return;
    const t = setTimeout(async () => {
      try {
        setResults(await searchFoods(search.trim()));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, custom, selected]);

  const gramsNum = Math.max(0, Number(grams) || 0);

  const preview = useMemo(() => {
    const f = gramsNum / 100;
    if (custom) {
      return {
        calories: (Number(cf.calories) || 0) * f,
        protein: (Number(cf.protein) || 0) * f,
        carbs: (Number(cf.carbs) || 0) * f,
        fats: (Number(cf.fats) || 0) * f,
      };
    }
    if (!selected) return null;
    return {
      calories: selected.caloriesPer100g * f,
      protein: selected.proteinPer100g * f,
      carbs: selected.carbsPer100g * f,
      fats: selected.fatsPer100g * f,
    };
  }, [custom, selected, gramsNum, cf]);

  async function add() {
    if (gramsNum <= 0) {
      toast({ title: "أدخل وزناً صحيحاً بالجرام", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (custom) {
        if (!cf.name.trim()) {
          toast({ title: "أدخل اسم الصنف", variant: "destructive" });
          return;
        }
        await addFoodLog({
          date,
          grams: gramsNum,
          name: cf.name.trim(),
          caloriesPer100g: Number(cf.calories) || 0,
          proteinPer100g: Number(cf.protein) || 0,
          carbsPer100g: Number(cf.carbs) || 0,
          fatsPer100g: Number(cf.fats) || 0,
        });
      } else {
        if (!selected) {
          toast({ title: "اختر صنفاً من القائمة", variant: "destructive" });
          return;
        }
        await addFoodLog({ date, grams: gramsNum, foodId: selected.id });
      }
      toast({ title: "✅ تمت الإضافة" });
      setSelected(null);
      setSearch("");
      setResults([]);
      setGrams("100");
      setCf({ name: "", calories: "", protein: "", carbs: "", fats: "" });
      await refetch();
    } catch {
      toast({ title: "فشل التسجيل، حاول مرة أخرى", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await deleteFoodLog(id);
      await refetch();
    } catch {
      toast({ title: "فشل الحذف", variant: "destructive" });
    }
  }

  const totals = day?.totals ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const items = day?.items ?? [];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-3xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الدايت المرن</h1>
          <p className="text-muted-foreground text-sm mt-0.5">سجّل أكلك وكميته والموقع يحسبلك الماكروز</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || todayStr())}
          className="rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
          style={INPUT_ST}
        />
      </div>

      {/* Daily totals */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {MACROS.map((m) => (
          <div key={m.key} className="rounded-xl p-3 text-center" style={CARD}>
            <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
            <p className="text-lg sm:text-2xl font-black tabular-nums" style={{ color: m.color }}>
              {r1(totals[m.key])}
            </p>
            {m.unit && <p className="text-[10px] text-muted-foreground">{m.unit}</p>}
          </div>
        ))}
      </div>

      {/* Add food */}
      <div className="rounded-xl p-4 space-y-3" style={CARD}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">أضف صنف</h2>
          <button
            onClick={() => {
              setCustom((v) => !v);
              setSelected(null);
              setResults([]);
              setSearch("");
            }}
            className="text-xs px-2.5 py-1 rounded-lg"
            style={{ background: "hsl(0 0% 14%)", color: custom ? GOLD : "hsl(0 0% 60%)" }}
          >
            {custom ? "اختيار من القائمة" : "صنف مخصص ✏️"}
          </button>
        </div>

        {!custom && !selected && (
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن أكل (مثال: فراخ، أرز، بيض...)"
              className={INPUT}
              style={INPUT_ST}
            />
            {results.length > 0 && (
              <div
                className="mt-2 rounded-lg overflow-hidden max-h-60 overflow-y-auto"
                style={{ border: "1px solid hsl(0 0% 16%)" }}
              >
                {results.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-right transition-colors"
                    style={{ borderBottom: "1px solid hsl(0 0% 11%)", background: "hsl(0 0% 10%)" }}
                  >
                    <span className="text-sm text-foreground">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.caloriesPer100g} سعرة / 100ج
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!custom && selected && (
          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={INPUT_ST}>
            <span className="text-sm font-semibold text-foreground">{selected.name}</span>
            <button onClick={() => setSelected(null)} className="text-xs" style={{ color: "hsl(0 72% 60%)" }}>
              تغيير
            </button>
          </div>
        )}

        {custom && (
          <div className="space-y-2">
            <input
              value={cf.name}
              onChange={(e) => setCf({ ...cf, name: e.target.value })}
              placeholder="اسم الصنف"
              className={INPUT}
              style={INPUT_ST}
            />
            <div className="grid grid-cols-4 gap-2">
              {(["calories", "protein", "carbs", "fats"] as const).map((k, i) => (
                <input
                  key={k}
                  value={cf[k]}
                  onChange={(e) => setCf({ ...cf, [k]: e.target.value })}
                  type="number"
                  min={0}
                  placeholder={["سعرات", "بروتين", "كارب", "دهون"][i]}
                  className="w-full rounded-lg px-2 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  style={INPUT_ST}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">القيم لكل 100 جرام</p>
          </div>
        )}

        {/* Grams + preview + add */}
        {(selected || custom) && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">الوزن (جرام)</label>
              <input
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                type="number"
                min={1}
                className={INPUT}
                style={INPUT_ST}
              />
            </div>
            {preview && (
              <div className="grid grid-cols-4 gap-2">
                {MACROS.map((m) => (
                  <div
                    key={m.key}
                    className="rounded-lg py-2 text-center"
                    style={{ background: "hsl(0 0% 12%)" }}
                  >
                    <p className="text-sm font-bold tabular-nums" style={{ color: m.color }}>
                      {r1(preview[m.key])}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={add}
              disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${GOLD}, hsl(40 65% 42%))`, color: "hsl(0 0% 5%)" }}
            >
              {busy ? "جاري الإضافة..." : "➕ أضف للسجل"}
            </button>
          </div>
        )}
      </div>

      {/* Day log */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0 0% 15%)" }}>
        <div className="px-4 py-3" style={{ background: "hsl(0 0% 9%)", borderBottom: "1px solid hsl(0 0% 13%)" }}>
          <h2 className="text-sm font-semibold text-foreground">سجل اليوم ({items.length})</h2>
        </div>
        <div style={{ background: "hsl(0 0% 8%)" }}>
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-sm text-muted-foreground">لسه مسجّلتش أي أكل النهاردة</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "hsl(0 0% 12%)" }}>
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{it.foodName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {it.grams}ج · {it.calories} سعرة · ب {it.protein} · ك {it.carbs} · د {it.fats}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(it.id)}
                    title="حذف"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground flex-shrink-0"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "hsl(0 72% 51% / 0.12)";
                      e.currentTarget.style.color = "hsl(0 72% 60%)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
