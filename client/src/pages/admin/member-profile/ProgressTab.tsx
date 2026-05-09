import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartPoint {
  date: string;
  وزن: number | null;
}

interface BodyStat {
  id: number;
  date: string;
  weight?: string | number | null;
  bodyFat?: string | number | null;
  chest?: string | number | null;
  waist?: string | number | null;
  hips?: string | number | null;
  biceps?: string | number | null;
  thigh?: string | number | null;
  neck?: string | number | null;
  performanceNote?: string | null;
}

interface Props {
  // Kept for backwards compatibility with the parent's chartData prop, but
  // unused — the chart is now driven directly from `stats` so it can render
  // every measurement, not just weight.
  chartData?: ChartPoint[];
  stats: BodyStat[];
}

const MEASUREMENTS = [
  { key: "weight", label: "الوزن", unit: "كجم", color: "hsl(40 65% 52%)" },
  { key: "bodyFat", label: "الدهون", unit: "%", color: "#e74c3c" },
  { key: "chest", label: "الصدر", unit: "سم", color: "#3498db" },
  { key: "waist", label: "الخصر", unit: "سم", color: "#9b59b6" },
  { key: "hips", label: "الأرداف", unit: "سم", color: "#e91e63" },
  { key: "biceps", label: "البايسبس", unit: "سم", color: "#f39c12" },
  { key: "thigh", label: "الفخذ", unit: "سم", color: "#2ecc71" },
  { key: "neck", label: "الرقبة", unit: "سم", color: "#1abc9c" },
] as const;

type MKey = typeof MEASUREMENTS[number]["key"];

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * "Progress" tab body — measurement trend chart + recent measurements table.
 *
 * The chart shows one toggleable line per measurement. Only measurements the
 * member actually logged are exposed as toggles to avoid clutter.
 */
export function ProgressTab({ stats }: Props) {
  const sorted = useMemo(
    () =>
      [...stats].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [stats],
  );

  const chartPoints = useMemo(
    () =>
      sorted.map((s) => {
        const point: Record<string, number | string | null> = {
          date: new Date(s.date).toLocaleDateString("ar-EG", {
            month: "short",
            day: "numeric",
          }),
        };
        for (const m of MEASUREMENTS) {
          point[m.key] = num((s as Record<string, unknown>)[m.key]);
        }
        return point;
      }),
    [sorted],
  );

  const loggedKeys = useMemo(() => {
    const out = new Set<MKey>();
    for (const p of chartPoints) {
      for (const m of MEASUREMENTS) {
        if (p[m.key] != null) out.add(m.key);
      }
    }
    return out;
  }, [chartPoints]);

  const availableMeasurements = MEASUREMENTS.filter((m) => loggedKeys.has(m.key));

  // Default the chart to weight only — showing every line on first open is
  // noise. The trainer enables what they want to see.
  const [active, setActive] = useState<Set<MKey>>(
    () => new Set(["weight"] as MKey[]),
  );

  function toggle(k: MKey) {
    setActive((prev) => {
      const next = new Set(prev);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      next.has(k) ? next.delete(k) : next.add(k);
      if (next.size === 0) next.add(k);
      return next;
    });
  }

  if (chartPoints.length === 0 && stats.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm">لا توجد قياسات مسجلة بعد</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {chartPoints.length > 0 && availableMeasurements.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">تطور القياسات</h2>
          {/* Toggleable measurement chips — only show what the member logged */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {availableMeasurements.map((m) => {
              const on = active.has(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  type="button"
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                  style={
                    on
                      ? { background: m.color, color: "#000" }
                      : {
                          background: "hsl(0 0% 13%)",
                          color: "hsl(0 0% 65%)",
                          border: `1px solid ${m.color}40`,
                        }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: on ? "#000" : m.color }}
                  />
                  {m.label}
                </button>
              );
            })}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 10%)",
                  border: "1px solid hsl(0 0% 18%)",
                  borderRadius: 8,
                }}
              />
              {MEASUREMENTS.filter((m) => active.has(m.key)).map((m) => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ fill: m.color, r: 3 }}
                  name={`${m.label} (${m.unit})`}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {stats.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">آخر القياسات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right text-muted-foreground font-medium py-2 px-2 whitespace-nowrap">
                    التاريخ
                  </th>
                  {MEASUREMENTS.map((m) => (
                    <th
                      key={m.key}
                      className="text-right font-medium py-2 px-2 whitespace-nowrap"
                      style={{ color: m.color }}
                    >
                      {m.label}
                    </th>
                  ))}
                  <th className="text-right text-muted-foreground font-medium py-2 px-2">
                    ملاحظة
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                        {new Date(s.date).toLocaleDateString("ar-EG")}
                      </td>
                      {MEASUREMENTS.map((m) => {
                        const v = num((s as Record<string, unknown>)[m.key]);
                        return (
                          <td
                            key={m.key}
                            className="py-2 px-2 font-medium text-foreground tabular-nums"
                          >
                            {v != null ? v : "—"}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-muted-foreground text-xs">
                        {s.performanceNote ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
