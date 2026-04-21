import Dexie, { type Table } from "dexie";
import type { DailyWeight, KV, Profile } from "./types";

/**
 * Fitness 90 local database.
 *
 * v1 — Phase 1: profile, dailyWeight, kv (crypto + onboarding singletons).
 * Future versions will add foodItem, foodLogEntry, exerciseDef, programTemplate,
 * programInstance, trainingSession, setLog, progressPhoto, tdeeSnapshot.
 */
class FitnessDB extends Dexie {
  profile!: Table<Profile, string>;
  dailyWeight!: Table<DailyWeight, string>;
  kv!: Table<KV, string>;

  constructor() {
    super("fitness90");
    this.version(1).stores({
      profile: "id, tenantId, goal",
      dailyWeight: "id, [tenantId+date], date",
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
