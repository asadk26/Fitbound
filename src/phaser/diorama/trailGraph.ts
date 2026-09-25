import { FENCE_X, type Pt } from './layout';

/**
 * The meadow's trail network for Guided Traversal.
 *
 * Marching moves the hero along these paths toward the current objective;
 * bends and scenery are followed automatically. At a few forks the hero stops
 * and the player picks a route with one lean. Everything here is plain data
 * and geometry so routing can be tested without Phaser.
 *
 *   start → banner → dummy ─ fork ─┬─ direct ───────────┬─ signpost → gate → skeleton ─ fork ─┬─ quarry ─ golem ─┬─ warden
 *                                  └─ Mossy Shrine ─────┘                                     └─ tower ── mage ──┘
 *
 * The golem–mage link lets whichever route was chosen continue to the other
 * guardian and then on to the warden.
 */
export interface TrailNode extends Pt {
  id: string;
  /** Pause here briefly the first time the hero passes (optional places of interest). */
  lingerMs?: number;
}

export interface TrailSeg {
  id: string;
  a: string;
  b: string;
  /** Control points between the two nodes (the path is a smooth curve through them). */
  via: Pt[];
  /** Only passable once the ward on the gate is down. */
  gate?: boolean;
}

export interface ForkOption {
  /** -1 = lean left, +1 = lean right. */
  dir: -1 | 1;
  seg: string;
  label: string;
  detail: string;
  icon: string;
}

export interface Fork {
  node: string;
  /** The fork is offered when arriving along this segment. */
  from: string;
  prompt: string;
  options: ForkOption[];
}

export const NODES: TrailNode[] = [
  { id: 'start', x: 480, y: 1240 },
  { id: 'banner', x: 480, y: 860 },
  { id: 'dummyStop', x: 780, y: 720 },
  { id: 'forkB', x: 1000, y: 800 },
  { id: 'shrine', x: 1085, y: 975, lingerMs: 1800 },
  { id: 'signStop', x: 1115, y: 855 },
  { id: 'gateIn', x: 1240, y: 895 },
  { id: 'gateOut', x: 1370, y: 925 },
  { id: 'skeleton', x: 1560, y: 1090 },
  { id: 'forkC', x: 1680, y: 1040 },
  { id: 'golem', x: 1890, y: 820 },
  { id: 'mage', x: 1560, y: 520 },
  { id: 'veil', x: 1700, y: 355 },
  { id: 'warden', x: 1880, y: 250 },
];

export const SEGS: TrailSeg[] = [
  { id: 'toBanner', a: 'start', b: 'banner', via: [{ x: 470, y: 1060 }] },
  { id: 'toDummy', a: 'banner', b: 'dummyStop', via: [{ x: 560, y: 780 }, { x: 650, y: 735 }] },
  { id: 'pastDummy', a: 'dummyStop', b: 'forkB', via: [{ x: 880, y: 790 }] },
  { id: 'direct', a: 'forkB', b: 'signStop', via: [{ x: 1060, y: 815 }] },
  { id: 'toShrine', a: 'forkB', b: 'shrine', via: [{ x: 1010, y: 900 }] },
  { id: 'fromShrine', a: 'shrine', b: 'signStop', via: [{ x: 1150, y: 930 }] },
  { id: 'toGate', a: 'signStop', b: 'gateIn', via: [{ x: 1180, y: 880 }] },
  { id: 'gate', a: 'gateIn', b: 'gateOut', via: [], gate: true },
  { id: 'toSkeleton', a: 'gateOut', b: 'skeleton', via: [{ x: 1440, y: 1010 }] },
  { id: 'pastSkeleton', a: 'skeleton', b: 'forkC', via: [{ x: 1620, y: 1070 }] },
  { id: 'quarry', a: 'forkC', b: 'golem', via: [{ x: 1780, y: 1000 }] },
  { id: 'tower', a: 'forkC', b: 'mage', via: [{ x: 1640, y: 830 }, { x: 1590, y: 660 }] },
  { id: 'ridge', a: 'golem', b: 'mage', via: [{ x: 1760, y: 640 }] },
  { id: 'eastPass', a: 'golem', b: 'warden', via: [{ x: 1960, y: 600 }, { x: 1940, y: 420 }] },
  { id: 'crystalPath', a: 'mage', b: 'veil', via: [{ x: 1620, y: 420 }] },
  { id: 'veilStair', a: 'veil', b: 'warden', via: [{ x: 1790, y: 300 }] },
];

export const FORKS: Fork[] = [
  {
    node: 'forkB',
    from: 'pastDummy',
    prompt: 'Which way to the signpost?',
    options: [
      { dir: -1, seg: 'direct', label: 'Forest path', detail: 'Straight to the signpost', icon: 'sword' },
      { dir: 1, seg: 'toShrine', label: 'Mossy Shrine', detail: 'A short detour · rest and recover', icon: 'star' },
    ],
  },
  {
    node: 'forkC',
    from: 'pastSkeleton',
    prompt: 'Two guardians remain. Which first?',
    options: [
      { dir: -1, seg: 'tower', label: 'Moonlit Tower', detail: 'The Shadow Mage · jumping jacks', icon: 'staff' },
      { dir: 1, seg: 'quarry', label: 'Stone Quarry', detail: 'The Stone Golem · squats', icon: 'shield' },
    ],
  },
];

/** Where each objective's trail goal is. */
export const GOAL_NODE: Record<string, string> = {
  banner: 'banner',
  dummy: 'dummyStop',
  signpost: 'signStop',
  shrine: 'shrine',
  skeleton: 'skeleton',
  golem: 'golem',
  mage: 'mage',
  warden: 'warden',
};

// ── Geometry ───────────────────────────────────────────────────────────────
export interface Sampled {
  seg: TrailSeg;
  pts: Pt[];
  /** Cumulative arc length at each point. */
  cum: number[];
  len: number;
}

const nodeById = new Map(NODES.map((n) => [n.id, n]));
export const node = (id: string): TrailNode => nodeById.get(id)!;

function catmull(ctrl: Pt[], step: number): Pt[] {
  const p = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out: Pt[] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export function sample(seg: TrailSeg, step = 8): Sampled {
  const pts = catmull([node(seg.a), ...seg.via, node(seg.b)], step);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { seg, pts, cum, len: cum[cum.length - 1] };
}

export const SAMPLED: Map<string, Sampled> = new Map(SEGS.map((s) => [s.id, sample(s)]));

/** Point (and unit tangent toward b) at arc length s along a segment. */
export function pointAt(id: string, s: number): { x: number; y: number; tx: number; ty: number } {
  const sm = SAMPLED.get(id)!;
  const d = Math.max(0, Math.min(sm.len, s));
  let i = 1;
  while (i < sm.cum.length - 1 && sm.cum[i] < d) i++;
  const a = sm.pts[i - 1];
  const b = sm.pts[i];
  const span = sm.cum[i] - sm.cum[i - 1] || 1;
  const k = (d - sm.cum[i - 1]) / span;
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, tx: (b.x - a.x) / l, ty: (b.y - a.y) / l };
}

/** Nearest point on any usable segment (respecting the fence and gate). */
export function nearestOnTrail(p: Pt, gateOpen: boolean): { seg: string; s: number; x: number; y: number; d: number } | null {
  let best: { seg: string; s: number; x: number; y: number; d: number } | null = null;
  const left = p.x < FENCE_X;
  for (const sm of SAMPLED.values()) {
    if (sm.seg.gate && !gateOpen) continue;
    const sides = [node(sm.seg.a).x < FENCE_X, node(sm.seg.b).x < FENCE_X];
    if (!gateOpen && (sides[0] !== left || sides[1] !== left)) continue;
    sm.pts.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || d < best.d) best = { seg: sm.seg.id, s: sm.cum[i], x: q.x, y: q.y, d };
    });
  }
  return best;
}

// ── Routing ────────────────────────────────────────────────────────────────
/** Shortest distances from every node to the nearest goal (Dijkstra). */
export function distancesTo(goals: string[], gateOpen: boolean, without?: string): Map<string, number> {
  const dist = new Map<string, number>(NODES.map((n) => [n.id, Infinity]));
  const todo = new Set(NODES.map((n) => n.id));
  for (const g of goals) if (g !== without) dist.set(g, 0);
  if (without) todo.delete(without);
  while (todo.size) {
    let u: string | null = null;
    for (const n of todo) if (u === null || dist.get(n)! < dist.get(u)!) u = n;
    if (u === null || dist.get(u) === Infinity) break;
    todo.delete(u);
    for (const sm of SAMPLED.values()) {
      if (sm.seg.gate && !gateOpen) continue;
      const other = sm.seg.a === u ? sm.seg.b : sm.seg.b === u ? sm.seg.a : null;
      if (!other || !todo.has(other)) continue;
      const nd = dist.get(u)! + sm.len;
      if (nd < dist.get(other)!) dist.set(other, nd);
    }
  }
  return dist;
}

export type Heading = { seg: string; dir: 1 | -1 } | null;

/** Which way to walk along the current segment to reach a goal soonest (null: unreachable). */
export function headingFrom(seg: string, s: number, goals: string[], gateOpen: boolean): Heading {
  const sm = SAMPLED.get(seg)!;
  if (sm.seg.gate && !gateOpen) return null;
  const d = distancesTo(goals, gateOpen);
  const viaA = s + d.get(sm.seg.a)!;
  const viaB = sm.len - s + d.get(sm.seg.b)!;
  if (!Number.isFinite(Math.min(viaA, viaB))) return null;
  // On a tie (e.g. standing exactly on a node) head away from the node we're on.
  const dir: 1 | -1 = viaB < viaA ? 1 : viaA < viaB ? -1 : sm.len - s >= s ? 1 : -1;
  return { seg, dir };
}

/** Leaving `from`, the next segment toward a goal (excluding the one just used, unless it's the only way). */
export function nextSegment(from: string, goals: string[], gateOpen: boolean, cameFrom?: string): Heading {
  const d = distancesTo(goals, gateOpen);
  let best: { seg: string; dir: 1 | -1; cost: number } | null = null;
  for (const sm of SAMPLED.values()) {
    if (sm.seg.gate && !gateOpen) continue;
    const dir = sm.seg.a === from ? 1 : sm.seg.b === from ? -1 : 0;
    if (!dir) continue;
    const other = dir === 1 ? sm.seg.b : sm.seg.a;
    const cost = sm.len + d.get(other)! + (sm.seg.id === cameFrom ? 1e6 : 0);
    if (!best || cost < best.cost) best = { seg: sm.seg.id, dir: dir as 1 | -1, cost };
  }
  return best && Number.isFinite(best.cost) ? { seg: best.seg, dir: best.dir } : null;
}

/** The fork to offer on arriving at `at` along `via`, keeping only options that still lead to a goal. */
export function forkAt(at: string, via: string, goals: string[], gateOpen: boolean): Fork | null {
  const f = FORKS.find((x) => x.node === at && x.from === via);
  if (!f) return null;
  const d = distancesTo(goals, gateOpen, at);
  const ok = f.options.filter((o) => {
    const sm = SAMPLED.get(o.seg)!;
    const other = sm.seg.a === at ? sm.seg.b : sm.seg.a;
    return Number.isFinite(d.get(other)!) || goals.includes(other);
  });
  return ok.length >= 2 ? { ...f, options: ok } : null;
}

/** Every segment's painted curve (for the ground art and keeping scenery off the paths). */
export function trailPaths(step = 12): Pt[][] {
  return SEGS.map((s) => sample(s, step).pts);
}

// ── Walking the trail ──────────────────────────────────────────────────────
export interface WalkState {
  x: number;
  y: number;
  /** Direction of travel along the trail, for facing (screen space, +y down). */
  dx: number;
  dy: number;
  /** Stopped at a goal, a fork, a rest stop, or with nowhere to go. */
  halted: boolean;
  choice: Fork | null;
}

/**
 * Follows the trail network toward the current goals. `advance` is given a
 * distance (speed × time from marching); the walker handles bends, node
 * transitions, forks (it stops and waits for `choose`), brief rest stops and
 * arrival. Pure logic: the scene only draws where it says the hero is.
 */
export class TrailWalker {
  seg: string;
  s: number;
  private forced: { seg: string; dir: 1 | -1 } | null = null;
  choice: Fork | null = null;
  private lingered = new Set<string>();
  private lingerUntil = 0;
  private atGoal: string | null = null;

  constructor(seg = 'toBanner', s = 0) {
    this.seg = seg;
    this.s = s;
  }

  get position(): { x: number; y: number } {
    const p = pointAt(this.seg, this.s);
    return { x: p.x, y: p.y };
  }

  /** Put the walker at a point on the trail (e.g. after rejoining). */
  place(seg: string, s: number): void {
    this.seg = seg;
    this.s = s;
    this.forced = null;
    this.choice = null;
    this.atGoal = null;
  }

  /** Pick a route at the current fork: -1 = left option, +1 = right option. */
  choose(dir: -1 | 1): ForkOption | null {
    const f = this.choice;
    const opt = f?.options.find((o) => o.dir === dir);
    if (!f || !opt) return null;
    const sm = SAMPLED.get(opt.seg)!;
    const fromA = sm.seg.a === f.node;
    this.place(opt.seg, fromA ? 0 : sm.len);
    this.forced = { seg: opt.seg, dir: fromA ? 1 : -1 };
    return opt;
  }

  /** True if the walker would not move right now (fork, rest stop, arrived, nothing to do). */
  halted(goals: string[], now: number): boolean {
    if (this.choice || now < this.lingerUntil || goals.length === 0) return true;
    return this.atGoal !== null && goals.includes(this.atGoal);
  }

  advance(distance: number, goals: string[], gateOpen: boolean, now: number): WalkState {
    const before = pointAt(this.seg, this.s);
    let remaining = this.halted(goals, now) ? 0 : distance;
    if (this.atGoal && !goals.includes(this.atGoal)) this.atGoal = null;
    for (let guard = 0; remaining > 0 && guard < 12; guard++) {
      const sm = SAMPLED.get(this.seg)!;
      const h = this.forced?.seg === this.seg ? this.forced : headingFrom(this.seg, this.s, goals, gateOpen);
      if (!h) break;
      const end = h.dir === 1 ? sm.len : 0;
      const step = Math.min(Math.abs(end - this.s), remaining);
      this.s += step * h.dir;
      remaining -= step;
      if (Math.abs(end - this.s) > 1e-6) break;
      const at = h.dir === 1 ? sm.seg.b : sm.seg.a;
      this.forced = null;
      if (this.arrive(at, sm.seg.id, goals, gateOpen, now)) break;
    }
    const p = pointAt(this.seg, this.s);
    const dx = p.x - before.x;
    const dy = p.y - before.y;
    return { x: p.x, y: p.y, dx, dy, halted: this.halted(goals, now), choice: this.choice };
  }

  /** Reached a node; true if the walker stops there. */
  private arrive(at: string, via: string, goals: string[], gateOpen: boolean, now: number): boolean {
    if (goals.includes(at)) {
      this.atGoal = at;
      return true;
    }
    const fork = forkAt(at, via, goals, gateOpen);
    if (fork) {
      this.choice = fork;
      return true;
    }
    const n = node(at);
    const next = nextSegment(at, goals, gateOpen, via);
    if (!next) return true;
    const sm = SAMPLED.get(next.seg)!;
    this.seg = next.seg;
    this.s = next.dir === 1 ? 0 : sm.len;
    if (n.lingerMs && !this.lingered.has(at)) {
      this.lingered.add(at);
      this.lingerUntil = now + n.lingerMs;
      return true;
    }
    return false;
  }
}
