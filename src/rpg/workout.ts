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
  /** Split holds (side planks): the camera-counted part of holdMs per side, ms. */
  holdSides?: { left: number; right: number };
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
  /** Marching between encounters: steps, and board distance marched vs moved with a controller. */
  march?: { steps: number; active: number; assisted: number };
  /** Wall-clock time by part of the run, for pacing: marching, encounters (fights, Mirror, Haven…), and everything else. */
  time?: Partial<Record<TimeBucket, number>>;
  /** Each strike: its height, how it was cued, and the result. */
  dodgeLog?: DodgeEntry[];
}

export type TimeBucket = 'march' | 'encounters' | 'other';

export interface DodgeEntry {
  h: 'high' | 'low';
  cues: string;
  o: keyof DodgeTally;
}

export function addTime(w: WorkoutData, bucket: TimeBucket, ms: number): void {
  if (!(ms > 0)) return;
  const t = (w.time ??= {});
  t[bucket] = (t[bucket] ?? 0) + ms;
}

/**
 * Where the run's time went. Sets and Haven are measured directly; the rest
 * of an encounter is choosing, dodging, resting and the enemy's turn.
 */
export function pacing(w: WorkoutData): { sets: number; haven: number; between: number; march: number; other: number; total: number } {
  const sets = w.sets.reduce((a, s) => a + s.activeMs, 0);
  const t = w.time ?? {};
  const enc = t.encounters ?? 0;
  const haven = w.recoveryMs;
  const between = Math.max(0, enc - sets - haven);
  const march = t.march ?? 0;
  const other = t.other ?? 0;
  return { sets, haven, between, march, other, total: Math.max(enc, sets + haven) + march + other };
}

export function addMarch(w: WorkoutData, steps: number, active: number, assisted: number): void {
  const m = (w.march ??= { steps: 0, active: 0, assisted: 0 });
  m.steps += steps;
  m.active += active;
  m.assisted += assisted;
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

export function addDodge(w: WorkoutData, o: keyof DodgeTally, detail?: Omit<DodgeEntry, 'o'>): void {
  w.dodges[o]++;
  if (detail) (w.dodgeLog ??= []).push({ ...detail, o });
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
  /** The expedition this session belonged to (an expedition can span several sessions). */
  expedition?: string;
  at: number;
  outcome: WorkoutData['outcome'];
  /** Sets and total verified work per exercise (split holds: also seconds per side, camera-counted). */
  volume: Record<string, { sets: number; work: number; sides?: { left: number; right: number } }>;
  /** The player's own check-in after the run, if given. */
  feedback?: Feedback;
  /** Minutes the session took (wall clock) and how many sets did work. */
  minutes?: number;
  sets?: number;
  intensity?: WorkoutData['intensity'];
  /** Areas that were sore that day. */
  sore?: string[];
  /** Steps marched between fights. */
  steps?: number;
}

/** A quick post-run check-in. Every answer is optional. */
export interface Feedback {
  effort?: 'easy' | 'right' | 'hard';
  fun?: 'meh' | 'good' | 'great';
  pacing?: 'slow' | 'right' | 'rushed';
}

export function toRecord(w: WorkoutData, sore: string[] = []): WorkoutRecord {
  const volume: WorkoutRecord['volume'] = {};
  for (const s of w.sets) {
    const v = (volume[s.exerciseId] ??= { sets: 0, work: 0 });
    v.sets++;
    v.work += s.camera + s.manual + Math.floor(s.holdMs / 1000);
    if (s.holdSides) {
      const sd = (v.sides ??= { left: 0, right: 0 });
      sd.left += Math.floor(s.holdSides.left / 1000);
      sd.right += Math.floor(s.holdSides.right / 1000);
    }
  }
  return {
    id: w.id,
    at: w.lastAt,
    outcome: w.outcome,
    volume,
    minutes: Math.round(pacing(w).total / 60000) || Math.round(Math.max(0, w.lastAt - w.startedAt) / 60000),
    sets: workingSets(w),
    intensity: w.intensity,
    ...(sore.length ? { sore } : {}),
    ...(w.march?.steps ? { steps: w.march.steps } : {}),
  };
}
