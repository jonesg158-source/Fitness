import { db } from "./schema";
import { macrosForGrams } from "@/lib/nutrition/macros";
import type {
  FoodItem,
  FoodLogEntry,
  MealType,
  PerMacros,
} from "@/lib/db/types";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function listLogForDate(date: string): Promise<FoodLogEntry[]> {
  return db.foodLogEntry
    .where("[tenantId+date]")
    .equals(["me", date])
    .toArray();
}

export interface AddLogInput {
  date: string;
  mealType: MealType;
  food: FoodItem;
  grams: number;
  serving?: { id: string; qty: number };
}

export async function addLogEntry(input: AddLogInput): Promise<FoodLogEntry> {
  const macros = macrosForGrams(input.food, input.grams);
  const entry: FoodLogEntry = {
    id: `me|${input.date}|${uuid()}`,
    tenantId: "me",
    date: input.date,
    mealType: input.mealType,
    foodItemId: input.food.id,
    nameSnapshot: input.food.name,
    grams: input.grams,
    serving: input.serving,
    macros,
    createdAt: Date.now(),
  };
  await db.foodLogEntry.put(entry);
  return entry;
}

export async function updateLogGrams(
  id: string,
  grams: number,
): Promise<void> {
  const entry = await db.foodLogEntry.get(id);
  if (!entry) return;
  const food = await db.foodItem.get(entry.foodItemId);
  const macros = food
    ? macrosForGrams(food, grams)
    : scaleMacros(entry.macros, grams / Math.max(1, entry.grams));
  await db.foodLogEntry.put({ ...entry, grams, macros });
}

export async function deleteLogEntry(id: string): Promise<void> {
  await db.foodLogEntry.delete(id);
}

function scaleMacros(m: PerMacros, factor: number): PerMacros {
  return {
    kcal: round1(m.kcal * factor),
    protein: round1(m.protein * factor),
    carbs: round1(m.carbs * factor),
    fat: round1(m.fat * factor),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Duplicate every entry from `fromDate` onto `toDate` (typical "copy yesterday"). */
export async function copyDay(
  fromDate: string,
  toDate: string,
): Promise<number> {
  const entries = await listLogForDate(fromDate);
  let n = 0;
  for (const e of entries) {
    const next: FoodLogEntry = {
      ...e,
      id: `me|${toDate}|${uuid()}`,
      date: toDate,
      createdAt: Date.now(),
    };
    await db.foodLogEntry.put(next);
    n++;
  }
  return n;
}
