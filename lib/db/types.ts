export type TenantId = "me" | string;

export type EncryptedBlob = {
  iv: Uint8Array;
  ct: Uint8Array;
};

export type Goal = "cut" | "recomp" | "bulk";
export type Sex = "male" | "female";
export type Experience = "beginner" | "intermediate" | "advanced";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "bands"
  | "kettlebell"
  | "smith"
  | "ez_bar"
  | "trap_bar";

export interface Profile {
  id: TenantId;
  tenantId: TenantId;
  sex: Sex;
  age: number;
  heightCm: number;
  experience: Experience;
  equipment: Equipment[];
  /** Days of week (0=Sun..6=Sat) the user intends to train. */
  weeklySchedule: number[];
  goal: Goal;
  /** AES-GCM ciphertext of the starting body weight in kg. */
  startWeightKg: EncryptedBlob;
  targetWeightKg: number;
  /** ISO yyyy-mm-dd. */
  targetDate: string;
  /** Mifflin-St Jeor activity multiplier (1.2..1.9). */
  activityMultiplier: number;
  /** Program start anchor; day counter is derived from this. */
  programStartDate: string;
  createdAt: number;
  updatedAt: number;
}

export interface DailyWeight {
  /** Compound "me|YYYY-MM-DD" */
  id: string;
  tenantId: TenantId;
  date: string; // YYYY-MM-DD
  weightKg: EncryptedBlob;
  note?: string;
  createdAt: number;
}

export interface KV<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

/** Persisted onboarding progress so users can resume. */
export interface OnboardingState {
  step: number;
  draft: Partial<{
    sex: Sex;
    age: number;
    heightCm: number;
    experience: Experience;
    equipment: Equipment[];
    weeklySchedule: number[];
    goal: Goal;
    startWeightKg: number;
    targetWeightKg: number;
    targetDate: string;
    activityMultiplier: number;
  }>;
}

/* ---------- Nutrition ---------- */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodSource = "off" | "custom" | "recipe";

export interface PerMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodServing {
  /** Stable id local to the food (e.g. "serving", "100g", "can"). */
  id: string;
  /** Human label, e.g. "1 scoop (30 g)". */
  label: string;
  /** Mass in grams represented by 1 of this serving. */
  grams: number;
}

export interface FoodItem {
  /** "off|<barcode>" for OFF imports, "custom|<uuid>" for user-created. */
  id: string;
  tenantId: TenantId;
  source: FoodSource;
  /** EAN/UPC if known. */
  barcode?: string;
  name: string;
  brand?: string;
  /** Macros per 100 g of edible product. */
  per100g: PerMacros;
  servings: FoodServing[];
  /** Last time we touched / refreshed this row. */
  updatedAt: number;
  createdAt: number;
}

export interface FoodLogEntry {
  /** "me|<isodate>|<uuid>" */
  id: string;
  tenantId: TenantId;
  /** YYYY-MM-DD local date the food was consumed. */
  date: string;
  mealType: MealType;
  foodItemId: string;
  /** Snapshot of the food name at time of logging (resilient to deletion). */
  nameSnapshot: string;
  /** Either grams-direct or a chosen serving × quantity. */
  grams: number;
  serving?: {
    id: string;
    qty: number;
  };
  /** Computed macros at log time so the entry is self-contained. */
  macros: PerMacros;
  /** Optional per-entry override (e.g. user knows the label was wrong). */
  macroOverride?: Partial<PerMacros>;
  createdAt: number;
}

export interface Meal {
  id: string;
  tenantId: TenantId;
  name: string;
  items: { foodItemId: string; grams: number }[];
  createdAt: number;
  updatedAt: number;
}
