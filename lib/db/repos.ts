"use client";

import { db } from "./schema";
import { encryptNumber, decryptNumber } from "@/lib/crypto/pin";
import type { DailyWeight, Profile } from "./types";
import { todayIso } from "@/lib/util/date";

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get("me");
}

export async function setDailyWeight(
  dek: CryptoKey,
  weightKg: number,
  date: string = todayIso(),
  note?: string,
): Promise<void> {
  const id = `me|${date}`;
  const blob = await encryptNumber(dek, weightKg);
  await db.dailyWeight.put({
    id,
    tenantId: "me",
    date,
    weightKg: blob,
    note,
    createdAt: Date.now(),
  });
}

export async function getDailyWeight(
  date: string = todayIso(),
): Promise<DailyWeight | undefined> {
  return db.dailyWeight.get(`me|${date}`);
}

export type WeightPoint = { date: string; weightKg: number };

/** Decrypt an ordered series of weights for charting. */
export async function listWeights(dek: CryptoKey): Promise<WeightPoint[]> {
  const rows = await db.dailyWeight
    .where("date")
    .aboveOrEqual("0000-00-00")
    .sortBy("date");
  const out: WeightPoint[] = [];
  for (const row of rows) {
    try {
      out.push({ date: row.date, weightKg: await decryptNumber(dek, row.weightKg) });
    } catch (e) {
      console.warn("decrypt failed for", row.date, e);
    }
  }
  return out;
}
