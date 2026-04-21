/** Local ISO date (YYYY-MM-DD) — not UTC. */
export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive day count starting at 1 for the start date. */
export function dayNumber(startIso: string, today: Date = new Date()): number {
  const [y, m, d] = startIso.split("-").map((s) => parseInt(s, 10));
  const start = new Date(y, (m ?? 1) - 1, d ?? 1);
  const ms = today.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

/** ISO date N days from `fromIso` (N may be negative). */
export function addDaysIso(fromIso: string, n: number): string {
  const [y, m, d] = fromIso.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + n);
  return todayIso(dt);
}
