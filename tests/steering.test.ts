import { describe, expect, it } from 'vitest';
import { InputHub } from '../src/input/InputHub';
import { MotionReader, motionPreset, type MotionReading } from '../src/input/motion';
import { FENCE_X, GATE_GAP } from '../src/phaser/diorama/layout';
import { compass, headingVector, HERO_R, resolveMove, turnHeading } from '../src/phaser/diorama/steering';
import { FRAME_MS, rng, standPose, type StandOpts } from '../src/testing/poses';

function run(reader: MotionReader, frames: (StandOpts | null)[], t0 = 0) {
  const out: MotionReading[] = [];
  let t = t0;
  for (const f of frames) {
    t += FRAME_MS;
    out.push(reader.update(f ? standPose(t, f) : null, t));
  }
  const events = out.flatMap((r) => r.events);
  return { out, t, turns: events.filter((e) => e === 'turnLeft' || e === 'turnRight') };
}
const still = (n: number, o: StandOpts = {}) => Array.from({ length: n }, () => ({ ...o }));
function march(n: number, lift = 0.6, extra: StandOpts = {}): StandOpts[] {
  return Array.from({ length: n }, (_, i) => {
    const s = Math.sin((i * FRAME_MS * Math.PI * 1.8) / 1000);
    return { ...extra, liftL: Math.max(0, s) * lift, liftR: Math.max(0, -s) * lift };
  });
}

describe('discrete turning', () => {
  it('one lean produces exactly one turn, in the leaned direction', () => {
    expect(run(new MotionReader(), [...still(15), ...still(20, { lean: 12 }), ...still(20)]).turns).toEqual(['turnLeft']);
    expect(run(new MotionReader(), [...still(15), ...still(20, { lean: -12 }), ...still(20)]).turns).toEqual(['turnRight']);
  });

  it('holding a lean does not repeat the turn', () => {
    const r = run(new MotionReader(), [...still(15), ...still(300, { lean: 14 })]);
    expect(r.turns).toEqual(['turnLeft']);
  });

  it('returning to neutral re-arms the next turn', () => {
    const r = run(new MotionReader(), [...still(15), ...still(20, { lean: 12 }), ...still(15), ...still(20, { lean: 12 }), ...still(15), ...still(20, { lean: -12 })]);
    expect(r.turns).toEqual(['turnLeft', 'turnLeft', 'turnRight']);
  });

  it('a lean that only eases off (never back to neutral) does not turn again', () => {
    const r = run(new MotionReader(), [...still(15), ...still(20, { lean: 12 }), ...still(20, { lean: 6 }), ...still(20, { lean: 12 })]);
    expect(r.turns).toEqual(['turnLeft']);
  });

  it('marching sway, posture noise and idle standing never turn', () => {
    const noise = { r: rng(3), amp: 0.008 };
    expect(run(new MotionReader(), still(300, { noise })).turns).toHaveLength(0);
    expect(run(new MotionReader(), march(300, 0.6, { noise })).turns).toHaveLength(0);
    const sway = Array.from({ length: 200 }, (_, i) => ({ lean: 3 * Math.sin(i * 0.35), noise }));
    expect(run(new MotionReader(), sway).turns).toHaveLength(0);
  });

  it('turns while marching, and marching continues', () => {
    const r = run(new MotionReader(), [...still(15), ...march(60), ...march(25, 0.6, { lean: -12 }), ...march(30)]);
    expect(r.turns).toEqual(['turnRight']);
    expect(r.out[r.out.length - 1].marching).toBe(true);
  });

  it('a cooldown stops a fast wobble from double-turning', () => {
    // Lean, snap back for only a moment, lean again: within the cooldown.
    const reader = new MotionReader({ turnNeutralMs: 0, leanSmoothing: 1 });
    const r = run(reader, [...still(10), ...still(3, { lean: 12 }), ...still(2), ...still(3, { lean: 12 }), ...still(20), ...still(5, { lean: 12 })]);
    expect(r.turns).toEqual(['turnLeft', 'turnLeft']);
  });

  it('losing tracking disarms turning until the player is back at neutral', () => {
    const reader = new MotionReader();
    run(reader, still(15));
    const r = run(reader, [...Array.from({ length: 30 }, () => null), ...still(20, { lean: 12 }), ...still(15), ...still(20, { lean: 12 })], 1000);
    expect(r.turns).toEqual(['turnLeft']);
  });

  it('still turns reliably when the phone only manages a few pose frames a second', () => {
    const reader = new MotionReader();
    const out: string[] = [];
    let t = 0;
    const seq = [...still(3), ...still(3, { lean: 12 }), ...still(3), ...still(3, { lean: 12 }), ...still(3), ...still(3, { lean: -12 })];
    for (const o of seq) {
      t += 250;
      out.push(...reader.update(standPose(t, o), t).events.filter((e) => e.startsWith('turn')));
    }
    expect(out).toEqual(['turnLeft', 'turnLeft', 'turnRight']);
  });

  it('sensitivity changes the lean needed', () => {
    const lean = (sens: 'low' | 'normal' | 'high', deg: number) => run(new MotionReader(motionPreset({ lean: sens })), [...still(15), ...still(30, { lean: deg })]).turns.length;
    expect(lean('high', 7)).toBe(1);
    expect(lean('normal', 7)).toBe(0);
    expect(lean('normal', 10)).toBe(1);
    expect(lean('low', 10)).toBe(0);
  });

  it('the player can turn while standing still (no marching needed)', () => {
    const hub = new InputHub();
    hub.setMode('explore');
    let t = 0;
    for (const o of [...still(15), ...still(20, { lean: -12 })]) hub.feed(standPose((t += FRAME_MS), o), t);
    expect(hub.intent(t).forward).toBe(0);
    expect(hub.takeTurns()).toBe(1);
    expect(hub.takeTurns()).toBe(0);
  });
});

describe('heading grid', () => {
  it('45° mode: eight headings, one step per turn, wrapping round', () => {
    let h = 0;
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      h = turnHeading(h, 1, 45);
      seen.push(compass(h));
    }
    expect(seen).toEqual(['NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']);
    expect(compass(turnHeading(0, -1, 45))).toBe('NW');
  });

  it('90° mode: four headings', () => {
    expect([1, 2, 3, 4].map((n) => compass(turnHeading(0, n, 90)))).toEqual(['E', 'S', 'W', 'N']);
    expect(compass(turnHeading(0, -1, 90))).toBe('W');
  });

  it('switching to 90° snaps an in-between heading onto the grid', () => {
    const ne = turnHeading(0, 1, 45);
    expect(['N', 'E']).toContain(compass(turnHeading(ne, 0, 90)));
  });

  it('diagonals move equally along both axes at full speed', () => {
    const v = headingVector(turnHeading(0, 1, 45));
    expect(v.x).toBeCloseTo(Math.SQRT1_2);
    expect(v.y).toBeCloseTo(-Math.SQRT1_2);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(headingVector(turnHeading(0, 1, 90))).toEqual({ x: 1, y: 0 });
  });
});

describe('movement and collisions on the grid', () => {
  const walk = (from: { x: number; y: number }, heading: number, steps: number, world: Parameters<typeof resolveMove>[3]) => {
    let p = from;
    const v = headingVector(heading);
    for (let i = 0; i < steps; i++) p = resolveMove(p, v.x * 6, v.y * 6, world);
    return p;
  };

  it('walks diagonally in open ground', () => {
    const p = walk({ x: 400, y: 700 }, turnHeading(0, 1, 45), 20, { obstacles: [], gateOpen: false });
    expect(p.x - 400).toBeCloseTo(700 - p.y, 5);
    expect(p.x).toBeGreaterThan(480);
  });

  it('slides around a round obstacle instead of passing through it', () => {
    const rock = { x: 500, y: 600, r: 40 };
    const p = walk({ x: 420, y: 680 }, turnHeading(0, 1, 45), 40, { obstacles: [rock], gateOpen: false });
    let inside = false;
    let q = { x: 420, y: 680 };
    const v = headingVector(turnHeading(0, 1, 45));
    for (let i = 0; i < 40; i++) {
      q = resolveMove(q, v.x * 6, v.y * 6, { obstacles: [rock], gateOpen: false });
      if (Math.hypot(q.x - rock.x, (q.y - rock.y) * 1.6) < rock.r + HERO_R - 0.5) inside = true;
    }
    expect(inside).toBe(false);
    expect(Math.hypot(p.x - 420, p.y - 680)).toBeGreaterThan(60); // still made progress
  });

  it('walking straight at a round obstacle slides round it instead of stopping dead', () => {
    const rock = { x: 500, y: 500, r: 40 };
    const p = walk({ x: 500, y: 640 }, 0, 80, { obstacles: [rock], gateOpen: false }); // due north, dead centre
    expect(p.y).toBeLessThan(rock.y - 40); // got past it
    expect(Math.hypot(p.x - rock.x, (p.y - rock.y) * 1.6)).toBeGreaterThanOrEqual(rock.r + HERO_R - 0.5);
  });

  it('a diagonal into the closed fence slides along it, and the open gate lets you through', () => {
    const se = turnHeading(0, 3, 45); // south-east
    const gateMid = (GATE_GAP.y0 + GATE_GAP.y1) / 2;
    const closed = walk({ x: FENCE_X - 120, y: gateMid - 60 }, se, 40, { obstacles: [], gateOpen: false });
    expect(closed.x).toBeLessThanOrEqual(FENCE_X - HERO_R);
    const east = turnHeading(0, 2, 45);
    const open = walk({ x: FENCE_X - 120, y: gateMid }, east, 40, { obstacles: [], gateOpen: true });
    expect(open.x).toBeGreaterThan(FENCE_X + HERO_R);
  });

  it('walking into the fence just beside the open gateway slides into it', () => {
    const east = turnHeading(0, 2, 45);
    const below = walk({ x: FENCE_X - 120, y: GATE_GAP.y1 + 20 }, east, 60, { obstacles: [], gateOpen: true });
    expect(below.x).toBeGreaterThan(FENCE_X + HERO_R);
    const above = walk({ x: FENCE_X - 120, y: GATE_GAP.y0 - 20 }, east, 60, { obstacles: [], gateOpen: true });
    expect(above.x).toBeGreaterThan(FENCE_X + HERO_R);
    // A diagonal pushing away from the gap along the fence still gets in.
    const se = walk({ x: FENCE_X - 60, y: GATE_GAP.y1 - 30 }, turnHeading(0, 3, 45), 60, { obstacles: [], gateOpen: true });
    expect(se.x).toBeGreaterThan(FENCE_X + HERO_R);
    // ...but never while the ward is up, and not from far along the fence.
    expect(walk({ x: FENCE_X - 120, y: GATE_GAP.y1 + 20 }, east, 60, { obstacles: [], gateOpen: false }).x).toBeLessThanOrEqual(FENCE_X - HERO_R);
    expect(walk({ x: FENCE_X - 120, y: GATE_GAP.y1 + 200 }, east, 60, { obstacles: [], gateOpen: true }).x).toBeLessThanOrEqual(FENCE_X - HERO_R);
  });
});
