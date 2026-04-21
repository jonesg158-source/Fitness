"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { db } from "@/lib/db/schema";
import { useCryptoSession } from "@/lib/crypto/session";
import { decryptNumber } from "@/lib/crypto/pin";

type Point = { date: string; kg: number; trend?: number };

/** Exp-weighted moving average — matches the spec's α = 0.1. */
function trendWeights(points: Point[], alpha = 0.1): Point[] {
  let t = points[0]?.kg;
  return points.map((p) => {
    t = t == null ? p.kg : alpha * p.kg + (1 - alpha) * t;
    return { ...p, trend: Number(t.toFixed(2)) };
  });
}

export default function ProgressPage() {
  const { dek } = useCryptoSession();
  const profile = useLiveQuery(() => db.profile.get("me"), []);
  const rows = useLiveQuery(() => db.dailyWeight.orderBy("date").toArray(), []);
  const [data, setData] = useState<Point[]>([]);

  useEffect(() => {
    if (!dek || !rows) return;
    (async () => {
      const out: Point[] = [];
      for (const r of rows) {
        try {
          const kg = await decryptNumber(dek, r.weightKg);
          out.push({ date: r.date, kg: Number(kg.toFixed(2)) });
        } catch {
          /* skip unreadable */
        }
      }
      setData(trendWeights(out));
    })();
  }, [dek, rows]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const first = data[0];
    const last = data[data.length - 1];
    const delta = (last.trend ?? last.kg) - first.kg;
    return {
      first: first.kg,
      last: last.kg,
      trendLast: last.trend ?? last.kg,
      delta,
    };
  }, [data]);

  return (
    <div className="px-5 py-6 space-y-5">
      <h1 className="text-2xl font-bold">Progress</h1>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-wider opacity-60">
            Weight trend
          </div>
          {stats && (
            <div className="text-sm opacity-80">
              {stats.delta >= 0 ? "+" : ""}
              {stats.delta.toFixed(2)} kg since start
            </div>
          )}
        </div>

        {data.length === 0 ? (
          <div className="py-10 text-center text-sm opacity-60">
            Log your weight daily to see the trend here.
          </div>
        ) : (
          <div className="h-64 -mx-2 mt-2">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10 }}
                  width={36}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="kg"
                  name="Daily"
                  stroke="#93c5fd"
                  dot={false}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  name="Trend"
                  stroke="#2563eb"
                  dot={false}
                  strokeWidth={2.5}
                />
                {profile && (
                  <ReferenceLine
                    y={profile.targetWeightKg}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `Target ${profile.targetWeightKg} kg`,
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="text-xs uppercase opacity-60 tracking-wider">
          Progress photos
        </div>
        <div className="mt-1 text-sm opacity-80">
          Weekly progress photos (front / side / back), encrypted on-device,
          land here in Phase 5.
        </div>
      </section>
    </div>
  );
}
