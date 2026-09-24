import { describe, expect, it } from 'vitest';
import { CalibrationFlow, type CalState } from '../src/input/calibration';
import { FENCE_X } from '../src/phaser/diorama/layout';
import { forkAt, GOAL_NODE, nearestOnTrail, node, SAMPLED, SEGS, TrailWalker } from '../src/phaser/diorama/trailGraph';
import { FRAME_MS, standPose } from '../src/testing/poses';

const goal = (...ids: string[]) => ids.map((i) => GOAL_NODE[i]);

/** Walk at a steady pace until halted or out of time. */
function walk(w: TrailWalker, goals: string[], gateOpen = false, seconds = 60, startMs = 0) {
  let now = startMs;
  let st = w.advance(0, goals, gateOpen, now);
  const path: { x: number; y: number }[] = [];
  for (let i = 0; i < seconds * 30; i++) {
    now += 33;
    st = w.advance(190 * 0.033, goals, gateOpen, now);
    path.push({ x: st.x, y: st.y });
    if (st.choice) break;
    // Halted for good (not just a brief rest stop)?
    if (st.halted && w.halted(goals, now + 5000)) break;
  }
  return { st, now, path };
}

describe('trail network', () => {
  it('every segment is connected, smooth and inside the board', () => {
    for (const s of SEGS) {
      const sm = SAMPLED.get(s.id)!;
      expect(sm.len).toBeGreaterThan(20);
      for (let i = 1; i < sm.pts.length; i++) expect(Math.hypot(sm.pts[i].x - sm.pts[i - 1].x, sm.pts[i].y - sm.pts[i - 1].y)).toBeLessThan(20);
    }
  });

  it('only the gate segment crosses the fence', () => {
    for (const s of SEGS) {
      const sm = SAMPLED.get(s.id)!;
      const sides = new Set(sm.pts.map((p) => p.x < FENCE_X));
      if (s.id !== 'gate') expect(sides.size, s.id).toBe(1);
    }
  });
});

describe('guided walking', () => {
  it('marching walks the trail to the banner and stops there, no steering needed', () => {
    const w = new TrailWalker();
    const { st } = walk(w, goal('banner'));
    const b = node('banner');
    expect(Math.hypot(st.x - b.x, st.y - b.y)).toBeLessThan(1);
    expect(st.halted).toBe(true);
  });

  it('with no movement input the hero stays put', () => {
    const w = new TrailWalker();
    const a = w.advance(0, goal('banner'), false, 0);
    const b = w.advance(0, goal('banner'), false, 1000);
    expect(b).toMatchObject({ x: a.x, y: a.y });
  });

  it('follows bends to the dummy stop without choices', () => {
    const w = new TrailWalker();
    walk(w, goal('banner'));
    const { st } = walk(w, goal('dummy'));
    expect(st.choice).toBeNull();
    const d = node('dummyStop');
    expect(Math.hypot(st.x - d.x, st.y - d.y)).toBeLessThan(1);
  });

  it('stops at a fork and waits; one choice sends it down that route', () => {
    const w = new TrailWalker('pastDummy', 0);
    const r = walk(w, goal('signpost'));
    expect(r.st.choice?.node).toBe('forkB');
    // Marching alone does not move it past the fork.
    const still = w.advance(500, goal('signpost'), false, r.now + 100);
    expect(still.halted).toBe(true);
    expect(still.choice).not.toBeNull();
    const opt = w.choose(1);
    expect(opt?.label).toBe('Mossy Shrine');
    const after = walk(w, goal('signpost'), false, 60, r.now + 200);
    // It went via the shrine (paused there briefly) and on to the signpost stop.
    expect(after.path.some((p) => Math.hypot(p.x - node('shrine').x, p.y - node('shrine').y) < 2)).toBe(true);
    const s = node('signStop');
    expect(Math.hypot(after.st.x - s.x, after.st.y - s.y)).toBeLessThan(1);
  });

  it('the direct route skips the shrine', () => {
    const w = new TrailWalker('pastDummy', 0);
    const r = walk(w, goal('signpost'));
    w.choose(-1);
    const after = walk(w, goal('signpost'), false, 60, r.now + 200);
    expect(after.path.some((p) => Math.hypot(p.x - node('shrine').x, p.y - node('shrine').y) < 40)).toBe(false);
  });

  it('the closed gate stops the trail; once open, the route continues through it', () => {
    const w = new TrailWalker('toGate', 0);
    const shut = walk(w, goal('skeleton'), false, 10);
    expect(shut.st.x).toBeLessThan(FENCE_X);
    const open = walk(w, goal('skeleton'), true, 20);
    expect(open.st.x).toBeGreaterThan(FENCE_X + 100);
  });

  it('after the skeleton, the fork offers both guardians; either order reaches the warden', () => {
    for (const dir of [-1, 1] as const) {
      const w = new TrailWalker('pastSkeleton', 0);
      const r = walk(w, goal('golem', 'mage'), true);
      expect(r.st.choice?.node).toBe('forkC');
      const opt = w.choose(dir)!;
      const first = dir === -1 ? 'mage' : 'golem';
      expect(opt.detail.toLowerCase()).toContain(first === 'mage' ? 'mage' : 'golem');
      const a = walk(w, goal('golem', 'mage'), true, 60, r.now + 100);
      expect(Math.hypot(a.st.x - node(first).x, a.st.y - node(first).y)).toBeLessThan(1);
      const other = first === 'mage' ? 'golem' : 'mage';
      const b = walk(w, goal(other), true, 60, a.now + 100);
      expect(Math.hypot(b.st.x - node(other).x, b.st.y - node(other).y)).toBeLessThan(1);
      expect(b.st.choice).toBeNull();
      const c = walk(w, goal('warden'), true, 60, b.now + 100);
      expect(Math.hypot(c.st.x - node('warden').x, c.st.y - node('warden').y)).toBeLessThan(1);
    }
  });

  it('a fork is not offered when only one option still leads to a goal', () => {
    expect(forkAt('forkC', 'pastSkeleton', goal('golem', 'mage'), true)?.options).toHaveLength(2);
    expect(forkAt('forkB', 'pastDummy', goal('signpost'), false)?.options).toHaveLength(2);
    expect(forkAt('forkB', 'direct', goal('signpost'), false)).toBeNull();
  });

  it('rejoining from free roam picks the nearest trail on the same side of a closed gate', () => {
    const inside = nearestOnTrail({ x: 1250, y: 1150 }, false)!;
    expect(inside.x).toBeLessThan(FENCE_X);
    const opened = nearestOnTrail({ x: 1320, y: 1000 }, true)!;
    expect(opened.d).toBeLessThan(120);
  });
});

describe('quick recalibration', () => {
  it('re-measures body and neutral only, then finishes', () => {
    const steps: string[] = [];
    let neutral = null;
    const f = new CalibrationFlow(
      (s: CalState, changed) => changed && steps.push(s.step),
      (n) => (neutral = n),
      'quick',
    );
    let t = 0;
    for (let i = 0; i < 80; i++) f.frame(standPose((t += FRAME_MS)), 0);
    expect(steps).toEqual(['neutral', 'done']);
    expect(neutral).not.toBeNull();
  });
});
