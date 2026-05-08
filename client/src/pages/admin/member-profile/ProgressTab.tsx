import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GOLD } from "./helpers";

interface ChartPoint {
  date: string;
  وزن: number | null;
}

interface BodyStat {
  id: number;
  date: string;
  weight?: string | null;
  bodyFat?: string | null;
  performanceNote?: string | null;
}

interface Props {
  chartData: ChartPoint[];
  stats: BodyStat[];
}

/**
 * "Progress" tab body — body-stat trend line + recent measurements table.
 */
export function ProgressTab({ chartData, stats }: Props) {
  if (chartData.length === 0 && stats.length === 0) {
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
      {chartData.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">تطور الوزن</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
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
              <Line
                type="monotone"
                dataKey="وزن"
                stroke={GOLD}
                strokeWidth={2}
                dot={{ fill: GOLD, r: 3 }}
              />
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
                  <th className="text-right text-muted-foreground font-medium py-2 px-2">
                    التاريخ
                  </th>
                  <th className="text-right text-muted-foreground font-medium py-2 px-2">
                    الوزن
                  </th>
                  <th className="text-right text-muted-foreground font-medium py-2 px-2">
                    الدهون%
                  </th>
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
                      <td className="py-2 px-2 text-muted-foreground">
                        {new Date(s.date).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="py-2 px-2 font-medium text-foreground">
                        {s.weight ? parseFloat(s.weight) + " كجم" : "—"}
                      </td>
                      <td className="py-2 px-2">
                        {s.bodyFat ? parseFloat(s.bodyFat) + "%" : "—"}
                      </td>
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
