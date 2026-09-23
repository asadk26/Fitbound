import { describe, expect, it } from 'vitest';
import { CombatEngine, type CombatEffect } from '../src/combat/CombatEngine';
import { ENEMIES } from '../src/combat/enemies';
import { PushupDetector } from '../src/exercise/detectors/pushup';
import { getExercise } from '../src/exercise/registry';
import { ExerciseSessionController } from '../src/exercise/session';
import type { ExerciseEvent } from '../src/exercise/types';
import { statsFor } from '../src/game/progression';
import { cycle, FRAME_MS, hold, pushupPose } from '../src/testing/poses';

const stats = statsFor(1, { atk: 0, def: 0, mag: 0 }); // atk/def/mag 10, hp 100
const fixedRng = () => 0.5; // variance multiplier exactly 1.0

const rep = (exerciseId: string, index: number, target: number, source: 'camera' | 'manual' = 'camera'): ExerciseEvent => ({ type: 'rep', exerciseId, index, target, source });
const done = (exerciseId: string, target: number): ExerciseEvent => ({ type: 'setComplete', exerciseId, verification: 'camera', completed: target, target });

describe('CombatEngine', () => {
  it('a push-up rep deals Sword Slash damage and lowers enemy HP', () => {
    const e = new CombatEngine(ENEMIES.skeleton, stats, fixedRng);
    const fx = e.handle(rep('pushup', 1, 5));
    // atk 10 × 3 / 5 reps = 6 per rep, skeleton has no physical resist
    expect(fx).toEqual([expect.objectContaining({ kind: 'hit', damage: 6, hp: 64, finisher: false, manual: false })]);
    expect(e.state.enemyHp).toBe(64);
  });

  it('completing the push-up set adds a finisher on top of the reps', () => {
    const e = new CombatEngine(ENEMIES.skeleton, stats, fixedRng);
    for (let i = 1; i <= 5; i++) e.handle(rep('pushup', i, 5));
    const fx = e.handle(done('pushup', 5));
    expect(fx.find((f) => f.kind === 'hit')).toMatchObject({ damage: 20, finisher: true });
    expect(e.state.enemyHp).toBe(70 - 30 - 20);
  });

  it('per-set damage is the same whatever the rep target', () => {
    const run = (target: number) => {
      const e = new CombatEngine(ENEMIES.skeleton, stats, fixedRng);
      for (let i = 1; i <= target; i++) e.handle(rep('pushup', i, target));
      e.handle(done('pushup', target));
      return e.state.enemyHp;
    };
    expect(Math.abs(run(3) - run(8))).toBeLessThanOrEqual(2);
  });

  it('squat reps build a shield that absorbs the next enemy attack', () => {
    const e = new CombatEngine(ENEMIES.skeleton, stats, fixedRng);
    for (let i = 1; i <= 8; i++) e.handle(rep('squat', i, 8));
    const fx = e.handle(done('squat', 8));
    expect(fx.some((f) => f.kind === 'shield' && f.finisher)).toBe(true);
    const shield = e.state.shield;
    expect(shield).toBeGreaterThan(30);
    const atk = e.enemyTurn().find((f): f is Extract<CombatEffect, { kind: 'enemyAttack' }> => f.kind === 'enemyAttack')!;
    expect(atk.damage).toBe(0);
    expect(atk.absorbed).toBe(7);
    expect(e.state.playerHp).toBe(100);
  });

  it('arcane burst ignores the golem’s physical resistance', () => {
    const phys = new CombatEngine(ENEMIES.golem, stats, fixedRng);
    phys.handle(done('pushup', 5));
    const magic = new CombatEngine(ENEMIES.golem, stats, fixedRng);
    magic.handle(done('jumping_jack', 10));
    expect(110 - phys.state.enemyHp).toBe(14); // 20 × 0.7
    expect(110 - magic.state.enemyHp).toBe(40); // 40 × 1.0
  });

  it('switching exercises between sets earns a combo', () => {
    const e = new CombatEngine(ENEMIES.skeleton, { ...stats, atk: 10 }, fixedRng);
    e.beginSet('pushup');
    e.handle(done('pushup', 5));
    expect(e.beginSet('jumping_jack')).toEqual([{ kind: 'combo', mult: 1.25 }]);
    expect(e.beginSet('jumping_jack')).toEqual([{ kind: 'combo', mult: 1.25 }]);
    e.handle(done('jumping_jack', 10));
    expect(e.beginSet('jumping_jack')).toEqual([]);
  });

  it('manual reps still work in combat but are flagged and counted separately', () => {
    const e = new CombatEngine(ENEMIES.skeleton, stats, fixedRng);
    const fx = e.handle(rep('pushup', 1, 5, 'manual'));
    expect(fx[0]).toMatchObject({ kind: 'hit', manual: true });
    expect(e.state.repsBySource).toEqual({ camera: 0, manual: 1 });
  });

  it('reports victory when enemy HP reaches zero', () => {
    const e = new CombatEngine(ENEMIES.skeleton, { ...stats, atk: 100 }, fixedRng);
    const fx = e.handle(done('pushup', 5));
    expect(fx.at(-1)).toEqual({ kind: 'victory' });
    expect(e.state.outcome).toBe('victory');
    expect(e.enemyTurn()).toEqual([]);
  });

  it('the boss needs three different exercises, one per phase', () => {
    const e = new CombatEngine(ENEMIES.warden, stats, fixedRng);
    expect(e.currentPhase?.required).toBe('pushup');
    const p1 = e.handle(done('pushup', 5));
    expect(p1).toContainEqual({ kind: 'phaseBreak', phase: 0, name: 'Iron Armor', nextPhase: 1 });
    expect(e.state.enemyHp).toBe(160);
    e.enemyTurn();
    expect(e.currentPhase?.required).toBe('squat');
    e.handle(done('squat', 8));
    expect(e.state.enemyHp).toBe(80);
    e.enemyTurn();
    expect(e.currentPhase?.required).toBe('jumping_jack');
    // Off-type damage is reduced during a phase
    const off = e.handle(done('pushup', 5)).find((f) => f.kind === 'hit');
    expect(off).toMatchObject({ damage: Math.round(20 * 0.4) });
    const fin = e.handle(done('jumping_jack', 10));
    expect(fin.at(-1)).toEqual({ kind: 'victory' });
  });

  it('boss phases can also be worn down without the required exercise', () => {
    const e = new CombatEngine(ENEMIES.warden, { ...stats, mag: 60 }, fixedRng);
    const fx = e.handle(done('jumping_jack', 10));
    expect(fx.some((f) => f.kind === 'phaseBreak')).toBe(true);
    expect(e.state.enemyHp).toBe(160);
  });

  it('plank hold ticks heal and completion shields', () => {
    const e = new CombatEngine(ENEMIES.skeleton, stats, fixedRng);
    e.state.playerHp = 50;
    e.handle({ type: 'holdTick', exerciseId: 'plank', heldMs: 5000, targetMs: 20000, source: 'camera' });
    expect(e.state.playerHp).toBe(55);
    e.handle({ type: 'setComplete', exerciseId: 'plank', verification: 'camera', completed: 20, target: 20 });
    expect(e.state.playerHp).toBe(80);
    expect(e.state.shield).toBe(20);
  });
});

describe('exercise → combat integration', () => {
  it('camera-verified push-ups flow through the session into enemy damage', () => {
    const events: ExerciseEvent[] = [];
    const engine = new CombatEngine(ENEMIES.skeleton, stats, fixedRng);
    const effects: CombatEffect[] = [];
    const session = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 3, (ev) => {
      events.push(ev);
      effects.push(...engine.handle(ev));
    });

    let t = 0;
    const feed = (angles: number[]) => {
      for (const a of angles) {
        t += FRAME_MS;
        session.update(pushupPose(a, t), t);
      }
    };
    feed(hold(170, 40)); // setup + ready hold
    expect(session.update(pushupPose(170, t), t).stage).toBe('countdown');
    // A push-up done during the countdown must not count.
    feed(cycle(170, 80));
    feed(hold(170, 100));
    expect(session.update(pushupPose(170, t), t).stage).toBe('active');
    expect(events).toHaveLength(0);

    for (let i = 0; i < 3; i++) feed([...cycle(170, 80), ...hold(170, 3)]);

    expect(events.map((e) => e.type)).toEqual(['rep', 'rep', 'rep', 'setComplete']);
    expect(events.every((e) => e.type !== 'rep' || e.source === 'camera')).toBe(true);
    expect(events[3]).toMatchObject({ verification: 'camera' });
    // 3 reps × (30/3) + finisher 20
    expect(engine.state.enemyHp).toBe(70 - 30 - 20);
    expect(effects.filter((f) => f.kind === 'hit')).toHaveLength(4);
  });

  it('manual fallback reps are tagged manual and the set is not reported as camera-verified', () => {
    const events: ExerciseEvent[] = [];
    const session = new ExerciseSessionController(getExercise('squat'), null, 2, (ev) => events.push(ev));
    session.update(null, 0);
    expect(session.update(null, 10).fallbackAvailable).toBe(true);
    session.manualRep(); // ignored until manual mode is chosen
    expect(events).toHaveLength(0);
    session.enableManualMode();
    session.manualRep();
    session.manualRep();
    expect(events).toEqual([
      { type: 'rep', exerciseId: 'squat', index: 1, target: 2, source: 'manual' },
      { type: 'rep', exerciseId: 'squat', index: 2, target: 2, source: 'manual' },
      { type: 'setComplete', exerciseId: 'squat', verification: 'manual', completed: 2, target: 2 },
    ]);
  });

  it('stopping a set early reports the reps done and ends without a finisher', () => {
    const events: ExerciseEvent[] = [];
    const session = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 5, (ev) => events.push(ev));
    session.stop();
    expect(events).toEqual([{ type: 'setEnded', exerciseId: 'pushup', completed: 0, target: 5, reason: 'stopped' }]);
  });
});
