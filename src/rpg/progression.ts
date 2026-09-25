import { getExercise, type ExerciseDefinition } from '../exercise/registry';
import { soreFactor, type DayPrefs } from './loadout';
import type { Feedback, SetRecord, WorkoutData } from './workout';

/**
 * Target progression: how your per-set targets change between sessions.
 *
 * It learns from what you *did*, not from surveys:
 *   - whether each set reached its target, or you finished it early;
 *   - whether your pace slowed a lot from the first set of a movement to the last;
 *   - and, only if you answered it, the end-of-run check-in ("too easy / about
 *     right / too hard").
 *
 * The rules are simple and deliberately slow to go up, quick to come down:
 *   - UP one step after two sessions in a row where every set was full and
 *     the pace held (one session is enough if you said it felt too easy).
 *   - DOWN one step after a session where you finished half or more of a
 *     movement's sets early or short, or said it was too hard and it showed.
 *   - Otherwise it holds.
 *   - Sore days and "Take it easy" days never raise a target; "Strong" days
 *     never lower one (you asked for more than usual).
 *
 * A step is one rep (two above 12), or 5 seconds for holds, always within the
 * movement's range. Changes apply to the *next* session, never mid-run, and
 * the summary lists them with a one-tap "keep" — nothing else ever asks.
 */

export type Verdict = 'up' | 'hold' | 'down';

export interface Evidence {
  sets: number;
  full: number;
  /** Sets finished early or ending short of the target. */
  short: number;
  /** Mean done ÷ target across sets (sided: the weaker side). */
  completion: number;
  /** Time per rep (or per held second) in the last set ÷ the first; null with one set. */
  slowdown: number | null;
}

export interface ProgressState {
  /** Sessions in a row that earned an "up". */
  streak: number;
  /** Past changes, newest last (kept short). */
  history: { at: number; from: number; to: number; why: string }[];
}

export interface Proposal {
  exerciseId: string;
  from: number;
  to: number;
  verdict: Verdict;
  why: string;
}

function done(s: SetRecord, ex: ExerciseDefinition): number {
  if (ex.kind === 'hold') return s.holdMs / 1000;
  if (ex.sided) return Math.min(s.left, s.right);
  return s.camera + s.manual;
}

/** What the sets of each movement in a session say. */
export function evidence(w: WorkoutData): Record<string, Evidence> {
  const by = new Map<string, SetRecord[]>();
  for (const s of w.sets) by.set(s.exerciseId, [...(by.get(s.exerciseId) ?? []), s]);
  const out: Record<string, Evidence> = {};
  for (const [id, sets] of by) {
    let ex: ExerciseDefinition;
    try {
      ex = getExercise(id);
    } catch {
      continue;
    }
    const ratio = sets.map((s) => Math.min(1.2, done(s, ex) / Math.max(1, s.target)));
    const pace = (s: SetRecord) => {
      const d = done(s, ex);
      return d > 0 ? s.activeMs / d : null;
    };
    const first = pace(sets[0]);
    const last = pace(sets[sets.length - 1]);
    out[id] = {
      sets: sets.length,
      full: sets.filter((s, i) => s.full || ratio[i] >= 1).length,
      short: sets.filter((s, i) => s.finishedEarly || ratio[i] < 1).length,
      completion: ratio.reduce((a, r) => a + r, 0) / sets.length,
      slowdown: sets.length >= 2 && first && last ? last / first : null,
    };
  }
  return out;
}

/** One movement's verdict for this session, and why (in plain words). */
export function judge(e: Evidence, ctx: { effort?: Feedback['effort']; intensity: DayPrefs['intensity']; sore: boolean }): { v: Verdict; why: string; quick: boolean } {
  const allFull = e.full === e.sets && e.short === 0;
  const steady = e.slowdown === null || e.slowdown <= 1.35;
  const struggled = e.short * 2 >= e.sets && e.completion < 0.85;
  if (ctx.sore) return { v: 'hold', why: 'sore today', quick: false };
  if (struggled || (ctx.effort === 'hard' && (!allFull || (e.slowdown ?? 1) > 1.5))) {
    if (ctx.intensity === 'strong') return { v: 'hold', why: 'a Strong day — no change', quick: false };
    return { v: 'down', why: struggled ? 'several sets finished early or short' : 'you said it was too hard', quick: true };
  }
  if (allFull && steady && e.sets >= 2 && ctx.effort !== 'hard') {
    if (ctx.intensity === 'easy') return { v: 'hold', why: 'a Take-it-easy day', quick: false };
    return { v: 'up', why: ctx.effort === 'easy' ? 'every set full, and it felt too easy' : 'every set full at a steady pace', quick: ctx.effort === 'easy' };
  }
  return { v: 'hold', why: 'about right', quick: false };
}

function step(ex: ExerciseDefinition, base: number): number {
  return ex.kind === 'hold' ? 5 : base >= 12 ? 2 : 1;
}

/**
 * What changes after this session. `targets` are your own per-movement
 * targets (before today's readiness scaling); `progress` is each movement's
 * streak so far. Returns the proposals and the updated streaks.
 */
export function propose(
  w: WorkoutData,
  prefs: DayPrefs,
  targets: Record<string, number>,
  progress: Record<string, ProgressState>,
  fb?: Feedback,
): { proposals: Proposal[]; progress: Record<string, ProgressState> } {
  const next: Record<string, ProgressState> = structuredClone(progress);
  const proposals: Proposal[] = [];
  for (const [id, e] of Object.entries(evidence(w))) {
    const ex = getExercise(id);
    const sore = soreFactor(ex.family, prefs) < 1;
    const { v, why, quick } = judge(e, { effort: fb?.effort, intensity: prefs.intensity, sore });
    const st = (next[id] ??= { streak: 0, history: [] });
    const base = targets[id] ?? ex.range.default;
    if (v === 'up') {
      st.streak++;
      if (st.streak >= 2 || quick) {
        const to = Math.min(ex.range.max, base + step(ex, base));
        if (to !== base) proposals.push({ exerciseId: id, from: base, to, verdict: 'up', why });
        st.streak = 0;
      }
    } else {
      st.streak = 0;
      if (v === 'down') {
        const to = Math.max(ex.range.min, base - step(ex, base));
        if (to !== base) proposals.push({ exerciseId: id, from: base, to, verdict: 'down', why });
      }
    }
  }
  return { proposals, progress: next };
}

/** Apply the proposals you kept to your targets, and note them in each movement's history. */
export function applyProposals(targets: Record<string, number>, progress: Record<string, ProgressState>, kept: Proposal[], at = Date.now()): void {
  for (const p of kept) {
    targets[p.exerciseId] = p.to;
    const st = (progress[p.exerciseId] ??= { streak: 0, history: [] });
    st.history = [...st.history, { at, from: p.from, to: p.to, why: p.why }].slice(-12);
  }
}
