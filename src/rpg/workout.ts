import { getExercise, type Family } from '../exercise/registry';

/**
 * The physical side of an expedition, recorded apart from the RPG. Every set
 * is logged as it ends — full, finished early, or cut short — and nothing here
 * is ever undone by a combat defeat, a reroll or quitting.
 *
 * "Verified" means counted by the camera. Manual counts are kept separately
 * and labelled as such.
 */
export interface SetRecord {
  exerciseId: string;
  family: Family;
  at: number;
  /** Camera-counted reps (reps exercises). */
  camera: number;
  manual: number;
  left: number;
  right: number;
  /** Hold exercises: verified hold time. */
  holdMs: number;
  target: number;
  full: boolean;
  /** The player chose "Finish set" before the target. */
  finishedEarly: boolean;
  /** Time in the active set (not setup, rests or combat). */
  activeMs: number;
}

export interface DodgeTally {
  dodged: number;
  hit: number;
  unclear: number;
}

export interface WorkoutData {
  id: string;
  startedAt: number;
  lastAt: number;
  sets: SetRecord[];
  dodges: DodgeTally;
  /** Minutes of guided recovery completed. */
  recoveryMs: number;
  intensity: 'easy' | 'normal' | 'strong';
  outcome: 'in-progress' | 'victory' | 'defeat' | 'suspended' | 'ended';
  /** Times the character fell (the workout carried on). */
  rpgDefeats: number;
  /** Planned sets for the session, for "workout complete" (not the RPG result). */
  plannedSets: number;
}

export interface ExerciseTotal {
  exerciseId: string;
  name: string;
  sets: number;
  camera: number;
  manual: number;
  left: number;
  right: number;
  holdMs: number;
}

export function newWorkout(intensity: WorkoutData['intensity'], plannedSets: number, now = Date.now()): WorkoutData {
  return { id: `w${now.toString(36)}`, startedAt: now, lastAt: now, sets: [], dodges: { dodged: 0, hit: 0, unclear: 0 }, recoveryMs: 0, intensity, outcome: 'in-progress', rpgDefeats: 0, plannedSets };
}

export function addSet(w: WorkoutData, r: SetRecord): void {
  w.sets.push(r);
  w.lastAt = r.at;
}

export function addDodge(w: WorkoutData, o: keyof DodgeTally): void {
  w.dodges[o]++;
}

export function totals(w: WorkoutData): ExerciseTotal[] {
  const by = new Map<string, ExerciseTotal>();
  for (const s of w.sets) {
    const t = by.get(s.exerciseId) ?? { exerciseId: s.exerciseId, name: safeName(s.exerciseId), sets: 0, camera: 0, manual: 0, left: 0, right: 0, holdMs: 0 };
    t.sets++;
    t.camera += s.camera;
    t.manual += s.manual;
    t.left += s.left;
    t.right += s.right;
    t.holdMs += s.holdMs;
    by.set(s.exerciseId, t);
  }
  return [...by.values()];
}

function safeName(id: string): string {
  try {
    return getExercise(id).name;
  } catch {
    return id;
  }
}

/** Sets that did some verified (or manual) work. */
export function workingSets(w: WorkoutData): number {
  return w.sets.filter((s) => s.camera + s.manual > 0 || s.holdMs >= 1000).length;
}

/** Time spent actually exercising (sets + recovery), versus total session time. */
export function activity(w: WorkoutData): { activeMs: number; sessionMs: number } {
  return { activeMs: w.sets.reduce((a, s) => a + s.activeMs, 0) + w.recoveryMs, sessionMs: Math.max(0, w.lastAt - w.startedAt) };
}

/** Workout completion (0..1), independent of whether the RPG run was won. */
export function completion(w: WorkoutData): number {
  return Math.min(1, workingSets(w) / Math.max(1, w.plannedSets));
}

/** A compact record kept in the save for the workout director's history. */
export interface WorkoutRecord {
  id: string;
  at: number;
  outcome: WorkoutData['outcome'];
  /** Sets and total verified work per exercise. */
  volume: Record<string, { sets: number; work: number }>;
}

export function toRecord(w: WorkoutData): WorkoutRecord {
  const volume: WorkoutRecord['volume'] = {};
  for (const s of w.sets) {
    const v = (volume[s.exerciseId] ??= { sets: 0, work: 0 });
    v.sets++;
    v.work += s.camera + s.manual + Math.floor(s.holdMs / 1000);
  }
  return { id: w.id, at: w.lastAt, outcome: w.outcome, volume };
}
