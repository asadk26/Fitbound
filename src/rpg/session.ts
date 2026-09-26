import { FAMILIES, getExercise } from '../exercise/registry';
import type { EngineSnapshot, PendingStrike } from './engine';
import { plannedSets, type ExpeditionState } from './expedition';
import { restingSore, setTarget, type DayPrefs, type ExLoadout } from './loadout';
import { newWorkout, toRecord, workingSets, type WorkoutRecord } from './workout';

/**
 * Workout sessions within an expedition (bible §18).
 *
 * An expedition is one RPG attempt; it may span several real sittings. Each
 * sitting is its own workout session with its own readiness, sets, record,
 * Journal row and target progression. `x.workout` is always the *current*
 * session; earlier sessions are already in the save's history and are only
 * summarised here, for the expedition's own progress display.
 */

/** A fight saved at a safe point. */
export interface BattleSave {
  /** The route node this fight belongs to. */
  index: number;
  engine: EngineSnapshot;
  /**
   * Where the fight stands: the player's turn ('choose'), the ability landed
   * and the enemies are yet to act ('ready'), or the enemies acted and these
   * strikes are still to be dodged ('strikes').
   */
  phase: 'choose' | 'ready' | 'strikes';
  strikes?: PendingStrike[];
  /** A staged boss: which stage this save belongs to. */
  stage?: number;
}

/** Local calendar day, e.g. "2026-09-26". */
export function dayOf(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returning on a different day than the last session: ask how you feel before anything physical. */
export function needsReadiness(x: ExpeditionState, now = Date.now()): boolean {
  return dayOf(x.workout.lastAt || x.workout.startedAt) !== dayOf(now);
}

/** Whether a session did anything worth a history row. */
export function hasWork(x: ExpeditionState): boolean {
  return x.workout.sets.length > 0 || x.workout.recoveryMs > 0 || (x.workout.march?.steps ?? 0) > 0;
}

/** The session's history row (the expedition it belongs to is noted). */
export function sessionRecord(x: ExpeditionState): WorkoutRecord {
  return { ...toRecord(x.workout, Object.keys(x.prefs.sore ?? {})), expedition: x.id };
}

/** Add or replace a session's row in the history (a session is never counted twice). */
export function upsertRecord(history: WorkoutRecord[], rec: WorkoutRecord, keep = 60): WorkoutRecord[] {
  const i = history.findIndex((r) => r.id === rec.id);
  if (i < 0) return [...history, rec].slice(-keep);
  const out = [...history];
  // The player's check-in answers survive a re-record.
  out[i] = { ...rec, ...(history[i].feedback ? { feedback: history[i].feedback } : {}) };
  return out;
}

/**
 * Start a new session on a resumed expedition: the previous session is folded
 * into the expedition's running totals and a fresh workout begins. Nothing is
 * repeated; the fight, HP, blessings and loadout carry on.
 */
export function startSession(x: ExpeditionState, now = Date.now()): ExpeditionState {
  const earlier = x.earlier ?? { sessions: [], sets: 0 };
  const prev = x.workout;
  const folded = hasWork(x) && !earlier.sessions.includes(prev.id) ? { sessions: [...earlier.sessions, prev.id], sets: earlier.sets + workingSets(prev) } : earlier;
  return {
    ...x,
    earlier: folded,
    status: 'active',
    workout: newWorkout(x.prefs.intensity, plannedSets(x), now),
  };
}

/** Sets done across the whole expedition so far (all sessions). */
export function expeditionSets(x: ExpeditionState): number {
  return (x.earlier?.sets ?? 0) + workingSets(x.workout);
}

/**
 * Today's readiness applied to a resumed expedition: new prefs, targets
 * recomputed from your own targets (never raised for resuming), and the same
 * loadout (families resting today simply sit out; see activeLoadout).
 */
export function applyReadiness(x: ExpeditionState, prefs: DayPrefs, custom: Record<string, number>): ExpeditionState {
  const targets: Record<string, number> = { ...x.targets };
  for (const slot of Object.values(x.loadout)) if (slot) targets[slot.exerciseId] = setTarget(getExercise(slot.exerciseId), prefs, custom);
  return { ...x, prefs, targets, workout: { ...x.workout, intensity: prefs.intensity } };
}

/** The loadout for today: a family you're resting (sore) sits out; the saved loadout is kept for later sessions. */
export function activeLoadout(x: ExpeditionState): ExLoadout {
  const out = { ...x.loadout };
  for (const f of FAMILIES) if (restingSore(f, x.prefs)) out[f] = null;
  return out;
}
