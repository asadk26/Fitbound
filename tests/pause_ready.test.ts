import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControllerBridge } from '../src/controller/bridge';
import type { PoseFrame } from '../src/exercise/types';
import { deadzone, GamepadInput } from '../src/input/gamepad';
import { ExercisePauseGesture, pausePolicy } from '../src/input/exercisePause';
import { InputHub, type InputEvent } from '../src/input/InputHub';
import { MotionReader } from '../src/input/motion';
import { TiltWatch } from '../src/input/tilt';
import { ControllerGate } from '../src/net/gate';
import { parseCtrlMsg, type CtrlMsg } from '../src/net/protocol';
import { cycle, FRAME_MS, hold, jackPose, pushupPose, rng, squatPose, standPose, type StandOpts } from '../src/testing/poses';
import { PausableTimers } from '../src/ui/pausableTimers';

type F = (t: number) => PoseFrame | null;
const stand = (n: number, o: StandOpts = {}): F[] => Array.from({ length: n }, () => (t: number) => standPose(t, o));
const jacks = (n: number): F[] => Array.from({ length: n }, (_, i) => (t: number) => jackPose((Math.sin(i * 0.3) + 1) / 2, (Math.sin(i * 0.3) + 1) / 2, t));

function pauses(exerciseId: string, frames: F[]) {
  const g = new ExercisePauseGesture(pausePolicy(exerciseId));
  let t = 0;
  let n = 0;
  for (const f of frames) {
    t += FRAME_MS;
    if (g.update(f(t), t)) n++;
  }
  return n;
}

describe('mid-set pause gestures', () => {
  it('jumping jacks never pause, however many', () => {
    expect(pauses('jumping_jack', [...stand(10), ...jacks(600)])).toBe(0);
  });

  it('jumping jacks: feet together, both hands high, held still → pause', () => {
    const pose: F = (t) => jackPose(1, 0, t);
    expect(pauses('jumping_jack', [...stand(10), ...Array.from({ length: 60 }, () => pose)])).toBe(1);
    // Arms up with feet apart (the top of a jack) held just as long does not.
    const top: F = (t) => jackPose(1, 1, t);
    expect(pauses('jumping_jack', [...stand(10), ...Array.from({ length: 60 }, () => top)])).toBe(0);
  });

  it('squats never pause; both hands high for a second does', () => {
    const squats = [...hold(0, 10), ...cycle(0, 80), ...cycle(0, 80), ...cycle(0, 80)].map((a) => (t: number) => squatPose(a, t));
    expect(pauses('squat', squats)).toBe(0);
    expect(pauses('squat', [...stand(10), ...stand(40, { rightHand: 'up', leftHand: 'up' })])).toBe(1);
    expect(pauses('squat', [...stand(10), ...stand(20, { rightHand: 'up', leftHand: 'up' })])).toBe(0); // too short
  });

  it('push-ups: no pause from the floor; standing up with both hands high pauses', () => {
    const floor = [...hold(170, 10), ...cycle(170, 80), ...cycle(170, 80)].map((a) => (t: number) => pushupPose(a, t));
    expect(pauses('pushup', floor)).toBe(0);
    expect(pauses('pushup', [...floor, ...stand(15), ...stand(40, { rightHand: 'up', leftHand: 'up' })])).toBe(1);
  });

  it('hands already up when the set starts do not pause until lowered first', () => {
    expect(pauses('squat', stand(80, { rightHand: 'up', leftHand: 'up' }))).toBe(0);
  });

  it('the hub fires pause from the active exercise gesture only in exercise mode', () => {
    const hub = new InputHub();
    const evs: InputEvent[] = [];
    hub.on((e) => evs.push(e));
    hub.setExercise('jumping_jack');
    hub.setMode('exercise');
    let t = 0;
    for (const f of [...stand(10), ...jacks(200)]) hub.feed(f((t += FRAME_MS)), t);
    expect(evs).toHaveLength(0);
    for (const f of [...stand(10), ...Array.from({ length: 60 }, () => (tt: number) => jackPose(1, 0, tt))]) hub.feed(f((t += FRAME_MS)), t);
    expect(evs.map((e) => e.type)).toEqual(['pause']);
  });
});

describe('standing-neutral "ready"', () => {
  const read = (frames: F[], reader = new MotionReader(), t0 = 0) => {
    let t = t0;
    const events: string[] = [];
    for (const f of frames) {
      t += FRAME_MS;
      events.push(...reader.update(f(t), t).events);
    }
    return events.filter((e) => e === 'ready');
  };

  it('fires once, briefly after standing tall with hands relaxed', () => {
    const floor = hold(170, 40).map((a) => (t: number) => pushupPose(a, t));
    expect(read([...floor, ...stand(40)])).toEqual(['ready']);
  });

  it('is forgiving: a brief wobble does not restart the hold', () => {
    const wobble = [...stand(10), ...stand(3, { lean: 14 }), ...stand(10)];
    expect(read(wobble)).toEqual(['ready']);
  });

  it('does not fire while marching, with hands raised, or when not in view', () => {
    const march = Array.from({ length: 120 }, (_, i) => (t: number) => {
      const s = Math.sin((i * FRAME_MS * Math.PI * 1.8) / 1000);
      return standPose(t, { liftL: Math.max(0, s) * 0.6, liftR: Math.max(0, -s) * 0.6 });
    });
    expect(read(march)).toEqual([]);
    expect(read(stand(80, { rightHand: 'up' }))).toEqual([]);
    expect(read(Array.from({ length: 60 }, () => () => null))).toEqual([]);
  });

  it('in ready mode only "ready" and pause count; a raised hand cannot confirm', () => {
    const hub = new InputHub();
    const evs: InputEvent[] = [];
    hub.on((e) => evs.push(e));
    hub.setMode('ready');
    let t = 0;
    for (const f of [...stand(10), ...stand(40, { rightHand: 'up' })]) hub.feed(f((t += FRAME_MS)), t);
    expect(evs.map((e) => e.type)).toEqual([]);
    for (const f of stand(30)) hub.feed(f((t += FRAME_MS)), t);
    expect(evs.map((e) => e.type)).toEqual(['ready']);
    // Continue from keyboard, touch or gamepad counts as ready too.
    hub.press('confirm', 'keyboard');
    hub.press('confirm', 'gamepad');
    expect(evs.map((e) => e.type)).toEqual(['ready', 'ready', 'ready']);
  });

  it('the phone sends READY only in ready mode, and the PC gate only accepts it there', () => {
    let seq = 0;
    let now = 0;
    const sent: CtrlMsg[] = [];
    const bridge = new ControllerBridge((p) => sent.push({ ...p, seq: ++seq, epoch: bridge.epoch } as CtrlMsg), () => now);
    bridge.applyMode('menu', 1);
    for (const f of stand(40)) bridge.frame(f((now += FRAME_MS)), now);
    expect(sent.some((m) => m.type === 'READY')).toBe(false);
    bridge.applyMode('ready', 2);
    for (const f of stand(40)) bridge.frame(f((now += FRAME_MS)), now);
    const ready = sent.filter((m) => m.type === 'READY');
    expect(ready).toHaveLength(1);
    const gate = new ControllerGate();
    gate.bind('s');
    expect(gate.check('s', ready[0], { mode: 'ready', epoch: 2 }).ok).toBe(true);
    expect(gate.check('s', { ...ready[0], seq: ready[0].seq + 1 }, { mode: 'explore', epoch: 3 }).ok).toBe(false);
  });
});

describe('phone moved since calibration', () => {
  it('ignores sensor noise and footsteps, flags a real move, clears when put back', () => {
    const w = new TiltWatch();
    const r = rng(4);
    let t = 0;
    const g = (ax: number) => {
      const a = (ax * Math.PI) / 180;
      return [Math.sin(a) * 9.8, -Math.cos(a) * 9.8, 0.3] as const;
    };
    for (let i = 0; i < 60; i++) w.push(...g(0), (t += 16));
    w.setReference();
    for (let i = 0; i < 600; i++) {
      const [x, y, z] = g(0);
      // noise plus occasional thumps
      const thump = i % 90 === 0 ? 4 : 0;
      w.push(x + (r() - 0.5) * 0.6 + thump, y + (r() - 0.5) * 0.6, z, (t += 16));
    }
    expect(w.moved).toBe(false);
    for (let i = 0; i < 300; i++) w.push(...g(12), (t += 16));
    expect(w.moved).toBe(true);
    for (let i = 0; i < 300; i++) w.push(...g(0), (t += 16));
    expect(w.moved).toBe(false);
  });
});

describe('gamepad and conventional movement', () => {
  const pad = (axes: number[], pressed: number[] = []) => ({ index: 0, connected: true, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })) }) as unknown as Gamepad;

  it('dead zone ignores stick drift and rescales smoothly', () => {
    expect(deadzone(0.1, 0.15)).toEqual({ x: 0, y: 0 });
    const d = deadzone(1, 0);
    expect(d.x).toBeCloseTo(1);
  });

  it('buttons fire once per press and follow the mode rules', () => {
    const hub = new InputHub();
    const evs: InputEvent[] = [];
    hub.on((e) => evs.push(e));
    let toggles = 0;
    const g = new GamepadInput(hub, () => toggles++);
    hub.setMode('explore');
    g.poll([pad([0, 0], [9])]);
    g.poll([pad([0, 0], [9])]);
    g.poll([pad([0, 0], [])]);
    g.poll([pad([0, 0], [8])]);
    expect(evs.map((e) => e.type)).toEqual(['pause']);
    expect(toggles).toBe(1);
    hub.setMode('exercise');
    g.poll([pad([0, 0], [0])]);
    expect(evs.map((e) => e.type)).toEqual(['pause']); // A does nothing mid-set
  });

  it('stick and keys never add up, and only work while exploring', () => {
    const hub = new InputHub();
    hub.setMode('explore');
    hub.setKey('right', true);
    hub.setStick(1, 0);
    expect(Math.hypot(hub.freeMove().x, hub.freeMove().y)).toBeCloseTo(1);
    hub.setMode('menu');
    expect(hub.freeMove()).toEqual({ x: 0, y: 0 });
  });
});

describe('pausable battle timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as Record<string, unknown>).window = globalThis;
  });
  afterEach(() => vi.useRealTimers());

  it('a paused battle does not let the enemy act, and resumes with the time left', () => {
    let now = 0;
    const timers = new PausableTimers(() => now);
    let attacked = false;
    timers.later(() => (attacked = true), 1000);
    vi.advanceTimersByTime(600);
    now = 600;
    timers.pause();
    vi.advanceTimersByTime(5000);
    now = 5600;
    expect(attacked).toBe(false);
    timers.resume();
    vi.advanceTimersByTime(399);
    expect(attacked).toBe(false);
    vi.advanceTimersByTime(2);
    expect(attacked).toBe(true);
  });
});

describe('protocol additions', () => {
  it('validates READY, rep diagnostics and the moved flag', () => {
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'READY', via: 'motion' })).toBeTruthy();
    const diag = { seq: 2, epoch: 0, type: 'EXERCISE_DIAG', setId: 'set-1', summary: { started: false, startBlocker: 'ARMS_HIDDEN', blockedMs: { ARMS_HIDDEN: 5000 }, events: { 'partial-depth': 2 }, counted: 0 } };
    expect(parseCtrlMsg(diag)).toBeTruthy();
    expect(parseCtrlMsg({ ...diag, summary: { ...diag.summary, events: { hacked: 1 } } })).toBeNull();
    expect(parseCtrlMsg({ ...diag, summary: { ...diag.summary, counted: -1 } })).toBeNull();
    expect((parseCtrlMsg({ seq: 3, epoch: 0, type: 'STATUS', camera: 'running', model: 'ready', calibrated: true, tracking: 'good', moved: true }) as { moved?: boolean }).moved).toBe(true);
    expect(parseCtrlMsg({ seq: 3, epoch: 0, type: 'STATUS', camera: 'running', model: 'ready', calibrated: true, tracking: 'good', moved: 'yes' })).toBeNull();
  });
});
