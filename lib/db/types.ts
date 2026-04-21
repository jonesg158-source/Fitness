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
