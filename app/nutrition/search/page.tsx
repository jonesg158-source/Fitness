"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchByBarcode,
  searchLocal,
  searchOff,
} from "@/lib/openfoodfacts/client";
import type { FoodItem, MealType } from "@/lib/db/types";
import { addLogEntry } from "@/lib/db/food-repos";
import { todayIso } from "@/lib/util/date";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export default function NutritionSearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm opacity-60">Loading…</div>}>
      <NutritionSearchInner />
    </Suspense>
  );
}

function NutritionSearchInner() {
  const router = useRouter();
  const search = useSearchParams();
  const date = search?.get("date") ?? todayIso();
  const mealQ = (search?.get("meal") ?? "snack") as MealType;
  const meal: MealType = MEAL_TYPES.includes(mealQ) ? mealQ : "snack";

  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"network" | "local" | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setSource(null);
      return;
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      setLoading(true);
      try {
        // If it looks like a barcode, try direct lookup first.
        const digits = term.replace(/\D/g, "");
        if (digits.length >= 8 && digits.length <= 14 && digits === term) {
          const hit = await fetchByBarcode(digits);
          if (hit) {
            setResults([hit]);
            setSource("network");
            return;
          }
        }
        const online = navigator.onLine;
        if (online) {
          const r = await searchOff(term, 20, abort.current.signal);
          if (r.length > 0) {
            setResults(r);
            setSource("network");
            return;
          }
        }
        const local = await searchLocal(term, 20);
        setResults(local);
        setSource("local");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const onAdd = useCallback(
    async (food: FoodItem, grams: number) => {
      await addLogEntry({ date, mealType: meal, food, grams });
      router.push(`/nutrition/log?date=${date}`);
    },
    [date, meal, router],
  );

  return (
    <div className="px-5 py-6 space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Add food</h1>
        <Link
          href={`/nutrition/log?date=${date}`}
          className="text-sm text-brand-600"
        >
          Done
        </Link>
      </header>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <div className="text-xs uppercase opacity-60 tracking-wider">
          Logging to
        </div>
        <div className="mt-1 text-sm capitalize">
          {meal} &middot; {date}
        </div>
      </div>

      <input
        autoFocus
        type="search"
        placeholder="Search foods, brand, or barcode…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full h-12 rounded-xl px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
      />

      <div className="text-xs opacity-60 h-4">
        {loading
          ? "Searching…"
          : source === "local"
            ? "Showing previously-seen foods (offline or no API match)"
            : source === "network"
              ? `${results.length} results from Open Food Facts`
              : " "}
      </div>

      <ul className="space-y-2">
        {results.map((f) => (
          <ResultRow key={f.id} food={f} onAdd={onAdd} />
        ))}
        {!loading && q.trim() && results.length === 0 ? (
          <li className="text-sm opacity-60 py-6 text-center">
            No matches. Try the barcode, or a brand name.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ResultRow({
  food,
  onAdd,
}: {
  food: FoodItem;
  onAdd: (food: FoodItem, grams: number) => Promise<void>;
}) {
  const [grams, setGrams] = useState<string>(() =>
    String(food.servings.find((s) => s.id === "serving")?.grams ?? 100),
  );
  const [busy, setBusy] = useState(false);

  return (
    <li className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{food.name}</div>
          {food.brand ? (
            <div className="text-xs opacity-60 truncate">{food.brand}</div>
          ) : null}
        </div>
        <div className="text-right text-xs opacity-70 shrink-0">
          {Math.round(food.per100g.kcal)} kcal/100g
          <br />
          P {food.per100g.protein} · C {food.per100g.carbs} · F {food.per100g.fat}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          className="h-10 rounded-xl px-2 bg-slate-100 dark:bg-slate-800 text-sm"
          value=""
          onChange={(e) => {
            const sid = e.target.value;
            const s = food.servings.find((x) => x.id === sid);
            if (s) setGrams(String(s.grams));
          }}
        >
          <option value="" disabled>
            Pick serving
          </option>
          {food.servings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className="h-10 w-20 rounded-xl px-2 bg-slate-100 dark:bg-slate-800 text-sm text-right"
        />
        <span className="text-sm opacity-70">g</span>
        <button
          disabled={busy || !grams || parseFloat(grams) <= 0}
          onClick={async () => {
            setBusy(true);
            try {
              await onAdd(food, parseFloat(grams));
            } finally {
              setBusy(false);
            }
          }}
          className="ml-auto h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50 text-sm"
        >
          {busy ? "…" : "Add"}
        </button>
      </div>
    </li>
  );
}
