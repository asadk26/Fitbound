import { EXERCISES, FAMILIES, type Family } from '../exercise/registry';
import type { ProgressState } from './progression';
import type { WorkoutRecord } from './workout';

const DAY = 86_400_000;

export interface JournalSummary {
  /** The last 14 days, oldest first: sessions that day. */
  days: number[];
  activeDays: number;
  /** Days since the last session (null: none yet). */
  sinceLast: number | null;
  /** Work per family over the last 14 days. */
  families: Record<Family, { sets: number; work: number }>;
  /** Movements used in the last 28 days, most-used first. */
  movements: { id: string; sets: number; work: number; target: number; last?: ProgressState['history'][number] }[];
  /** Most recent sessions, newest first. */
  sessions: WorkoutRecord[];
}

/** What the Journal shows, from the saved history. */
export function summarize(history: WorkoutRecord[], targets: Record<string, number>, progress: Record<string, ProgressState>, now = Date.now()): JournalSummary {
  const dayOf = (t: number) => Math.floor((now - t) / DAY);
  const days = Array.from({ length: 14 }, () => 0);
  const families = Object.fromEntries(FAMILIES.map((f) => [f, { sets: 0, work: 0 }])) as JournalSummary['families'];
  const moves = new Map<string, { sets: number; work: number }>();
  const fam = new Map(EXERCISES.map((e) => [e.id, e.family]));
  for (const r of history) {
    const d = dayOf(r.at);
    if (d >= 0 && d < 14) days[13 - d]++;
    for (const [id, v] of Object.entries(r.volume)) {
      if (d < 14 && fam.has(id)) {
        families[fam.get(id)!].sets += v.sets;
        families[fam.get(id)!].work += v.work;
      }
      if (d < 28) {
        const m = moves.get(id) ?? { sets: 0, work: 0 };
        m.sets += v.sets;
        m.work += v.work;
        moves.set(id, m);
      }
    }
  }
  const last = history.length ? Math.max(...history.map((r) => r.at)) : null;
  const def = new Map(EXERCISES.map((e) => [e.id, e.range.default]));
  return {
    days,
    activeDays: days.filter((n) => n > 0).length,
    sinceLast: last === null ? null : dayOf(last),
    families,
    movements: [...moves.entries()]
      .filter(([id]) => def.has(id))
      .sort((a, b) => b[1].sets - a[1].sets)
      .map(([id, m]) => ({ id, ...m, target: targets[id] ?? def.get(id)!, last: progress[id]?.history.at(-1) })),
    sessions: [...history].sort((a, b) => b.at - a.at).slice(0, 8),
  };
}
