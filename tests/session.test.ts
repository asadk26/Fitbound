import { describe, expect, it } from 'vitest';
import { EXERCISES, getExercise } from '../src/exercise/registry';
import { RpgEngine, type SetWork } from '../src/rpg/engine';
import { abilityLoadout, loadExpedition, newExpedition, sanitizeExpedition, saveExpedition, type ExpeditionState } from '../src/rpg/expedition';
import { DEFAULT_PREFS, generateLoadout, setTarget, type Calibrations, type DayPrefs } from '../src/rpg/loadout';
import { activeLoadout, applyReadiness, dayOf, expeditionSets, hasWork, needsReadiness, sessionRecord, startSession, upsertRecord } from '../src/rpg/session';
import { addSet, type SetRecord } from '../src/rpg/workout';
import { rng } from '../src/testing/poses';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const prefs = (p: Partial<DayPrefs> = {}): DayPrefs => ({ ...DEFAULT_PREFS, ...p });
const allChecked: Calibrations = Object.fromEntries(EXERCISES.map((e) => [e.id, { at: 1, reps: 5 }]));
const DAY = 86_400_000;
const T0 = new Date(2026, 8, 20, 18, 0).getTime();

function run(): ExpeditionState {
  const lo = generateLoadout(prefs(), allChecked, [], rng(3));
  const targets = Object.fromEntries(Object.values(lo).flatMap((s) => (s ? [[s.exerciseId, setTarget(getExercise(s.exerciseId), prefs(), {})]] : [])));
  return newExpedition('standard', prefs(), lo, targets, T0);
}
const set = (id: string, at: number): SetRecord => ({
  exerciseId: id,
  family: getExercise(id).family,
  at,
  camera: 8,
  manual: 0,
  left: 0,
  right: 0,
  holdMs: 0,
  target: 8,
  full: true,
  finishedEarly: false,
  activeMs: 20000,
});
const full = (): SetWork => ({ done: 10, target: 10, sided: false, full: true });

describe('workout sessions within an expedition', () => {
  it('a resume starts a new session; the old one is folded in once and never repeated', () => {
    const x = run();
    addSet(x.workout, set('squat', T0 + 60_000));
    addSet(x.workout, set('pushup', T0 + 120_000));
    const firstId = x.workout.id;
    const y = startSession(x, T0 + DAY);
    expect(y.workout.id).not.toBe(firstId);
    expect(y.workout.sets).toHaveLength(0);
    expect(y.earlier).toEqual({ sessions: [firstId], sets: 2 });
    expect(expeditionSets(y)).toBe(2);
    // The same expedition, fight state and all.
    expect(y.id).toBe(x.id);
    expect(y.index).toBe(x.index);
    // Resuming again without doing anything doesn't count the empty session or double the old one.
    const z = startSession(y, T0 + DAY + 1000);
    expect(z.earlier).toEqual({ sessions: [firstId], sets: 2 });
  });

  it('asks how you feel only on a different day', () => {
    const x = run();
    addSet(x.workout, set('squat', T0 + 60_000));
    expect(needsReadiness(x, T0 + 3 * 3600_000)).toBe(false);
    expect(needsReadiness(x, T0 + DAY)).toBe(true);
    expect(dayOf(T0)).toBe('2026-09-20');
  });

  it('each session gets its own history row, tagged with its expedition; re-recording replaces, keeping the check-in', () => {
    const x = run();
    addSet(x.workout, set('squat', T0 + 60_000));
    const rec = sessionRecord(x);
    expect(rec.expedition).toBe(x.id);
    let h = upsertRecord([], { ...rec, feedback: { effort: 'right' } });
    h = upsertRecord(h, { ...sessionRecord(x), outcome: 'suspended' });
    expect(h).toHaveLength(1);
    expect(h[0].outcome).toBe('suspended');
    expect(h[0].feedback).toEqual({ effort: 'right' });
    const y = startSession(x, T0 + DAY);
    addSet(y.workout, set('pushup', T0 + DAY + 60_000));
    h = upsertRecord(h, sessionRecord(y));
    expect(h.map((r) => r.expedition)).toEqual([x.id, x.id]);
    expect(h[1].volume).toEqual({ pushup: { sets: 1, work: 8 } });
  });

  it("today's readiness sets today's targets; a resting family sits out without losing its slot", () => {
    const x = run();
    const legs = x.loadout.legs!.exerciseId;
    const easy = applyReadiness(x, prefs({ intensity: 'easy', sore: { legs: 'rest' }, soreAt: T0 }), {});
    expect(easy.targets[legs]).toBeLessThanOrEqual(x.targets[legs]);
    expect(easy.workout.intensity).toBe('easy');
    expect(activeLoadout(easy).legs).toBeNull();
    expect(easy.loadout.legs?.exerciseId).toBe(legs);
    // Resuming never raises a target by itself.
    const same = applyReadiness(x, prefs(), {});
    for (const [id, t] of Object.entries(same.targets)) expect(t).toBe(x.targets[id]);
  });

  it('a session with nothing done leaves no history row', () => {
    expect(hasWork(run())).toBe(false);
  });
});

describe('fights saved at a safe point', () => {
  it('a restored fight carries on identically', () => {
    const x = run();
    const lo = abilityLoadout(x.loadout);
    const a = new RpgEngine(['iron_husk', 'haze_wisp'], { hp: 80, maxHp: 100 }, lo, { blessings: [] });
    const fam = (['upper', 'legs', 'cardio', 'core'] as const).find((f) => a.available(f))!;
    a.useAbility(fam, full());
    const t = a.startEnemyTurn();
    for (const s of t.strikes.slice(0, 1)) a.resolveStrike(s, 'hit');
    const snap = a.snapshot();
    const b = RpgEngine.restore(structuredClone(snap), lo, { blessings: [] })!;
    expect(b.snapshot()).toEqual(snap);
    // Both finish the turn the same way.
    for (const s of t.strikes.slice(1)) {
      a.resolveStrike(s, 'dodged');
      b.resolveStrike(s, 'dodged');
    }
    a.endEnemyTurn();
    b.endEnemyTurn();
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(b.hero.hp).toBe(a.hero.hp);
  });

  it('a save naming a vanished enemy is refused (the fight restarts instead)', () => {
    const e = new RpgEngine(['iron_husk'], { hp: 100, maxHp: 100 }, {}, {});
    const snap = e.snapshot();
    snap.foes[0].def = 'no_such_enemy';
    expect(RpgEngine.restore(snap, {}, {})).toBeNull();
  });

  it('the expedition keeps its saved fight, but only for the node it belongs to', () => {
    const store = new Mem();
    const x = run();
    x.index = 1;
    const e = new RpgEngine(['iron_husk'], { hp: 90, maxHp: 100 }, {}, {});
    e.foes[0].hp = 7;
    x.battle = { index: 1, engine: e.snapshot(), phase: 'choose' };
    x.earlier = { sessions: ['w1'], sets: 5 };
    saveExpedition(x, store);
    const back = loadExpedition(store)!;
    expect(back.battle?.engine.foes[0].hp).toBe(7);
    expect(back.earlier).toEqual({ sessions: ['w1'], sets: 5 });
    expect(sanitizeExpedition({ ...x, index: 2 })!.battle).toBeUndefined();
    const bad = structuredClone(x);
    bad.battle!.engine.foes[0].def = 'nope';
    expect(sanitizeExpedition(bad)!.battle).toBeUndefined();
    // Saves from before sessions existed still load.
    const old = structuredClone(x) as Partial<ExpeditionState>;
    delete old.battle;
    delete old.earlier;
    expect(sanitizeExpedition(old)).not.toBeNull();
  });
});

describe('workout time', () => {
  it('counts sets, dodging, recovery, setup, active marching and the Haven; exercise time stays separate', async () => {
    const { addPhysical, workoutTime, newWorkout, toRecord } = await import('../src/rpg/workout');
    const w = newWorkout('normal', 21, 0);
    addSet(w, { ...set('squat', 1000), activeMs: 60_000 });
    addSet(w, { ...set('pushup', 2000), activeMs: 30_000 });
    addPhysical(w, 'dodge', 45_000);
    addPhysical(w, 'recovery', 120_000);
    addPhysical(w, 'setup', 15_000);
    addPhysical(w, 'march', 90_000);
    addPhysical(w, 'march', 0);
    w.recoveryMs = 180_000;
    const t = workoutTime(w);
    expect(t).toEqual({ exercise: 90_000, dodge: 45_000, recovery: 120_000, setup: 15_000, march: 90_000, haven: 180_000, total: 540_000 });
    const r = toRecord(w);
    expect(r.workoutMin).toBe(9);
    expect(r.exerciseMin).toBe(1.5);
  });
});
