"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useCryptoSession } from "@/lib/crypto/session";
import { decryptNumber } from "@/lib/crypto/pin";
import { dayNumber, todayIso } from "@/lib/util/date";
import { initialTargets } from "@/lib/tdee/initial";
import { setDailyWeight } from "@/lib/db/repos";
import { sumMacros } from "@/lib/nutrition/macros";

export default function TodayPage() {
  const router = useRouter();
  const { dek } = useCryptoSession();
  const profile = useLiveQuery(() => db.profile.get("me"), []);
  const today = todayIso();
  const todayWeightRow = useLiveQuery(
    () => db.dailyWeight.get(`me|${today}`),
    [today],
  );
  const todayEntries = useLiveQuery(
    () =>
      db.foodLogEntry
        .where("[tenantId+date]")
        .equals(["me", today])
        .toArray(),
    [today],
  );
  const consumed = useMemo(() => sumMacros(todayEntries ?? []), [todayEntries]);

  const [startKg, setStartKg] = useState<number | null>(null);
  const [todayKg, setTodayKg] = useState<number | null>(null);

  useEffect(() => {
    if (!dek || !profile) return;
    decryptNumber(dek, profile.startWeightKg).then(setStartKg).catch(() => {});
  }, [dek, profile]);

  useEffect(() => {
    if (!dek || !todayWeightRow) {
      setTodayKg(null);
      return;
    }
    decryptNumber(dek, todayWeightRow.weightKg).then(setTodayKg).catch(() => {});
  }, [dek, todayWeightRow]);

  useEffect(() => {
    if (profile === null) router.replace("/onboarding");
  }, [profile, router]);

  const targets = useMemo(() => {
    if (!profile || startKg == null) return null;
    return initialTargets({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: todayKg ?? startKg,
      activityMultiplier: profile.activityMultiplier,
      goal: profile.goal,
    });
  }, [profile, startKg, todayKg]);

  if (!profile) {
    return (
      <div className="p-6 text-sm opacity-60">Loading…</div>
    );
  }

  const day = dayNumber(profile.programStartDate);
  const dayOf = Math.min(90, day);

  return (
    <div className="px-5 py-6 space-y-5">
      <header className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-60">
            90-day transformation
          </div>
          <h1 className="text-3xl font-bold">Day {dayOf} / 90</h1>
        </div>
        <div className="text-sm opacity-70">
          Goal: <span className="capitalize">{profile.goal}</span>
        </div>
      </header>

      <Card>
        <WeightQuickAdd
          todayKg={todayKg}
          onSave={async (kg) => {
            if (!dek) return;
            await setDailyWeight(dek, kg);
          }}
        />
      </Card>

      {targets && (
        <Card>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase opacity-60 tracking-wider">
                Today
              </div>
              <div className="text-2xl font-bold">
                {Math.round(consumed.kcal).toLocaleString()}
                <span className="text-sm font-normal opacity-60">
                  {" "}
                  / {targets.targetKcal.toLocaleString()} kcal
                </span>
              </div>
            </div>
            <Link
              href={`/nutrition/log?date=${today}`}
              className="text-sm text-brand-600 font-medium"
            >
              Log →
            </Link>
          </div>
          <CalorieBar
            value={consumed.kcal}
            target={targets.targetKcal}
          />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <Macro
              label="Protein"
              value={consumed.protein}
              target={targets.proteinG}
            />
            <Macro
              label="Carbs"
              value={consumed.carbs}
              target={targets.carbG}
            />
            <Macro
              label="Fat"
              value={consumed.fat}
              target={targets.fatG}
            />
          </div>
          <p className="mt-3 text-xs opacity-60">
            Initial estimate. Adaptive TDEE takes over after ~1 week of logging.
          </p>
        </Card>
      )}

      <Card>
        <div className="text-xs uppercase opacity-60 tracking-wider">
          Today&apos;s workout
        </div>
        <div className="mt-1 text-sm opacity-80">
          Training module coming in Phase 3. You&apos;ll see your session card
          here with exercises, rep targets, and a &ldquo;Start session&rdquo;
          button.
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      {children}
    </section>
  );
}

function Macro({
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
    <div className="rounded-xl bg-slate-100 dark:bg-slate-800 py-2">
      <div className="text-xs opacity-60">{label}</div>
      <div className="font-semibold">
        {Math.round(value)}
        <span className="font-normal opacity-50"> / {target} g</span>
      </div>
      <div className="mt-1 mx-2 h-1 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CalorieBar({ value, target }: { value: number; target: number }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, target)) * 100));
  return (
    <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
      <div
        className="h-full bg-brand-600 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function WeightQuickAdd({
  todayKg,
  onSave,
}: {
  todayKg: number | null;
  onSave: (kg: number) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(todayKg != null ? String(todayKg) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (todayKg != null) setValue(String(todayKg));
  }, [todayKg]);

  return (
    <div>
      <div className="text-xs uppercase opacity-60 tracking-wider">
        Today&apos;s weight
      </div>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => {
            setSaved(false);
            setValue(e.target.value);
          }}
          className="flex-1 h-12 rounded-xl px-3 bg-slate-100 dark:bg-slate-800 text-xl font-semibold"
          placeholder="kg"
        />
        <button
          disabled={saving || !value}
          onClick={async () => {
            const n = parseFloat(value);
            if (!Number.isFinite(n)) return;
            setSaving(true);
            try {
              await onSave(n);
              setSaved(true);
            } finally {
              setSaving(false);
            }
          }}
          className="h-12 px-4 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
        >
          {saving ? "…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
