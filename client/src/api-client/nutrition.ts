import { customFetch } from "./custom-fetch";

export interface Food {
  id: number;
  name: string;
  category: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
}

export interface FoodLogItem {
  id: number;
  date: string;
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface FoodLogDay {
  date: string;
  items: FoodLogItem[];
  totals: { calories: number; protein: number; carbs: number; fats: number };
}

export interface AddFoodLogInput {
  date: string;
  grams: number;
  /** Reference a catalog food … */
  foodId?: number;
  /** … or supply a custom food with its own per-100g macros. */
  name?: string;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
}

export const searchFoods = (search: string) =>
  customFetch<Food[]>(`/api/foods${search ? `?search=${encodeURIComponent(search)}` : ""}`, {
    method: "GET",
  });

export const getFoodLog = (date: string) =>
  customFetch<FoodLogDay>(`/api/food-logs?date=${encodeURIComponent(date)}`, { method: "GET" });

export const addFoodLog = (data: AddFoodLogInput) =>
  customFetch<FoodLogItem>("/api/food-logs", { method: "POST", body: JSON.stringify(data) });

export const deleteFoodLog = (id: number) =>
  customFetch<{ success: boolean }>(`/api/food-logs/${id}`, { method: "DELETE" });
