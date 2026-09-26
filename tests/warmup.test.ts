import { describe, expect, it } from 'vitest';
import { awakeningSequence, sequenceSeconds } from '../src/exercise/warmup';

describe('the Awakening (bible §18)', () => {
  const none = { sore: {} };
  it('is about five minutes by default, about two in its short version', () => {
    const full = sequenceSeconds(awakeningSequence(none, { length: 'full', smallSpace: false }));
    const short = sequenceSeconds(awakeningSequence(none, { length: 'short', smallSpace: false }));
    expect(full).toBeGreaterThanOrEqual(240);
    expect(full).toBeLessThanOrEqual(330);
    expect(short).toBeGreaterThanOrEqual(80);
    expect(short).toBeLessThanOrEqual(150);
  });

  it('gentle dynamic movements, each with a demonstration; nothing on the floor', () => {
    for (const m of awakeningSequence(none, { length: 'full', smallSpace: false })) {
      expect(m.demo, m.id).toBeTruthy();
      expect(m.floor).toBe(false);
    }
  });

  it('adapts to soreness and space', () => {
    const ids = (sore: object, smallSpace = false) => awakeningSequence({ sore }, { length: 'full', smallSpace }).map((m) => m.id);
    expect(ids({})).toContain('leg_swings');
    expect(ids({}, true)).not.toContain('leg_swings');
    expect(ids({}, true)).toContain('knee_lifts');
    expect(ids({ legs: 'gentle' })).not.toContain('easy_squats');
    expect(ids({ legs: 'gentle' })).toContain('heel_raises');
    expect(ids({ upper: 'rest' })).not.toContain('arm_circles');
  });
});
