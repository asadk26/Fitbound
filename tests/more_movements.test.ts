import { describe, expect, it } from 'vitest';
import { ButtKickDetector, GluteBridgeDetector, LateralRaiseDetector, OverheadPressDetector, PunchDetector, SkaterDetector, TwistDetector } from '../src/exercise/detectors/more';
import type { ExerciseDetector, PoseFrame, Side } from '../src/exercise/types';
import { bridgePose, FRAME_MS, hold, kickPose, lateralPose, pressPose, punchPose, ramp, skaterPose, twistPose } from '../src/testing/poses';

type F = (t: number) => PoseFrame | null;

function run(d: ExerciseDetector, frames: F[]) {
  let t = 0;
  const sides: (Side | undefined)[] = [];
  for (const f of frames) {
    t += FRAME_MS;
    const u = d.update(f(t), t);
    if (u.repCompleted) sides.push(u.repSide);
  }
  return { reps: sides.length, left: sides.filter((s) => s === 'left').length, right: sides.filter((s) => s === 'right').length };
}

const up = (n: number, to = 1) => [...ramp(0, to, n), ...hold(to, 4), ...ramp(to, 0, n), ...hold(0, 5)];
const idle = (n: number, f: F) => Array.from({ length: n }, () => f);
const reps = (count: number, pose: (k: number) => F, n = 12, to = 1) => {
  const out: F[] = [...idle(10, pose(0))];
  for (let i = 0; i < count; i++) for (const k of up(n, to)) out.push(pose(k));
  return out;
};

describe('overhead press', () => {
  it('counts full presses with both arms', () => {
    expect(
      run(
        new OverheadPressDetector(),
        reps(3, (k) => (t) => pressPose(k, t)),
      ).reps,
    ).toBe(3);
  });
  it('a half press or one arm left behind does not count', () => {
    expect(
      run(
        new OverheadPressDetector(),
        reps(2, (k) => (t) => pressPose(k, t), 12, 0.45),
      ).reps,
    ).toBe(0);
    expect(
      run(
        new OverheadPressDetector(),
        reps(2, (k) => (t) => pressPose(k, t, 0.6)),
      ).reps,
    ).toBe(0);
  });
});

describe('lateral raises', () => {
  it('counts arms raised out to shoulder height; a small lift does not count', () => {
    expect(
      run(
        new LateralRaiseDetector(),
        reps(3, (k) => (t) => lateralPose(k, t)),
      ).reps,
    ).toBe(3);
    expect(
      run(
        new LateralRaiseDetector(),
        reps(2, (k) => (t) => lateralPose(k, t), 12, 0.5),
      ).reps,
    ).toBe(0);
  });
});

describe('glute bridges', () => {
  it('counts hips lifted into a line; a small lift does not count', () => {
    expect(
      run(
        new GluteBridgeDetector(),
        reps(3, (k) => (t) => bridgePose(k, t)),
      ).reps,
    ).toBe(3);
    expect(
      run(
        new GluteBridgeDetector(),
        reps(2, (k) => (t) => bridgePose(k, t), 12, 0.35),
      ).reps,
    ).toBe(0);
  });
});

describe('skaters', () => {
  it('counts each bound for the side it goes to', () => {
    const frames: F[] = [...idle(20, (t) => skaterPose(0, t))];
    for (let i = 0; i < 3; i++) {
      for (const k of [...ramp(0, 1.3, 8), ...hold(1.3, 6), ...ramp(1.3, -1.3, 14), ...hold(-1.3, 6), ...ramp(-1.3, 0, 8)]) frames.push((t) => skaterPose(k, t));
    }
    const r = run(new SkaterDetector(), frames);
    expect(r.left).toBe(3);
    expect(r.right).toBe(3);
  });
  it('swaying in place does not count', () => {
    const frames: F[] = [...idle(20, (t) => skaterPose(0, t))];
    for (let i = 0; i < 4; i++) for (const k of [...ramp(0, 0.35, 8), ...ramp(0.35, -0.35, 12), ...ramp(-0.35, 0, 8)]) frames.push((t) => skaterPose(k, t));
    expect(run(new SkaterDetector(), frames).reps).toBe(0);
  });
});

describe('butt kicks', () => {
  it('counts heel kicks with either leg', () => {
    const frames: F[] = [...idle(10, (t) => kickPose(0, 0, t))];
    for (let i = 0; i < 2; i++) {
      for (const k of up(7)) frames.push((t) => kickPose(k, 0, t));
      for (const k of up(7)) frames.push((t) => kickPose(0, k, t));
    }
    expect(run(new ButtKickDetector(), frames).reps).toBe(4);
  });
  it('a knee driven up in front is a high knee, not a butt kick', () => {
    const frames: F[] = [...idle(10, (t) => kickPose(0, 0, t))];
    for (let i = 0; i < 2; i++) for (const k of up(7)) frames.push((t) => kickPose(k, 0, t, { kneeUp: 1 }));
    expect(run(new ButtKickDetector(), frames).reps).toBe(0);
  });
});

describe('Russian twists', () => {
  it('counts each turn by side; small wobbles do not count', () => {
    const frames: F[] = [...idle(10, (t) => twistPose(0, t))];
    for (let i = 0; i < 2; i++) for (const k of [...ramp(0, 1, 8), ...hold(1, 3), ...ramp(1, -1, 14), ...hold(-1, 3), ...ramp(-1, 0, 8)]) frames.push((t) => twistPose(k, t));
    const r = run(new TwistDetector(), frames);
    expect(r).toMatchObject({ left: 2, right: 2 });
    const wobble: F[] = [...idle(10, (t) => twistPose(0, t))];
    for (let i = 0; i < 3; i++) for (const k of [...ramp(0, 0.3, 6), ...ramp(0.3, -0.3, 10), ...ramp(-0.3, 0, 6)]) wobble.push((t) => twistPose(k, t));
    expect(run(new TwistDetector(), wobble).reps).toBe(0);
  });
});

describe('straight punches (Lab feasibility)', () => {
  const combo = (stance: 'front' | 'side', seq: Side[]) => {
    const frames: F[] = [...idle(10, (t) => punchPose(stance, 0, 0, t))];
    for (const s of seq) for (const k of [...ramp(0, 1, 4), ...hold(1, 2), ...ramp(1, 0, 5), ...hold(0, 3)]) frames.push((t) => punchPose(stance, s === 'left' ? k : 0, s === 'right' ? k : 0, t));
    return frames;
  };
  for (const stance of ['side', 'front'] as const) {
    it(`${stance}: counts each arm on its own`, () => {
      const r = run(new PunchDetector(stance), combo(stance, ['left', 'right', 'left', 'left', 'right']));
      expect(r).toMatchObject({ left: 3, right: 2 });
    });
    it(`${stance}: a punch only counts after coming back toward guard`, () => {
      const frames: F[] = [...idle(10, (t) => punchPose(stance, 0, 0, t))];
      for (const k of ramp(0, 1, 5)) frames.push((t) => punchPose(stance, k, 0, t));
      frames.push(...idle(20, (t) => punchPose(stance, 1, 0, t)));
      expect(run(new PunchDetector(stance), frames).reps).toBe(0);
    });
    it(`${stance}: a half-extended jab is not a punch`, () => {
      const frames: F[] = [...idle(10, (t) => punchPose(stance, 0, 0, t))];
      for (let i = 0; i < 3; i++) for (const k of [...ramp(0, 0.45, 4), ...ramp(0.45, 0, 4), ...hold(0, 3)]) frames.push((t) => punchPose(stance, k, 0, t));
      expect(run(new PunchDetector(stance), frames).reps).toBe(0);
    });
  }
});
