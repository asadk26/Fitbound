import { EXERCISES, FAMILIES, getExercise, type ExerciseDefinition, type Family } from '../exercise/registry';
import type { WorkoutRecord } from './workout';

/**
 * Today's equipment and readiness, and the four-family loadout generated from
 * them. The rules, in order:
 *
 *  1. Never pick a movement that needs equipment you didn't confirm, one you
 *     excluded today, or (unless you opted in) an experimental one.
 *  2. Prefer movements that are stable or that you've checked in the Movement
 *     Lab. If a family has none, use a checked-later "beta" movement and mark
 *     it as a first-time check.
 *  3. Among those, vary things: movements that were demanding in your last
 *     session are less likely, and a reroll never returns the same pick when
 *     there's an alternative.
 *
 * A family with nothing eligible (e.g. every upper-body movement excluded)
 * sits out: its ability rests and the other three still win fights.
 */
export interface DayPrefs {
  dumbbells: boolean;
  /** A sturdy chair or bench for supported rows. */
  support: boolean;
  exclude: string[];
  intensity: 'easy' | 'normal' | 'strong';
  experimental: boolean;
  /** Sore today: go gentle on a family (lighter targets) or rest it (its ability sits out). */
  sore: Partial<Record<SoreArea, Soreness>>;
  /** When soreness was last set: it's about today, so it clears after a day. */
  soreAt?: number;
}

export type SoreArea = 'upper' | 'legs' | 'core';
export type Soreness = 'gentle' | 'rest';
export const SORE_AREAS: readonly SoreArea[] = ['upper', 'legs', 'core'];
/** Soreness is about today: after this long it's forgotten. */
export const SORE_TTL_MS = 20 * 3600_000;

export const DEFAULT_PREFS: DayPrefs = { dumbbells: false, support: false, exclude: [], intensity: 'normal', experimental: false, sore: {} };

/** Whether a family sits out today because it's sore. */
export function restingSore(f: Family, prefs: DayPrefs): boolean {
  return f !== 'cardio' && prefs.sore?.[f] === 'rest';
}

/**
 * How much of the usual target a family gets today because of soreness:
 * gentle is 60%; sore legs also ease cardio (mostly legs) to 80%.
 */
export function soreFactor(f: Family, prefs: DayPrefs): number {
  const s = prefs.sore ?? {};
  if (f === 'cardio') return s.legs ? 0.8 : 1;
  return s[f] === 'gentle' ? 0.6 : 1;
}

export type Calibrations = Record<string, { at: number; reps: number }>;

export interface Slot {
  exerciseId: string;
  /** Not yet checked on your setup: the first set doubles as the check. */
  firstCheck: boolean;
}

export type ExLoadout = Record<Family, Slot | null>;

export type Eligibility = { tier: 'ready' } | { tier: 'check'; reason: string } | { tier: 'blocked'; reason: string };

export function eligibility(ex: ExerciseDefinition, prefs: DayPrefs, cal: Calibrations): Eligibility {
  if (!ex.createDetector || ex.reliability === 'unavailable' || !ex.eligible.includes('combat')) return { tier: 'blocked', reason: 'No camera detector yet' };
  if (ex.equipment.includes('dumbbells') && !prefs.dumbbells) return { tier: 'blocked', reason: 'Needs dumbbells' };
  if (ex.needsSupport && !prefs.support) return { tier: 'blocked', reason: 'Needs a chair or bench' };
  if (prefs.exclude.includes(ex.id)) return { tier: 'blocked', reason: 'Resting today' };
  if (ex.reliability === 'experimental' && !prefs.experimental) return { tier: 'blocked', reason: 'Experimental (switch on to include)' };
  if (ex.reliability === 'stable' || cal[ex.id]) return { tier: 'ready' };
  return { tier: 'check', reason: 'Not checked on your setup yet — try it in the Movement Lab' };
}

/** How recently and how hard a movement was worked (0 = fresh). */
export function fatigue(id: string, history: WorkoutRecord[]): number {
  const recent = [...history].sort((a, b) => b.at - a.at);
  let f = 0;
  recent.slice(0, 2).forEach((r, i) => {
    const v = r.volume[id];
    if (!v) return;
    const heavy = v.sets >= 3 ? 1 : v.sets >= 2 ? 0.7 : 0.4;
    f += heavy * (i === 0 ? 1 : 0.5);
  });
  return f;
}

function pickWeighted<T>(items: { v: T; w: number }[], rng: () => number): T | null {
  const total = items.reduce((a, x) => a + x.w, 0);
  if (!items.length || total <= 0) return null;
  let r = rng() * total;
  for (const x of items) {
    r -= x.w;
    if (r <= 0) return x.v;
  }
  return items[items.length - 1].v;
}

export function pickForFamily(family: Family, prefs: DayPrefs, cal: Calibrations, history: WorkoutRecord[], rng: () => number, avoid?: string): Slot | null {
  if (restingSore(family, prefs)) return null;
  const all = EXERCISES.filter((e) => e.family === family).map((ex) => ({ ex, el: eligibility(ex, prefs, cal) }));
  const ready = all.filter((x) => x.el.tier === 'ready');
  // Experimental movements are never a silent first-time fallback.
  const check = all.filter((x) => x.el.tier === 'check' && x.ex.reliability === 'beta');
  const pool = ready.length ? ready : check;
  if (!pool.length) return null;
  const options = pool.length > 1 && avoid ? pool.filter((x) => x.ex.id !== avoid) : pool;
  const id = pickWeighted(
    options.map((x) => ({ v: x.ex.id, w: 1 / (1 + 2 * fatigue(x.ex.id, history)) })),
    rng,
  );
  return id ? { exerciseId: id, firstCheck: !ready.length } : null;
}

export function generateLoadout(prefs: DayPrefs, cal: Calibrations, history: WorkoutRecord[], rng: () => number = Math.random, keep: Partial<Record<Family, string>> = {}, avoid: Partial<Record<Family, string>> = {}): ExLoadout {
  const out = {} as ExLoadout;
  for (const f of FAMILIES) {
    const k = keep[f];
    if (restingSore(f, prefs)) out[f] = null;
    else if (k && eligibility(getExercise(k), prefs, cal).tier !== 'blocked') out[f] = { exerciseId: k, firstCheck: eligibility(getExercise(k), prefs, cal).tier === 'check' };
    else out[f] = pickForFamily(f, prefs, cal, history, rng, avoid[f]);
  }
  return out;
}

/** Reroll one family (a different movement when there's one to choose). */
export function rerollSlot(l: ExLoadout, family: Family, prefs: DayPrefs, cal: Calibrations, history: WorkoutRecord[], rng: () => number = Math.random): ExLoadout {
  return { ...l, [family]: pickForFamily(family, prefs, cal, history, rng, l[family]?.exerciseId) };
}

/** Reroll every family, avoiding the current picks where possible. */
export function rerollAll(l: ExLoadout, prefs: DayPrefs, cal: Calibrations, history: WorkoutRecord[], rng: () => number = Math.random): ExLoadout {
  const avoid = Object.fromEntries(FAMILIES.map((f) => [f, l[f]?.exerciseId])) as Partial<Record<Family, string>>;
  return generateLoadout(prefs, cal, history, rng, {}, avoid);
}

/** Other eligible movements for a family (for "swap one"). */
export function alternatives(family: Family, current: string | undefined, prefs: DayPrefs, cal: Calibrations): ExerciseDefinition[] {
  return EXERCISES.filter((e) => e.family === family && e.id !== current && eligibility(e, prefs, cal).tier === 'ready');
}

const INTENSITY = { easy: 0.7, normal: 1, strong: 1.25 };

/** A set's target: your own setting (or the default), scaled by today's readiness and soreness — never by enemy difficulty. */
export function setTarget(ex: ExerciseDefinition, prefs: DayPrefs, custom: Record<string, number> = {}): number {
  const base = custom[ex.id] ?? ex.range.default;
  return Math.max(ex.range.min, Math.min(ex.range.max, Math.round(base * INTENSITY[prefs.intensity] * soreFactor(ex.family, prefs))));
}
