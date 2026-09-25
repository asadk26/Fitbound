import { angle, dist, Ema, inclineFromHorizontal, LM, mid, SIDE } from '../geometry';
import type { GuidanceCode, Landmark, PoseFrame, Side } from '../types';
import { LimbCycleDetector, type LimbCycleConfig, type LimbReading } from './limbCycle';

/**
 * More movements for variety, each chosen because it reads cleanly from one
 * fixed phone:
 *
 *   upper   overhead press, lateral raise (dumbbells, facing the phone)
 *   legs    glute bridge (lying side-on, like push-ups)
 *   cardio  skaters (side-to-side bounds), butt kicks (facing)
 *   core    Russian twists (seated, facing)
 *
 * plus a straight-punch detector for the Movement Lab only (a feasibility
 * test for Punch Away and the Unbound), facing the phone or side-on.
 *
 * All are measured against the body's own proportions, so distance to the
 * phone doesn't matter. Directions use the anatomical left → right axis (from
 * the shoulder or hip landmarks), never the image's x, so a mirrored preview
 * can't swap sides.
 */

const vis = (l: Landmark, min = 0.5) => l.visibility >= min;
const SIDES: Side[] = ['left', 'right'];

function upright(l: Landmark[], min = 60): boolean {
  return inclineFromHorizontal(mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]), mid(l[LM.L_HIP], l[LM.R_HIP])) >= min;
}

/** Unit vector pointing toward the player's own left, and the span it was measured on. */
function leftAxis(a: Landmark, b: Landmark): { ux: number; uy: number; span: number } {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const span = Math.max(Math.hypot(dx, dy), 1e-3);
  return { ux: dx / span, uy: dy / span, span };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Overhead press ───────────────────────────────────────────────────────

export interface PressConfig extends LimbCycleConfig {
  /** Wrist height above the shoulder (upper-arm lengths) at the rack... */
  rack: number;
  /** ...and overhead, arms extended. */
  top: number;
}

export const PRESS_DEFAULTS: PressConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 600, rack: 0.6, top: 1.75 };

/**
 * Standing dumbbell overhead press, facing the phone: both hands from about
 * shoulder height to fully overhead and back. The lower of the two arms is
 * what counts, so it takes both arms (one arm lagging holds the rep back).
 */
export class OverheadPressDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';
  private readonly ua: Record<Side, Ema> = { left: new Ema(0.15), right: new Ema(0.15) };

  constructor(private readonly cfg: PressConfig = PRESS_DEFAULTS) {
    super('overhead_press', cfg, [{ key: 'both', dir: 'up', rest: cfg.rack, peak: cfg.top }]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const h: number[] = [];
    let conf = 0;
    for (const s of SIDES) {
      const S = l[SIDE[s].shoulder];
      const E = l[SIDE[s].elbow];
      const W = l[SIDE[s].wrist];
      if (!vis(S) || !vis(E) || !vis(W)) continue;
      conf += (S.visibility + E.visibility + W.visibility) / 3;
      const cur = dist(S, E);
      const ua = Math.max(this.ua[s].value === null || cur >= 0.8 * this.ua[s].value! ? this.ua[s].push(cur) : this.ua[s].value!, 1e-3);
      h.push((S.y - W.y) / ua);
    }
    const ok = h.length === 2;
    const v = ok ? Math.min(h[0], h[1]) : null;
    const up = upright(l);
    return {
      confidence: h.length ? conf / h.length : 0,
      issue: !ok ? 'ARMS_NOT_VISIBLE' : !up ? 'STAND_UPRIGHT' : null,
      values: { both: v },
      startReady: ok && up && v! <= this.cfg.rack,
      metrics: { height: +(v ?? 0).toFixed(2) },
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }

  reset(): void {
    super.reset();
    this.ua.left.reset();
    this.ua.right.reset();
  }
}

// ── Lateral raise ────────────────────────────────────────────────────────

export interface RaiseConfig extends LimbCycleConfig {
  /** Arm angle from hanging straight down (degrees) at rest... */
  low: number;
  /** ...and raised out to the side, about shoulder height. */
  high: number;
}

export const RAISE_DEFAULTS: RaiseConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 600, low: 30, high: 72 };

/** Angle of the shoulder → wrist line from straight down, 0..180°. */
function armFromVertical(S: Landmark, W: Landmark): number {
  const dx = W.x - S.x;
  const dy = W.y - S.y;
  return (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;
}

/**
 * Standing dumbbell lateral raises, facing the phone: both arms lift out to
 * the sides to about shoulder height and come back down. Both arms together
 * (the lower one counts).
 */
export class LateralRaiseDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';

  constructor(private readonly cfg: RaiseConfig = RAISE_DEFAULTS) {
    super('lateral_raise', cfg, [{ key: 'both', dir: 'up', rest: cfg.low, peak: cfg.high }]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const a: number[] = [];
    let conf = 0;
    for (const s of SIDES) {
      const S = l[SIDE[s].shoulder];
      const W = l[SIDE[s].wrist];
      if (!vis(S) || !vis(W)) continue;
      conf += (S.visibility + W.visibility) / 2;
      a.push(armFromVertical(S, W));
    }
    const ok = a.length === 2;
    const v = ok ? Math.min(a[0], a[1]) : null;
    const up = upright(l);
    return {
      confidence: a.length ? conf / a.length : 0,
      issue: !ok ? 'ARMS_NOT_VISIBLE' : !up ? 'STAND_UPRIGHT' : null,
      values: { both: v },
      startReady: ok && up && v! <= this.cfg.low,
      metrics: { angle: Math.round(v ?? 0) },
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }
}

// ── Glute bridge ─────────────────────────────────────────────────────────

export interface BridgeConfig extends LimbCycleConfig {
  /** Hip angle (shoulder–hip–knee) with the hips down... */
  down: number;
  /** ...and lifted into a straight line. */
  up: number;
}

export const BRIDGE_DEFAULTS: BridgeConfig = { minConfidence: 0.45, lostGraceMs: 600, readyFrames: 5, minRepMs: 700, down: 145, up: 162 };

/**
 * Glute bridges, lying on your back side-on to the phone (like push-ups),
 * knees bent and feet flat: lift the hips until shoulder, hip and knee make a
 * straight line, then lower. Reads the side nearer the camera.
 */
export class GluteBridgeDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'LIE_ON_BACK';

  constructor(private readonly cfg: BridgeConfig = BRIDGE_DEFAULTS) {
    super('glute_bridge', cfg, [{ key: 'hips', dir: 'up', rest: cfg.down, peak: cfg.up }]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const score = (s: Side) => l[SIDE[s].shoulder].visibility + l[SIDE[s].hip].visibility + l[SIDE[s].knee].visibility;
    const s: Side = score('left') >= score('right') ? 'left' : 'right';
    const S = l[SIDE[s].shoulder];
    const H = l[SIDE[s].hip];
    const K = l[SIDE[s].knee];
    const A = l[SIDE[s].ankle];
    if (!vis(S, 0.4) || !vis(H, 0.4) || !vis(K, 0.4)) return { confidence: 0, issue: 'LEGS_NOT_VISIBLE', values: { hips: null }, startReady: false };
    const hip = angle(S, H, K);
    const lying = inclineFromHorizontal(S, H) <= 35;
    const kneesBent = !vis(A, 0.3) || angle(H, K, A) <= 125;
    return {
      confidence: (S.visibility + H.visibility + K.visibility) / 3,
      issue: null,
      values: { hips: hip },
      startReady: lying && kneesBent && hip <= this.cfg.down,
      metrics: { hip: Math.round(hip) },
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }
}

// ── Skaters ──────────────────────────────────────────────────────────────

export interface SkaterConfig extends LimbCycleConfig {
  /** Hip travel from centre, in shoulder widths: back near the middle... */
  centre: number;
  /** ...and far enough out to be a bound. */
  out: number;
}

export const SKATER_DEFAULTS: SkaterConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 350, centre: 0.3, out: 0.8 };

/**
 * Skaters, facing the phone: bound side to side, landing on one foot. Each
 * bound out to a side counts for that side (the player's own left or right).
 * The centre is where you've been standing on average, so drifting across the
 * room slowly doesn't count and doesn't break counting.
 */
export class SkaterDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';
  private readonly cx = new Ema(0.03);
  private readonly cy = new Ema(0.03);
  private readonly width = new Ema(0.1);

  constructor(private readonly cfg: SkaterConfig = SKATER_DEFAULTS) {
    super('skaters', cfg, [
      { key: 'left', side: 'left', dir: 'up', rest: cfg.centre, peak: cfg.out },
      { key: 'right', side: 'right', dir: 'down', rest: -cfg.centre, peak: -cfg.out },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const need = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP];
    if (need.some((i) => !vis(l[i]))) return { confidence: 0.3, issue: 'NO_BODY', values: { left: null, right: null }, startReady: false };
    const ax = leftAxis(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
    const w = this.width.push(ax.span);
    const H = mid(l[LM.L_HIP], l[LM.R_HIP]);
    const cx = this.cx.push(H.x);
    const cy = this.cy.push(H.y);
    const v = ((H.x - cx) * ax.ux + (H.y - cy) * ax.uy) / Math.max(w, 1e-3);
    const up = upright(l, 50);
    return {
      confidence: need.reduce((a, i) => a + l[i].visibility, 0) / need.length,
      issue: up ? null : 'STAND_UPRIGHT',
      values: { left: v, right: v },
      startReady: up && Math.abs(v) <= this.cfg.centre,
      metrics: { shift: +v.toFixed(2) },
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }

  reset(): void {
    super.reset();
    this.cx.reset();
    this.cy.reset();
    this.width.reset();
  }
}

// ── Butt kicks ───────────────────────────────────────────────────────────

export interface KickConfig extends LimbCycleConfig {
  /** Ankle height relative to the knee, in shin lengths (−1 standing): down... */
  down: number;
  /** ...and kicked up behind. */
  up: number;
  /** The knee must stay at least this many thigh lengths below the hip (not a high knee). */
  kneeLow: number;
}

export const KICK_DEFAULTS: KickConfig = { minConfidence: 0.45, lostGraceMs: 500, readyFrames: 4, minRepMs: 300, down: -0.75, up: -0.3, kneeLow: 0.65 };

/**
 * Butt kicks, facing the phone: heels flick up behind toward the glutes while
 * the knees stay pointing down. Every kick counts (like high knees). A knee
 * driven up in front is a high knee, not a butt kick.
 */
export class ButtKickDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';
  private readonly shin: Record<Side, Ema> = { left: new Ema(0.15), right: new Ema(0.15) };
  private readonly thigh: Record<Side, Ema> = { left: new Ema(0.15), right: new Ema(0.15) };
  private kneeUp: Partial<Record<string, boolean>> = {};
  private lastKneeLow: Record<Side, boolean> = { left: true, right: true };

  constructor(private readonly cfg: KickConfig = KICK_DEFAULTS) {
    super('butt_kicks', cfg, [
      { key: 'left', side: 'left', dir: 'up', rest: cfg.down, peak: cfg.up },
      { key: 'right', side: 'right', dir: 'up', rest: cfg.down, peak: cfg.up },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const values: Record<string, number | null> = {};
    let conf = 0;
    let n = 0;
    let standing = true;
    for (const s of SIDES) {
      const H = l[SIDE[s].hip];
      const K = l[SIDE[s].knee];
      const A = l[SIDE[s].ankle];
      if (!vis(H) || !vis(K) || !vis(A, 0.35)) {
        values[s] = null;
        standing = false;
        continue;
      }
      n++;
      conf += (H.visibility + K.visibility + A.visibility) / 3;
      const straight = angle(H, K, A) >= 160;
      if (straight) {
        this.shin[s].push(dist(K, A));
        this.thigh[s].push(dist(H, K));
      } else standing = false;
      const shin = Math.max(this.shin[s].value ?? dist(K, A), 1e-3);
      const thigh = Math.max(this.thigh[s].value ?? dist(H, K), 1e-3);
      values[s] = (K.y - A.y) / shin;
      this.lastKneeLow[s] = K.y - H.y >= this.cfg.kneeLow * thigh;
    }
    return {
      confidence: n ? conf / n : 0,
      issue: n < 2 ? 'LEGS_NOT_VISIBLE' : null,
      values,
      startReady: standing && upright(l),
      metrics: { left: +(values.left ?? 0).toFixed(2), right: +(values.right ?? 0).toFixed(2) },
    };
  }

  protected onStart(key: string): void {
    this.kneeUp[key] = false;
  }

  protected onMidRep(key: string): void {
    if (!this.lastKneeLow[key as Side]) this.kneeUp[key] = true;
  }

  protected validate(key: string): GuidanceCode | null {
    return this.kneeUp[key] ? 'STAND_UPRIGHT' : null;
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }

  reset(): void {
    super.reset();
    for (const s of SIDES) {
      this.shin[s].reset();
      this.thigh[s].reset();
    }
  }
}

// ── Russian twists ───────────────────────────────────────────────────────

export interface TwistConfig extends LimbCycleConfig {
  /** Hands' offset from the hips' centre, in hip widths: near the middle... */
  centre: number;
  /** ...and turned out to a side. */
  out: number;
}

export const TWIST_DEFAULTS: TwistConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 400, centre: 0.4, out: 1.1 };

/**
 * Russian twists, seated and facing the phone, leaning back a little with
 * hands together: turn to bring the hands beside one hip, then the other.
 * Each turn counts for that side.
 */
export class TwistDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'FACE_CAMERA';
  private readonly width = new Ema(0.1);

  constructor(private readonly cfg: TwistConfig = TWIST_DEFAULTS) {
    super('russian_twist', cfg, [
      { key: 'left', side: 'left', dir: 'up', rest: cfg.centre, peak: cfg.out },
      { key: 'right', side: 'right', dir: 'down', rest: -cfg.centre, peak: -cfg.out },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const need = [LM.L_HIP, LM.R_HIP, LM.L_WRIST, LM.R_WRIST, LM.L_SHOULDER, LM.R_SHOULDER];
    if (need.some((i) => !vis(l[i], 0.4))) return { confidence: 0.3, issue: 'ARMS_NOT_VISIBLE', values: { left: null, right: null }, startReady: false };
    const ax = leftAxis(l[LM.L_HIP], l[LM.R_HIP]);
    const w = this.width.push(ax.span);
    const H = mid(l[LM.L_HIP], l[LM.R_HIP]);
    const Wm = mid(l[LM.L_WRIST], l[LM.R_WRIST]);
    const v = ((Wm.x - H.x) * ax.ux + (Wm.y - H.y) * ax.uy) / Math.max(w, 1e-3);
    // Seated: the torso stays upright-ish (not lying flat) — a sit-up doesn't count.
    const seated = upright(l, 35);
    return {
      confidence: need.reduce((a, i) => a + l[i].visibility, 0) / need.length,
      issue: seated ? null : 'FACE_CAMERA',
      values: { left: v, right: v },
      startReady: seated && Math.abs(v) <= this.cfg.centre,
      metrics: { turn: +v.toFixed(2) },
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }

  reset(): void {
    super.reset();
    this.width.reset();
  }
}

// ── Straight punches (Movement Lab feasibility test) ─────────────────────

export type PunchStance = 'front' | 'side';

export interface PunchConfig extends LimbCycleConfig {
  /** Extension 0 (guard, fists at the chin) .. 1 (arm straight out): back at guard... */
  guard: number;
  /** ...and punched out. */
  out: number;
}

export const PUNCH_DEFAULTS: PunchConfig = { minConfidence: 0.35, lostGraceMs: 400, readyFrames: 3, minRepMs: 220, guard: 0.45, out: 0.78 };

/**
 * Straight punches, each counted for the arm that threw it, and only after it
 * returns toward guard. Two ways to stand, to find which one a single phone
 * reads better:
 *
 *  - side:  turned side-on (like push-ups), punching along the image. The
 *           punch is a big, clear sideways movement; the far arm is partly
 *           hidden behind the body, so left/right relies on the pose model
 *           keeping the labels straight.
 *  - front: facing the phone, punching toward it. Both arms stay visible, but
 *           the punch is mostly *toward* the camera, so it's read from depth
 *           (the model's rough z) plus the elbow rising to shoulder height.
 *
 * Lab only: not in any fight until it has been tried with a real body.
 */
export class PunchDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';
  private readonly arm: Record<Side, Ema> = { left: new Ema(0.1), right: new Ema(0.1) };
  private readonly ua: Record<Side, Ema> = { left: new Ema(0.1), right: new Ema(0.1) };

  constructor(
    readonly stance: PunchStance,
    private readonly cfg: PunchConfig = PUNCH_DEFAULTS,
  ) {
    super(stance === 'side' ? 'punch_side' : 'punch_front', cfg, [
      { key: 'left', side: 'left', dir: 'up', rest: cfg.guard, peak: cfg.out },
      { key: 'right', side: 'right', dir: 'up', rest: cfg.guard, peak: cfg.out },
    ]);
  }

  /** Which way the player faces in a side-on view: +1 toward larger x. */
  private facing(l: Landmark[]): number {
    const sh = mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
    return l[LM.NOSE].x >= sh.x ? 1 : -1;
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const values: Record<string, number | null> = {};
    const metrics: Record<string, number> = {};
    let conf = 0;
    let n = 0;
    const dir = this.facing(l);
    for (const s of SIDES) {
      const S = l[SIDE[s].shoulder];
      const E = l[SIDE[s].elbow];
      const W = l[SIDE[s].wrist];
      // The far arm in a side view is often half-hidden: accept lower visibility.
      if (!vis(S, 0.3) || !vis(E, 0.3) || !vis(W, 0.3)) {
        values[s] = null;
        continue;
      }
      n++;
      conf += (S.visibility + E.visibility + W.visibility) / 3;
      // Arm lengths come from frames where the arm isn't pointing at the camera
      // (a punch toward the lens makes it look short in the image).
      const keep = (ema: Ema, cur: number) => (ema.value === null || cur >= 0.8 * ema.value ? ema.push(cur) : ema.value);
      const len = Math.max(keep(this.arm[s], dist(S, E) + dist(E, W)), 1e-3);
      const ua = Math.max(keep(this.ua[s], dist(S, E)), 1e-3);
      let ext: number;
      if (this.stance === 'side') {
        const reach = (dir * (W.x - S.x)) / Math.max(len, 1e-3);
        // A punch travels near shoulder height; an arm swinging down doesn't count.
        const level = Math.abs(W.y - S.y) <= 0.5 * len;
        ext = clamp(reach, -1, 1.2) * (level ? 1 : 0.5);
      } else {
        const depth = clamp((S.z - W.z) / Math.max(len, 1e-3), 0, 1.2);
        const elbow = clamp(1 - (E.y - S.y) / ua, 0, 1.2);
        ext = 0.6 * depth + 0.4 * elbow;
        metrics[`${s[0]}Depth`] = +depth.toFixed(2);
        metrics[`${s[0]}Elbow`] = +elbow.toFixed(2);
      }
      values[s] = ext;
      metrics[s] = +ext.toFixed(2);
      metrics[`${s[0]}Vis`] = +W.visibility.toFixed(2);
    }
    const up = upright(l, 50);
    const guard = SIDES.every((s) => values[s] === null || values[s]! <= this.cfg.guard);
    return {
      confidence: n ? conf / n : 0,
      issue: n === 0 ? 'ARMS_NOT_VISIBLE' : !up ? 'STAND_UPRIGHT' : null,
      values,
      startReady: n > 0 && up && guard,
      metrics,
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }

  reset(): void {
    super.reset();
    for (const s of SIDES) {
      this.arm[s].reset();
      this.ua[s].reset();
    }
  }
}
