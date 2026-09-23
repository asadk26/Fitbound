import { bestSide, inclineFromHorizontal, inFrame, LM, SIDE } from '../exercise/geometry';
import type { PoseFrame } from '../exercise/types';
import { measure, NeutralCalibrator, type NeutralPose } from './motion';

/**
 * Hands-free setup, run once per session with the phone in its final spot.
 * Each check advances on its own when the camera sees it done:
 *
 *   body → arms → neutral → confirm → march → lean left → lean right →
 *   floor (push-up position) → stand up → done
 *
 * The floor check can be skipped with the left hand; the result is reported
 * so the trial can warn that push-ups may not track from this placement.
 *
 * This is the logic only. It runs wherever the camera is: in the game page
 * for single-device play, or on the phone in Connected Play (which sends its
 * state to the PC so the TV can show the same checklist).
 */
export type CalStep = 'body' | 'arms' | 'neutral' | 'confirm' | 'march' | 'leanL' | 'leanR' | 'floor' | 'stand' | 'done';

export const CAL_STEPS: { id: CalStep; title: string; say: string }[] = [
  { id: 'body', title: 'Step back until your whole body is in view', say: 'Step back until your whole body is in view, head to feet.' },
  { id: 'arms', title: 'Raise BOTH hands high', say: 'Raise both hands high above your head.' },
  { id: 'neutral', title: 'Stand still, arms down', say: 'Now stand still with your arms down.' },
  { id: 'confirm', title: 'Raise your RIGHT hand to confirm', say: 'Raise your right hand and hold it to confirm.' },
  { id: 'march', title: 'March in place', say: 'March in place. Lift your knees.' },
  { id: 'leanL', title: 'Lean to your LEFT', say: 'Lean to your left.' },
  { id: 'leanR', title: 'Lean to your RIGHT', say: 'Now lean to your right.' },
  { id: 'floor', title: 'Floor check: turn sideways and get into push-up position', say: 'Floor check. Turn sideways and get down into push-up position. Raise your left hand to skip.' },
  { id: 'stand', title: 'Great — stand back up, facing the phone', say: 'Great. Stand back up, facing the phone.' },
  { id: 'done', title: 'All set!', say: 'Calibration complete. Let the trial begin!' },
];

export const CAL_STEP_IDS = CAL_STEPS.map((s) => s.id);

export interface CalState {
  step: CalStep;
  progress: number;
  hint: string | null;
  floorOk: boolean;
}

const MARCH_STEPS = 6;

export class CalibrationFlow {
  state: CalState = { step: 'body', progress: 0, hint: null, floorOk: false };
  neutral: NeutralPose | null = null;
  private counter = 0;
  private steps = 0;
  private readonly cal = new NeutralCalibrator(30);

  constructor(
    /** Called whenever the step, progress or hint changes. */
    private readonly onChange: (s: CalState, stepChanged: boolean) => void,
    /** Called once the standing neutral has been measured. */
    private readonly onNeutral: (n: NeutralPose) => void,
  ) {}

  private set(patch: Partial<CalState>): void {
    const prev = this.state;
    const next = { ...prev, ...patch };
    if (next.step === prev.step && next.progress === prev.progress && next.hint === prev.hint && next.floorOk === prev.floorOk) return;
    this.state = next;
    this.onChange(next, next.step !== prev.step);
  }

  private go(step: CalStep): void {
    this.counter = 0;
    this.set({ step, progress: 0, hint: null });
  }

  private need(cond: boolean, frames: number): boolean {
    this.counter = cond ? this.counter + 1 : 0;
    this.set({ progress: Math.min(1, this.counter / frames) });
    return this.counter >= frames;
  }

  /** Feed one camera frame plus the motion reader's current lean direction. */
  frame(frame: PoseFrame | null, leanDir: -1 | 0 | 1): void {
    const s = this.state.step;
    if (s === 'body') {
      const q = frameIssue(frame);
      this.set({ hint: q });
      if (this.need(q === null, 20)) this.go('arms');
    } else if (s === 'arms') {
      const ok = !!frame && armsUpInFrame(frame);
      this.set({ hint: frame && !ok ? 'Both hands above your head — make sure they stay in the picture' : null });
      if (this.need(ok, 12)) this.go('neutral');
    } else if (s === 'neutral') {
      const res = this.cal.push(frame);
      this.set({ progress: res.progress, hint: res.still ? null : 'Stand still and relaxed, arms down' });
      if (res.neutral) {
        this.neutral = res.neutral;
        this.onNeutral(res.neutral);
        this.go('confirm');
      }
    } else if (s === 'leanL' || s === 'leanR') {
      const want = s === 'leanL' ? -1 : 1;
      if (this.need(leanDir === want, 12)) this.go(s === 'leanL' ? 'leanR' : 'floor');
    } else if (s === 'floor') {
      if (this.need(!!frame && onFloor(frame), 20)) {
        this.set({ floorOk: true });
        this.go('stand');
      }
    } else if (s === 'stand') {
      if (this.need(!!frame && measure(frame).fullBody && frameIssue(frame) === null, 15)) this.go('done');
    }
  }

  /** Gesture and footstep events from the motion reader. */
  event(type: 'confirm' | 'back' | 'step'): void {
    const s = this.state.step;
    if (s === 'confirm' && type === 'confirm') this.go('march');
    if (s === 'march' && type === 'step') {
      this.steps++;
      this.set({ progress: Math.min(1, this.steps / MARCH_STEPS) });
      if (this.steps >= MARCH_STEPS) this.go('leanL');
    }
    if (s === 'floor' && type === 'back') {
      this.set({ floorOk: false });
      this.go('stand');
    }
  }
}

/** Why the whole body isn't usable yet, or null if it is. */
export function frameIssue(f: PoseFrame | null): string | null {
  if (!f) return 'No one in view — step in front of the phone';
  const l = f.landmarks;
  const vis = (i: number) => l[i].visibility >= 0.5 && inFrame(l[i], f.aspect, 0);
  const head = vis(LM.NOSE);
  const feet = vis(LM.L_ANKLE) && vis(LM.R_ANKLE);
  if (!head && !feet) return 'Move farther from the phone';
  if (!feet) return 'Your feet are cut off — step back, or tilt the phone down';
  if (!head) return 'Your head is cut off — step back, or tilt the phone up';
  if (l[LM.NOSE].y < 0.04 || Math.max(l[LM.L_ANKLE].y, l[LM.R_ANKLE].y) > 0.97) return 'A little farther back, please — leave some room around you';
  return null;
}

export function armsUpInFrame(f: PoseFrame): boolean {
  const l = f.landmarks;
  const ok = (w: number) => l[w].visibility >= 0.5 && l[w].y < l[LM.NOSE].y - 0.03 && l[w].y > 0.01 && inFrame(l[w], f.aspect, 0);
  return ok(LM.L_WRIST) && ok(LM.R_WRIST);
}

/** Lying horizontally, side-on, with shoulder, hip and ankle visible. */
export function onFloor(f: PoseFrame): boolean {
  const l = f.landmarks;
  const side = SIDE[bestSide(l, ['shoulder', 'hip', 'ankle'])];
  const vis = [side.shoulder, side.hip, side.ankle].every((i) => l[i].visibility >= 0.5 && inFrame(l[i], f.aspect, 0));
  return vis && inclineFromHorizontal(l[side.shoulder], l[side.ankle]) < 40;
}
