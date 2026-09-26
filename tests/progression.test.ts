import { describe, expect, it } from 'vitest';
import { getExercise } from '../src/exercise/registry';
import { DEFAULT_PREFS, type DayPrefs } from '../src/rpg/loadout';
import { applyProposals, evidence, propose, type ProgressState } from '../src/rpg/progression';
import { addSet, newWorkout, toRecord, type SetRecord, type WorkoutData } from '../src/rpg/workout';

const prefs = (p: Partial<DayPrefs> = {}): DayPrefs => ({ ...DEFAULT_PREFS, ...p });
const set = (id: string, done: number, target: number, extra: Partial<SetRecord> = {}): SetRecord => ({
  exerciseId: id,
  family: getExercise(id).family,
  at: 0,
  camera: done,
  manual: 0,
  left: 0,
  right: 0,
  holdMs: 0,
  target,
  full: done >= target,
  finishedEarly: false,
  activeMs: done * 2000,
  ...extra,
});
const session = (sets: SetRecord[]): WorkoutData => {
  const w = newWorkout('normal', 12, 0);
  for (const s of sets) addSet(w, s);
  return w;
};
const strong = () => session([set('pushup', 6, 6), set('pushup', 6, 6), set('squat', 12, 12), set('squat', 12, 12)]);

describe('target progression', () => {
  it('goes up only after two strong sessions in a row', () => {
    const r1 = propose(strong(), prefs(), {}, {});
    expect(r1.proposals).toEqual([]);
    const r2 = propose(strong(), prefs(), {}, r1.progress);
    expect(r2.proposals.map((p) => [p.exerciseId, p.from, p.to])).toEqual([
      ['pushup', 6, 7],
      ['squat', 10, 11],
    ]);
  });

  it('one session is enough when you said it felt too easy', () => {
    const r = propose(strong(), prefs(), {}, {}, { effort: 'easy' });
    expect(r.proposals.find((p) => p.exerciseId === 'pushup')?.to).toBe(7);
  });

  it('comes down after a session of sets finished early', () => {
    const w = session([set('pushup', 3, 6, { finishedEarly: true }), set('pushup', 4, 6, { finishedEarly: true }), set('pushup', 6, 6)]);
    const r = propose(w, prefs(), { pushup: 8 }, {});
    expect(r.proposals).toEqual([expect.objectContaining({ exerciseId: 'pushup', from: 8, to: 7, verdict: 'down' })]);
  });

  it('a pace that collapses holds it steady even if every set was full', () => {
    const w = session([set('pushup', 6, 6, { activeMs: 10_000 }), set('pushup', 6, 6, { activeMs: 20_000 })]);
    expect(evidence(w).pushup.slowdown).toBeCloseTo(2);
    const r1 = propose(w, prefs(), {}, {});
    expect(propose(w, prefs(), {}, r1.progress).proposals).toEqual([]);
  });

  it('sore, easy and strong days are handled gently', () => {
    const first = propose(strong(), prefs(), {}, {}).progress;
    // Sore upper body: push-ups hold (and the streak resets); squats still go up.
    const sore = propose(strong(), prefs({ sore: { upper: 'gentle' } }), {}, first);
    expect(sore.proposals.map((p) => p.exerciseId)).toEqual(['squat']);
    // A Take-it-easy day never raises; a Strong day never lowers.
    expect(propose(strong(), prefs({ intensity: 'easy' }), {}, first).proposals).toEqual([]);
    const bad = session([set('pushup', 2, 8, { finishedEarly: true }), set('pushup', 3, 8, { finishedEarly: true })]);
    expect(propose(bad, prefs({ intensity: 'strong' }), {}, {}).proposals).toEqual([]);
  });

  it('holds and sided movements use their own units, within range', () => {
    const plank = session([set('plank', 0, 30, { holdMs: 30_000, full: true }), set('plank', 0, 30, { holdMs: 31_000, full: true })]);
    const r = propose(plank, prefs(), { plank: 30 }, { plank: { streak: 1, history: [] } });
    expect(r.proposals[0]).toMatchObject({ from: 30, to: 35 });
    const top = getExercise('pushup').range.max;
    expect(propose(strong(), prefs(), { pushup: top }, { pushup: { streak: 1, history: [] } }).proposals.find((p) => p.exerciseId === 'pushup')).toBeUndefined();
    const sided = session([set('reverse_lunge', 0, 6, { left: 6, right: 3, finishedEarly: true }), set('reverse_lunge', 0, 6, { left: 6, right: 2, finishedEarly: true })]);
    expect(evidence(sided).reverse_lunge.completion).toBeLessThan(0.6);
  });

  it('a side plank is judged by its weaker side, and its sides are kept in the history', () => {
    const even = set('side_plank', 0, 30, { holdMs: 30_000, holdSides: { left: 15_000, right: 15_000 }, full: true });
    const uneven = set('side_plank', 0, 30, { holdMs: 20_000, holdSides: { left: 15_000, right: 5_000 }, finishedEarly: true });
    const e = evidence(session([even, uneven])).side_plank;
    expect(e.full).toBe(1);
    // 30/30 and 10/30 (twice the weaker side).
    expect(e.completion).toBeCloseTo((1 + 1 / 3) / 2, 5);
    // Manual time without a side reached the total, but the camera saw it uneven: not full.
    const manual = set('side_plank', 0, 30, { holdMs: 30_000, holdSides: { left: 15_000, right: 5_000 }, full: true });
    expect(evidence(session([manual])).side_plank.full).toBe(0);
    const lopsided = set('side_plank', 0, 30, { holdMs: 30_000, holdSides: { left: 15_000, right: 10_000 }, full: true });
    expect(evidence(session([lopsided])).side_plank.completion).toBeCloseTo(25 / 30, 5);
    const rec = toRecord(session([even, uneven]));
    expect(rec.volume.side_plank).toEqual({ sets: 2, work: 50, sides: { left: 30, right: 20 } });
  });

  it('kept proposals are skipped; applied ones are remembered in the history', () => {
    const r = propose(strong(), prefs(), {}, { pushup: { streak: 1, history: [] }, squat: { streak: 1, history: [] } });
    const targets: Record<string, number> = {};
    const progress: Record<string, ProgressState> = r.progress;
    applyProposals(
      targets,
      progress,
      r.proposals.filter((p) => p.exerciseId !== 'squat'),
      123,
    );
    expect(targets).toEqual({ pushup: 7 });
    expect(progress.pushup.history).toEqual([{ at: 123, from: 6, to: 7, why: 'every set full at a steady pace' }]);
  });
});

describe('the Journal', () => {
  it('summarises days, families, movements and recent sessions', async () => {
    const { summarize } = await import('../src/rpg/journal');
    const now = 100 * 86_400_000;
    const rec = (daysAgo: number, volume: Record<string, { sets: number; work: number }>) => ({ id: `w${daysAgo}`, at: now - daysAgo * 86_400_000 - 1000, outcome: 'victory' as const, volume });
    const j = summarize(
      [rec(0, { pushup: { sets: 3, work: 18 }, squat: { sets: 2, work: 20 } }), rec(3, { pushup: { sets: 2, work: 12 } }), rec(20, { plank: { sets: 2, work: 60 } })],
      { pushup: 7 },
      { pushup: { streak: 0, history: [{ at: 1, from: 6, to: 7, why: 'x' }] } },
      now,
    );
    expect(j.activeDays).toBe(2);
    expect(j.days[13]).toBe(1);
    expect(j.sinceLast).toBe(0);
    expect(j.families.upper.sets).toBe(5);
    expect(j.families.legs.sets).toBe(2);
    expect(j.families.core.sets).toBe(0);
    expect(j.movements[0]).toMatchObject({ id: 'pushup', sets: 5, target: 7, last: { to: 7 } });
    expect(j.movements.find((m) => m.id === 'plank')).toMatchObject({ target: getExercise('plank').range.default });
    expect(j.sessions.map((s) => s.id)).toEqual(['w0', 'w3', 'w20']);
  });
});
