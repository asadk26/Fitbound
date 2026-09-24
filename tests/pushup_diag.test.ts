import { describe, expect, it } from 'vitest';
import { diagLines, SetDiagnostics } from '../src/exercise/diagnostics';
import { PushupDetector, PUSHUP_DEFAULTS } from '../src/exercise/detectors/pushup';
import { inclineFromHorizontal, LM } from '../src/exercise/geometry';
import { levelFrame } from '../src/exercise/level';
import { getExercise } from '../src/exercise/registry';
import { ExerciseSessionController } from '../src/exercise/session';
import type { DetectorUpdate, PoseFrame } from '../src/exercise/types';
import { NeutralCalibrator } from '../src/input/motion';
import { cycle, FRAME_MS, hold, pushupPose, ramp, standPose } from '../src/testing/poses';

type F = (t: number) => PoseFrame | null;
const push = (angles: number[], opts?: Parameters<typeof pushupPose>[2]): F[] => angles.map((a) => (t: number) => pushupPose(a, t, opts));

function run(d: PushupDetector, frames: F[]) {
  let t = 0;
  const out: DetectorUpdate[] = [];
  for (const f of frames) {
    t += FRAME_MS;
    out.push(d.update(f(t), t));
  }
  return { out, reps: out.filter((u) => u.repCompleted).length, events: out.map((u) => u.diag?.event).filter(Boolean) };
}

/** Rotate a frame about the image centre by deg (a tilted phone). */
function rotate(f: PoseFrame, deg: number): PoseFrame {
  return levelFrame(f, -deg)!;
}

describe('push-up robustness', () => {
  it('one noisy out-of-position frame no longer throws away a rep in progress', () => {
    const angles = [...hold(170, 10), ...cycle(170, 80)];
    const frames = push(angles);
    // A single garbage frame (looks like a standing body) right at the bottom.
    frames.splice(10 + 17, 0, (t) => standPose(t));
    expect(run(new PushupDetector(), frames).reps).toBe(1);
  });

  it('a sustained break out of position still discards the rep (and says so)', () => {
    const frames = [...push([...hold(170, 10), ...ramp(170, 80, 15)]), ...Array.from({ length: 20 }, () => (t: number) => standPose(t)), ...push(ramp(80, 170, 15))];
    const r = run(new PushupDetector(), frames);
    expect(r.reps).toBe(0);
    expect(r.events).toContain('reset-mid-rep');
  });

  it("learns the player's own extended-arm angle when straight arms read low from a floor-level camera", () => {
    const angles = [...hold(142, 25)];
    for (let i = 0; i < 3; i++) angles.push(...cycle(142, 80), ...hold(142, 5));
    expect(run(new PushupDetector(), push(angles)).reps).toBe(3);
    // Without the calibrated top, the arms never reach the fixed 150° threshold.
    expect(run(new PushupDetector({ ...PUSHUP_DEFAULTS, adaptiveTop: false }), push(angles)).reps).toBe(0);
  });

  it('keeps the same required depth: a shallow dip from a learned top does not count', () => {
    const angles = [...hold(142, 25), ...cycle(142, 105), ...hold(142, 5)];
    const r = run(new PushupDetector(), push(angles));
    expect(r.reps).toBe(0);
    expect(r.events).toContain('partial-depth');
  });

  it('never learns a "top" from bent arms or a low hold', () => {
    const r = run(new PushupDetector(), push(hold(120, 60)));
    expect(r.out.every((u) => u.phase === 'SETUP')).toBe(true);
    expect(r.out.at(-1)!.diag?.blocker).toBe('ARMS_NOT_STRAIGHT');
  });

  it('standing arm movements still never count', () => {
    const frames: F[] = Array.from({ length: 200 }, (_, i) => (t: number) => standPose(t, { rightHand: i % 40 < 20 ? 'shoulder' : 'down', leftHand: i % 40 < 20 ? 'shoulder' : 'down' }));
    expect(run(new PushupDetector(), frames).reps).toBe(0);
  });
});

describe('push-up diagnostics', () => {
  it('reports a rep that went back down without returning to the top', () => {
    const angles = [...hold(170, 10), ...ramp(170, 80, 15), ...ramp(80, 125, 8), ...ramp(125, 80, 8), ...ramp(80, 170, 15)];
    const r = run(new PushupDetector(), push(angles));
    expect(r.events).toContain('no-return');
    expect(r.reps).toBe(1); // the second push back up completes it
  });

  it('distinguishes tracking lost mid-rep (could not assess) from an incomplete rep', () => {
    const frames = [...push([...hold(170, 10), ...ramp(170, 80, 15)]), ...Array.from({ length: 25 }, () => () => null)];
    const r = run(new PushupDetector(), frames);
    expect(r.events).toContain('lost-mid-rep');
    expect(r.events).not.toContain('partial-depth');
  });

  it('names the blocker when landmarks are hidden', () => {
    const r = run(new PushupDetector(), push(hold(170, 30), { vis: 0.2 }));
    expect(['ARMS_HIDDEN', 'BODY_HIDDEN']).toContain(r.out.at(-1)!.diag?.blocker);
  });

  it('summarises a set that could not begin, and one with incomplete reps', () => {
    const d = new SetDiagnostics();
    const s = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 5, () => {});
    let t = 0;
    for (const a of hold(120, 150)) {
      t += FRAME_MS;
      const sn = s.update(pushupPose(a, t), t);
      d.feed(sn.last, sn.stage, t);
    }
    const sum = d.summary();
    expect(sum.started).toBe(false);
    expect(sum.startBlocker).toBe('ARMS_NOT_STRAIGHT');
    expect(diagLines(sum)[0]).toMatch(/Starting pose not detected/);

    const d2 = new SetDiagnostics();
    const s2 = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 5, () => {});
    const angles = [...hold(170, 130), ...cycle(170, 80), ...cycle(170, 125), ...cycle(170, 125), ...hold(170, 5)];
    t = 0;
    for (const a of angles) {
      t += FRAME_MS;
      const sn = s2.update(pushupPose(a, t), t);
      d2.feed(sn.last, sn.stage, t);
    }
    const sum2 = d2.summary();
    expect(sum2.counted).toBe(1);
    expect(sum2.events['partial-depth']).toBe(2);
    expect(diagLines(sum2)).toContain('2× Lowering depth not reached');
  });
});

describe('camera roll', () => {
  it('calibration measures the roll from the upright standing torso', () => {
    const cal = new NeutralCalibrator(20);
    let n = null;
    for (let i = 0; i < 30 && !n; i++) n = cal.push(rotate(standPose(i * FRAME_MS), 12)).neutral;
    expect(n?.rollDeg).toBeCloseTo(12, 0);
  });

  it('levelling undoes a tilted phone before the detectors see the frame', () => {
    const f = pushupPose(170, 0);
    const tilted = rotate(f, 20);
    const l = f.landmarks;
    const incl = (x: PoseFrame) => inclineFromHorizontal(x.landmarks[LM.L_SHOULDER], x.landmarks[LM.L_HIP]);
    expect(Math.abs(incl(tilted) - incl(f))).toBeGreaterThan(15);
    const back = levelFrame(tilted, 20)!;
    expect(incl(back)).toBeCloseTo(incl(f), 5);
    expect(back.landmarks[LM.NOSE].x).toBeCloseTo(l[LM.NOSE].x, 6);
  });

  it('push-ups still count from a phone tilted 25° once levelled', () => {
    const angles = [...hold(170, 10), ...cycle(170, 80), ...cycle(170, 80), ...hold(170, 5)];
    const frames = angles.map((a) => (t: number) => levelFrame(rotate(pushupPose(a, t), 25), 25));
    expect(run(new PushupDetector(), frames).reps).toBe(2);
  });
});
