import { describe, expect, it } from 'vitest';
import { EXERCISES, FAMILIES, getExercise } from '../src/exercise/registry';
import { defaultSave, loadSave, sanitize, writeSave } from '../src/game/save';
import { abilityLoadout, atPhaseBoundary, currentNode, loadExpedition, newExpedition, ROUTES, saveExpedition, validateContent } from '../src/rpg/expedition';
import { alternatives, DEFAULT_PREFS, eligibility, generateLoadout, rerollAll, rerollSlot, setTarget, type Calibrations, type DayPrefs } from '../src/rpg/loadout';
import { addSet, completion, toRecord, totals, type SetRecord } from '../src/rpg/workout';
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

describe('eligibility and loadouts', () => {
  it('never uses equipment you did not confirm, excluded movements, or experimental ones unless opted in', () => {
    const r = rng(1);
    for (let i = 0; i < 200; i++) {
      const l = generateLoadout(prefs({ exclude: ['squat'] }), allChecked, [], r);
      for (const f of FAMILIES) {
        const ex = getExercise(l[f]!.exerciseId);
        expect(ex.equipment).toEqual([]);
        expect(ex.id).not.toBe('squat');
        expect(ex.reliability).not.toBe('experimental');
        expect(ex.family).toBe(f);
      }
    }
  });

  it('dumbbells unlock rows and curls — rows only with a support', () => {
    const seen = new Set<string>();
    const r = rng(2);
    for (let i = 0; i < 300; i++) seen.add(generateLoadout(prefs({ dumbbells: true, experimental: true }), allChecked, [], r).upper!.exerciseId);
    expect(seen.has('bicep_curl')).toBe(true);
    expect(seen.has('dumbbell_row')).toBe(false);
    for (let i = 0; i < 300; i++) seen.add(generateLoadout(prefs({ dumbbells: true, support: true, experimental: true }), allChecked, [], r).upper!.exerciseId);
    expect(seen.has('dumbbell_row')).toBe(true);
  });

  it('only checked (calibrated) movements enter ordinary selection; a family with none gets a first-time check', () => {
    const r = rng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const l = generateLoadout(prefs(), {}, [], r);
      for (const f of FAMILIES) {
        const s = l[f]!;
        seen.add(s.exerciseId);
        const ex = getExercise(s.exerciseId);
        if (ex.reliability !== 'stable') expect(s.firstCheck).toBe(true);
      }
    }
    // Stable families never fall back to unchecked movements.
    expect(seen.has('reverse_lunge')).toBe(false);
    expect(seen.has('high_knees')).toBe(false);
    // Core has no stable movement: plank (beta) is offered as a first-time check.
    expect(eligibility(getExercise('plank'), prefs(), {}).tier).toBe('check');
    expect(eligibility(getExercise('plank'), prefs(), { plank: { at: 1, reps: 10 } }).tier).toBe('ready');
  });

  it('a family with everything excluded sits out instead of breaking the run', () => {
    const l = generateLoadout(prefs({ exclude: ['pushup'] }), allChecked, [], rng(4));
    expect(l.upper).toBeNull();
    expect(abilityLoadout(l).upper).toBeUndefined();
    expect(abilityLoadout(l).legs).toBeTruthy();
  });

  it('rerolls change the pick when there is an alternative, and respect the same rules', () => {
    const p = prefs({ dumbbells: true });
    const r = rng(5);
    let l = generateLoadout(p, allChecked, [], r);
    for (let i = 0; i < 30; i++) {
      const before = l.legs!.exerciseId;
      l = rerollSlot(l, 'legs', p, allChecked, [], r);
      expect(l.legs!.exerciseId).not.toBe(before);
    }
    const all = rerollAll(l, p, allChecked, [], r);
    for (const f of FAMILIES) if (alternatives(f, l[f]!.exerciseId, p, allChecked).length) expect(all[f]!.exerciseId).not.toBe(l[f]!.exerciseId);
  });

  it('recently demanding movements are chosen less often', () => {
    const heavy = [{ id: 'w1', at: 100, outcome: 'victory' as const, volume: { squat: { sets: 4, work: 40 } } }];
    const r = rng(6);
    let squats = 0;
    for (let i = 0; i < 400; i++) if (generateLoadout(prefs(), allChecked, heavy, r).legs!.exerciseId === 'squat') squats++;
    expect(squats).toBeLessThan(150); // vs ~200 of 400 when fresh
  });

  it('targets follow your setting and readiness, never enemy difficulty', () => {
    const push = getExercise('pushup');
    expect(setTarget(push, prefs())).toBe(push.range.default);
    expect(setTarget(push, prefs({ intensity: 'easy' }))).toBeLessThan(push.range.default);
    expect(setTarget(push, prefs(), { pushup: 12 })).toBe(12);
    expect(setTarget(push, prefs(), { pushup: 999 })).toBe(push.range.max);
  });

  it('the library stays consistent as it grows', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('workout records stay separate from the RPG', () => {
  const set = (id: string, reps: number, extra: Partial<SetRecord> = {}): SetRecord => ({ exerciseId: id, family: getExercise(id).family, at: Date.now(), camera: reps, manual: 0, left: 0, right: 0, holdMs: 0, target: 8, full: false, finishedEarly: false, activeMs: 30_000, ...extra });

  it('a mid-run reroll keeps every set already done', () => {
    const x = newExpedition('standard', prefs(), generateLoadout(prefs(), allChecked, [], rng(7)), {});
    addSet(x.workout, set('pushup', 8, { full: true }));
    addSet(x.workout, set('squat', 5, { finishedEarly: true }));
    x.loadout = rerollAll(x.loadout, prefs(), allChecked, [], rng(8));
    expect(x.workout.sets).toHaveLength(2);
    expect(totals(x.workout).find((t) => t.exerciseId === 'pushup')!.camera).toBe(8);
  });

  it('defeat and victory both keep the completed exercise record', () => {
    for (const outcome of ['defeat', 'victory'] as const) {
      const x = newExpedition('short', prefs(), generateLoadout(prefs(), allChecked, [], rng(9)), {});
      addSet(x.workout, set('jumping_jack', 12, { full: true }));
      addSet(x.workout, set('reverse_lunge', 6, { left: 3, right: 3 }));
      x.workout.outcome = outcome;
      const rec = toRecord(x.workout);
      expect(rec.volume.jumping_jack).toEqual({ sets: 1, work: 12 });
      expect(rec.volume.reverse_lunge.work).toBe(6);
      expect(completion(x.workout)).toBeCloseTo(2 / ROUTES.short.plannedSets);
    }
  });

  it('suspending saves the run; resuming picks up at the same node with the same workout', () => {
    const mem = new Mem();
    const x = newExpedition('standard', prefs({ dumbbells: true }), generateLoadout(prefs(), allChecked, [], rng(10)), { pushup: 7 });
    x.index = 3;
    x.hp = 61;
    x.blessings = ['aftershock'];
    addSet(x.workout, set('pushup', 7, { full: true }));
    x.status = 'suspended';
    saveExpedition(x, mem);
    const y = loadExpedition(mem)!;
    expect(y.index).toBe(3);
    expect(currentNode(y)!.phase).toBe(2);
    expect(atPhaseBoundary(y)).toBe(true);
    expect(y.hp).toBe(61);
    expect(y.blessings).toEqual(['aftershock']);
    expect(y.workout.sets).toHaveLength(1);
    expect(y.targets.pushup).toBe(7);
    // A corrupted save is dropped, not half-loaded.
    mem.setItem('fitbound.expedition.v1', JSON.stringify({ ...y, blessings: ['not-real'] }));
    expect(loadExpedition(mem)).toBeNull();
  });

  it('the main save keeps setup, targets, checks and history across reloads', () => {
    const mem = new Mem();
    const s = defaultSave();
    s.expeditionPrefs = prefs({ dumbbells: true, exclude: ['plank', 'nope'] });
    s.exerciseTargets = { pushup: 9, bogus: 3 };
    s.calibrations = { plank: { at: 5, reps: 20 } };
    s.workouts = [{ id: 'w', at: 1, outcome: 'victory', volume: { pushup: { sets: 2, work: 14 } } }];
    s.settings.voiceCommands = true;
    writeSave(s, mem);
    const back = loadSave(mem);
    expect(back.expeditionPrefs.dumbbells).toBe(true);
    expect(back.expeditionPrefs.exclude).toEqual(['plank']);
    expect(back.exerciseTargets).toEqual({ pushup: 9 });
    expect(back.calibrations.plank.reps).toBe(20);
    expect(back.workouts).toHaveLength(1);
    expect(back.settings.voiceCommands).toBe(true);
    expect(sanitize({}).settings.voiceCommands).toBe(false);
  });
});
