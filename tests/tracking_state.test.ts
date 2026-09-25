import { describe, expect, it } from 'vitest';
import { ControllerBridge } from '../src/controller/bridge';
import { PushupDetector } from '../src/exercise/detectors/pushup';
import { getExercise } from '../src/exercise/registry';
import { ExerciseSessionController, trialSessionOptions } from '../src/exercise/session';
import type { ExerciseEvent } from '../src/exercise/types';
import { deadzone, GamepadInput } from '../src/input/gamepad';
import { InputHub, type InputEvent } from '../src/input/InputHub';
import type { CtrlMsg } from '../src/net/protocol';
import { DodgeReader, StrikeTimer } from '../src/rpg/dodge';
import { RpgEngine } from '../src/rpg/engine';
import { cycle, FRAME_MS, hold, pushupPose, squatPose } from '../src/testing/poses';

const pad = (axes: number[], pressed: number[] = []) => ({ index: 0, connected: true, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })) }) as unknown as Gamepad;

describe('couch play: nobody in view', () => {
  it('gamepad exploration and menus work with no visible person', () => {
    const hub = new InputHub();
    const evs: InputEvent[] = [];
    hub.on((e) => evs.push(e));
    const g = new GamepadInput(hub, () => {});
    hub.setMode('explore');
    // The camera sees nobody for a long time.
    for (let t = 0; t < 5000; t += FRAME_MS) hub.feed(null, t);
    g.poll([pad([1, 0])]);
    expect(hub.freeMove().x).toBeCloseTo(deadzone(1, 0).x);
    g.poll([pad([0, 0], [0])]);
    expect(evs.map((e) => e.type)).toContain('confirm');
    // Menus: d-pad and A.
    hub.setMode('menu');
    g.poll([pad([0, 0], [15])]);
    g.poll([pad([0, 0], [])]);
    g.poll([pad([0, 0], [0])]);
    expect(evs.slice(-2).map((e) => e.type)).toEqual(['nav', 'confirm']);
    // Between sets, Continue on the gamepad counts as ready without standing in view.
    hub.setMode('ready');
    g.poll([pad([0, 0], [])]);
    g.poll([pad([0, 0], [0])]);
    expect(evs.at(-1)!.type).toBe('ready');
  });

  it('the phone sends no "what the camera sees" warnings while you are in menus', () => {
    let seq = 0;
    let now = 0;
    const sent: CtrlMsg[] = [];
    const b = new ControllerBridge((p) => sent.push({ ...p, seq: ++seq, epoch: b.epoch } as CtrlMsg), () => now);
    for (const m of ['menu', 'dialogue'] as const) {
      b.applyMode(m, seq + 1);
      for (let i = 0; i < 120; i++) b.frame(null, (now += FRAME_MS));
    }
    expect(sent.some((m) => m.type === 'VIEW' && m.view)).toBe(false);
    // ...but as soon as physical play begins, it does.
    b.applyMode('dodge', 99);
    for (let i = 0; i < 60; i++) b.frame(null, (now += FRAME_MS));
    expect(sent.some((m) => m.type === 'VIEW' && m.view)).toBe(true);
  });
});

describe('tracking becomes required when physical play begins', () => {
  it('a set does not start (no countdown, no counting) until you are tracked in position', () => {
    const evs: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 5, (e) => evs.push(e), trialSessionOptions('pushup'));
    let t = 0;
    for (let i = 0; i < 600; i++) s.update(null, (t += FRAME_MS)); // 20 s, nobody there
    expect(s.update(null, t).stage).toBe('setup');
    for (const a of [...hold(170, 12), ...cycle(170, 80), ...hold(170, 4)]) s.update(pushupPose(a, (t += FRAME_MS)), t);
    expect(evs.filter((e) => e.type === 'rep')).toHaveLength(1);
  });

  it('no enemy strike runs its clock, and no dodge counts, until a standing baseline exists', () => {
    const r = new DodgeReader();
    const st = new StrikeTimer('high');
    let t = 0;
    for (let i = 0; i < 200; i++) {
      t += FRAME_MS;
      const s = r.update(null, t);
      st.update(t, s.baseline ? { tracking: s.tracking, ducking: s.ducking, hops: s.hops } : { tracking: 'lost', ducking: false, hops: 0 });
    }
    expect(st.outcome).toBeNull();
    expect(st.state).toBe('waiting');
    // Step in, stand still, then duck in time.
    for (let i = 0; i < 20; i++) r.update(squatPose(0, (t += FRAME_MS)), t);
    let res = null;
    for (let i = 0; i < 200 && !res; i++) {
      t += FRAME_MS;
      const s = r.update(squatPose(st.impactIn < 700 ? 75 : 0, t), t);
      res = st.update(t, { tracking: s.tracking, ducking: s.ducking, hops: s.hops });
    }
    expect(res).toBe('dodged');
  });
});

describe('camera loss during physical play is safe', () => {
  it('losing the camera mid-strike is never a failed dodge, and costs no HP', () => {
    const e = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, { upper: 'sunder', legs: 'quake', cardio: 'arc', core: 'aegis' });
    e.useAbility('legs', { done: 1, target: 8, sided: false, full: false });
    const { strikes } = e.startEnemyTurn();
    const st = new StrikeTimer(strikes[0].height);
    let t = 0;
    let res = null;
    for (let i = 0; i < 400 && !res; i++) {
      t += 33;
      res = st.update(t, t < 2000 ? { tracking: 'good', ducking: false, hops: 0 } : { tracking: 'lost', ducking: false, hops: 0 });
    }
    expect(res).toBe('unclear');
    e.resolveStrike(strikes[0], res!);
    expect(e.hero.hp).toBe(100);
  });
});
