/**
 * Synthetic BlazePose landmark generators for detector tests.
 *
 * Each generator builds a plausible 2D skeleton from a joint angle, so tests
 * can script whole movements ("descend from 170° to 80° over 15 frames") and
 * assert on what the state machines count.
 */
import { LM } from '../exercise/geometry';
import type { Landmark, PoseFrame, Side } from '../exercise/types';

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

/**
 * Standing, facing the phone, curling. `left` / `right` are 0 (arm hanging)
 * .. 1 (full curl) for the player's own arms. `lean` sways the whole upper
 * body (a swing); `elbowForward` lifts the elbows toward the camera.
 */
export function curlPose(left: number, right: number, t: number, o: { lean?: number; elbowRaise?: number } = {}): PoseFrame {
  const lean = rad(o.lean ?? 0);
  const hc: P = [0.5, 0.55];
  const rot = (dx: number, dy: number): P => [hc[0] + dx * Math.cos(lean) - dy * Math.sin(lean), hc[1] + dx * Math.sin(lean) + dy * Math.cos(lean)];
  const UA = 0.13;
  const arm = (side: 1 | -1, k: number) => {
    const S = rot(side * 0.08, -0.25);
    const E: P = [S[0] + side * 0.01, S[1] + UA - (o.elbowRaise ?? 0)];
    const phi = rad(140 * k);
    const W: P = [E[0] + side * 0.01, E[1] + UA * Math.cos(phi)];
    return { S, E, W };
  };
  const L = arm(1, left);
  const R = arm(-1, right);
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: rot(0, -0.36),
    [LM.L_SHOULDER]: L.S,
    [LM.R_SHOULDER]: R.S,
    [LM.L_ELBOW]: L.E,
    [LM.R_ELBOW]: R.E,
    [LM.L_WRIST]: L.W,
    [LM.R_WRIST]: R.W,
    [LM.L_HIP]: [0.55, 0.55],
    [LM.R_HIP]: [0.45, 0.55],
    [LM.L_KNEE]: [0.55, 0.75],
    [LM.R_KNEE]: [0.45, 0.75],
    [LM.L_ANKLE]: [0.55, 0.95],
    [LM.R_ANKLE]: [0.45, 0.95],
  };
  return frameFrom(pts, 1, t);
}

/**
 * Supported one-arm dumbbell row seen side-on: torso bent over near
 * horizontal, legs standing. `k` is 0 (arm hanging) .. 1 (dumbbell at the
 * ribs) for the rowing arm; the other arm hangs still onto the support.
 */
export function rowPose(side: 'left' | 'right', k: number, t: number): PoseFrame {
  const UA = 0.14;
  const S: P = [0.35, 0.5];
  const H: P = [0.62, 0.53];
  const th = rad(80 * k);
  const E: P = [S[0] + UA * Math.sin(th), S[1] + UA * Math.cos(th)];
  const W: P = [E[0], E[1] + UA];
  const sE: P = [S[0] - 0.02, S[1] + UA];
  const sW: P = [S[0] - 0.02, S[1] + 2 * UA];
  const work = side === 'left' ? [LM.L_ELBOW, LM.L_WRIST] : [LM.R_ELBOW, LM.R_WRIST];
  const sup = side === 'left' ? [LM.R_ELBOW, LM.R_WRIST] : [LM.L_ELBOW, LM.L_WRIST];
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [S[0] - 0.1, S[1] + 0.02],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: [S[0] + 0.005, S[1]],
    [work[0]]: E,
    [work[1]]: W,
    [sup[0]]: sE,
    [sup[1]]: sW,
    [LM.L_HIP]: H,
    [LM.R_HIP]: H,
    [LM.L_KNEE]: [0.62, 0.74],
    [LM.R_KNEE]: [0.6, 0.74],
    [LM.L_ANKLE]: [0.62, 0.95],
    [LM.R_ANKLE]: [0.6, 0.95],
  };
  return frameFrom(pts, 4 / 3, t);
}

/** Reverse lunge facing the phone: depth 0 (standing) .. 1 (bottom); `back` is the leg that steps back. */
export function lungePose(depth: number, back: 'left' | 'right', t: number): PoseFrame {
  const d = depth;
  const hipY = 0.55 + 0.12 * d;
  const knee = (side: 'left' | 'right') => 0.75 + (side === back ? 0.15 : 0.03) * d;
  const ankle = (side: 'left' | 'right') => 0.95 - (side === back ? 0.05 : 0) * d;
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [0.5, hipY - 0.36],
    [LM.L_SHOULDER]: [0.58, hipY - 0.25],
    [LM.R_SHOULDER]: [0.42, hipY - 0.25],
    [LM.L_ELBOW]: [0.6, hipY - 0.12],
    [LM.R_ELBOW]: [0.4, hipY - 0.12],
    [LM.L_WRIST]: [0.6, hipY],
    [LM.R_WRIST]: [0.4, hipY],
    [LM.L_HIP]: [0.55, hipY],
    [LM.R_HIP]: [0.45, hipY],
    [LM.L_KNEE]: [0.56 + 0.03 * d, knee('left')],
    [LM.R_KNEE]: [0.44 - 0.03 * d, knee('right')],
    [LM.L_ANKLE]: [0.55, ankle('left')],
    [LM.R_ANKLE]: [0.45, ankle('right')],
  };
  return frameFrom(pts, 1, t);
}

/** Standing cross-body crunch: `knee` side drives up by k (0..1) while the opposite elbow comes across to meet it. */
export function crossCrunchPose(knee: 'left' | 'right', k: number, t: number, o: { elbow?: boolean } = {}): PoseFrame {
  const f = standPose(t, { liftL: knee === 'left' ? 1.3 * k : 0, liftR: knee === 'right' ? 1.3 * k : 0, rightHand: 'shoulder', leftHand: 'shoulder' });
  if (o.elbow !== false && k > 0) {
    const kn = f.landmarks[knee === 'left' ? LM.L_KNEE : LM.R_KNEE];
    const eIdx = knee === 'left' ? LM.R_ELBOW : LM.L_ELBOW;
    const e = f.landmarks[eIdx];
    f.landmarks[eIdx] = { ...e, x: e.x + (kn.x - e.x) * k, y: e.y + (kn.y - 0.05 - e.y) * k };
  }
  return f;
}

/** Mountain climber side-on: plank with each knee driven toward the chest by 0..1. */
export function climberPose(driveL: number, driveR: number, t: number): PoseFrame {
  const f = pushupPose(170, t);
  const l = f.landmarks;
  const hip = l[LM.L_HIP];
  const drive = (ki: number, ai: number, k: number) => {
    // Swing the thigh from along the body toward under the chest.
    const a = rad(180 - 85 * k);
    const len = Math.hypot(l[ki].x - hip.x, l[ki].y - hip.y);
    const base = Math.atan2(hip.y - l[LM.L_SHOULDER].y, hip.x - l[LM.L_SHOULDER].x);
    const dir = base + (Math.PI - a);
    l[ki] = { ...l[ki], x: hip.x + Math.cos(dir) * len, y: hip.y + Math.sin(dir) * len };
    l[ai] = { ...l[ai], x: l[ki].x - 0.05 * k, y: l[ki].y + 0.12 * k };
  };
  drive(LM.L_KNEE, LM.L_ANKLE, driveL);
  drive(LM.R_KNEE, LM.R_ANKLE, driveR);
  return f;
}

/** Dead bug side-on, lying on the back: each leg 0 (tabletop, knee over hip) .. 1 (extended). */
export function deadBugPose(extL: number, extR: number, t: number): PoseFrame {
  const S: P = [0.45, 0.8];
  const H: P = [0.75, 0.8];
  const leg = (e: number) => {
    const K: P = [H[0] + 0.02 + 0.1 * e, H[1] - 0.18 + 0.12 * e];
    // Tabletop: shin horizontal (knee 90°); extended: straight line from hip.
    const shin = rad(90 + 90 * e);
    const dir = Math.atan2(K[1] - H[1], K[0] - H[0]);
    const a = dir + Math.PI - shin;
    const A: P = [K[0] + Math.cos(a) * 0.19, K[1] + Math.sin(a) * 0.19];
    return { K, A };
  };
  const Ll = leg(extL);
  const Rl = leg(extR);
  const pts: Partial<Record<number, P>> = {
    [LM.NOSE]: [0.35, 0.78],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: [S[0] + 0.005, S[1]],
    [LM.L_ELBOW]: [S[0], S[1] - 0.14],
    [LM.R_ELBOW]: [S[0] + 0.01, S[1] - 0.14],
    [LM.L_WRIST]: [S[0], S[1] - 0.27],
    [LM.R_WRIST]: [S[0] + 0.01, S[1] - 0.27],
    [LM.L_HIP]: H,
    [LM.R_HIP]: H,
    [LM.L_KNEE]: Ll.K,
    [LM.R_KNEE]: Rl.K,
    [LM.L_ANKLE]: Ll.A,
    [LM.R_ANKLE]: Rl.A,
  };
  return frameFrom(pts, 4 / 3, t);
}

// ── More movements ───────────────────────────────────────────────────────

type Pts = Partial<Record<number, P>>;
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** Standing, facing the phone, with the arms placed explicitly (player's left = image right). */
function standingWith(t: number, arms: Pts, shift = 0): PoseFrame {
  const base = standPose(t);
  const pts: Pts = {};
  for (const i of [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST, LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE]) pts[i] = arms[i] ?? [base.landmarks[i].x, base.landmarks[i].y];
  if (shift) for (const k of Object.keys(pts)) pts[+k] = [pts[+k]![0] + shift, pts[+k]![1]];
  return frameFrom(pts, 1, t);
}

const SH_L: P = [0.58, 0.3];
const SH_R: P = [0.42, 0.3];

/** Dumbbell overhead press, facing: k 0 (hands at the shoulders) .. 1 (arms overhead). */
export function pressPose(k: number, t: number, lag = 0): PoseFrame {
  // The elbow swings on an arc (upper arm length constant); the wrist rises over it.
  const arm = (S: P, side: 1 | -1, kk: number) => {
    const th = rad(-40 + 110 * kk);
    const e: P = [S[0] + side * Math.cos(th) * 0.11, S[1] - Math.sin(th) * 0.11];
    return { e, w: lerp([e[0], e[1] - 0.11], [S[0] + side * 0.02, S[1] - 0.23], kk) };
  };
  const L = arm(SH_L, 1, k);
  const R = arm(SH_R, -1, Math.max(0, k - lag));
  return standingWith(t, { [LM.L_ELBOW]: L.e, [LM.L_WRIST]: L.w, [LM.R_ELBOW]: R.e, [LM.R_WRIST]: R.w });
}

/** Dumbbell lateral raise, facing: k 0 (arms hanging) .. 1 (out to shoulder height). */
export function lateralPose(k: number, t: number): PoseFrame {
  const arm = (S: P, side: 1 | -1) => {
    const th = rad(88 * k);
    return { e: [S[0] + side * Math.sin(th) * 0.12, S[1] + Math.cos(th) * 0.12] as P, w: [S[0] + side * Math.sin(th) * 0.24, S[1] + Math.cos(th) * 0.24] as P };
  };
  const L = arm(SH_L, 1);
  const R = arm(SH_R, -1);
  return standingWith(t, { [LM.L_ELBOW]: L.e, [LM.L_WRIST]: L.w, [LM.R_ELBOW]: R.e, [LM.R_WRIST]: R.w });
}

/** Skaters: standing, shifted toward the player's own left by `shift` shoulder widths (negative = right). */
export function skaterPose(shift: number, t: number): PoseFrame {
  return standingWith(t, {}, shift * 0.16);
}

/** Butt kicks, facing: each heel 0 (down) .. 1 (kicked up behind); `kneeUp` lifts the knee instead (a high knee). */
export function kickPose(kL: number, kR: number, t: number, o: { kneeUp?: number } = {}): PoseFrame {
  const leg = (x: number, k: number) => {
    const knee: P = [x, 0.75 - 0.18 * (o.kneeUp ?? 0) * k];
    return { k: knee, a: [x + 0.01, lerp([0, 0.95], [0, knee[1] - 0.04], k)[1]] as P };
  };
  const L = leg(0.55, kL);
  const R = leg(0.45, kR);
  return standingWith(t, { [LM.L_KNEE]: L.k, [LM.L_ANKLE]: L.a, [LM.R_KNEE]: R.k, [LM.R_ANKLE]: R.a });
}

/** Russian twist, seated facing the phone: hands turned toward the player's left by k (−1 .. 1). */
export function twistPose(k: number, t: number): PoseFrame {
  const w: P = [0.5 + 0.13 * k, 0.58];
  const pts: Pts = {
    [LM.NOSE]: [0.5 + 0.02 * k, 0.33],
    [LM.L_SHOULDER]: [0.57 + 0.01 * k, 0.45],
    [LM.R_SHOULDER]: [0.43 + 0.01 * k, 0.45],
    [LM.L_ELBOW]: [0.56 + 0.07 * k, 0.55],
    [LM.R_ELBOW]: [0.44 + 0.07 * k, 0.55],
    [LM.L_WRIST]: [w[0] + 0.015, w[1]],
    [LM.R_WRIST]: [w[0] - 0.015, w[1]],
    [LM.L_HIP]: [0.55, 0.7],
    [LM.R_HIP]: [0.45, 0.7],
    [LM.L_KNEE]: [0.56, 0.6],
    [LM.R_KNEE]: [0.44, 0.6],
    [LM.L_ANKLE]: [0.57, 0.8],
    [LM.R_ANKLE]: [0.43, 0.8],
  };
  return frameFrom(pts, 1, t);
}

/** Glute bridge, lying side-on: hips 0 (down) .. 1 (lifted into a line). */
export function bridgePose(k: number, t: number): PoseFrame {
  const S: P = [0.3, 0.8];
  const H: P = [0.55, 0.8 - 0.1 * k];
  const K: P = [0.7, 0.66];
  const A: P = [0.78, 0.8];
  const pts: Pts = {
    [LM.NOSE]: [0.2, 0.78],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: [S[0] + 0.005, S[1]],
    [LM.L_ELBOW]: [0.4, 0.82],
    [LM.R_ELBOW]: [0.41, 0.82],
    [LM.L_WRIST]: [0.5, 0.82],
    [LM.R_WRIST]: [0.51, 0.82],
    [LM.L_HIP]: H,
    [LM.R_HIP]: H,
    [LM.L_KNEE]: K,
    [LM.R_KNEE]: K,
    [LM.L_ANKLE]: A,
    [LM.R_ANKLE]: A,
  };
  return frameFrom(pts, 4 / 3, t);
}

/**
 * Straight punches. `side`: turned side-on facing image-right, punching along
 * the image (the far arm less visible). `front`: facing the phone, punching
 * toward it (depth in z, the elbow rising to shoulder height). ext 0 (guard) .. 1.
 */
export function punchPose(stance: 'front' | 'side', extL: number, extR: number, t: number): PoseFrame {
  const z: Record<number, number> = {};
  const vis: Record<number, number> = {};
  let pts: Pts;
  if (stance === 'side') {
    const arm = (S: P, k: number) => ({ e: lerp([S[0] + 0.02, S[1] + 0.1], [S[0] + 0.13, S[1]], k), w: lerp([S[0] + 0.05, S[1] - 0.08], [S[0] + 0.26, S[1]], k) });
    const SL: P = [0.5, 0.35];
    const SR: P = [0.51, 0.35];
    const L = arm(SL, extL);
    const R = arm(SR, extR);
    pts = {
      [LM.NOSE]: [0.55, 0.25],
      [LM.L_SHOULDER]: SL,
      [LM.R_SHOULDER]: SR,
      [LM.L_ELBOW]: L.e,
      [LM.R_ELBOW]: R.e,
      [LM.L_WRIST]: L.w,
      [LM.R_WRIST]: R.w,
      [LM.L_HIP]: [0.5, 0.6],
      [LM.R_HIP]: [0.51, 0.6],
      [LM.L_KNEE]: [0.52, 0.78],
      [LM.R_KNEE]: [0.48, 0.78],
      [LM.L_ANKLE]: [0.53, 0.95],
      [LM.R_ANKLE]: [0.46, 0.95],
    };
    // The far (right) arm is partly behind the body.
    for (const i of [LM.R_ELBOW, LM.R_WRIST]) vis[i] = 0.6;
  } else {
    const arm = (S: P, side: 1 | -1, k: number, ei: number, wi: number) => {
      z[ei] = -0.13 * k;
      z[wi] = -0.05 - 0.21 * k;
      return { e: lerp([S[0] + side * 0.02, S[1] + 0.12], [S[0], S[1] + 0.01], k), w: lerp([S[0] - side * 0.03, S[1] - 0.06], [S[0] - side * 0.01, S[1]], k) };
    };
    const L = arm(SH_L, 1, extL, LM.L_ELBOW, LM.L_WRIST);
    const R = arm(SH_R, -1, extR, LM.R_ELBOW, LM.R_WRIST);
    return withZ(standingWith(t, { [LM.L_ELBOW]: L.e, [LM.L_WRIST]: L.w, [LM.R_ELBOW]: R.e, [LM.R_WRIST]: R.w }), z, vis);
  }
  return withZ(frameFrom(pts, 1, t), z, vis);
}

function withZ(f: PoseFrame, z: Record<number, number>, vis: Record<number, number>): PoseFrame {
  for (const [i, v] of Object.entries(z)) f.landmarks[+i].z = v;
  for (const [i, v] of Object.entries(vis)) f.landmarks[+i].visibility = v;
  return f;
}

/**
 * Wall sit, side-on (facing image-left): `k` 0 (standing) .. 1 (seated, knees
 * at ~90°, thighs level). `lean` tips the torso forward, degrees.
 */
export function wallSitPose(k: number, t: number, o: { lean?: number } = {}): PoseFrame {
  const A: P = [0.5, 0.9];
  const K: P = [0.5 - 0.02 * k, 0.9 - 0.22];
  const th = rad(90 - 90 * k); // thigh angle from horizontal: 90 standing .. 0 seated
  const H: P = [K[0] + 0.22 * Math.cos(th), K[1] - 0.22 * Math.sin(th)];
  const lean = rad(o.lean ?? 0);
  const S: P = [H[0] - 0.28 * Math.sin(lean), H[1] - 0.28 * Math.cos(lean)];
  const pts: Pts = {
    [LM.NOSE]: [S[0] - 0.03, S[1] - 0.08],
    [LM.L_SHOULDER]: S,
    [LM.R_SHOULDER]: [S[0] + 0.005, S[1]],
    [LM.L_ELBOW]: [S[0] - 0.02, S[1] + 0.13],
    [LM.R_ELBOW]: [S[0] - 0.015, S[1] + 0.13],
    [LM.L_WRIST]: [S[0] - 0.05, S[1] + 0.24],
    [LM.R_WRIST]: [S[0] - 0.045, S[1] + 0.24],
    [LM.L_HIP]: H,
    [LM.R_HIP]: [H[0] + 0.005, H[1]],
    [LM.L_KNEE]: K,
    [LM.R_KNEE]: [K[0] + 0.005, K[1]],
    [LM.L_ANKLE]: A,
    [LM.R_ANKLE]: [A[0] + 0.005, A[1]],
  };
  return frameFrom(pts, 4 / 3, t);
}

/**
 * Side plank facing the phone, resting on `down` (the player's side, whose
 * landmarks are the lower ones). `lift` 0 (lying flat) .. 1 (hips up in a
 * straight line).
 */
export function sidePlankPose(down: Side, lift: number, t: number): PoseFrame {
  // Head toward image-left; the body runs diagonally down to the feet at image-right.
  // The shoulders stack across the body line, a shoulder-width apart.
  const lowSh: P = [0.41, 0.665];
  const hiSh: P = [0.31, 0.435];
  const feet: P = [1.05, 0.86];
  const shMid: P = [(lowSh[0] + hiSh[0]) / 2, (lowSh[1] + hiSh[1]) / 2];
  const line = lerp(shMid, feet, 0.45);
  const sag: P = [line[0], 0.86];
  const hip = lerp(sag, line, lift);
  const knee = lerp(hip, feet, 0.5);
  const low = down;
  const high: Side = down === 'left' ? 'right' : 'left';
  const L = (s: Side, left: number, right: number) => (s === 'left' ? left : right);
  const pts: Pts = {
    [LM.NOSE]: [0.26, 0.52],
    [L(low, LM.L_SHOULDER, LM.R_SHOULDER)]: lowSh,
    [L(high, LM.L_SHOULDER, LM.R_SHOULDER)]: hiSh,
    [L(low, LM.L_ELBOW, LM.R_ELBOW)]: [0.36, 0.86],
    [L(high, LM.L_ELBOW, LM.R_ELBOW)]: [0.48, 0.55],
    [L(low, LM.L_WRIST, LM.R_WRIST)]: [0.24, 0.87],
    [L(high, LM.L_WRIST, LM.R_WRIST)]: [0.56, 0.6],
    [L(low, LM.L_HIP, LM.R_HIP)]: [hip[0], hip[1] + 0.03],
    [L(high, LM.L_HIP, LM.R_HIP)]: [hip[0], hip[1] - 0.03],
    [L(low, LM.L_KNEE, LM.R_KNEE)]: [knee[0], knee[1] + 0.02],
    [L(high, LM.L_KNEE, LM.R_KNEE)]: [knee[0], knee[1] - 0.02],
    [L(low, LM.L_ANKLE, LM.R_ANKLE)]: [feet[0], feet[1] + 0.01],
    [L(high, LM.L_ANKLE, LM.R_ANKLE)]: [feet[0], feet[1] - 0.01],
  };
  return frameFrom(pts, 4 / 3, t);
}
