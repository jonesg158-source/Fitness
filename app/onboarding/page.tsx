"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db/schema";
import { encryptNumber } from "@/lib/crypto/pin";
import { useCryptoSession } from "@/lib/crypto/session";
import { todayIso, addDaysIso } from "@/lib/util/date";
import type {
  Equipment,
  Experience,
  Goal,
  Profile,
  Sex,
} from "@/lib/db/types";

const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "cable", label: "Cable" },
  { id: "machine", label: "Machines" },
  { id: "smith", label: "Smith machine" },
  { id: "ez_bar", label: "EZ bar" },
  { id: "trap_bar", label: "Trap bar" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "bands", label: "Bands" },
  { id: "bodyweight", label: "Bodyweight" },
];

type Draft = {
  sex?: Sex;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  experience?: Experience;
  equipment: Equipment[];
  schedule: number[];
  goal?: Goal;
  targetWeightKg?: number;
  targetDate?: string;
  activityMultiplier: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { dek } = useCryptoSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    equipment: ["barbell", "dumbbell", "cable", "machine"],
    schedule: [1, 3, 5],
    activityMultiplier: 1.5,
  });

  const update = useCallback(
    <K extends keyof Draft>(k: K, v: Draft[K]) =>
      setDraft((d) => ({ ...d, [k]: v })),
    [],
  );

  const steps = useMemo(
    () => [
      "Basics",
      "Body",
      "Experience",
      "Equipment",
      "Schedule",
      "Goal",
      "Review",
    ],
    [],
  );

  const canNext = (() => {
    switch (step) {
      case 0:
        return draft.sex && draft.age && draft.heightCm;
      case 1:
        return !!draft.weightKg;
      case 2:
        return !!draft.experience;
      case 3:
        return draft.equipment.length > 0;
      case 4:
        return draft.schedule.length > 0;
      case 5:
        return draft.goal && draft.targetWeightKg && draft.targetDate;
      default:
        return true;
    }
  })();

  const finish = useCallback(async () => {
    if (!dek) return;
    setBusy(true);
    try {
      const now = Date.now();
      const startIso = todayIso();
      const profile: Profile = {
        id: "me",
        tenantId: "me",
        sex: draft.sex!,
        age: draft.age!,
        heightCm: draft.heightCm!,
        experience: draft.experience!,
        equipment: draft.equipment,
        weeklySchedule: draft.schedule,
        goal: draft.goal!,
        startWeightKg: await encryptNumber(dek, draft.weightKg!),
        targetWeightKg: draft.targetWeightKg!,
        targetDate: draft.targetDate!,
        activityMultiplier: draft.activityMultiplier,
        programStartDate: startIso,
        createdAt: now,
        updatedAt: now,
      };
      await db.profile.put(profile);

      // Seed today's weight so the trend line has a data point from day 1.
      await db.dailyWeight.put({
        id: `me|${startIso}`,
        tenantId: "me",
        date: startIso,
        weightKg: await encryptNumber(dek, draft.weightKg!),
        createdAt: now,
      });
      router.replace("/today");
    } finally {
      setBusy(false);
    }
  }, [dek, draft, router]);

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider opacity-60">
          Step {step + 1} of {steps.length}
        </div>
        <h1 className="text-2xl font-bold mt-1">{steps[step]}</h1>
      </div>

      {step === 0 && (
        <BasicsStep
          draft={draft}
          onChange={(k, v) => update(k, v)}
        />
      )}
      {step === 1 && (
        <BodyStep draft={draft} onChange={(k, v) => update(k, v)} />
      )}
      {step === 2 && (
        <ExperienceStep draft={draft} onChange={(k, v) => update(k, v)} />
      )}
      {step === 3 && (
        <EquipmentStep draft={draft} onChange={(k, v) => update(k, v)} />
      )}
      {step === 4 && (
        <ScheduleStep draft={draft} onChange={(k, v) => update(k, v)} />
      )}
      {step === 5 && (
        <GoalStep draft={draft} onChange={(k, v) => update(k, v)} />
      )}
      {step === 6 && <ReviewStep draft={draft} />}

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button
            className="flex-1 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 font-medium"
            onClick={() => setStep((s) => s - 1)}
            disabled={busy}
          >
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            className="flex-1 h-12 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext || busy}
          >
            Next
          </button>
        ) : (
          <button
            className="flex-1 h-12 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
            onClick={finish}
            disabled={busy}
          >
            {busy ? "Saving…" : "Start my 90 days"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Steps ---- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <div className="mb-1 text-sm font-medium opacity-80">{label}</div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full h-12 rounded-xl px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700";

function BasicsStep({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  return (
    <div>
      <Field label="Sex (used for BMR)">
        <div className="flex gap-2">
          {(["male", "female"] as Sex[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange("sex", s)}
              className={[
                "flex-1 h-12 rounded-xl border font-medium capitalize",
                draft.sex === s
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-slate-300 dark:border-slate-700",
              ].join(" ")}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Age">
        <input
          type="number"
          inputMode="numeric"
          className={inputCls}
          value={draft.age ?? ""}
          onChange={(e) => onChange("age", parseInt(e.target.value) || 0)}
        />
      </Field>
      <Field label="Height (cm)">
        <input
          type="number"
          inputMode="numeric"
          className={inputCls}
          value={draft.heightCm ?? ""}
          onChange={(e) => onChange("heightCm", parseInt(e.target.value) || 0)}
        />
      </Field>
    </div>
  );
}

function BodyStep({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  return (
    <div>
      <Field label="Current weight (kg)">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          className={inputCls}
          value={draft.weightKg ?? ""}
          onChange={(e) =>
            onChange("weightKg", parseFloat(e.target.value) || 0)
          }
        />
      </Field>
      <Field label="Daily activity (outside training)">
        <select
          className={inputCls}
          value={draft.activityMultiplier}
          onChange={(e) =>
            onChange("activityMultiplier", parseFloat(e.target.value))
          }
        >
          <option value={1.3}>Sedentary (desk job, little walking)</option>
          <option value={1.4}>Light (some walking)</option>
          <option value={1.5}>Moderate (active job or daily walks)</option>
          <option value={1.7}>High (manual job, coach, etc.)</option>
          <option value={1.9}>Very high (athlete, laborer)</option>
        </select>
      </Field>
    </div>
  );
}

function ExperienceStep({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  const opts: { id: Experience; label: string; sub: string }[] = [
    { id: "beginner", label: "Beginner", sub: "< 1 year of consistent lifting" },
    {
      id: "intermediate",
      label: "Intermediate",
      sub: "1–3 years, knows basic lifts",
    },
    { id: "advanced", label: "Advanced", sub: "3+ years, programs themselves" },
  ];
  return (
    <div className="space-y-2">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange("experience", o.id)}
          className={[
            "w-full text-left rounded-xl border p-4",
            draft.experience === o.id
              ? "border-brand-600 bg-brand-50 dark:bg-slate-800"
              : "border-slate-300 dark:border-slate-700",
          ].join(" ")}
        >
          <div className="font-semibold">{o.label}</div>
          <div className="text-sm opacity-70">{o.sub}</div>
        </button>
      ))}
    </div>
  );
}

function EquipmentStep({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  const toggle = (id: Equipment) => {
    const has = draft.equipment.includes(id);
    onChange(
      "equipment",
      has ? draft.equipment.filter((e) => e !== id) : [...draft.equipment, id],
    );
  };
  return (
    <>
      <p className="mb-3 text-sm opacity-70">
        Pick everything you have reliable access to. Used to filter exercise
        swaps.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {EQUIPMENT.map((e) => {
          const on = draft.equipment.includes(e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggle(e.id)}
              className={[
                "h-12 rounded-xl border font-medium",
                on
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-slate-300 dark:border-slate-700",
              ].join(" ")}
            >
              {e.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ScheduleStep({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const toggle = (d: number) => {
    const has = draft.schedule.includes(d);
    onChange(
      "schedule",
      has ? draft.schedule.filter((x) => x !== d) : [...draft.schedule, d],
    );
  };
  return (
    <>
      <p className="mb-3 text-sm opacity-70">Which days will you train?</p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const on = draft.schedule.includes(i);
          return (
            <button
              key={d}
              onClick={() => toggle(i)}
              className={[
                "h-12 rounded-xl border text-sm font-medium",
                on
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-slate-300 dark:border-slate-700",
              ].join(" ")}
            >
              {d}
            </button>
          );
        })}
      </div>
    </>
  );
}

function GoalStep({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  const opts: { id: Goal; label: string; sub: string }[] = [
    { id: "cut", label: "Cut", sub: "Lose fat, keep muscle" },
    { id: "recomp", label: "Recomp", sub: "Lose fat + gain muscle" },
    { id: "bulk", label: "Bulk", sub: "Gain muscle (some fat ok)" },
  ];
  const defaultTarget = addDaysIso(todayIso(), 90);
  return (
    <div>
      <div className="space-y-2 mb-4">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange("goal", o.id)}
            className={[
              "w-full text-left rounded-xl border p-4",
              draft.goal === o.id
                ? "border-brand-600 bg-brand-50 dark:bg-slate-800"
                : "border-slate-300 dark:border-slate-700",
            ].join(" ")}
          >
            <div className="font-semibold">{o.label}</div>
            <div className="text-sm opacity-70">{o.sub}</div>
          </button>
        ))}
      </div>
      <Field label="Target weight (kg)">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          className={inputCls}
          value={draft.targetWeightKg ?? ""}
          onChange={(e) =>
            onChange("targetWeightKg", parseFloat(e.target.value) || 0)
          }
        />
      </Field>
      <Field label="Target date">
        <input
          type="date"
          className={inputCls}
          value={draft.targetDate ?? defaultTarget}
          onChange={(e) => onChange("targetDate", e.target.value)}
        />
      </Field>
    </div>
  );
}

function ReviewStep({ draft }: { draft: Draft }) {
  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-4 text-sm space-y-1">
      <div>
        <b>Sex:</b> {draft.sex}
      </div>
      <div>
        <b>Age:</b> {draft.age}
      </div>
      <div>
        <b>Height:</b> {draft.heightCm} cm
      </div>
      <div>
        <b>Weight:</b> {draft.weightKg} kg
      </div>
      <div>
        <b>Experience:</b> {draft.experience}
      </div>
      <div>
        <b>Equipment:</b> {draft.equipment.join(", ")}
      </div>
      <div>
        <b>Schedule:</b>{" "}
        {draft.schedule
          .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
          .join(", ")}
      </div>
      <div>
        <b>Goal:</b> {draft.goal} → {draft.targetWeightKg} kg by{" "}
        {draft.targetDate}
      </div>
      <div className="mt-3 opacity-70 text-xs">
        You can change any of this later in Settings.
      </div>
    </div>
  );
}
