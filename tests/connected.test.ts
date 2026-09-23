import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatEngine } from '../src/combat/CombatEngine';
import { ControllerBridge } from '../src/controller/bridge';
import { getExercise } from '../src/exercise/registry';
import type { ExerciseEvent, PoseFrame } from '../src/exercise/types';
import { statsFor } from '../src/game/progression';
import { InputHub, MOVE_TIMEOUT_MS } from '../src/input/InputHub';
import { ControllerGate, toCommand } from '../src/net/gate';
import { HostLink } from '../src/net/host';
import { parseCtrlMsg, parseGameMsg, type CtrlMsg, type CtrlPayload, type GameMsg } from '../src/net/protocol';
import { RemoteSet } from '../src/net/remoteSet';
import { cycle, FRAME_MS, hold, jackPose, pushupPose, rng, standPose, type StandOpts } from '../src/testing/poses';
import { DEFAULT_TARGETS, encounterPlan, trialEnemy } from '../src/trial/config';

// ── Helpers ────────────────────────────────────────────────────────────────
const still = (n: number, o: StandOpts = {}) => Array.from({ length: n }, () => ({ ...o }));
function march(n: number, lift = 0.6): StandOpts[] {
  return Array.from({ length: n }, (_, i) => {
    const s = Math.sin((i * FRAME_MS * Math.PI * 1.8) / 1000);
    return { liftL: Math.max(0, s) * lift, liftR: Math.max(0, -s) * lift };
  });
}

/** A phone bridge whose messages are stamped like the real link does. */
function phone() {
  let seq = 0;
  let t = 0;
  const sent: CtrlMsg[] = [];
  const bridge = new ControllerBridge(
    (p: CtrlPayload) => sent.push({ ...p, seq: ++seq, epoch: bridge.epoch } as CtrlMsg),
    () => t,
  );
  bridge.camera = 'running';
  bridge.model = 'ready';
  const feed = (frames: ((t: number) => PoseFrame | null)[]) => {
    for (const f of frames) {
      t += FRAME_MS;
      bridge.frame(f(t), t);
    }
    return t;
  };
  const stand = (opts: StandOpts[]) => feed(opts.map((o) => (tt: number) => standPose(tt, o)));
  const types = () => sent.map((m) => m.type);
  return { bridge, sent, feed, stand, types, now: () => t };
}

/** A PC-side hub + gate, fed by a phone's messages. */
function pc(sid = 'sess1') {
  const hub = new InputHub();
  const gate = new ControllerGate();
  gate.bind(sid);
  const deliver = (msgs: CtrlMsg[], now = 0) =>
    msgs.map((m) => {
      const res = gate.check(sid, m, { mode: hub.mode, epoch: hub.epoch });
      if (res.ok) {
        const cmd = toCommand(res.msg);
        if (cmd) hub.command(cmd, 'remote', now);
      }
      return res.ok ? 'ok' : res.reason;
    });
  return { hub, gate, deliver };
}

// ── Protocol ───────────────────────────────────────────────────────────────
describe('protocol validation', () => {
  it('accepts well-formed messages and strips unknown fields', () => {
    const m = parseCtrlMsg({ seq: 1, epoch: 0, type: 'EXERCISE_REP', setId: 'a-1', exerciseId: 'pushup', index: 1, source: 'camera', frame: 'data:image/png;base64,AAAA' });
    expect(m).toEqual({ seq: 1, epoch: 0, type: 'EXERCISE_REP', setId: 'a-1', exerciseId: 'pushup', index: 1, source: 'camera' });
  });

  it('rejects unknown types, missing or out-of-range fields', () => {
    const bad: unknown[] = [
      null,
      'TURN_LEFT',
      { seq: 1, epoch: 0, type: 'TELEPORT' },
      { epoch: 0, type: 'HEARTBEAT' },
      { seq: 0, epoch: 0, type: 'HEARTBEAT' },
      { seq: 1.5, epoch: 0, type: 'HEARTBEAT' },
      { seq: 1, epoch: 0, type: 'MOVE_START', intensity: 7 },
      { seq: 1, epoch: 0, type: 'MOVE_START', intensity: NaN },
      { seq: 1, epoch: 0, type: 'TURN_LEFT' },
      { seq: 1, epoch: 0, type: 'NAV', dir: 2, via: 'motion' },
      { seq: 1, epoch: 0, type: 'EXERCISE_REP', setId: 'a', exerciseId: 'pushup', index: -1, source: 'camera' },
      { seq: 1, epoch: 0, type: 'EXERCISE_REP', setId: 'a', exerciseId: 'pushup', index: 1, source: 'magic' },
      { seq: 1, epoch: 0, type: 'EXERCISE_REP', setId: '<script>', exerciseId: 'pushup', index: 1, source: 'camera' },
      { seq: 1, epoch: 0, type: 'CALIBRATION', step: 'teleport', progress: 0, hint: null, floorOk: false },
    ];
    for (const b of bad) expect(parseCtrlMsg(b), JSON.stringify(b)).toBeNull();
  });

  it('the phone validates game messages too', () => {
    expect(parseGameMsg({ type: 'MODE', mode: 'explore', epoch: 3 })).toEqual({ type: 'MODE', mode: 'explore', epoch: 3 });
    expect(parseGameMsg({ type: 'MODE', mode: 'godmode', epoch: 3 })).toBeNull();
    expect(parseGameMsg({ type: 'EXERCISE_BEGIN', setId: 's', exerciseId: 'pushup', difficulty: 'impossible' })).toBeNull();
  });
});

// ── Gate ───────────────────────────────────────────────────────────────────
describe('controller gate (PC-authoritative validation)', () => {
  const msg = (seq: number, type: string, extra: object = {}, epoch = 1) => ({ seq, epoch, type, ...extra });

  it('ignores messages from any other session', () => {
    const { gate, hub } = pc('sess1');
    hub.setMode('explore');
    expect(gate.check('intruder', msg(1, 'TURN_LEFT', { via: 'motion' }), { mode: 'explore', epoch: 1 })).toEqual({ ok: false, reason: 'session' });
    expect(gate.check(undefined, msg(1, 'TURN_LEFT', { via: 'motion' }), { mode: 'explore', epoch: 1 })).toEqual({ ok: false, reason: 'session' });
  });

  it('drops duplicates and replays by sequence number', () => {
    const { deliver, hub } = pc();
    hub.setMode('explore');
    const m = msg(5, 'TURN_LEFT', { via: 'motion' }) as CtrlMsg;
    expect(deliver([m, m, msg(4, 'TURN_LEFT', { via: 'motion' }) as CtrlMsg])).toEqual(['ok', 'duplicate', 'duplicate']);
    expect(hub.takeTurns()).toBe(-1);
  });

  it('movement only in exploration; exercise events only during an exercise', () => {
    const { deliver, hub } = pc();
    hub.setMode('menu'); // epoch 1
    expect(deliver([msg(1, 'MOVE_START', { intensity: 1 }) as CtrlMsg])).toEqual(['mode']);
    expect(deliver([msg(2, 'EXERCISE_REP', { setId: 's', exerciseId: 'pushup', index: 1, source: 'camera' }) as CtrlMsg])).toEqual(['mode']);
    hub.setMode('exercise'); // epoch 2
    expect(deliver([msg(3, 'MOVE_START', { intensity: 1 }, 2) as CtrlMsg, msg(4, 'TURN_LEFT', { via: 'motion' }, 2) as CtrlMsg, msg(5, 'INTERACT', { via: 'motion' }, 2) as CtrlMsg])).toEqual(['mode', 'mode', 'mode']);
    expect(deliver([msg(6, 'EXERCISE_REP', { setId: 's', exerciseId: 'pushup', index: 1, source: 'camera' }, 2) as CtrlMsg])).toEqual(['ok']);
    expect(deliver([msg(7, 'PAUSE', { via: 'touch' }, 2) as CtrlMsg])).toEqual(['ok']);
  });

  it('drops commands produced for a previous mode (stale epoch), but never a pause', () => {
    const { deliver, hub } = pc();
    hub.setMode('explore'); // 1
    hub.setMode('dialogue'); // 2
    expect(deliver([msg(1, 'INTERACT', { via: 'motion' }, 1) as CtrlMsg])).toEqual(['stale-epoch']);
    expect(deliver([msg(2, 'PAUSE', { via: 'motion' }, 1) as CtrlMsg])).toEqual(['ok']);
    expect(deliver([msg(3, 'INTERACT', { via: 'motion' }, 2) as CtrlMsg])).toEqual(['ok']);
  });

  it('a session change restarts sequence numbering', () => {
    const { gate } = pc('a');
    const ctx = { mode: 'explore' as const, epoch: 0 };
    expect(gate.check('a', { seq: 100, epoch: 0, type: 'HEARTBEAT' }, ctx).ok).toBe(true);
    gate.bind('a');
    expect(gate.check('a', { seq: 100, epoch: 0, type: 'HEARTBEAT' }, ctx).ok).toBe(false);
    gate.bind('b');
    expect(gate.check('b', { seq: 1, epoch: 0, type: 'HEARTBEAT' }, ctx).ok).toBe(true);
  });
});

// ── Phone bridge ───────────────────────────────────────────────────────────
describe('phone controller bridge', () => {
  it('idle standing produces no movement and no turns', () => {
    const p = phone();
    p.bridge.applyMode('explore', 1);
    p.stand(still(400, { noise: { r: rng(11), amp: 0.01 } }));
    expect(p.types().filter((t) => t === 'MOVE_START' || t === 'TURN_LEFT' || t === 'TURN_RIGHT' || t === 'STEP')).toEqual([]);
  });

  it('marching sends MOVE_START (refreshed while marching) and one MOVE_STOP after', () => {
    const p = phone();
    p.bridge.applyMode('explore', 1);
    p.stand([...still(15), ...march(120), ...still(60)]);
    const t = p.types();
    const starts = t.filter((x) => x === 'MOVE_START').length;
    expect(starts).toBeGreaterThanOrEqual(5);
    expect(t.filter((x) => x === 'MOVE_STOP')).toHaveLength(1);
    expect(t.lastIndexOf('MOVE_STOP')).toBeGreaterThan(t.lastIndexOf('MOVE_START'));
  });

  it('one lean sends exactly one TURN; in menus it sends NAV instead', () => {
    const p = phone();
    p.bridge.applyMode('explore', 1);
    p.stand([...still(15), ...still(60, { lean: 12 }), ...still(15), ...still(60, { lean: -12 })]);
    expect(p.types().filter((x) => x.startsWith('TURN'))).toEqual(['TURN_LEFT', 'TURN_RIGHT']);
    p.bridge.applyMode('menu', 2);
    p.stand([...still(15), ...still(60, { lean: -12 })]);
    const nav = p.sent.filter((m) => m.type === 'NAV');
    expect(nav).toHaveLength(1);
    expect(nav[0]).toMatchObject({ dir: 1, epoch: 2 });
    expect(p.types().filter((x) => x.startsWith('TURN'))).toHaveLength(2);
  });

  it('marching in a menu never sends movement', () => {
    const p = phone();
    p.bridge.applyMode('menu', 1);
    p.stand([...still(15), ...march(120)]);
    expect(p.types().filter((x) => x === 'MOVE_START' || x === 'STEP')).toEqual([]);
  });

  it('exercise mode runs only the requested detector and sends reps — no movement, gestures or turns', () => {
    const p = phone();
    p.bridge.applyMode('exercise', 1);
    p.bridge.handle({ type: 'EXERCISE_BEGIN', setId: 'set-1', exerciseId: 'pushup', difficulty: 'beginner' });
    const angles = [...hold(170, 130)];
    for (let i = 0; i < 3; i++) angles.push(...cycle(170, 80), ...hold(170, 6));
    p.feed(angles.map((a) => (t: number) => pushupPose(a, t)));
    const reps = p.sent.filter((m) => m.type === 'EXERCISE_REP');
    expect(reps.map((r) => (r as Extract<CtrlMsg, { type: 'EXERCISE_REP' }>).index)).toEqual([1, 2, 3]);
    expect(p.types().filter((x) => /MOVE|TURN|NAV|INTERACT|BACK|PAUSE/.test(x))).toEqual([]);
    // Jumping jacks during a push-up set count nothing.
    const before = reps.length;
    p.feed(Array.from({ length: 150 }, (_, i) => (t: number) => jackPose((Math.sin(i * 0.3) + 1) / 2, (Math.sin(i * 0.3) + 1) / 2, t)));
    expect(p.sent.filter((m) => m.type === 'EXERCISE_REP')).toHaveLength(before);
  });

  it('never sends camera frames or landmarks', () => {
    const p = phone();
    p.bridge.applyMode('explore', 1);
    p.stand([...still(15), ...march(60), ...still(30, { lean: 12 })]);
    const json = JSON.stringify(p.sent);
    expect(json).not.toMatch(/landmarks|visibility|data:image|"x":|"y":/);
    expect(Math.max(...p.sent.map((m) => JSON.stringify(m).length))).toBeLessThan(600);
  });
});

// ── End to end: phone bridge → gate → PC hub ───────────────────────────────
describe('phone → PC pipeline', () => {
  it('marching on the phone moves the hero on the PC; standing still does not', () => {
    const p = phone();
    const { hub, deliver } = pc();
    hub.setMode('explore');
    p.bridge.applyMode('explore', hub.epoch);
    p.stand(still(60));
    deliver(p.sent.splice(0), p.now());
    expect(hub.intent(p.now()).forward).toBe(0);
    p.stand(march(90));
    deliver(p.sent.splice(0), p.now());
    expect(hub.intent(p.now()).forward).toBeGreaterThan(0);
  });

  it('one lean on the phone turns the hero once on the PC', () => {
    const p = phone();
    const { hub, deliver } = pc();
    hub.setMode('explore');
    p.bridge.applyMode('explore', hub.epoch);
    p.stand([...still(15), ...still(120, { lean: 12 })]);
    deliver(p.sent.splice(0), p.now());
    expect(hub.takeTurns()).toBe(-1);
  });

  it('movement stops when the phone goes silent (dead-man timeout) or is lost', () => {
    const p = phone();
    const { hub, deliver } = pc();
    hub.setMode('explore');
    p.bridge.applyMode('explore', hub.epoch);
    p.stand([...still(15), ...march(90)]);
    const t = p.now();
    deliver(p.sent.splice(0), t);
    expect(hub.intent(t).forward).toBeGreaterThan(0);
    // Connection drops mid-march: no MOVE_STOP ever arrives.
    expect(hub.intent(t + MOVE_TIMEOUT_MS + 50).forward).toBe(0);
    // And on an explicit disconnect it stops immediately.
    deliver([{ seq: 10_000, epoch: hub.epoch, type: 'MOVE_START', intensity: 1 }], t);
    hub.stop();
    expect(hub.intent(t).forward).toBe(0);
  });
});

// ── Remote exercise sets ───────────────────────────────────────────────────
describe('remote exercise set (PC is authoritative)', () => {
  const rep = (index: number, extra: Partial<Extract<CtrlMsg, { type: 'EXERCISE_REP' }>> = {}) => ({ seq: index, epoch: 1, type: 'EXERCISE_REP' as const, setId: 'set-1', exerciseId: 'pushup', index, source: 'camera' as const, ...extra });
  const active = { seq: 1, epoch: 1, type: 'EXERCISE_STATUS' as const, setId: 'set-1', stage: 'active' as const, countdownLeftMs: 0, tracking: 'good' as const, confidence: 0.9, guidance: null, ready: true, fallbackAvailable: false };
  const make = (target = 3) => {
    const events: ExerciseEvent[] = [];
    const out: GameMsg[] = [];
    const set = new RemoteSet('set-1', getExercise('pushup'), target, (e) => events.push(e), (m) => out.push(m), 'beginner');
    return { set, events, out, reps: () => events.filter((e) => e.type === 'rep') };
  };

  it('counts valid reps and completes the set at the target', () => {
    const { set, events, out } = make(3);
    expect(out[0]).toMatchObject({ type: 'EXERCISE_BEGIN', setId: 'set-1', exerciseId: 'pushup' });
    set.status(active);
    expect([1, 2, 3].map((i) => set.rep(rep(i), i * 1000))).toEqual(['accepted', 'accepted', 'accepted']);
    expect(events.map((e) => e.type)).toEqual(['rep', 'rep', 'rep', 'setComplete']);
    expect(events[3]).toMatchObject({ verification: 'camera', completed: 3 });
    expect(out.some((m) => m.type === 'EXERCISE_END')).toBe(true);
  });

  it('ignores duplicate rep events (resends after a reconnect)', () => {
    const { set, reps } = make(5);
    set.status(active);
    expect(set.rep(rep(1), 1000)).toBe('accepted');
    expect(set.rep(rep(1), 1500)).toBe('duplicate');
    expect(set.rep(rep(1, { seq: 99 }), 2000)).toBe('duplicate');
    expect(reps()).toHaveLength(1);
  });

  it('ignores invalid rep events: wrong set, wrong exercise, too fast, before the set is live, after it ends', () => {
    const { set, reps } = make(2);
    expect(set.rep(rep(1), 1000)).toBe('not-active'); // still in setup/countdown on the phone
    set.status(active);
    expect(set.rep(rep(1, { setId: 'old-set' }), 1000)).toBe('wrong-set');
    expect(set.rep(rep(1, { exerciseId: 'squat' }), 1000)).toBe('wrong-exercise');
    expect(set.rep(rep(1, { source: 'manual' }), 1000)).toBe('manual-off');
    expect(set.rep(rep(1), 1000)).toBe('accepted');
    expect(set.rep(rep(2), 1100)).toBe('too-fast');
    expect(set.rep(rep(3), 2000)).toBe('accepted');
    expect(set.rep(rep(4), 3000)).toBe('complete');
    expect(reps()).toHaveLength(2);
  });

  it('no reps count while paused (e.g. the controller disconnected)', () => {
    const { set, reps, out } = make(5);
    set.status(active);
    set.pause();
    expect(out.at(-1)).toMatchObject({ type: 'EXERCISE_PROGRESS', paused: true });
    expect(set.rep(rep(1), 1000)).toBe('paused');
    set.resume(2000);
    expect(set.rep(rep(2), 3000)).toBe('accepted');
    expect(reps()).toHaveLength(1);
  });

  it('manual counting is opt-in and stays labelled manual', () => {
    const { set, events } = make(2);
    set.requestManual({ seq: 1, epoch: 1, type: 'MANUAL_MODE', setId: 'set-1' });
    expect(set.rep(rep(1, { source: 'manual' }), 1000)).toBe('accepted');
    set.manualRep();
    expect(events.at(-1)).toMatchObject({ type: 'setComplete', verification: 'manual' });
  });

  it('drives the same combat engine to the same result as a local set', () => {
    const stats = statsFor(1, { atk: 0, def: 0, mag: 0 });
    const fight = (remote: boolean) => {
      const engine = new CombatEngine(trialEnemy('skeleton', stats, DEFAULT_TARGETS), stats, () => 0.5);
      const plan = encounterPlan('skeleton', DEFAULT_TARGETS)[0];
      engine.beginSet(plan.exerciseId);
      if (remote) {
        const set = new RemoteSet('s1', getExercise(plan.exerciseId), plan.target, (e) => engine.handle(e), () => {}, 'beginner');
        set.status({ ...active, setId: 's1' });
        for (let i = 1; i <= plan.target; i++) set.rep(rep(i, { setId: 's1' }), i * 1000);
      } else {
        for (let i = 1; i <= plan.target; i++) engine.handle({ type: 'rep', exerciseId: plan.exerciseId, index: i, target: plan.target, source: 'camera' });
        engine.handle({ type: 'setComplete', exerciseId: plan.exerciseId, verification: 'camera', completed: plan.target, target: plan.target });
      }
      return { outcome: engine.state.outcome, enemyHp: engine.state.enemyHp };
    };
    expect(fight(true)).toEqual(fight(false));
    expect(fight(true).outcome).toBe('victory');
  });
});

// ── Host link: disconnects ─────────────────────────────────────────────────
class FakeSocket {
  static last: FakeSocket;
  readyState = 1;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
    queueMicrotask(() => this.onopen?.());
  }
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close() {
    this.readyState = 3;
  }
  recv(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}

describe('host link', () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
    const g = globalThis as Record<string, unknown>;
    g.window = globalThis;
    g.WebSocket = FakeSocket;
    const store = new Map<string, string>();
    g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function connected() {
    const hub = new InputHub();
    const link = new HostLink(hub);
    link.start('ws://test/relay');
    await Promise.resolve();
    const ws = FakeSocket.last;
    ws.recv({ relay: 'room', room: 'r', key: 'k', pairing: { code: '123456', token: 't', expiresAt: Date.now() + 60_000, urls: [] }, controller: null });
    ws.recv({ relay: 'peer', state: 'joined', sid: 'S' });
    hub.setMode('explore');
    let seq = 0;
    const send = (m: object) => ws.recv({ relay: 'msg', sid: 'S', msg: { seq: ++seq, epoch: hub.epoch, ...m } });
    return { hub, link, ws, send };
  }

  it('tells the phone the authoritative mode', async () => {
    const { ws, hub } = await connected();
    expect(ws.sent).toContainEqual({ type: 'MODE', mode: 'explore', epoch: hub.epoch });
  });

  it('a disconnect stops movement at once', async () => {
    const { hub, link, ws, send } = await connected();
    send({ type: 'MOVE_START', intensity: 1 });
    expect(hub.intent(now).forward).toBe(1);
    ws.recv({ relay: 'peer', state: 'left', sid: 'S' });
    expect(link.state.controller).toBe('lost');
    expect(hub.intent(now).forward).toBe(0);
  });

  it('a silent phone is treated as lost within a few seconds', async () => {
    const { hub, link, send } = await connected();
    send({ type: 'MOVE_START', intensity: 1 });
    now = 3500;
    vi.advanceTimersByTime(600);
    expect(link.state.controller).toBe('lost');
    expect(hub.intent(now).forward).toBe(0);
  });

  it('only reports ready once the phone is back with camera, calibration and tracking', async () => {
    const { link, send, ws } = await connected();
    ws.recv({ relay: 'peer', state: 'left', sid: 'S' });
    expect(link.ready).toBe(false);
    ws.recv({ relay: 'peer', state: 'resumed', sid: 'S' });
    expect(link.ready).toBe(false);
    send({ type: 'STATUS', camera: 'running', model: 'ready', calibrated: false, tracking: 'good' });
    expect(link.ready).toBe(false);
    send({ type: 'STATUS', camera: 'running', model: 'ready', calibrated: true, tracking: 'good' });
    expect(link.ready).toBe(true);
  });

  it('acknowledges every rep so the phone stops resending, but counts only valid ones', async () => {
    const { hub, link, ws, send } = await connected();
    hub.setMode('exercise');
    const events: ExerciseEvent[] = [];
    link.activeSet = new RemoteSet('set-9', getExercise('squat'), 5, (e) => events.push(e), (m) => link.send(m), 'beginner');
    send({ type: 'EXERCISE_STATUS', setId: 'set-9', stage: 'active', countdownLeftMs: 0, tracking: 'good', confidence: 1, guidance: null, ready: true, fallbackAvailable: false });
    now = 1000;
    send({ type: 'EXERCISE_REP', setId: 'set-9', exerciseId: 'squat', index: 1, source: 'camera' });
    now = 2000;
    send({ type: 'EXERCISE_REP', setId: 'set-9', exerciseId: 'pushup', index: 2, source: 'camera' });
    expect(events.filter((e) => e.type === 'rep')).toHaveLength(1);
    expect(ws.sent.filter((m) => (m as { type: string }).type === 'ACK')).toHaveLength(2);
    expect(link.rejected['rep:wrong-exercise']).toBe(1);
  });
});
