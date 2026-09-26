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
  /** Holds: the part of holdMs the player added as a correction (manual, not seen by the camera). */
  manualMs?: number;
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
  /** Physically active time outside the sets themselves, by kind (see workoutTime). */
  physical?: Partial<Record<PhysicalBucket, number>>;
  /** The Awakening this session: done fully, shortened, or skipped. */
  warmup?: { length: 'full' | 'short' | 'skipped'; completed: boolean };
}

/**
 * Workout time (bible §18), in six categories:
 *  1. warm-up (the Awakening)                    } the core target,
 *  2. core combat and physical recovery: sets and } ~20 ± 5 min per
 *     holds, dodging, recovery between sets,      } expedition
 *     physical setup (getting into position, camera checks)
 *  3. optional Haven / Stillpoint yoga (`recoveryMs`)  } total physical
 *  4. optional cooldown (the Heart's Rest)             } activity, shown
 *  5. other activity: marching you chose               } separately
 *  6. passive adventure (not recorded here): controller travel, choosing,
 *     dialogue, cutscenes, menus, paused time.
 * Optional activity never shrinks the core budget or makes it look longer.
 */
export type PhysicalBucket = 'warmup' | 'dodge' | 'recovery' | 'setup' | 'march' | 'cooldown';

export function addPhysical(w: WorkoutData, b: PhysicalBucket, ms: number): void {
  if (!(ms > 0)) return;
  const p = (w.physical ??= {});
  p[b] = (p[b] ?? 0) + ms;
}

export interface WorkoutTime {
  warmup: number;
  /** Sets and holds themselves (also part of core). */
  exercise: number;
  dodge: number;
  recovery: number;
  setup: number;
  /** Warm-up + exercise + dodging + recovery + setup: what the ~20-minute target is about. */
  core: number;
  /** Optional Haven / Stillpoint yoga and mobility. */
  optional: number;
  cooldown: number;
  /** Marching you chose. */
  march: number;
  /** Everything physical: core + optional + cooldown + marching. */
  total: number;
}

/** Workout time by category (bible §18). */
export function workoutTime(w: WorkoutData): WorkoutTime {
  const exercise = w.sets.reduce((a, s) => a + s.activeMs, 0);
  const p = w.physical ?? {};
  const warmup = p.warmup ?? 0;
  const dodge = p.dodge ?? 0;
  const recovery = p.recovery ?? 0;
  const setup = p.setup ?? 0;
  const core = warmup + exercise + dodge + recovery + setup;
  const optional = w.recoveryMs;
  const cooldown = p.cooldown ?? 0;
  const march = p.march ?? 0;
  return { warmup, exercise, dodge, recovery, setup, core, optional, cooldown, march, total: core + optional + cooldown + march };
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
  /** Core workout time (warm-up included) and, within it, time exercising (sets and holds), in minutes to one decimal. */
  workoutMin?: number;
  exerciseMin?: number;
  /** All physical activity, optional yoga, cooldown and marching included. */
  activeMin?: number;
  /** Warm-up done this session (the Awakening), minutes. */
  warmupMin?: number;
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
    workoutMin: Math.round(workoutTime(w).core / 6000) / 10,
    exerciseMin: Math.round(workoutTime(w).exercise / 6000) / 10,
    activeMin: Math.round(workoutTime(w).total / 6000) / 10,
    ...(workoutTime(w).warmup ? { warmupMin: Math.round(workoutTime(w).warmup / 6000) / 10 } : {}),
  };
}
