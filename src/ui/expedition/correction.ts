import type { ExerciseDefinition } from '../../exercise/registry';
import type { SetResult } from './setRunner';

/**
 * The player's correction after a set the camera under-counted (bible §15):
 * `n` repetitions (or seconds, for holds) it missed. They're added as manual
 * work, always distinguishable from what the camera counted. Sided sets
 * credit the side that is behind first.
 */
export function applyCorrection(r: SetResult, ex: Pick<ExerciseDefinition, 'kind' | 'sided'>, n: number): SetResult {
  if (!(n > 0)) return r;
  if (ex.kind === 'hold') {
    const holdMs = r.holdMs + n * 1000;
    const done = Math.floor(holdMs / 1000);
    return { ...r, holdMs, done, manualMs: (r.manualMs ?? 0) + n * 1000, full: done >= r.target };
  }
  const out: SetResult = { ...r, manual: r.manual + n, done: r.done + n };
  if (ex.sided) {
    const sides = { ...(r.sides ?? { left: 0, right: 0 }) };
    for (let i = 0; i < n; i++) {
      if (sides.left <= sides.right) sides.left++;
      else sides.right++;
    }
    out.sides = sides;
    out.full = Math.min(sides.left, sides.right) >= r.target;
  } else out.full = out.done >= r.target;
  return out;
}

/** How many the camera could have missed: up to the target (per side for sided sets). */
export function missing(r: SetResult, ex: Pick<ExerciseDefinition, 'kind' | 'sided'>): number {
  if (ex.kind === 'hold') return Math.max(0, r.target - Math.floor(r.holdMs / 1000));
  if (ex.sided && r.sides) return Math.max(0, r.target - r.sides.left) + Math.max(0, r.target - r.sides.right);
  return Math.max(0, r.target - r.done);
}
