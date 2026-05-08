/**
 * Shared types, constants, and pure helpers used by the admin member-profile
 * page and its sub-components.
 *
 * Anything that doesn't depend on React state (pure functions, color tables,
 * Zod schemas) lives here so the per-tab components can import it cheaply.
 */

import { z } from "zod";

export const GOLD = "hsl(40 65% 52%)";

export const AVATAR_COLORS = [
  "hsl(40 65% 48%)",
  "hsl(142 60% 45%)",
  "hsl(220 70% 58%)",
  "hsl(280 60% 55%)",
  "hsl(0 60% 52%)",
  "hsl(30 80% 52%)",
  "hsl(180 60% 45%)",
];

export const MUSCLE_COLORS: Record<string, string> = {
  "صدر": "#e74c3c",
  "ظهر": "#3498db",
  "أكتاف": "#2ecc71",
  "بايسبس": "#f39c12",
  "ترايسبس": "#e67e22",
  "أرجل": "#9b59b6",
  "بطن": "#1abc9c",
  "كارديو": "#e91e63",
  "أخرى": "#95a5a6",
};

// Re-used everywhere as the standard <input>/<select> class string.
export const inp =
  "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export type Tab = "overview" | "qr" | "training" | "meals" | "progress" | "notes";

export interface MealItem {
  id?: number;
  mealName: string;
  time: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  description: string | null;
}

export interface MealPlan {
  id: number;
  name: string;
  notes: string | null;
  items: MealItem[];
  createdAt?: string;
}

export const assignSchema = z.object({
  subscriptionId: z.coerce.number().min(1, "اختر خطة"),
  startDate: z.string().min(1, "التاريخ مطلوب"),
  paymentAmount: z.coerce.number().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});

export type AssignForm = z.infer<typeof assignSchema>;

export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

export function emptyMealItem(): MealItem {
  return {
    mealName: "",
    time: null,
    calories: null,
    protein: null,
    carbs: null,
    fats: null,
    description: null,
  };
}

export function parseNum(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
