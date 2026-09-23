import { describe, expect, it } from 'vitest';
import { InputHub, type InputEvent } from '../src/input/InputHub';
import { MotionReader, NeutralCalibrator, type MotionReading } from '../src/input/motion';
import type { PoseFrame } from '../src/exercise/types';
import { FRAME_MS, jackPose, rng, standPose, type StandOpts } from '../src/testing/poses';

/** Drive a reader with pose options per frame. */
function run(reader: MotionReader, frames: (StandOpts | null)[], t0 = 0) {
  const out: MotionReading[] = [];
  let t = t0;
  for (const f of frames) {
    t += FRAME_MS;
    out.push(reader.update(f ? standPose(t, f) : null, t));
  }
  return { out, t, last: out[out.length - 1], events: out.flatMap((r) => r.events) };
}

const still = (n: number, o: StandOpts = {}) => Array.from({ length: n }, () => ({ ...o }));

/** Marching in place: legs alternate with a sine, ~1.8 steps per second. */
function march(n: number, lift = 0.6, extra: StandOpts = {}): StandOpts[] {
  return Array.from({ length: n }, (_, i) => {
    const s = Math.sin((i * FRAME_MS * Math.PI * 1.8) / 1000);
    return { ...extra, liftL: Math.max(0, s) * lift, liftR: Math.max(0, -s) * lift };
  });
}

describe('march detection', () => {
  it('does not trigger from idle standing, even with landmark noise', () => {
    const noise = { r: rng(5), amp: 0.01 };
    const r = run(new MotionReader(), still(300, { noise }));
    expect(r.out.some((o) => o.marching)).toBe(false);
    expect(r.events.filter((e) => e === 'step')).toHaveLength(0);
  });

  it('triggers from deliberate marching and stops shortly after marching stops', () => {
    const reader = new MotionReader();
    const r = run(reader, [...still(20), ...march(90)]);
    expect(r.last.marching).toBe(true);
    expect(r.last.steps).toBeGreaterThanOrEqual(4);
    expect(r.last.cadence).toBeGreaterThan(1);
    const after = run(reader, still(40), r.t);
    expect(after.last.marching).toBe(false);
  });

  it('starts moving within about half a second of marching', () => {
    const r = run(new MotionReader(), [...still(20), ...march(40)]);
    const first = r.out.findIndex((o) => o.marching);
    expect(first).toBeGreaterThan(20);
    expect((first - 20) * FRAME_MS).toBeLessThan(1000);
  });

  it('does not count jumping, bobbing or stepping toward the camera as marching', () => {
    const jumps = Array.from({ length: 120 }, (_, i) => ({ bob: Math.max(0, Math.sin(i * 0.4)) * 0.08 }));
    expect(run(new MotionReader(), jumps).out.some((o) => o.marching)).toBe(false);
    const approach = Array.from({ length: 90 }, (_, i) => ({ scale: 0.8 + i * 0.003 }));
    expect(run(new MotionReader(), approach).out.some((o) => o.marching)).toBe(false);
  });

  it('does not treat jumping jacks as marching', () => {
    const reader = new MotionReader();
    let t = 0;
    let marching = false;
    for (let i = 0; i < 150; i++) {
      t += FRAME_MS;
      const k = (Math.sin(i * 0.3) + 1) / 2;
      marching ||= reader.update(jackPose(k, k, t), t).marching;
    }
    expect(marching).toBe(false);
  });

  it('never marches when tracking is lost', () => {
    const reader = new MotionReader();
    const r = run(reader, [...march(60), ...Array.from({ length: 40 }, () => null)]);
    expect(r.last.tracking).toBe('lost');
    expect(r.last.marching).toBe(false);
  });
});

describe('lean steering', () => {
  it('is zero around neutral and does not jitter with noise or marching sway', () => {
    const noise = { r: rng(9), amp: 0.008 };
    const sway = Array.from({ length: 150 }, (_, i) => ({ lean: 3 * Math.sin(i * 0.35), noise }));
    const r = run(new MotionReader(), sway);
    expect(r.out.every((o) => o.steer === 0 && o.leanDir === 0)).toBe(true);
  });

  it('steers left for a lean to the left and right for a lean to the right', () => {
    const left = run(new MotionReader(), still(40, { lean: 14 })).last;
    expect(left.steer).toBeLessThan(-0.5);
    expect(left.leanDir).toBe(-1);
    const right = run(new MotionReader(), still(40, { lean: -14 })).last;
    expect(right.steer).toBeGreaterThan(0.5);
    expect(right.leanDir).toBe(1);
  });

  it('holds a lean direction until well back inside the dead zone (hysteresis)', () => {
    const reader = new MotionReader();
    run(reader, still(30, { lean: 10 }));
    const hovering = run(reader, still(30, { lean: 5.5 }), 2000);
    expect(hovering.last.leanDir).toBe(-1);
    const back = run(reader, still(30, { lean: 1 }), 4000);
    expect(back.last.leanDir).toBe(0);
  });

  it('respects a calibrated neutral lean', () => {
    const cal = new NeutralCalibrator(20);
    let neutral = null;
    for (let i = 0; i < 25 && !neutral; i++) neutral = cal.push(standPose(i * FRAME_MS, { lean: 6 })).neutral;
    expect(neutral).not.toBeNull();
    const reader = new MotionReader();
    reader.setNeutral(neutral);
    expect(run(reader, still(40, { lean: 6 })).last.steer).toBe(0);
  });
});

describe('gestures', () => {
  it('a held right-hand raise fires confirm once', () => {
    const reader = new MotionReader();
    const r = run(reader, [...still(15), ...still(40, { rightHand: 'up' })]);
    expect(r.events.filter((e) => e === 'confirm')).toHaveLength(1);
    expect(r.events).not.toContain('back');
  });

  it('a quick flick of the hand does not confirm', () => {
    const r = run(new MotionReader(), [...still(15), ...still(6, { rightHand: 'up' }), ...still(20)]);
    expect(r.events).not.toContain('confirm');
  });

  it('left hand fires back; both hands fire pause', () => {
    const back = run(new MotionReader(), [...still(15), ...still(40, { leftHand: 'up' })]);
    expect(back.events).toEqual(['back']);
    const pause = run(new MotionReader(), [...still(15), ...still(60, { leftHand: 'up', rightHand: 'up' })]);
    expect(pause.events).toEqual(['pause']);
  });

  it('must lower the hand before confirming again', () => {
    const r = run(new MotionReader(), [...still(15), ...still(40, { rightHand: 'up' }), ...still(15), ...still(40, { rightHand: 'up' })]);
    expect(r.events.filter((e) => e === 'confirm')).toHaveLength(2);
  });

  it('hands already raised when reading starts do not fire', () => {
    const r = run(new MotionReader(), still(80, { rightHand: 'up', leftHand: 'up' }));
    expect(r.events).toHaveLength(0);
  });
});

describe('input modes', () => {
  const feed = (hub: InputHub, frames: ((t: number) => PoseFrame)[], t0 = 0) => {
    let t = t0;
    for (const f of frames) {
      t += FRAME_MS;
      hub.feed(f(t), t);
    }
    return t;
  };
  const poses = (opts: StandOpts[]) => opts.map((o) => (t: number) => standPose(t, o));
  const collect = (hub: InputHub) => {
    const evs: InputEvent[] = [];
    hub.on((e) => evs.push(e));
    return evs;
  };

  it('exploration: marching moves, lean turns, right hand confirms', () => {
    const hub = new InputHub();
    const evs = collect(hub);
    hub.setMode('explore');
    feed(hub, poses([...still(15), ...march(60, 0.6, { lean: -12 })]));
    const i = hub.intent();
    expect(i.forward).toBeGreaterThan(0);
    expect(i.turn).toBeGreaterThan(0);
    feed(hub, poses([...still(15), ...still(30, { rightHand: 'up' })]), 5000);
    expect(evs.some((e) => e.type === 'confirm')).toBe(true);
  });

  it('exercise mode ignores all motion input: no movement, no gestures', () => {
    const hub = new InputHub();
    const evs = collect(hub);
    hub.setMode('exercise');
    feed(hub, poses([...still(15), ...march(60), ...still(40, { rightHand: 'up' }), ...still(60, { rightHand: 'up', leftHand: 'up' })]));
    const t = feed(
      hub,
      Array.from({ length: 100 }, (_, i) => (t: number) => jackPose((Math.sin(i * 0.3) + 1) / 2, (Math.sin(i * 0.3) + 1) / 2, t)),
      9000,
    );
    expect(t).toBeGreaterThan(0);
    expect(evs).toHaveLength(0);
    expect(hub.intent()).toEqual({ forward: 0, turn: 0 });
    expect(hub.latest).toBeNull();
  });

  it('menu mode: lean navigates, marching does not move anything', () => {
    const hub = new InputHub();
    const evs = collect(hub);
    hub.setMode('menu');
    feed(hub, poses([...still(15), ...march(60)]));
    expect(hub.intent()).toEqual({ forward: 0, turn: 0 });
    expect(evs.filter((e) => e.type === 'step')).toHaveLength(0);
    feed(hub, poses(still(20, { lean: 12 })), 3000);
    expect(evs.filter((e) => e.type === 'nav')).toEqual([{ type: 'nav', dir: -1, source: 'motion' }]);
  });

  it('arms raised at the end of an exercise do not confirm in the next mode', () => {
    const hub = new InputHub();
    const evs = collect(hub);
    hub.setMode('exercise');
    feed(hub, poses(still(30, { rightHand: 'up', leftHand: 'up' })));
    hub.setMode('menu');
    // Still holding the final jumping-jack pose, then only the right hand stays up.
    feed(hub, poses([...still(30, { rightHand: 'up', leftHand: 'up' }), ...still(40, { rightHand: 'up' })]), 2000);
    expect(evs.filter((e) => e.type === 'confirm' || e.type === 'pause')).toHaveLength(0);
    // After lowering both hands, a deliberate raise works.
    feed(hub, poses([...still(15), ...still(30, { rightHand: 'up' })]), 6000);
    expect(evs.filter((e) => e.type === 'confirm')).toHaveLength(1);
  });

  it('keyboard follows the same mode rules', () => {
    const hub = new InputHub();
    const evs = collect(hub);
    hub.setMode('exercise');
    hub.press('confirm');
    hub.press('back');
    hub.setKey('forward', true);
    expect(hub.intent().forward).toBe(0);
    hub.press('pause');
    expect(evs.map((e) => e.type)).toEqual(['pause']);
    hub.setMode('explore');
    expect(hub.intent().forward).toBe(1);
  });
});

describe('calibration hand-off', () => {
  it('a right-hand raise straight after calibrating still confirms', () => {
    const reader = new MotionReader();
    run(reader, still(20));
    reader.setNeutral({ thigh: 0.2, torso: 0.25, legDiff: 0, leanDeg: 0 });
    const r = run(reader, still(40, { rightHand: 'up' }), 2000);
    expect(r.events).toContain('confirm');
  });
});
