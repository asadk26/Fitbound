import { dist, LM, meanVisibility, mid } from '../exercise/geometry';
import type { Landmark, PoseFrame } from '../exercise/types';

/**
 * A pause gesture that is safe *during* an exercise set.
 *
 * "Both hands up" is the everyday pause gesture, but it can't be used as-is
 * mid-set: it is the top of every jumping jack, and nobody can raise both
 * hands while in a push-up. So each exercise gets a variant that its own
 * repetitions never produce:
 *
 *   - squats:        both hands high above the head, held 1 s. Squats keep
 *                    the hands at chest height or lower.
 *   - jumping jacks: both hands high, feet together and hands still, held
 *                    1.5 s. A jack's arms-up moment has the feet apart and
 *                    lasts a fraction of a second.
 *   - push-ups and
 *     other floor
 *     exercises:     stand up, then both hands high, held 1 s. It can't
 *                    happen while on the floor, and standing up alone
 *                    doesn't pause.
 *
 * Like every gesture, it must start from hands down, so hands still raised
 * when a set begins don't count. For a pause that works while lying on the
 * floor, use the touchscreen, keyboard (P), a gamepad's Start button or —
 * later — voice.
 */
export interface PausePolicy {
  holdMs: number;
  feetTogether: boolean;
  still: boolean;
  standing: boolean;
}

export const PAUSE_POLICIES: Record<string, PausePolicy> = {
  squat: { holdMs: 1000, feetTogether: false, still: false, standing: false },
  jumping_jack: { holdMs: 1500, feetTogether: true, still: true, standing: false },
  pushup: { holdMs: 1000, feetTogether: false, still: false, standing: true },
  plank: { holdMs: 1000, feetTogether: false, still: false, standing: true },
  // Curls stop at the shoulders and lunges keep the hands low: a plain hands-high hold.
  bicep_curl: { holdMs: 1000, feetTogether: false, still: false, standing: false },
  reverse_lunge: { holdMs: 1000, feetTogether: false, still: false, standing: false },
  // Arms pump during high knees; cross crunches start with hands behind the head.
  high_knees: { holdMs: 1500, feetTogether: true, still: true, standing: false },
  cross_crunch: { holdMs: 1500, feetTogether: true, still: true, standing: false },
  goblet_squat: { holdMs: 1000, feetTogether: false, still: false, standing: false },
  sumo_squat: { holdMs: 1000, feetTogether: false, still: false, standing: false },
  lateral_raise: { holdMs: 1000, feetTogether: false, still: false, standing: false },
  // Presses end with the hands overhead: only a long, still hold with the feet together pauses.
  overhead_press: { holdMs: 3000, feetTogether: true, still: true, standing: false },
  skaters: { holdMs: 1500, feetTogether: true, still: true, standing: false },
  butt_kicks: { holdMs: 1500, feetTogether: true, still: true, standing: false },
  punch_front: { holdMs: 1500, feetTogether: true, still: true, standing: false },
  punch_side: { holdMs: 1500, feetTogether: true, still: true, standing: false },
};

const DEFAULT_POLICY: PausePolicy = { holdMs: 1200, feetTogether: false, still: false, standing: true };

export function pausePolicy(exerciseId: string): PausePolicy {
  return PAUSE_POLICIES[exerciseId] ?? DEFAULT_POLICY;
}

export class ExercisePauseGesture {
  private since: number | null = null;
  private armed = false;
  private downSince: number | null = null;
  private lastWrists: { l: Landmark; r: Landmark } | null = null;
  private fired = false;
  progress = 0;

  constructor(readonly policy: PausePolicy) {}

  reset(): void {
    this.since = null;
    this.armed = false;
    this.downSince = null;
    this.lastWrists = null;
    this.fired = false;
    this.progress = 0;
  }

  /** Feed a frame; returns true on the one frame the pause fires. */
  update(frame: PoseFrame | null, now: number): boolean {
    const p = this.policy;
    if (!frame) {
      this.since = null;
      this.progress = 0;
      return false;
    }
    const l = frame.landmarks;
    const vis = (i: number) => l[i].visibility >= 0.5;
    const shoulders = mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
    const hips = mid(l[LM.L_HIP], l[LM.R_HIP]);
    const torso = Math.max(dist(shoulders, hips), 1e-3);
    const nose = l[LM.NOSE];
    const high = (w: number) => vis(w) && (nose.y - l[w].y) / torso >= 0.15;
    const handsUp = high(LM.L_WRIST) && high(LM.R_WRIST);
    const handsDown = (!vis(LM.L_WRIST) || l[LM.L_WRIST].y > shoulders.y) && (!vis(LM.R_WRIST) || l[LM.R_WRIST].y > shoulders.y);

    // Arm only after both hands have been down for a moment.
    if (handsDown) {
      this.downSince ??= now;
      if (now - this.downSince >= 250) this.armed = true;
    } else this.downSince = null;

    let ok = handsUp && meanVisibility(l, [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP]) >= 0.5;
    if (ok && p.standing) {
      // Upright: hips well below shoulders and knees below hips.
      const knees = mid(l[LM.L_KNEE], l[LM.R_KNEE]);
      const upright = hips.y - shoulders.y > torso * 0.8 && knees.y > hips.y;
      ok = upright;
    }
    if (ok && p.feetTogether) {
      const hipW = Math.max(dist(l[LM.L_HIP], l[LM.R_HIP]), 1e-3);
      ok = vis(LM.L_ANKLE) && vis(LM.R_ANKLE) && Math.abs(l[LM.L_ANKLE].x - l[LM.R_ANKLE].x) < hipW * 1.8;
    }
    if (ok && p.still && this.lastWrists) {
      const moved = Math.max(dist(this.lastWrists.l, l[LM.L_WRIST]), dist(this.lastWrists.r, l[LM.R_WRIST])) / torso;
      // Per frame, a jack's arms move several times this.
      ok = moved < 0.08;
    }
    this.lastWrists = { l: l[LM.L_WRIST], r: l[LM.R_WRIST] };

    if (!ok || !this.armed) {
      this.since = null;
      this.progress = 0;
      if (!ok) this.fired = false;
      return false;
    }
    this.since ??= now;
    this.progress = Math.min(1, (now - this.since) / p.holdMs);
    if (this.progress >= 1 && !this.fired) {
      this.fired = true;
      this.armed = false;
      return true;
    }
    return false;
  }
}
