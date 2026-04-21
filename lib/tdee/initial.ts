import type { Goal, Sex } from "@/lib/db/types";

/**
 * Mifflin-St Jeor BMR.
 * Male:   10·kg + 6.25·cm − 5·yrs + 5
 * Female: 10·kg + 6.25·cm − 5·yrs − 161
 */
export function bmrMifflin(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export type InitialTargets = {
  bmr: number;
  tdee: number;
  targetKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
};

/**
 * First-pass calorie + macro targets used during onboarding, before
 * the adaptive TDEE engine has enough data to take over.
 */
export function initialTargets(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityMultiplier: number;
  goal: Goal;
}): InitialTargets {
  const bmr = bmrMifflin(
    input.sex,
    input.weightKg,
    input.heightCm,
    input.age,
  );
  const tdee = Math.round(bmr * input.activityMultiplier);
  const goalDelta =
    input.goal === "cut" ? -500 : input.goal === "bulk" ? 250 : 0;
  const targetKcal = Math.max(1200, Math.round(tdee + goalDelta));

  // Protein ~1.8 g/kg BW, fat ~0.8 g/kg BW, carbs fill the remainder.
  const proteinG = Math.round(input.weightKg * 1.8);
  const fatG = Math.round(input.weightKg * 0.8);
  const kcalFromPF = proteinG * 4 + fatG * 9;
  const carbG = Math.max(0, Math.round((targetKcal - kcalFromPF) / 4));

  return { bmr: Math.round(bmr), tdee, targetKcal, proteinG, fatG, carbG };
}
