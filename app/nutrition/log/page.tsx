"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useCryptoSession } from "@/lib/crypto/session";
import { decryptNumber } from "@/lib/crypto/pin";
import {
  copyDay,
  deleteLogEntry,
  updateLogGrams,
} from "@/lib/db/food-repos";
import { sumMacros } from "@/lib/nutrition/macros";
import { initialTargets } from "@/lib/tdee/initial";
import { addDaysIso, todayIso } from "@/lib/util/date";
import type { FoodLogEntry, MealType } from "@/lib/db/types";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export default function NutritionLogPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm opacity-60">Loading…</div>}>
      <NutritionLogPageInner />
    </Suspense>
  );
}

function NutritionLogPageInner() {
  const search = useSearchParams();
  const date = search?.get("date") ?? todayIso();
  const { dek } = useCryptoSession();

  const profile = useLiveQuery(() => db.profile.get("me"), []);
  const entries = useLiveQuery(
    () =>
      db.foodLogEntry
        .where("[tenantId+date]")
        .equals(["me", date])
        .toArray(),
    [date],
  );

  const [currentKg, setCurrentKg] = useState<number | null>(null);
  useEffect(() => {
    if (!dek || !profile) return;
    decryptNumber(dek, profile.startWeightKg)
      .then(setCurrentKg)
      .catch(() => {});
  }, [dek, profile]);

  const total = useMemo(() => sumMacros(entries ?? []), [entries]);

  const targets = useMemo(() => {
    if (!profile || currentKg == null) return null;
    return initialTargets({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: currentKg,
      activityMultiplier: profile.activityMultiplier,
      goal: profile.goal,
    });
  }, [profile, currentKg]);

  const grouped = useMemo(() => {
    const map: Record<MealType, FoodLogEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const e of entries ?? []) {
      map[e.mealType]?.push(e);
    }
    return map;
  }, [entries]);

  const prev = addDaysIso(date, -1);
  const next = addDaysIso(date, 1);

  return (
    <div className="px-5 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <Link
          href={`/nutrition/log?date=${prev}`}
          className="text-sm opacity-70"
        >
          ‹ {prev.slice(5)}
        </Link>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider opacity-60">
            Food log
          </div>
          <div className="font-semibold">{date}</div>
        </div>
        <Link
          href={`/nutrition/log?date=${next}`}
          className="text-sm opacity-70"
        >
          {next.slice(5)} ›
        </Link>
      </header>

      {targets && (
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold">
              {Math.round(total.kcal)}
              <span className="text-sm font-normal opacity-60">
                {" "}
                / {targets.targetKcal} kcal
              </span>
            </div>
            <div className="text-sm opacity-70">
              {targets.targetKcal - Math.round(total.kcal)} left
            </div>
          </div>
          <Progress value={total.kcal} max={targets.targetKcal} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <MacroCell
              label="Protein"
              value={total.protein}
              target={targets.proteinG}
            />
            <MacroCell
              label="Carbs"
              value={total.carbs}
              target={targets.carbG}
            />
            <MacroCell
              label="Fat"
              value={total.fat}
              target={targets.fatG}
            />
          </div>
        </section>
      )}

      {MEAL_ORDER.map((meal) => (
        <MealSection
          key={meal}
          meal={meal}
          date={date}
          entries={grouped[meal]}
        />
      ))}

      <div className="flex gap-2">
        <button
          onClick={async () => {
            const n = await copyDay(prev, date);
            if (n === 0) alert("Nothing logged yesterday.");
          }}
          className="flex-1 h-11 rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-medium"
        >
          Duplicate yesterday
        </button>
      </div>
    </div>
  );
}

function MealSection({
  meal,
  date,
  entries,
}: {
  meal: MealType;
  date: string;
  entries: FoodLogEntry[];
}) {
  const subtotal = sumMacros(entries);
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-baseline justify-between">
        <div className="font-semibold">{MEAL_LABEL[meal]}</div>
        <div className="text-xs opacity-60">
          {Math.round(subtotal.kcal)} kcal
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="py-3 text-sm opacity-50">Nothing logged.</div>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
          {entries.map((e) => (
            <LogRow key={e.id} entry={e} />
          ))}
        </ul>
      )}

      <Link
        href={`/nutrition/search?date=${date}&meal=${meal}`}
        className="mt-3 inline-block text-sm text-brand-600 font-medium"
      >
        + Add food
      </Link>
    </section>
  );
}

function LogRow({ entry }: { entry: FoodLogEntry }) {
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState(String(entry.grams));
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm">{entry.nameSnapshot}</div>
          <div className="text-xs opacity-60">
            {entry.grams} g · P {entry.macros.protein} · C {entry.macros.carbs}{" "}
            · F {entry.macros.fat}
          </div>
        </div>
        <div className="text-sm font-semibold shrink-0">
          {Math.round(entry.macros.kcal)} kcal
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="h-8 w-20 rounded-lg px-2 bg-slate-100 dark:bg-slate-800 text-sm text-right"
            />
            <span className="text-xs opacity-60">g</span>
            <button
              className="text-xs text-brand-600"
              onClick={async () => {
                const n = parseFloat(grams);
                if (Number.isFinite(n) && n > 0) {
                  await updateLogGrams(entry.id, n);
                }
                setEditing(false);
              }}
            >
              Save
            </button>
            <button
              className="text-xs opacity-60"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="text-xs text-brand-600"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              className="text-xs text-red-500"
              onClick={() => deleteLogEntry(entry.id)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  return (
    <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
      <div
        className="h-full bg-brand-600 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MacroCell({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const pct = Math.min(100, (value / Math.max(1, target)) * 100);
  return (
    <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
      <div className="opacity-60">{label}</div>
      <div className="font-semibold">
        {Math.round(value)}
        <span className="opacity-50 font-normal"> / {target} g</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-brand-600"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
