import { rng } from './paint';

/**
 * The Motion Trial board: a small sanctuary meadow, a gate, and a winding
 * trail past four guardians. World units are pixels at zoom 1.
 */
export const BOARD = { w: 2200, h: 1400 };
export const START = { x: 480, y: 1240, heading: 0 };

export type Pt = { x: number; y: number };

export const SPOTS = {
  banner: { x: 480, y: 860 },
  dummy: { x: 880, y: 700 },
  signpost: { x: 1170, y: 830 },
  gate: { x: 1300, y: 900 },
  skeleton: { x: 1560, y: 1090 },
  golem: { x: 1890, y: 820 },
  mage: { x: 1560, y: 520 },
  warden: { x: 1880, y: 250 },
} satisfies Record<string, Pt>;

export const FENCE_X = 1300;
export const GATE_GAP = { y0: 835, y1: 965 };
export const POND = { x: 800, y: 1120, rx: 150, ry: 90 };
export const ARENA = { x: 1880, y: 260, r: 180 };

const WAYPOINTS: Pt[] = [
  START,
  SPOTS.banner,
  { x: 620, y: 740 },
  SPOTS.dummy,
  { x: 1040, y: 790 },
  SPOTS.signpost,
  SPOTS.gate,
  { x: 1420, y: 1010 },
  SPOTS.skeleton,
  { x: 1760, y: 1010 },
  SPOTS.golem,
  { x: 1760, y: 640 },
  SPOTS.mage,
  { x: 1660, y: 380 },
  SPOTS.warden,
];

/** Catmull-Rom sampled trail. */
export function trail(step = 12): Pt[] {
  const p = WAYPOINTS;
  const out: Pt[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const n = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

export function distToTrail(pts: Pt[], x: number, y: number): number {
  let best = Infinity;
  for (const p of pts) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  return best;
}

export interface Placed {
  key: string;
  x: number;
  y: number;
  scale: number;
  /** Collision radius in world units. */
  radius: number;
}

/** Hand-placed landmarks plus seeded scatter that keeps the trail clear. */
export function scatter(radii: Record<string, number>): Placed[] {
  const r = rng(2024);
  const pts = trail(24);
  const out: Placed[] = [];
  const place = (key: string, x: number, y: number, scale = 1) => out.push({ key, x, y, scale, radius: (radii[key] ?? 0) * scale });

  // Sanctuary
  place('cottage', 230, 1090, 1);
  place('campfire', 300, 1300, 0.9);
  place('bush0', 120, 1250, 1);
  place('bush1', 380, 1000, 0.9);
  place('mushroom', 410, 1330, 0.9);
  place('mushroom', 150, 1330, 0.8);
  // Around the pond
  place('rock0', 640, 1180, 0.9);
  place('bush1', 980, 1180, 1);
  place('mushroom', 950, 1060, 0.8);
  // Steering chicane between the banner and the dummy
  place('rock1', 700, 860, 1.1);
  place('tree2', 620, 560, 1);
  place('bush0', 1000, 620, 1);
  // Beyond the gate
  place('rock0', 1440, 1220, 1);
  place('rock1', 1700, 1180, 1.1);
  place('rock0', 2020, 950, 1.2);
  place('rock1', 2000, 700, 1);
  place('crystal', 1420, 560, 1.1);
  place('crystal', 1680, 440, 0.9);
  place('crystal', 1440, 380, 1);
  place('crystal', 2080, 360, 1.1);
  place('crystal', 1700, 150, 1);
  place('crystal', 2080, 140, 0.9);

  // Seeded border forest, kept off the trail and away from landmarks.
  const avoid: Pt[] = [...Object.values(SPOTS), { x: POND.x, y: POND.y }, { x: 230, y: 1090 }];
  const trees = ['tree0', 'tree1', 'tree2', 'pine0', 'pine1', 'bush0', 'bush1'];
  for (let i = 0; i < 260 && out.length < 120; i++) {
    const x = 60 + r() * (BOARD.w - 120);
    const y = 60 + r() * (BOARD.h - 120);
    if (Math.abs(x - FENCE_X) < 70) continue;
    if (distToTrail(pts, x, y) < 150) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.y - y) < 170)) continue;
    if (Math.hypot(x - ARENA.x, y - ARENA.y) < ARENA.r + 60) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 95)) continue;
    const key = trees[Math.floor(r() * trees.length)];
    place(key, x, y, 0.85 + r() * 0.3);
  }
  return out;
}
