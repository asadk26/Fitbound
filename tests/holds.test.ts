import { describe, expect, it } from 'vitest';
import { SidePlankDetector, sidePlankConfig, WallSitDetector, wallSitConfig } from '../src/exercise/detectors/holds';
import { EXERCISES, getExercise, targetLabel } from '../src/exercise/registry';
import { ExerciseSessionController, trialSessionOptions } from '../src/exercise/session';
import { parseCtrlMsg, parseGameMsg } from '../src/net/protocol';
import { RemoteSet } from '../src/net/remoteSet';
import type { DetectorUpdate, ExerciseDetector, ExerciseEvent, PoseFrame } from '../src/exercise/types';
import { FRAME_MS, sidePlankPose, wallSitPose } from '../src/testing/poses';

type F = (t: number) => PoseFrame | null;

function run(d: ExerciseDetector, frames: F[], start = 0) {
  let t = start;
  let u: DetectorUpdate | null = null;
  for (const f of frames) {
    t += FRAME_MS;
    u = d.update(f(t), t);
  }
  return { u: u!, t };
}
const n = (count: number, f: F) => Array.from({ length: count }, () => f);
const secs = (s: number) => Math.round((s * 1000) / FRAME_MS);

describe('wall sit', () => {
  it('times a seated hold and nothing while standing', () => {
    const d = new WallSitDetector();
    const stand = run(
      d,
      n(60, (t) => wallSitPose(0, t)),
    );
    expect(stand.u.holdMs).toBe(0);
    expect(stand.u.guidance).toBe('GET_INTO_WALL_SIT');
    const sit = run(
      d,
      n(secs(5), (t) => wallSitPose(1, t)),
      stand.t,
    );
    expect(sit.u.holding).toBe(true);
    expect(sit.u.holdMs!).toBeGreaterThan(4500);
    expect(sit.u.holdMs!).toBeLessThanOrEqual(5000);
  });

  it('a half-way sit asks for lower; beginners may sit higher', () => {
    const half = run(
      new WallSitDetector(),
      n(90, (t) => wallSitPose(0.55, t)),
    );
    expect(half.u.holdMs).toBe(0);
    expect(half.u.guidance).toBe('GO_LOWER');
    const easy = run(
      new WallSitDetector(wallSitConfig('beginner')),
      n(90, (t) => wallSitPose(0.6, t)),
    );
    expect(easy.u.holdMs!).toBeGreaterThan(2000);
  });

  it('leaning well forward off the wall does not count', () => {
    const r = run(
      new WallSitDetector(),
      n(90, (t) => wallSitPose(1, t, { lean: 50 })),
    );
    expect(r.u.holdMs).toBe(0);
    expect(r.u.guidance).toBe('BACK_AGAINST_WALL');
  });

  it('standing up pauses the clock and keeps the time; losing the camera never adds time', () => {
    const d = new WallSitDetector();
    const a = run(
      d,
      n(secs(3), (t) => wallSitPose(1, t)),
    );
    const kept = a.u.holdMs!;
    const b = run(d, [...n(30, (t) => wallSitPose(0, t)), ...n(60, () => null)], a.t);
    expect(b.u.holdMs).toBe(kept);
    expect(b.u.holding).toBe(false);
    // A stalled camera: one frame after a 5 s gap adds at most the per-frame cap.
    const c = run(
      d,
      n(20, (t) => wallSitPose(1, t)),
      b.t,
    );
    const before = c.u.holdMs!;
    const u = d.update(wallSitPose(1, c.t + 5000), c.t + 5000);
    expect(u.holdMs! - before).toBeLessThanOrEqual(200);
  });
});

describe('side plank', () => {
  it('tells which side you rest on and times each separately', () => {
    const d = new SidePlankDetector();
    const l = run(
      d,
      n(secs(4), (t) => sidePlankPose('left', 1, t)),
    );
    expect(l.u.holding).toBe(true);
    expect(l.u.metrics!.down).toBe(-1);
    const r = run(d, [...n(20, (t) => sidePlankPose('right', 0, t)), ...n(secs(3), (t) => sidePlankPose('right', 1, t))], l.t);
    expect(r.u.metrics!.down).toBe(1);
    expect(d.sides.left).toBeGreaterThan(3500);
    expect(d.sides.right).toBeGreaterThan(2500);
    expect(d.sides.right).toBeLessThan(3100);
  });

  it('hips down on the floor do not count', () => {
    const r = run(
      new SidePlankDetector(),
      n(90, (t) => sidePlankPose('left', 0, t)),
    );
    expect(r.u.holdMs).toBe(0);
    expect(r.u.guidance).toBe('LIFT_HIPS');
  });

  it('balances the two sides: past its half, one side stops counting and asks you to switch', () => {
    const d = new SidePlankDetector();
    d.setHoldTarget(10_000);
    const l = run(
      d,
      n(secs(9), (t) => sidePlankPose('left', 1, t)),
    );
    expect(l.u.holdMs).toBe(5000);
    expect(l.u.holding).toBe(false);
    expect(l.u.guidance).toBe('SWITCH_SIDES');
    const r = run(d, [...n(15, (t) => sidePlankPose('right', 0, t)), ...n(secs(6), (t) => sidePlankPose('right', 1, t))], l.t);
    expect(r.u.holdMs).toBe(10_000);
    expect(d.sides).toEqual({ left: 5000, right: 5000 });
  });

  it('a full set in the session completes only when both sides are done', () => {
    const ex = getExercise('side_plank');
    const events: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(ex, ex.createDetector!('intermediate'), 10, (e) => events.push(e), trialSessionOptions(ex.id));
    let t = 0;
    const feed = (count: number, f: F) => {
      for (let i = 0; i < count; i++) s.update(f((t += FRAME_MS)), t);
    };
    feed(secs(12), (tt) => sidePlankPose('right', 1, tt));
    expect(events.some((e) => e.type === 'setComplete')).toBe(false);
    feed(15, (tt) => sidePlankPose('left', 0, tt));
    feed(secs(6), (tt) => sidePlankPose('left', 1, tt));
    expect(events.some((e) => e.type === 'setComplete')).toBe(true);
  });

  it('the session reports the time held on each side', () => {
    const ex = getExercise('side_plank');
    const s = new ExerciseSessionController(ex, ex.createDetector!('intermediate'), 20, () => {}, trialSessionOptions(ex.id));
    let t = 0;
    let sn = s.update(null, t);
    for (let i = 0; i < secs(4); i++) sn = s.update(sidePlankPose('left', 1, (t += FRAME_MS)), t);
    for (let i = 0; i < 15; i++) sn = s.update(sidePlankPose('right', 0, (t += FRAME_MS)), t);
    for (let i = 0; i < secs(2); i++) sn = s.update(sidePlankPose('right', 1, (t += FRAME_MS)), t);
    expect(sn.holdSides!.left).toBeGreaterThan(3500);
    expect(sn.holdSides!.right).toBeGreaterThan(1500);
    expect(sn.holdSides!.left + sn.holdSides!.right).toBeCloseTo(sn.heldMs, -1);
  });

  it('beginners may rest on their knees', () => {
    expect(sidePlankConfig('beginner').allowKnees).toBe(true);
  });
});

describe('the two holds in the library', () => {
  it('are experimental and Lab-only until physically checked', () => {
    for (const id of ['wall_sit', 'side_plank']) {
      const ex = getExercise(id);
      expect(ex.kind).toBe('hold');
      expect(ex.reliability).toBe('experimental');
      expect(ex.eligible).toEqual(['lab']);
    }
  });
  it('the side plank target reads as a total split in half', () => {
    expect(targetLabel(getExercise('side_plank'), 30)).toBe('30 s (15 s each side)');
  });
  it('per-side hold time from the phone is validated, and never exceeds what the PC accepted', () => {
    const base = { type: 'EXERCISE_HOLD', setId: 's1', heldMs: 4000, seq: 1, epoch: 1 };
    expect(parseCtrlMsg({ ...base, left: 3000, right: 1000 })).toMatchObject({ left: 3000, right: 1000 });
    expect(parseCtrlMsg({ ...base, left: 3000 })).toBeNull();
    expect(parseCtrlMsg({ ...base, left: -1, right: 1000 })).toBeNull();
    expect(parseCtrlMsg(base)).not.toHaveProperty('left');

    const events: ExerciseEvent[] = [];
    const r = new RemoteSet(
      's1',
      getExercise('side_plank'),
      30,
      (e) => events.push(e),
      () => {},
      'intermediate',
    );
    r.status({ type: 'EXERCISE_STATUS', setId: 's1', stage: 'active', countdownLeftMs: 0, tracking: 'good', confidence: 1, guidance: null, ready: true, fallbackAvailable: false, seq: 1, epoch: 1 });
    r.hold({ type: 'EXERCISE_HOLD', setId: 's1', heldMs: 0, left: 0, right: 0, seq: 2, epoch: 1 }, 0);
    // The phone claims 20 s (more than its half on one side) one second later: the PC accepts about 1 s.
    r.hold({ type: 'EXERCISE_HOLD', setId: 's1', heldMs: 20_000, left: 20_000, right: 0, seq: 3, epoch: 1 }, 1000);
    const sn = r.snapshot();
    expect(sn.heldMs).toBeLessThan(2000);
    expect(sn.holdSides!.left + sn.holdSides!.right).toBeLessThanOrEqual(sn.heldMs);
    // A hold that isn't split ignores sides.
    const p = new RemoteSet(
      's2',
      getExercise('plank'),
      30,
      () => {},
      () => {},
      'intermediate',
    );
    p.status({ type: 'EXERCISE_STATUS', setId: 's2', stage: 'active', countdownLeftMs: 0, tracking: 'good', confidence: 1, guidance: null, ready: true, fallbackAvailable: false, seq: 1, epoch: 1 });
    p.hold({ type: 'EXERCISE_HOLD', setId: 's2', heldMs: 500, left: 500, right: 0, seq: 2, epoch: 1 }, 0);
    expect(p.snapshot().holdSides).toBeUndefined();
  });

  it('calibration labels match how each movement is done', () => {
    expect(getExercise('russian_twist').calibration).toBe('seated-front');
    expect(getExercise('side_plank').calibration).toBe('floor-front');
    for (const e of EXERCISES) {
      if (e.floor) expect(e.calibration, e.id).not.toMatch(/^standing/);
      expect(e.calibration.endsWith('-side'), e.id).toBe(e.camera.view === 'side');
    }
  });

  it('the phone is told the split target, validated', () => {
    const ok = parseGameMsg({ type: 'EXERCISE_BEGIN', setId: 's1', exerciseId: 'side_plank', difficulty: 'beginner', holdTargetMs: 30_000 });
    expect(ok).toMatchObject({ holdTargetMs: 30_000 });
    expect(parseGameMsg({ type: 'EXERCISE_BEGIN', setId: 's1', exerciseId: 'side_plank', difficulty: 'beginner', holdTargetMs: -5 })).toBeNull();
    expect(parseGameMsg({ type: 'EXERCISE_BEGIN', setId: 's1', exerciseId: 'plank', difficulty: 'beginner' })).not.toHaveProperty('holdTargetMs');
  });
});
