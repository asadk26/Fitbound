import { describe, expect, it } from 'vitest';
import { LungeDetector } from '../src/exercise/detectors/movements';
import { PlankDetector } from '../src/exercise/detectors/plank';
import { PushupDetector } from '../src/exercise/detectors/pushup';
import { getExercise } from '../src/exercise/registry';
import { ExerciseSessionController, trialSessionOptions } from '../src/exercise/session';
import type { ExerciseEvent, PoseFrame } from '../src/exercise/types';
import { ControllerGate } from '../src/net/gate';
import { parseCtrlMsg, type CtrlMsg, type GameMsg } from '../src/net/protocol';
import { RemoteSet } from '../src/net/remoteSet';
import { cycle, FRAME_MS, hold, lungePose, plankPose, pushupPose, ramp } from '../src/testing/poses';

type F = (t: number) => PoseFrame | null;

function drive(s: ExerciseSessionController, frames: F[], t0 = 0) {
  let t = t0;
  for (const f of frames) {
    t += FRAME_MS;
    s.update(f(t), t);
  }
  return t;
}

const pushups = (n: number): F[] => {
  const a = [...hold(170, 12)];
  for (let i = 0; i < n; i++) a.push(...cycle(170, 80));
  a.push(...hold(170, 4));
  return a.map((x) => (t: number) => pushupPose(x, t));
};

describe('finishing a set', () => {
  it('5 of 8 push-ups, then "finish set": resolves as a partial with the 5 verified reps', () => {
    const evs: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 8, (e) => evs.push(e), trialSessionOptions('pushup'));
    drive(s, pushups(5));
    expect(evs.filter((e) => e.type === 'rep')).toHaveLength(5);
    s.finish();
    const end = evs.at(-1)!;
    expect(end).toMatchObject({ type: 'setEnded', reason: 'finished', completed: 5, target: 8 });
    // Nothing more counts afterwards, and finishing twice does nothing.
    drive(s, pushups(2), 99_000);
    s.finish();
    expect(evs.filter((e) => e.type === 'rep')).toHaveLength(5);
    expect(evs.filter((e) => e.type === 'setEnded')).toHaveLength(1);
  });

  it('pausing, a tracking dropout or standing still never ends a set', () => {
    const evs: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 8, (e) => evs.push(e), trialSessionOptions('pushup'));
    let t = drive(s, pushups(3));
    s.pause();
    t = drive(s, Array.from({ length: 300 }, () => () => null), t);
    s.resume(t);
    t = drive(s, Array.from({ length: 300 }, () => () => null), t); // 10 s out of view
    drive(s, hold(170, 300).map((x) => (tt: number) => pushupPose(x, tt)), t); // 10 s holding still
    expect(evs.some((e) => e.type === 'setEnded' || e.type === 'setComplete')).toBe(false);
    expect(s.update(null, t + 1).stage).not.toBe('complete');
  });

  it('reaching the target still completes automatically', () => {
    const evs: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 3, (e) => evs.push(e), trialSessionOptions('pushup'));
    drive(s, pushups(3));
    expect(evs.at(-1)).toMatchObject({ type: 'setComplete', completed: 3 });
  });

  it('finishing a hold resolves the whole seconds held', () => {
    const evs: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(getExercise('plank'), new PlankDetector(), 30, (e) => evs.push(e), { countdownMs: 0 });
    drive(s, Array.from({ length: 200 }, () => (t: number) => plankPose(t)));
    s.finish();
    const end = evs.at(-1) as Extract<ExerciseEvent, { type: 'setEnded' }>;
    expect(end.reason).toBe('finished');
    expect(end.completed).toBeGreaterThanOrEqual(5);
    expect(end.completed).toBeLessThanOrEqual(7);
  });
});

describe('sided exercises', () => {
  const lunge = (back: 'left' | 'right'): F[] => [...ramp(0, 1, 15), ...hold(1, 3), ...ramp(1, 0, 15), ...hold(0, 4)].map((d) => (t: number) => lungePose(d, back, t));

  it('counts sides separately and completes only when both reach the target', () => {
    const evs: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(getExercise('reverse_lunge'), new LungeDetector(), 2, (e) => evs.push(e), { countdownMs: 0 });
    const frames: F[] = [...hold(0, 12).map((d) => (t: number) => lungePose(d, 'left', t)), ...lunge('left'), ...lunge('left'), ...lunge('left'), ...lunge('right')];
    const t = drive(s, frames);
    expect(evs.some((e) => e.type === 'setComplete')).toBe(false); // 3 left, 1 right: unbalanced
    expect(s.update(null, t + 1).sides).toEqual({ left: 3, right: 1 });
    drive(s, lunge('right'), t + 2);
    const done = evs.find((e) => e.type === 'setComplete') as Extract<ExerciseEvent, { type: 'setComplete' }>;
    expect(done.sides).toEqual({ left: 3, right: 2 });
    expect(evs.filter((e) => e.type === 'rep').map((e) => (e as { side?: string }).side)).toEqual(['left', 'left', 'left', 'right', 'right']);
  });
});

describe('Connected Play: finish, sides and holds', () => {
  const mk = (exerciseId: string, target: number) => {
    const evs: ExerciseEvent[] = [];
    const sent: GameMsg[] = [];
    const rs = new RemoteSet('set-1', getExercise(exerciseId), target, (e) => evs.push(e), (m) => sent.push(m), 'intermediate');
    rs.status({ seq: 1, epoch: 0, type: 'EXERCISE_STATUS', setId: 'set-1', stage: 'active', countdownLeftMs: 0, tracking: 'good', confidence: 1, guidance: null, ready: true, fallbackAvailable: false, blocker: null, pauseProgress: 0 });
    return { evs, sent, rs };
  };
  const rep = (i: number, side?: 'left' | 'right') => ({ seq: 10 + i, epoch: 0, type: 'EXERCISE_REP' as const, setId: 'set-1', exerciseId: '', index: i, source: 'camera' as const, ...(side ? { side } : {}) });

  it('a sided rep without a side is refused; both arms at once are allowed', () => {
    const { evs, rs } = mk('bicep_curl', 2);
    expect(rs.rep({ ...rep(1), exerciseId: 'bicep_curl' }, 1000)).toBe('wrong-exercise');
    expect(rs.rep({ ...rep(1, 'left'), exerciseId: 'bicep_curl' }, 1000)).toBe('accepted');
    expect(rs.rep({ ...rep(2, 'right'), exerciseId: 'bicep_curl' }, 1010)).toBe('accepted');
    expect(rs.rep({ ...rep(3, 'left'), exerciseId: 'bicep_curl' }, 1100)).toBe('too-fast');
    rs.finish();
    expect(evs.at(-1)).toMatchObject({ type: 'setEnded', reason: 'finished', completed: 2, sides: { left: 1, right: 1 } });
  });

  it('hold time only accrues as fast as real time, never while paused', () => {
    const { evs, rs } = mk('plank', 20);
    const h = (ms: number, seq: number) => ({ seq, epoch: 0, type: 'EXERCISE_HOLD' as const, setId: 'set-1', heldMs: ms });
    rs.hold(h(1000, 1), 1000);
    rs.hold(h(60_000, 2), 1100); // a burst claiming a minute
    expect(rs.snapshot().heldMs).toBeLessThan(2000);
    let now = 1100;
    for (let i = 3; i < 60; i++) rs.hold(h(1000 + (i - 2) * 250, i), (now += 250));
    const before = rs.snapshot().heldMs;
    expect(before).toBeGreaterThan(14_000);
    rs.pause();
    rs.hold(h(before + 5000, 70), (now += 5000));
    expect(rs.snapshot().heldMs).toBe(before);
    rs.resume(now);
    rs.finish();
    const end = evs.at(-1) as Extract<ExerciseEvent, { type: 'setEnded' }>;
    expect(end.completed).toBe(Math.floor(before / 1000));
    expect(evs.filter((e) => e.type === 'holdTick').length).toBeGreaterThanOrEqual(2);
  });

  it('the phone Finish button: validated and routed to the active set only', () => {
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'FINISH_SET', setId: 'set-1' })).toBeTruthy();
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'EXERCISE_HOLD', setId: 'set-1', heldMs: -5 })).toBeNull();
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'EXERCISE_REP', setId: 'set-1', exerciseId: 'x', index: 1, source: 'camera', side: 'middle' })).toBeNull();
    const gate = new ControllerGate();
    gate.bind('s');
    const fin = parseCtrlMsg({ seq: 2, epoch: 0, type: 'FINISH_SET', setId: 'set-1' })!;
    expect(gate.check('s', fin, { mode: 'explore', epoch: 0 }).ok).toBe(false);
    expect(gate.check('s', { ...fin, seq: 3 }, { mode: 'menu', epoch: 5 }).ok).toBe(true);
    const { evs, rs } = mk('pushup', 5);
    expect(rs.requestFinish({ ...(fin as Extract<CtrlMsg, { type: 'FINISH_SET' }>), setId: 'other' })).toBe(false);
    expect(rs.requestFinish(fin as Extract<CtrlMsg, { type: 'FINISH_SET' }>)).toBe(true);
    expect(evs.at(-1)).toMatchObject({ type: 'setEnded', reason: 'finished', completed: 0 });
  });
});

describe('phone bridge reports holds and sides', () => {
  it('sends a running hold total for planks and a side with each lunge rep', async () => {
    const { ControllerBridge } = await import('../src/controller/bridge');
    let seq = 0;
    let now = 0;
    const sent: CtrlMsg[] = [];
    const b = new ControllerBridge((p) => sent.push({ ...p, seq: ++seq, epoch: b.epoch } as CtrlMsg), () => now);
    b.applyMode('exercise', 1);
    b.handle({ type: 'EXERCISE_BEGIN', setId: 'p1', exerciseId: 'plank', difficulty: 'intermediate' });
    for (let i = 0; i < 300; i++) b.frame(plankPose((now += FRAME_MS)), now);
    const holds = sent.filter((m) => m.type === 'EXERCISE_HOLD') as Extract<CtrlMsg, { type: 'EXERCISE_HOLD' }>[];
    expect(holds.length).toBeGreaterThan(10);
    expect(holds.at(-1)!.heldMs).toBeGreaterThan(4000);
    expect(holds.every((h, i) => i === 0 || h.heldMs >= holds[i - 1].heldMs)).toBe(true);

    b.handle({ type: 'EXERCISE_END', setId: 'p1' });
    b.handle({ type: 'EXERCISE_BEGIN', setId: 'l1', exerciseId: 'reverse_lunge', difficulty: 'intermediate' });
    const lunge = [...hold(0, 140), ...ramp(0, 1, 15), ...hold(1, 3), ...ramp(1, 0, 15), ...hold(0, 90)];
    for (const d of lunge) b.frame(lungePose(d, 'right', (now += FRAME_MS)), now);
    const reps = sent.filter((m) => m.type === 'EXERCISE_REP') as Extract<CtrlMsg, { type: 'EXERCISE_REP' }>[];
    expect(reps.map((r) => r.side)).toEqual(['right']);
  });
});

describe('missed-repetition corrections (bible §15)', () => {
  it('adds manual work only, credits the side that is behind, and recomputes "full"', async () => {
    const { applyCorrection, missing } = await import('../src/ui/expedition/correction');
    const base = { exerciseId: 'squat', target: 10, done: 7, full: false, ending: 'finished' as const, camera: 7, manual: 0, holdMs: 0, activeMs: 20000 };
    const reps = { kind: 'reps' as const, sided: false };
    expect(missing(base, reps)).toBe(3);
    const two = applyCorrection(base, reps, 2);
    expect(two).toMatchObject({ camera: 7, manual: 2, done: 9, full: false });
    expect(applyCorrection(base, reps, 3)).toMatchObject({ camera: 7, manual: 3, done: 10, full: true });
    expect(applyCorrection(base, reps, 0)).toBe(base);
    const sided = { ...base, exerciseId: 'reverse_lunge', target: 5, done: 7, camera: 7, sides: { left: 5, right: 2 } };
    const lunge = { kind: 'reps' as const, sided: true };
    expect(missing(sided, lunge)).toBe(3);
    expect(applyCorrection(sided, lunge, 3)).toMatchObject({ sides: { left: 5, right: 5 }, manual: 3, full: true });
    const hold = { ...base, exerciseId: 'plank', target: 30, done: 22, camera: 0, holdMs: 22_000 };
    const plank = { kind: 'hold' as const, sided: false };
    expect(missing(hold, plank)).toBe(8);
    expect(applyCorrection(hold, plank, 8)).toMatchObject({ holdMs: 30_000, done: 30, manualMs: 8000, full: true, camera: 0 });
  });
});
