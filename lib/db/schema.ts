import Dexie, { type Table } from "dexie";
import type {
  DailyWeight,
  FoodItem,
  FoodLogEntry,
  KV,
  Meal,
  Profile,
} from "./types";

/**
 * Fitness 90 local database.
 *
 * v1 — Phase 1: profile, dailyWeight, kv.
 * v2 — Phase 2: foodItem, foodLogEntry, meal.
 */
class FitnessDB extends Dexie {
  profile!: Table<Profile, string>;
  dailyWeight!: Table<DailyWeight, string>;
  foodItem!: Table<FoodItem, string>;
  foodLogEntry!: Table<FoodLogEntry, string>;
  meal!: Table<Meal, string>;
  kv!: Table<KV, string>;

  constructor() {
    super("fitness90");
    this.version(1).stores({
      profile: "id, tenantId, goal",
      dailyWeight: "id, [tenantId+date], date",
      kv: "key",
    });
    this.version(2).stores({
      profile: "id, tenantId, goal",
      dailyWeight: "id, [tenantId+date], date",
      foodItem: "id, source, barcode, name, updatedAt",
      foodLogEntry: "id, [tenantId+date], date, mealType, foodItemId",
      meal: "id, name, updatedAt",
      kv: "key",
    });
  }
}

let _db: FitnessDB | null = null;

/** Lazy singleton — guards against construction during SSR/build. */
export function getDb(): FitnessDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie is only available in the browser");
  }
  if (!_db) _db = new FitnessDB();
  return _db;
}

/**
 * `db` is a proxy that forwards to the lazy singleton, so consumers can
 * write `db.profile.get(...)` from client components without worrying
 * about construction order.
 */
export const db = new Proxy({} as FitnessDB, {
  get(_t, prop: keyof FitnessDB) {
    return getDb()[prop];
  },
}) as FitnessDB;
