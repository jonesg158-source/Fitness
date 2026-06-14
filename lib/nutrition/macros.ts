import type { FoodItem, FoodLogEntry, PerMacros } from "@/lib/db/types";

export const ZERO_MACROS: PerMacros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Scale per-100g macros to a given mass in grams. */
export function macrosForGrams(food: FoodItem, grams: number): PerMacros {
  const k = grams / 100;
  return {
    kcal: round1(food.per100g.kcal * k),
    protein: round1(food.per100g.protein * k),
    carbs: round1(food.per100g.carbs * k),
    fat: round1(food.per100g.fat * k),
  };
}

/** Sum the macros across a list of log entries (applies overrides). */
export function sumMacros(entries: FoodLogEntry[]): PerMacros {
  return entries.reduce<PerMacros>((acc, e) => {
    const m = { ...e.macros, ...(e.macroOverride ?? {}) };
    return {
      kcal: round1(acc.kcal + (m.kcal ?? 0)),
      protein: round1(acc.protein + (m.protein ?? 0)),
      carbs: round1(acc.carbs + (m.carbs ?? 0)),
      fat: round1(acc.fat + (m.fat ?? 0)),
    };
  }, ZERO_MACROS);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function clampPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(1, Math.max(0, numerator / denominator));
}
