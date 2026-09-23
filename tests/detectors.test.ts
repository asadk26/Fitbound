import { describe, expect, it } from 'vitest';
import { JumpingJackDetector } from '../src/exercise/detectors/jumpingJack';
import { PlankDetector } from '../src/exercise/detectors/plank';
import { PushupDetector } from '../src/exercise/detectors/pushup';
import { SquatDetector } from '../src/exercise/detectors/squat';
import type { DetectorUpdate, ExerciseDetector, PoseFrame } from '../src/exercise/types';
import { cycle, FRAME_MS, hold, jackPose, plankPose, pushupPose, ramp, rng, squatPose, standingCurlPose } from './fixtures/poses';

/** Feed a sequence of frames and collect every update. */
class Runner {
  t = 0;
  updates: DetectorUpdate[] = [];
  constructor(readonly d: ExerciseDetector) {}
  feed(frames: ((t: number) => PoseFrame | null)[]): this {
    for (const f of frames) {
      this.t += FRAME_MS;
      this.updates.push(this.d.update(f(this.t), this.t));
    }
    return this;
  }
  get reps(): number {
    return this.updates.filter((u) => u.repCompleted).length;
  }
  get phases(): string[] {
    const out: string[] = [];
    for (const u of this.updates) if (out[out.length - 1] !== u.phase) out.push(u.phase);
    return out;
  }
  get last(): DetectorUpdate {
    return this.updates[this.updates.length - 1];
  }
}

const push = (angles: number[], opts?: Parameters<typeof pushupPose>[2]) => angles.map((a) => (t: number) => pushupPose(a, t, opts));
const squat = (angles: number[], opts?: Parameters<typeof squatPose>[2]) => angles.map((a) => (t: number) => squatPose(a, t, opts));
const nothing = (n: number) => Array.from({ length: n }, () => () => null);

describe('PushupDetector', () => {
  it('counts one complete push-up exactly once, through every phase', () => {
    const r = new Runner(new PushupDetector()).feed(push([...hold(170, 10), ...cycle(170, 80), ...hold(170, 10)]));
    expect(r.reps).toBe(1);
    expect(r.phases).toEqual(['SETUP', 'STARTING_POSITION', 'LOWERING', 'BOTTOM_POSITION', 'RISING', 'COMPLETED_REPETITION', 'STARTING_POSITION']);
  });

  it('counts five push-ups as five', () => {
    const angles = [...hold(170, 10)];
    for (let i = 0; i < 5; i++) angles.push(...cycle(170, 85), ...hold(170, 3));
    expect(new Runner(new PushupDetector()).feed(push(angles)).reps).toBe(5);
  });

  it('does not count a partial push-up that never reaches the bottom', () => {
    const r = new Runner(new PushupDetector()).feed(push([...hold(170, 10), ...cycle(170, 125), ...hold(170, 10)]));
    expect(r.reps).toBe(0);
    expect(r.updates.some((u) => u.partialRep)).toBe(true);
    expect(r.updates.some((u) => u.guidance === 'GO_LOWER')).toBe(true);
  });

  it('does not generate repeated counts while holding the bottom position', () => {
    const r = new Runner(new PushupDetector()).feed(push([...hold(170, 10), ...ramp(170, 80, 15), ...hold(80, 120)]));
    expect(r.reps).toBe(0);
    r.feed(push([...ramp(80, 170, 15), ...hold(170, 10)]));
    expect(r.reps).toBe(1);
  });

  it('does not multi-count when landmarks are noisy', () => {
    const noise = { r: rng(42), amp: 0.012 };
    const angles = [...hold(170, 20), ...cycle(170, 80, 20, 30, 20), ...hold(170, 40)];
    const r = new Runner(new PushupDetector()).feed(push(angles, { noise }));
    expect(r.reps).toBe(1);
  });

  it('does not count jitter around the top or bottom thresholds', () => {
    const noise = { r: rng(7), amp: 0.01 };
    const wobbleTop = Array.from({ length: 80 }, (_, i) => 150 + 8 * Math.sin(i));
    const wobbleBottom = Array.from({ length: 80 }, (_, i) => 100 + 10 * Math.sin(i * 1.3));
    const r = new Runner(new PushupDetector()).feed(push([...hold(170, 10), ...wobbleTop, ...ramp(150, 100, 10), ...wobbleBottom], { noise }));
    expect(r.reps).toBe(0);
  });

  it('does not award a rep when tracking is lost mid-rep', () => {
    const r = new Runner(new PushupDetector()).feed([
      ...push([...hold(170, 10), ...ramp(170, 80, 15)]),
      ...nothing(40),
      ...push(hold(170, 20)),
    ]);
    expect(r.reps).toBe(0);
    expect(r.updates.some((u) => u.tracking === 'lost' && u.guidance === 'TRACKING_LOST')).toBe(true);
  });

  it('never counts with no body in frame', () => {
    const r = new Runner(new PushupDetector()).feed(nothing(300));
    expect(r.reps).toBe(0);
    expect(r.last.guidance).toBe('NO_BODY');
  });

  it('does not count when landmark confidence is low', () => {
    const r = new Runner(new PushupDetector()).feed(push([...hold(170, 10), ...cycle(170, 80), ...hold(170, 10)], { vis: 0.2 }));
    expect(r.reps).toBe(0);
  });

  it('tolerates a brief dropout without losing a real rep', () => {
    const r = new Runner(new PushupDetector()).feed([
      ...push([...hold(170, 10), ...ramp(170, 80, 15)]),
      ...nothing(5),
      ...push([...ramp(80, 170, 15), ...hold(170, 5)]),
    ]);
    expect(r.reps).toBe(1);
  });

  it('does not count elbow bends while standing (e.g. a biceps curl)', () => {
    const angles = [...hold(170, 10), ...cycle(170, 60), ...cycle(170, 60), ...hold(170, 10)];
    const r = new Runner(new PushupDetector()).feed(angles.map((a) => (t: number) => standingCurlPose(a, t)));
    expect(r.reps).toBe(0);
    expect(r.last.guidance).toBe('GET_INTO_PUSHUP');
  });

  it('ignores a rep that is impossibly fast', () => {
    const r = new Runner(new PushupDetector()).feed(push([...hold(170, 10), 120, 80, 120, 170, ...hold(170, 5)]));
    expect(r.reps).toBe(0);
  });
});

describe('SquatDetector', () => {
  it('counts one complete squat exactly once', () => {
    const r = new Runner(new SquatDetector()).feed(squat([...hold(175, 10), ...cycle(175, 95), ...hold(175, 10)]));
    expect(r.reps).toBe(1);
    expect(r.phases).toEqual(['SETUP', 'STANDING', 'LOWERING', 'BOTTOM_POSITION', 'RISING', 'COMPLETED_REPETITION', 'STANDING']);
  });

  it('counts eight squats as eight', () => {
    const angles = [...hold(175, 10)];
    for (let i = 0; i < 8; i++) angles.push(...cycle(175, 100), ...hold(175, 3));
    expect(new Runner(new SquatDetector()).feed(squat(angles)).reps).toBe(8);
  });

  it('does not count a shallow knee bend', () => {
    const r = new Runner(new SquatDetector()).feed(squat([...hold(175, 10), ...cycle(175, 140), ...hold(175, 10)]));
    expect(r.reps).toBe(0);
  });

  it('does not repeat counts while holding the bottom, even with noise', () => {
    const noise = { r: rng(3), amp: 0.01 };
    const r = new Runner(new SquatDetector()).feed(squat([...hold(175, 10), ...ramp(175, 95, 15), ...hold(95, 150), ...ramp(95, 175, 15), ...hold(175, 10)], { noise }));
    expect(r.reps).toBe(1);
  });

  it('asks for the legs when the ankles are out of view and counts nothing', () => {
    const r = new Runner(new SquatDetector()).feed(squat([...hold(175, 10), ...cycle(175, 95), ...hold(175, 10)], { hideAnkles: true }));
    expect(r.reps).toBe(0);
    expect(r.last.guidance).toBe('LEGS_NOT_VISIBLE');
  });

  it('does not award a rep when tracking is lost at the bottom', () => {
    const r = new Runner(new SquatDetector()).feed([...squat([...hold(175, 10), ...ramp(175, 95, 15)]), ...nothing(40), ...squat(hold(175, 20))]);
    expect(r.reps).toBe(0);
  });
});

describe('JumpingJackDetector', () => {
  const jack = (seq: [number, number][], opts?: Parameters<typeof jackPose>[3]) => seq.map(([a, l]) => (t: number) => jackPose(a, l, t, opts));
  const closedHold = (n: number) => Array.from({ length: n }, (): [number, number] => [0, 0]);
  const fullJack = (): [number, number][] => [...ramp(0, 1, 6).map((k): [number, number] => [k, k]), [1, 1], [1, 1], ...ramp(1, 0, 6).map((k): [number, number] => [k, k])];

  it('counts one complete jumping jack exactly once', () => {
    const r = new Runner(new JumpingJackDetector()).feed(jack([...closedHold(8), ...fullJack(), ...closedHold(8)]));
    expect(r.reps).toBe(1);
    expect(r.phases).toContain('OPEN');
  });

  it('counts ten jacks as ten', () => {
    const seq: [number, number][] = [...closedHold(8)];
    for (let i = 0; i < 10; i++) seq.push(...fullJack(), ...closedHold(2));
    expect(new Runner(new JumpingJackDetector()).feed(jack(seq)).reps).toBe(10);
  });

  it('does not count arm raises without the legs', () => {
    const seq: [number, number][] = [...closedHold(8)];
    for (let i = 0; i < 4; i++) seq.push(...ramp(0, 1, 6).map((k): [number, number] => [k, 0]), ...ramp(1, 0, 6).map((k): [number, number] => [k, 0]));
    const r = new Runner(new JumpingJackDetector()).feed(jack(seq));
    expect(r.reps).toBe(0);
    expect(r.updates.some((u) => u.guidance === 'ARMS_AND_LEGS_TOGETHER')).toBe(true);
  });

  it('does not count stepping side to side without the arms', () => {
    const seq: [number, number][] = [...closedHold(8)];
    for (let i = 0; i < 4; i++) seq.push(...ramp(0, 1, 6).map((k): [number, number] => [0, k]), ...ramp(1, 0, 6).map((k): [number, number] => [0, k]));
    expect(new Runner(new JumpingJackDetector()).feed(jack(seq)).reps).toBe(0);
  });

  it('does not multi-count noisy open or closed holds', () => {
    const noise = { r: rng(11), amp: 0.012 };
    const seq: [number, number][] = [...closedHold(20), ...ramp(0, 1, 6).map((k): [number, number] => [k, k]), ...Array.from({ length: 60 }, (): [number, number] => [1, 1]), ...ramp(1, 0, 6).map((k): [number, number] => [k, k]), ...closedHold(60)];
    expect(new Runner(new JumpingJackDetector()).feed(jack(seq, { noise })).reps).toBe(1);
  });

  it('does not award a rep when tracking is lost while open', () => {
    const seq = jack([...closedHold(8), ...ramp(0, 1, 6).map((k): [number, number] => [k, k])]);
    const r = new Runner(new JumpingJackDetector()).feed([...seq, ...nothing(40), ...jack(closedHold(20))]);
    expect(r.reps).toBe(0);
  });
});

describe('PlankDetector (hold)', () => {
  const plank = (n: number, sag = 0) => Array.from({ length: n }, () => (t: number) => plankPose(t, sag));

  it('accumulates hold time only while the plank is held', () => {
    const r = new Runner(new PlankDetector()).feed(plank(100));
    const held = r.last.holdMs ?? 0;
    expect(held).toBeGreaterThan(2800);
    expect(held).toBeLessThan(3400);
    expect(r.last.holding).toBe(true);
  });

  it('pauses (without resetting) when the body line breaks', () => {
    const r = new Runner(new PlankDetector()).feed(plank(60));
    const before = r.last.holdMs ?? 0;
    r.feed(plank(20, 12));
    expect(r.last.holding).toBe(false);
    // Smoothing may bank a frame or two of the break, never more.
    const paused = r.last.holdMs ?? 0;
    expect(paused - before).toBeLessThanOrEqual(3 * 33);
    r.feed(plank(60, 12));
    expect(r.last.holdMs).toBe(paused);
    r.feed(plank(40));
    expect(r.last.holdMs ?? 0).toBeGreaterThan(before);
  });

  it('gains no time while tracking is lost', () => {
    const r = new Runner(new PlankDetector()).feed(plank(30));
    const before = r.last.holdMs ?? 0;
    r.feed(nothing(100));
    expect(r.last.holdMs).toBe(before);
    expect(r.last.repCompleted).toBe(false);
  });
});
