/**
 * Synthetic BlazePose landmark generators for detector tests.
 *
 * Each generator builds a plausible 2D skeleton from a joint angle, so tests
 * can script whole movements ("descend from 170° to 80° over 15 frames") and
 * assert on what the state machines count.
 */
import { LM } from '../../src/exercise/geometry';
import type { Landmark, PoseFrame } from '../../src/exercise/types';

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

/** Front-view squat at a given knee angle (degrees). */
export function squatPose(kneeDeg: number, t: number, opts: { noise?: { r: () => number; amp: number }; hideAnkles?: boolean } = {}): PoseFrame {
  const L = 0.2; // thigh = shin
  const a = rad((180 - kneeDeg) / 2);
  const legs = (ax: number) => {
    const A: P = [ax, 0.95];
    const K: P = [ax + L * Math.sin(a), 0.95 - L * Math.cos(a)];
    const H: P = [ax, 0.95 - 2 * L * Math.cos(a)];
    return { A, K, H };
  };
  const l = legs(0.45);
  const r = legs(0.55);
  const hipY = l.H[1];
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [0.5, hipY - 0.37],
    [LM.L_SHOULDER]: [0.42, hipY - 0.26],
    [LM.R_SHOULDER]: [0.58, hipY - 0.26],
    [LM.L_ELBOW]: [0.4, hipY - 0.12],
    [LM.R_ELBOW]: [0.6, hipY - 0.12],
    [LM.L_WRIST]: [0.4, hipY],
    [LM.R_WRIST]: [0.6, hipY],
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
