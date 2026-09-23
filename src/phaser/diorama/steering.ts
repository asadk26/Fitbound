import { BOARD, FENCE_X, GATE_GAP, POND } from './layout';

/**
 * Discrete steering for the exploration board, kept free of Phaser so it can
 * be tested: headings live on a 45° (or 90°) grid, one turn command moves one
 * step around it, and the hero walks straight along the current heading.
 *
 * Heading 0 is "up the board" (north); positive is clockwise.
 */
export type TurnStep = 45 | 90;

const TAU = Math.PI * 2;

/** Normalise to [0, 2π). */
export function wrapAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}

/** Apply `turns` discrete turns (+ right, − left), snapping to the step grid. */
export function turnHeading(heading: number, turns: number, step: TurnStep): number {
  const rad = (step * Math.PI) / 180;
  const snapped = Math.round(wrapAngle(heading) / rad) * rad;
  return wrapAngle(snapped + turns * rad);
}

/** Unit movement vector for a heading (screen space: +y is down). */
export function headingVector(heading: number): { x: number; y: number } {
  const x = Math.sin(heading);
  const y = -Math.cos(heading);
  // Clean zeros so 90° steps move exactly along an axis.
  return { x: Math.abs(x) < 1e-9 ? 0 : x, y: Math.abs(y) < 1e-9 ? 0 : y };
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = wrapAngle(b) - wrapAngle(a);
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Eight-way compass label, for the direction indicator and tests. */
export function compass(heading: number): 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' {
  const i = Math.round(wrapAngle(heading) / (Math.PI / 4)) % 8;
  return (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const)[i];
}

export type Obstacle = { x: number; y: number; r: number };

export interface BoardWorld {
  obstacles: Obstacle[];
  gateOpen: boolean;
}

export const HERO_R = 26;
/** How far beside the open gateway a push into the fence is steered into it. */
export const GATE_FUNNEL = 70;

/**
 * Move from (x, y) by (dx, dy), sliding around round obstacles and the pond,
 * and through the fence only at the open gateway.
 */
export function resolveMove(from: { x: number; y: number }, dx: number, dy: number, world: BoardWorld): { x: number; y: number } {
  let x = from.x + dx;
  let y = from.y + dy;
  for (const o of world.obstacles) {
    const ox = x - o.x;
    const oy = (y - o.y) * 1.6; // ground ellipses are flatter than they are wide
    const d = Math.hypot(ox, oy);
    const min = o.r + HERO_R;
    if (d < min && d > 0.001) {
      let px = (ox / d) * min;
      let py = (oy / d) * min;
      // Walking straight at a round obstacle would stop you dead (with only
      // eight headings that happens a lot): slide round it instead, toward
      // whichever side you were already slightly on.
      const mx = dx;
      const my = dy * 1.6;
      const len = Math.hypot(mx, my);
      const tx = -py / min;
      const ty = px / min;
      const along = mx * tx + my * ty;
      if (len > 0 && Math.abs(along) < len * 0.4) {
        const slide = (along !== 0 ? Math.sign(along) : 1) * len * 0.7;
        px += tx * slide;
        py += ty * slide;
        const k = min / Math.hypot(px, py);
        px *= k;
        py *= k;
      }
      x = o.x + px;
      y = o.y + py / 1.6;
    }
  }
  // Pond
  const px = (x - POND.x) / (POND.rx + HERO_R);
  const py = (y - POND.y) / (POND.ry + HERO_R * 0.6);
  const pd = Math.hypot(px, py);
  if (pd < 1 && pd > 0.001) {
    x = POND.x + (px / pd) * (POND.rx + HERO_R);
    y = POND.y + (py / pd) * (POND.ry + HERO_R * 0.6);
  }
  // Fence: passable only through the gateway once the ward is down.
  const wasLeft = from.x < FENCE_X;
  const crossing = wasLeft ? x > FENCE_X - HERO_R : x < FENCE_X + HERO_R;
  const lo = GATE_GAP.y0 + 12;
  const hi = GATE_GAP.y1 - 12;
  if (crossing && world.gateOpen && (y < lo || y > hi)) {
    // Walking into the fence just beside the open gateway steers you into
    // it, so the gap is easy to hit with only eight (or four) headings.
    const off = y > hi ? y - hi : y - lo;
    if (Math.abs(off) <= GATE_FUNNEL) y -= Math.sign(off) * Math.min(Math.abs(off), Math.abs(dx) + Math.abs(dy));
  }
  const through = world.gateOpen && y > GATE_GAP.y0 + 10 && y < GATE_GAP.y1 - 10;
  if (!through) {
    if (wasLeft && x > FENCE_X - HERO_R) x = FENCE_X - HERO_R;
    if (!wasLeft && x < FENCE_X + HERO_R) x = FENCE_X + HERO_R;
  }
  x = Math.max(50, Math.min(BOARD.w - 50, x));
  y = Math.max(60, Math.min(BOARD.h - 30, y));
  return { x, y };
}
