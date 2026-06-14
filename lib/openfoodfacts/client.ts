/**
 * Thin Open Food Facts client.
 *
 * - Search: /api/v2/search?search_terms=...
 * - Product: /api/v2/product/{barcode}.json
 *
 * Every resolved product is cached into Dexie `foodItem`, so the user's
 * personal food DB grows organically and the app keeps working offline
 * for previously-seen products.
 */

import { db } from "@/lib/db/schema";
import type { FoodItem, FoodServing, PerMacros } from "@/lib/db/types";

const BASE = "https://world.openfoodfacts.org";
const FIELDS = [
  "code",
  "product_name",
  "brands",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "image_small_url",
].join(",");
const UA = "Fitness90/0.1 (https://github.com/jonesg158-source/Fitness)";

/** OFF nutriments are sometimes strings, sometimes missing. Coerce safely. */
function num(x: unknown): number {
  const n = typeof x === "string" ? parseFloat(x) : (x as number);
  return Number.isFinite(n) ? n : 0;
}

type OffNutriments = Record<string, unknown>;

function macrosFromNutriments(n: OffNutriments | undefined): PerMacros {
  if (!n) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  // Prefer kcal_100g; fall back to energy_100g / 4.184 if only kJ.
  const kcal100 = num(n["energy-kcal_100g"]);
  const energyKJ100 = num(n["energy-kj_100g"]);
  const kcal = kcal100 || (energyKJ100 ? energyKJ100 / 4.184 : 0);
  return {
    kcal: round1(kcal),
    protein: round1(num(n["proteins_100g"])),
    carbs: round1(num(n["carbohydrates_100g"])),
    fat: round1(num(n["fat_100g"])),
  };
}

function servingsFrom(
  servingSize: unknown,
  servingQty: unknown,
): FoodServing[] {
  const out: FoodServing[] = [{ id: "100g", label: "100 g", grams: 100 }];
  const grams = num(servingQty);
  if (grams > 0) {
    const label =
      typeof servingSize === "string" && servingSize.trim()
        ? servingSize.trim()
        : `${grams} g`;
    out.push({ id: "serving", label, grams });
  }
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type OffProductResponse = {
  status?: number;
  product?: {
    code?: string;
    product_name?: string;
    brands?: string;
    nutriments?: OffNutriments;
    serving_size?: string;
    serving_quantity?: string | number;
  };
};

type OffSearchResponse = {
  products?: NonNullable<OffProductResponse["product"]>[];
  count?: number;
};

function mapProduct(
  p: NonNullable<OffProductResponse["product"]>,
): FoodItem | null {
  const code = p.code?.trim();
  const name = (p.product_name ?? "").trim();
  if (!code || !name) return null;
  const macros = macrosFromNutriments(p.nutriments);
  if (macros.kcal <= 0 && macros.protein <= 0 && macros.carbs <= 0 && macros.fat <= 0) {
    return null; // unusable row
  }
  const now = Date.now();
  return {
    id: `off|${code}`,
    tenantId: "me",
    source: "off",
    barcode: code,
    name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    per100g: macros,
    servings: servingsFrom(p.serving_size, p.serving_quantity),
    updatedAt: now,
    createdAt: now,
  };
}

async function cachePut(item: FoodItem): Promise<void> {
  const existing = await db.foodItem.get(item.id);
  await db.foodItem.put({
    ...item,
    createdAt: existing?.createdAt ?? item.createdAt,
    updatedAt: Date.now(),
  });
}

/** Look up a product by barcode. Returns null if not found or malformed. */
export async function fetchByBarcode(
  barcode: string,
): Promise<FoodItem | null> {
  const clean = barcode.replace(/\D/g, "");
  if (!clean) return null;
  // Hit cache first.
  const cached = await db.foodItem.get(`off|${clean}`);
  if (cached) return cached;
  try {
    const res = await fetch(
      `${BASE}/api/v2/product/${encodeURIComponent(clean)}.json?fields=${FIELDS}`,
      { headers: { "User-Agent": UA, Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as OffProductResponse;
    if (data.status !== 1 || !data.product) return null;
    const mapped = mapProduct(data.product);
    if (!mapped) return null;
    await cachePut(mapped);
    return mapped;
  } catch (e) {
    console.warn("OFF barcode fetch failed", e);
    return null;
  }
}

/**
 * Text search. Returns up to `pageSize` mapped products.
 * Pulls from the live API; also caches every result for offline reuse.
 */
export async function searchOff(
  query: string,
  pageSize = 20,
  signal?: AbortSignal,
): Promise<FoodItem[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const url =
      `${BASE}/api/v2/search` +
      `?search_terms=${encodeURIComponent(q)}` +
      `&fields=${FIELDS}` +
      `&page_size=${pageSize}` +
      `&sort_by=popularity_key`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OffSearchResponse;
    const products = data.products ?? [];
    const out: FoodItem[] = [];
    for (const p of products) {
      const m = mapProduct(p);
      if (m) {
        out.push(m);
        // Fire-and-forget cache write.
        void cachePut(m);
      }
    }
    return out;
  } catch (e) {
    if ((e as Error).name === "AbortError") return [];
    console.warn("OFF search failed", e);
    return [];
  }
}

/** Offline fallback — search the local foodItem cache by name substring. */
export async function searchLocal(
  query: string,
  pageSize = 20,
): Promise<FoodItem[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await db.foodItem.orderBy("updatedAt").reverse().toArray();
  return all
    .filter((f) => f.name.toLowerCase().includes(q))
    .slice(0, pageSize);
}
