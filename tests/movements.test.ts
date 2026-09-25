import { describe, expect, it } from 'vitest';
import { ClimberDetector, CrossCrunchDetector, CurlDetector, DeadBugDetector, HighKneesDetector, LungeDetector, RowDetector } from '../src/exercise/detectors/movements';
import { PushupDetector } from '../src/exercise/detectors/pushup';
import { EXERCISES, FAMILIES, exercisesIn } from '../src/exercise/registry';
import type { ExerciseDetector, PoseFrame, Side } from '../src/exercise/types';
import { climberPose, crossCrunchPose, curlPose, cycle, deadBugPose, FRAME_MS, hold, lungePose, pushupPose, ramp, rowPose, squatPose, standPose } from '../src/testing/poses';

type F = (t: number) => PoseFrame | null;

function run(d: ExerciseDetector, frames: F[]) {
  let t = 0;
  const sides: (Side | undefined)[] = [];
  const cues: string[] = [];
  for (const f of frames) {
    t += FRAME_MS;
    const u = d.update(f(t), t);
    if (u.repCompleted) sides.push(u.repSide);
    if (u.guidance) cues.push(u.guidance);
  }
  return { reps: sides.length, sides, cues };
}

const up = (n: number) => [...ramp(0, 1, n), ...hold(1, 3), ...ramp(1, 0, n), ...hold(0, 4)];
const idle = (n: number, f: F) => Array.from({ length: n }, () => f);

describe('biceps curls', () => {
  it('counts each arm on its own, and both at once as one per arm', () => {
    const frames: F[] = [...idle(10, (t) => curlPose(0, 0, t))];
    for (const k of up(12)) frames.push((t) => curlPose(k, 0, t)); // left only
    for (const k of up(12)) frames.push((t) => curlPose(0, k, t)); // right only
    for (const k of up(12)) frames.push((t) => curlPose(k, k, t)); // both
    const r = run(new CurlDetector(), frames);
    expect(r.reps).toBe(4);
    expect(r.sides.filter((s) => s === 'left')).toHaveLength(2);
    expect(r.sides.filter((s) => s === 'right')).toHaveLength(2);
  });

  it('swinging the body or raising the elbows does not count', () => {
    const swing: F[] = [...idle(10, (t) => curlPose(0, 0, t))];
    for (const k of up(12)) swing.push((t) => curlPose(k, 0, t, { lean: 25 * k }));
    const r = run(new CurlDetector(), swing);
    expect(r.reps).toBe(0);
    expect(r.cues).toContain('NO_SWING');
    const raise: F[] = [...idle(10, (t) => curlPose(0, 0, t))];
    for (const k of up(12)) raise.push((t) => curlPose(k, 0, t, { elbowRaise: 0.12 * k }));
    expect(run(new CurlDetector(), raise).reps).toBe(0);
  });

  it('a half curl is a partial, not a rep', () => {
    const frames: F[] = [...idle(10, (t) => curlPose(0, 0, t))];
    for (const k of up(12)) frames.push((t) => curlPose(k * 0.45, 0, t));
    expect(run(new CurlDetector(), frames).reps).toBe(0);
  });
});

describe('one-arm dumbbell rows', () => {
  it('counts the rowing arm by side; the supporting arm never counts', () => {
    const frames: F[] = [...idle(10, (t) => rowPose('left', 0, t))];
    for (let i = 0; i < 3; i++) for (const k of up(14)) frames.push((t) => rowPose('left', k, t));
    frames.push(...idle(10, (t) => rowPose('right', 0, t)));
    for (let i = 0; i < 2; i++) for (const k of up(14)) frames.push((t) => rowPose('right', k, t));
    const r = run(new RowDetector(), frames);
    expect(r.sides).toEqual(['left', 'left', 'left', 'right', 'right']);
  });

  it('push-ups are not rows (the legs are not standing under the body)', () => {
    const frames = [...hold(170, 10), ...cycle(170, 80), ...cycle(170, 80)].map((a) => (t: number) => pushupPose(a, t));
    expect(run(new RowDetector(), frames).reps).toBe(0);
  });

  it('standing curls are not rows (the torso is upright)', () => {
    const frames: F[] = [...idle(10, (t) => curlPose(0, 0, t))];
    for (const k of up(12)) frames.push((t) => curlPose(k, k, t));
    expect(run(new RowDetector(), frames).reps).toBe(0);
  });
});

describe('reverse lunges', () => {
  const lunges = (back: 'left' | 'right', n: number): F[] => {
    const out: F[] = [];
    for (let i = 0; i < n; i++) for (const d of up(15)) out.push((t) => lungePose(d, back, t));
    return out;
  };

  it('counts each side by the leg that stepped back', () => {
    const r = run(new LungeDetector(), [...idle(12, (t) => lungePose(0, 'left', t)), ...lunges('left', 2), ...lunges('right', 3)]);
    expect(r.sides).toEqual(['left', 'left', 'right', 'right', 'right']);
  });

  it('a squat is not a lunge, and a shallow dip is not either', () => {
    const squats = [...hold(0, 12), ...cycle(0, 80), ...cycle(0, 80)].map((a) => (t: number) => squatPose(a, t));
    expect(run(new LungeDetector(), squats).reps).toBe(0);
    const shallow: F[] = [...idle(12, (t) => lungePose(0, 'left', t))];
    for (const d of up(15)) shallow.push((t) => lungePose(d * 0.3, 'left', t));
    expect(run(new LungeDetector(), shallow).reps).toBe(0);
  });
});

describe('high knees', () => {
  it('counts every knee driven to hip height', () => {
    const frames: F[] = [...idle(8, (t) => standPose(t))];
    for (let i = 0; i < 4; i++) {
      for (const k of up(5)) frames.push((t) => standPose(t, { liftL: 1.25 * k }));
      for (const k of up(5)) frames.push((t) => standPose(t, { liftR: 1.25 * k }));
    }
    const r = run(new HighKneesDetector(), frames);
    expect(r.reps).toBe(8);
  });

  it('ordinary marching does not count', () => {
    const frames: F[] = [...idle(8, (t) => standPose(t))];
    for (let i = 0; i < 6; i++) {
      for (const k of up(5)) frames.push((t) => standPose(t, { liftL: 0.6 * k }));
      for (const k of up(5)) frames.push((t) => standPose(t, { liftR: 0.6 * k }));
    }
    expect(run(new HighKneesDetector(), frames).reps).toBe(0);
  });
});

describe('standing cross crunches', () => {
  it('counts per side when the opposite elbow meets the knee', () => {
    const frames: F[] = [...idle(8, (t) => crossCrunchPose('left', 0, t))];
    for (const k of up(10)) frames.push((t) => crossCrunchPose('left', k, t));
    for (const k of up(10)) frames.push((t) => crossCrunchPose('right', k, t));
    expect(run(new CrossCrunchDetector(), frames).sides).toEqual(['left', 'right']);
  });

  it('a knee lift without the elbow coming across does not count', () => {
    const frames: F[] = [...idle(8, (t) => crossCrunchPose('left', 0, t))];
    for (const k of up(10)) frames.push((t) => crossCrunchPose('left', k, t, { elbow: false }));
    expect(run(new CrossCrunchDetector(), frames).reps).toBe(0);
  });
});

describe('floor movements (experimental)', () => {
  it('mountain climbers: each knee drive counts from a plank', () => {
    const frames: F[] = [...idle(8, (t) => climberPose(0, 0, t))];
    for (let i = 0; i < 3; i++) {
      for (const k of up(5)) frames.push((t) => climberPose(k, 0, t));
      for (const k of up(5)) frames.push((t) => climberPose(0, k, t));
    }
    expect(run(new ClimberDetector(), frames).reps).toBe(6);
    // Standing knee lifts are not mountain climbers.
    const standing: F[] = [...idle(8, (t) => standPose(t))];
    for (const k of up(5)) standing.push((t) => standPose(t, { liftL: 1.2 * k }));
    expect(run(new ClimberDetector(), standing).reps).toBe(0);
  });

  it('dead bugs: each leg extension from tabletop counts', () => {
    const frames: F[] = [...idle(8, (t) => deadBugPose(0, 0, t))];
    for (let i = 0; i < 2; i++) {
      for (const k of up(20)) frames.push((t) => deadBugPose(k, 0, t));
      for (const k of up(20)) frames.push((t) => deadBugPose(0, k, t));
    }
    expect(run(new DeadBugDetector(), frames).reps).toBe(4);
    // Standing doesn't look like lying on your back.
    expect(run(new DeadBugDetector(), idle(60, (t) => standPose(t))).reps).toBe(0);
  });
});

describe('library structure', () => {
  it('every family has a stable, equipment-free movement, so a loadout is always possible', () => {
    for (const fam of FAMILIES) {
      const ok = exercisesIn(fam).filter((e) => e.equipment.length === 0 && e.createDetector && (e.reliability === 'stable' || e.reliability === 'beta'));
      expect(ok.length, fam).toBeGreaterThan(0);
    }
  });

  it('entries are well-formed and ids are unique', () => {
    const ids = new Set<string>();
    for (const e of EXERCISES) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.range.min).toBeLessThanOrEqual(e.range.default);
      expect(e.range.default).toBeLessThanOrEqual(e.range.max);
      if (e.reliability !== 'unavailable') expect(e.createDetector).not.toBeNull();
      if (e.createDetector) expect(e.createDetector('intermediate').exerciseId).toBe(e.id);
    }
  });

  it('push-ups still count exactly as before with the new detectors registered', () => {
    const frames = [...hold(170, 10), ...cycle(170, 80), ...cycle(170, 80), ...hold(170, 5)].map((a) => (t: number) => pushupPose(a, t));
    expect(run(new PushupDetector(), frames).reps).toBe(2);
  });
});
