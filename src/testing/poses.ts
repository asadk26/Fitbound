/**
 * Synthetic BlazePose landmark generators for detector tests.
 *
 * Each generator builds a plausible 2D skeleton from a joint angle, so tests
 * can script whole movements ("descend from 170° to 80° over 15 frames") and
 * assert on what the state machines count.
 */
import { LM } from '../exercise/geometry';
import type { Landmark, PoseFrame } from '../exercise/types';

type P = [number, number];

export const FRAME_MS = 33;

/** Deterministic PRNG so noisy tests are reproducible. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function frameFrom(points: Partial<Record<number, P>>, aspect: number, t: number, vis = 0.95, noise?: { r: () => number; amp: number }): PoseFrame {
  const landmarks: Landmark[] = [];
  const fallback = points[LM.NOSE] ?? [aspect / 2, 0.2];
  for (let i = 0; i < 33; i++) {
    const p = points[i] ?? fallback;
    const jx = noise ? (noise.r() - 0.5) * 2 * noise.amp : 0;
    const jy = noise ? (noise.r() - 0.5) * 2 * noise.amp : 0;
    landmarks.push({ x: p[0] + jx, y: p[1] + jy, z: 0, visibility: points[i] ? vis : 0.1 });
  }
  return { landmarks, timestamp: t, aspect };
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Side-view push-up at a given elbow angle (degrees). */
export function pushupPose(elbowDeg: number, t: number, opts: { noise?: { r: () => number; amp: number }; vis?: number } = {}): PoseFrame {
  const U = 0.15; // upper arm = forearm
  const W: P = [0.5, 0.8];
  const h = Math.sqrt(2 * U * U - 2 * U * U * Math.cos(rad(elbowDeg)));
  const S: P = [0.5, W[1] - h];
  const d = Math.sqrt(Math.max(U * U - (h / 2) ** 2, 0));
  const E: P = [0.5 + d, W[1] - h / 2];
  const A: P = [1.2, 0.79];
  const along = (k: number): P => [S[0] + k * (A[0] - S[0]), S[1] + k * (A[1] - S[1])];
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [S[0] - 0.08, S[1] + 0.01],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: [S[0] + 0.005, S[1]],
    [LM.L_ELBOW]: E,
    [LM.R_ELBOW]: E,
    [LM.L_WRIST]: W,
    [LM.R_WRIST]: W,
    [LM.L_HIP]: along(0.43),
    [LM.R_HIP]: along(0.43),
    [LM.L_KNEE]: along(0.7),
    [LM.R_KNEE]: along(0.7),
    [LM.L_ANKLE]: A,
    [LM.R_ANKLE]: A,
  };
  return frameFrom(pts, 4 / 3, t, opts.vis, opts.noise);
}

/** Standing upright, side-on, bending the elbows (a biceps curl). */
export function standingCurlPose(elbowDeg: number, t: number): PoseFrame {
  const S: P = [0.6, 0.3];
  const E: P = [0.6, 0.45];
  const a = rad(180 - elbowDeg);
  const W: P = [E[0] + 0.15 * Math.sin(a), E[1] + 0.15 * Math.cos(a)];
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [0.6, 0.18],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: S,
    [LM.L_ELBOW]: E,
    [LM.R_ELBOW]: E,
    [LM.L_WRIST]: W,
    [LM.R_WRIST]: W,
    [LM.L_HIP]: [0.6, 0.58],
    [LM.R_HIP]: [0.6, 0.58],
    [LM.L_KNEE]: [0.6, 0.76],
    [LM.R_KNEE]: [0.6, 0.76],
    [LM.L_ANKLE]: [0.6, 0.94],
    [LM.R_ANKLE]: [0.6, 0.94],
  };
  return frameFrom(pts, 4 / 3, t);
}

/**
 * Squat at a given thigh angle from vertical (0 = standing, 90 = thighs
 * parallel). The shin leans about half as much as the thigh, as in a real
 * squat. `view: 'front'` projects the pose as a front-facing camera sees it:
 * hip, knee and ankle stay stacked and only vertical distances change.
 */
export function squatPose(
  thighDeg: number,
  t: number,
  opts: { noise?: { r: () => number; amp: number }; hideAnkles?: boolean; view?: 'front' | 'side'; torsoLean?: number } = {},
): PoseFrame {
  const L = 0.2; // thigh = shin
  const th = rad(thighDeg);
  const sh = rad(thighDeg * 0.5);
  const side = opts.view === 'side';
  const legs = (ax: number) => {
    const A: P = [ax, 0.95];
    const K: P = [ax + (side ? L * Math.sin(sh) : 0), 0.95 - L * Math.cos(sh)];
    const H: P = [K[0] - (side ? L * Math.sin(th) : 0), K[1] - L * Math.cos(th)];
    return { A, K, H };
  };
  const l = legs(side ? 0.5 : 0.45);
  const r = legs(side ? 0.5 : 0.55);
  const hipY = l.H[1];
  const hx = (l.H[0] + r.H[0]) / 2;
  // Torso leans forward as the thighs drop (side view shows it).
  const lean = rad(opts.torsoLean ?? thighDeg * 0.4);
  const tx = side ? Math.sin(lean) * 0.26 : 0;
  const ty = Math.cos(lean) * 0.26;
  const sw = side ? 0.005 : 0.08;
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [hx + tx * 1.4, hipY - ty - 0.11],
    [LM.L_SHOULDER]: [hx + tx - sw, hipY - ty],
    [LM.R_SHOULDER]: [hx + tx + sw, hipY - ty],
    [LM.L_ELBOW]: [hx + tx - sw, hipY - ty + 0.13],
    [LM.R_ELBOW]: [hx + tx + sw, hipY - ty + 0.13],
    [LM.L_WRIST]: [hx + tx - sw, hipY - ty + 0.25],
    [LM.R_WRIST]: [hx + tx + sw, hipY - ty + 0.25],
    [LM.L_HIP]: l.H,
    [LM.R_HIP]: r.H,
    [LM.L_KNEE]: l.K,
    [LM.R_KNEE]: r.K,
  };
  if (!opts.hideAnkles) {
    pts[LM.L_ANKLE] = l.A;
    pts[LM.R_ANKLE] = r.A;
  }
  return frameFrom(pts, 1, t, 0.95, opts.noise);
}

/** Standing side-on, hinging forward at the hips with straight legs. */
export function hingePose(bendDeg: number, t: number): PoseFrame {
  const lean = rad(bendDeg);
  const H: P = [0.5 - 0.05 * Math.sin(lean), 0.55];
  const S: P = [H[0] + Math.sin(lean) * 0.26, H[1] - Math.cos(lean) * 0.26];
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [S[0] + Math.sin(lean) * 0.1, S[1] - Math.cos(lean) * 0.1],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: [S[0] + 0.005, S[1]],
    [LM.L_ELBOW]: [S[0], S[1] + 0.13],
    [LM.R_ELBOW]: [S[0], S[1] + 0.13],
    [LM.L_WRIST]: [S[0], S[1] + 0.25],
    [LM.R_WRIST]: [S[0], S[1] + 0.25],
    [LM.L_HIP]: H,
    [LM.R_HIP]: H,
    [LM.L_KNEE]: [0.5, 0.75],
    [LM.R_KNEE]: [0.5, 0.75],
    [LM.L_ANKLE]: [0.5, 0.95],
    [LM.R_ANKLE]: [0.5, 0.95],
  };
  return frameFrom(pts, 1, t);
}

/** Front-view jumping jack. arms/legs in 0 (closed) .. 1 (open). */
export function jackPose(arms: number, legs: number, t: number, opts: { noise?: { r: () => number; amp: number } } = {}): PoseFrame {
  const lerp = (x: number, y: number, k: number) => x + (y - x) * k;
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [0.5, 0.2],
    [LM.L_SHOULDER]: [0.42, 0.3],
    [LM.R_SHOULDER]: [0.58, 0.3],
    [LM.L_ELBOW]: [lerp(0.4, 0.33, arms), lerp(0.42, 0.22, arms)],
    [LM.R_ELBOW]: [lerp(0.6, 0.67, arms), lerp(0.42, 0.22, arms)],
    [LM.L_WRIST]: [lerp(0.4, 0.3, arms), lerp(0.55, 0.13, arms)],
    [LM.R_WRIST]: [lerp(0.6, 0.7, arms), lerp(0.55, 0.13, arms)],
    [LM.L_HIP]: [0.45, 0.55],
    [LM.R_HIP]: [0.55, 0.55],
    [LM.L_KNEE]: [lerp(0.455, 0.4, legs), 0.75],
    [LM.R_KNEE]: [lerp(0.545, 0.6, legs), 0.75],
    [LM.L_ANKLE]: [lerp(0.46, 0.34, legs), 0.95],
    [LM.R_ANKLE]: [lerp(0.54, 0.66, legs), 0.95],
  };
  return frameFrom(pts, 1, t, 0.95, opts.noise);
}

/** Side-view forearm plank. `sag` drops the hips below the body line (0 = straight, 12 ≈ a clear sag). */
export function plankPose(t: number, sag = 0): PoseFrame {
  const S: P = [0.45, 0.62];
  const A: P = [1.2, 0.8];
  const midX = S[0] + 0.43 * (A[0] - S[0]);
  const midY = S[1] + 0.43 * (A[1] - S[1]) + sag * 0.012;
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [0.37, 0.62],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: S,
    [LM.L_ELBOW]: [0.45, 0.8],
    [LM.R_ELBOW]: [0.45, 0.8],
    [LM.L_WRIST]: [0.3, 0.8],
    [LM.R_WRIST]: [0.3, 0.8],
    [LM.L_HIP]: [midX, midY],
    [LM.R_HIP]: [midX, midY],
    [LM.L_KNEE]: [S[0] + 0.7 * (A[0] - S[0]), S[1] + 0.7 * (A[1] - S[1])],
    [LM.R_KNEE]: [S[0] + 0.7 * (A[0] - S[0]), S[1] + 0.7 * (A[1] - S[1])],
    [LM.L_ANKLE]: A,
    [LM.R_ANKLE]: A,
  };
  return frameFrom(pts, 4 / 3, t);
}

/** Linear ramp of values, inclusive of both ends. */
export function ramp(from: number, to: number, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) out.push(from + ((to - from) * i) / steps);
  return out;
}

export function hold(value: number, frames: number): number[] {
  return Array.from({ length: frames }, () => value);
}

/** One full push-up / squat cycle of angles: top → bottom → top. */
export function cycle(top: number, bottom: number, framesDown = 15, framesHold = 4, framesUp = 15): number[] {
  return [...ramp(top, bottom, framesDown), ...hold(bottom, framesHold), ...ramp(bottom, top, framesUp)];
}

export interface StandOpts {
  /** Torso lean in degrees; positive = toward the player's LEFT. */
  lean?: number;
  /** 0..1 lift of each leg (knee and foot rise). */
  liftL?: number;
  liftR?: number;
  rightHand?: 'down' | 'up' | 'shoulder';
  leftHand?: 'down' | 'up' | 'shoulder';
  /** Whole body shifted up (a jump) in image units. */
  bob?: number;
  /** Scale about the image centre (stepping toward / away from the camera). */
  scale?: number;
  noise?: { r: () => number; amp: number };
}

/**
 * A player standing and facing an unmirrored front camera, as a phone on a
 * shelf sees them: the player's LEFT side appears on the image's RIGHT.
 */
export function standPose(t: number, o: StandOpts = {}): PoseFrame {
  const lean = rad(o.lean ?? 0);
  const b = o.bob ?? 0;
  const hipY = 0.55 - b;
  const hc: P = [0.5, hipY];
  // Rotate an upper-body point about the hip centre toward the player's left (+x).
  const rot = (dx: number, dy: number): P => [hc[0] + dx * Math.cos(lean) - dy * Math.sin(lean), hc[1] + dx * Math.sin(lean) + dy * Math.cos(lean)];
  const shL = rot(0.08, -0.25);
  const shR = rot(-0.08, -0.25);
  const nose = rot(0, -0.36);
  const hand = (side: 1 | -1, pose: 'down' | 'up' | 'shoulder' | undefined): { e: P; w: P } => {
    const sx = side * 0.08;
    if (pose === 'up') return { e: rot(sx + side * 0.03, -0.4), w: rot(sx + side * 0.02, -0.52) };
    if (pose === 'shoulder') return { e: rot(sx + side * 0.1, -0.2), w: rot(sx + side * 0.12, -0.3) };
    return { e: rot(sx + side * 0.02, -0.12), w: rot(sx + side * 0.02, 0) };
  };
  const hl = hand(1, o.leftHand);
  const hr = hand(-1, o.rightHand);
  const leg = (side: 1 | -1, lift: number) => {
    const x = 0.5 + side * 0.05;
    return { k: [x, 0.75 - b - 0.1 * lift] as P, a: [x, 0.95 - b - 0.12 * lift] as P };
  };
  const ll = leg(1, o.liftL ?? 0);
  const lr = leg(-1, o.liftR ?? 0);
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: nose,
    [LM.L_SHOULDER]: shL,
    [LM.R_SHOULDER]: shR,
    [LM.L_ELBOW]: hl.e,
    [LM.R_ELBOW]: hr.e,
    [LM.L_WRIST]: hl.w,
    [LM.R_WRIST]: hr.w,
    [LM.L_HIP]: [0.55, hipY],
    [LM.R_HIP]: [0.45, hipY],
    [LM.L_KNEE]: ll.k,
    [LM.R_KNEE]: lr.k,
    [LM.L_ANKLE]: ll.a,
    [LM.R_ANKLE]: lr.a,
  };
  const s = o.scale ?? 1;
  if (s !== 1) for (const k of Object.keys(pts)) {
    const p = pts[+k]!;
    pts[+k] = [0.5 + (p[0] - 0.5) * s, 0.5 + (p[1] - 0.5) * s];
  }
  return frameFrom(pts, 1, t, 0.95, o.noise);
}
