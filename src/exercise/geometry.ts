import type { Landmark } from './types';

/** MediaPipe BlazePose landmark indices used by the detectors. */
export const LM = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
} as const;

export type Side = 'left' | 'right';

export const SIDE = {
  left: {
    shoulder: LM.L_SHOULDER,
    elbow: LM.L_ELBOW,
    wrist: LM.L_WRIST,
    hip: LM.L_HIP,
    knee: LM.L_KNEE,
    ankle: LM.L_ANKLE,
  },
  right: {
    shoulder: LM.R_SHOULDER,
    elbow: LM.R_ELBOW,
    wrist: LM.R_WRIST,
    hip: LM.R_HIP,
    knee: LM.R_KNEE,
    ankle: LM.R_ANKLE,
  },
} as const;

/** Interior angle ABC in degrees, 0..180. */
export function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mid(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

/** Angle of segment a→b from horizontal, 0 (flat) .. 90 (vertical). */
export function inclineFromHorizontal(a: Landmark, b: Landmark): number {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function meanVisibility(lms: Landmark[], idx: readonly number[]): number {
  if (idx.length === 0) return 0;
  let s = 0;
  for (const i of idx) s += lms[i]?.visibility ?? 0;
  return s / idx.length;
}

/** Whether a landmark sits inside the frame (with a small margin). */
export function inFrame(l: Landmark, aspect: number, margin = 0.01): boolean {
  return l.x >= -margin && l.x <= aspect + margin && l.y >= -margin && l.y <= 1 + margin;
}

/** Pick the body side facing the camera better, by landmark visibility. */
export function bestSide(lms: Landmark[], keys: (keyof (typeof SIDE)['left'])[]): Side {
  const score = (s: Side) => keys.reduce((acc, k) => acc + (lms[SIDE[s][k]]?.visibility ?? 0), 0);
  return score('left') >= score('right') ? 'left' : 'right';
}

/** Exponential moving average helper that tolerates a cold start. */
export class Ema {
  private v: number | null = null;
  constructor(private readonly alpha: number) {}
  push(x: number): number {
    this.v = this.v === null ? x : this.v + this.alpha * (x - this.v);
    return this.v;
  }
  get value(): number | null {
    return this.v;
  }
  reset(): void {
    this.v = null;
  }
}
