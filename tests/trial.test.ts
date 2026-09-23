import { describe, expect, it } from 'vitest';
import { CombatEngine } from '../src/combat/CombatEngine';
import { JumpingJackDetector } from '../src/exercise/detectors/jumpingJack';
import { PushupDetector } from '../src/exercise/detectors/pushup';
import { SquatDetector } from '../src/exercise/detectors/squat';
import { getExercise } from '../src/exercise/registry';
import { ExerciseSessionController } from '../src/exercise/session';
import type { ExerciseDetector, ExerciseEvent, PoseFrame } from '../src/exercise/types';
import { statsFor } from '../src/game/progression';
import { cycle, FRAME_MS, hold, jackPose, pushupPose, squatPose, standPose } from '../src/testing/poses';
import { DEFAULT_TARGETS, encounterPlan, parseTargets, trialEnemy, TRIAL_ENEMIES } from '../src/trial/config';

const stats = statsFor(1, { atk: 0, def: 0, mag: 0 });
const fixed = () => 0.5;

/** Play a plan through the engine as if every rep were counted by the camera. */
function playPlan(id: (typeof TRIAL_ENEMIES)[number], fraction = 1) {
  const e = new CombatEngine(trialEnemy(id, stats, DEFAULT_TARGETS), stats, fixed);
  for (const set of encounterPlan(id, DEFAULT_TARGETS)) {
    e.beginSet(set.exerciseId);
    const reps = Math.floor(set.target * fraction);
    for (let i = 1; i <= reps; i++) e.handle({ type: 'rep', exerciseId: set.exerciseId, index: i, target: set.target, source: 'camera' });
    if (reps === set.target) e.handle({ type: 'setComplete', exerciseId: set.exerciseId, verification: 'camera', completed: reps, target: set.target });
    else e.handle({ type: 'setEnded', exerciseId: set.exerciseId, completed: reps, target: set.target, reason: 'stopped' });
    if (e.state.outcome !== 'ongoing') break;
    e.enemyTurn();
  }
  return e;
}

describe('Motion Trial rules', () => {
  for (const id of TRIAL_ENEMIES) {
    it(`${id}: finishing the planned sets wins the fight`, () => {
      expect(playPlan(id).state.outcome).toBe('victory');
    });
    it(`${id}: stopping each set halfway does not`, () => {
      expect(playPlan(id, 0.5).state.outcome).toBe('ongoing');
    });
  }

  it('the boss needs all three exercises, in order', () => {
    expect(encounterPlan('warden', DEFAULT_TARGETS).map((p) => p.exerciseId)).toEqual(['pushup', 'squat', 'jumping_jack']);
  });

  it('rep targets can be overridden from the URL, with bad values ignored', () => {
    const t = parseTargets('?reps=pushup:2,squat:3,bogus:4,jumping_jack:0,bossJack:x', DEFAULT_TARGETS);
    expect(t).toEqual({ ...DEFAULT_TARGETS, pushup: 2, squat: 3 });
  });
});

describe('transitions between exercises', () => {
  const run = (d: ExerciseDetector, frames: ((t: number) => PoseFrame)[]) => {
    let t = 0;
    let reps = 0;
    for (const f of frames) {
      t += FRAME_MS;
      if (d.update(f(t), t).repCompleted) reps++;
    }
    return reps;
  };
  const standingAround = () => [
    ...Array.from({ length: 60 }, () => (t: number) => standPose(t)),
    ...Array.from({ length: 90 }, (_, i) => (t: number) => standPose(t, { liftL: Math.max(0, Math.sin(i * 0.2)) * 0.6, liftR: Math.max(0, -Math.sin(i * 0.2)) * 0.6 })),
    ...Array.from({ length: 40 }, () => (t: number) => standPose(t, { rightHand: 'up' })),
  ];

  it('push-up detector counts nothing while the player stands, marches or waves', () => {
    expect(run(new PushupDetector(), standingAround())).toBe(0);
  });

  it('squat detector counts nothing during jumping jacks or push-ups', () => {
    const jacks = Array.from({ length: 150 }, (_, i) => (t: number) => jackPose((Math.sin(i * 0.3) + 1) / 2, (Math.sin(i * 0.3) + 1) / 2, t));
    const pushups = [...hold(170, 10), ...cycle(170, 80), ...cycle(170, 80)].map((a) => (t: number) => pushupPose(a, t));
    expect(run(new SquatDetector(), jacks)).toBe(0);
    expect(run(new SquatDetector(), pushups)).toBe(0);
  });

  it('jumping-jack detector counts nothing during squats or marching', () => {
    const squats = [...hold(0, 10), ...cycle(0, 75), ...cycle(0, 75)].map((a) => (t: number) => squatPose(a, t));
    expect(run(new JumpingJackDetector(), squats)).toBe(0);
    expect(run(new JumpingJackDetector(), standingAround())).toBe(0);
  });

  it('a new set starts clean: getting into position and the countdown award nothing', () => {
    const events: ExerciseEvent[] = [];
    const s = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 5, (e) => events.push(e));
    let t = 0;
    // Player finishes squats, stands, walks over and gets down — then waits out the countdown.
    for (const f of [...standingAround(), ...hold(170, 40).map((a) => (tt: number) => pushupPose(a, tt)), ...cycle(170, 80).map((a) => (tt: number) => pushupPose(a, tt))]) {
      t += FRAME_MS;
      s.update(f(t), t);
    }
    expect(events.filter((e) => e.type === 'rep')).toHaveLength(0);
  });
});
