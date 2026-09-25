import { angle, dist, Ema, inclineFromHorizontal, inFrame, LM, mid, SIDE } from '../geometry';
import type { Difficulty, GuidanceCode, Landmark, PoseFrame, Side } from '../types';
import { LimbCycleDetector, type LimbCycleConfig, type LimbReading } from './limbCycle';

/**
 * The movements added for the four-family library. Each reads a few joint
 * relationships that survive a fixed, low phone position; see the README's
 * exercise table for which views they need and how reliable they are.
 *
 * Signals are normalised by body proportions measured while the player holds
 * the start position (upper-arm length, standing thigh length), so moving
 * nearer or farther from the phone doesn't change the thresholds.
 */

const vis = (l: Landmark, min = 0.5) => l.visibility >= min;
const SIDES: Side[] = ['left', 'right'];
const other = (s: Side): Side => (s === 'left' ? 'right' : 'left');

/** Torso lean from vertical in degrees (sign = image direction). */
function torsoLean(l: Landmark[]): number {
  const sh = mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
  const hp = mid(l[LM.L_HIP], l[LM.R_HIP]);
  return (Math.atan2(sh.x - hp.x, Math.max(hp.y - sh.y, 1e-3)) * 180) / Math.PI;
}

function torsoIncline(l: Landmark[]): number {
  return inclineFromHorizontal(mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]), mid(l[LM.L_HIP], l[LM.R_HIP]));
}

// ── Biceps curls ─────────────────────────────────────────────────────────

export interface CurlConfig extends LimbCycleConfig {
  /** (elbow.y − wrist.y) / upper arm at or below which the arm is extended. */
  bottom: number;
  /** ...and at or above which the curl reached the top. */
  top: number;
  /** The elbow must stay at least this × upper arm below the shoulder (no front raises). */
  elbowDrop: number;
  /** Max change in torso lean during a rep (body swing). */
  maxSwingDeg: number;
  minUpright: number;
}

export const CURL_DEFAULTS: CurlConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 500, bottom: -0.55, top: 0.3, elbowDrop: 0.45, maxSwingDeg: 14, minUpright: 65 };

/**
 * Standing biceps curls, each arm counted on its own (both at once is fine).
 * Works facing the phone or side-on. A rep is the wrist travelling from below
 * the elbow (arm extended) to well above it and back. Swinging the torso to
 * throw the weight up, or lifting the elbow forward, doesn't count.
 */
export class CurlDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'EXTEND_FULLY';
  private readonly ua: Record<Side, Ema> = { left: new Ema(0.15), right: new Ema(0.15) };
  private lean = 0;
  private startLean: Partial<Record<string, number>> = {};
  private swing: Partial<Record<string, number>> = {};
  private elbowUp: Partial<Record<string, boolean>> = {};
  private lastElbowOk: Record<Side, boolean> = { left: true, right: true };

  constructor(private readonly cfg: CurlConfig = CURL_DEFAULTS) {
    super('bicep_curl', cfg, [
      { key: 'left', side: 'left', dir: 'up', rest: cfg.bottom, peak: cfg.top },
      { key: 'right', side: 'right', dir: 'up', rest: cfg.bottom, peak: cfg.top },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const c = this.cfg;
    this.lean = torsoLean(l);
    const upright = torsoIncline(l) >= c.minUpright;
    const values: Record<string, number | null> = {};
    let conf = 0;
    let arms = 0;
    let extended = false;
    for (const s of SIDES) {
      const S = l[SIDE[s].shoulder];
      const E = l[SIDE[s].elbow];
      const W = l[SIDE[s].wrist];
      if (!vis(S) || !vis(E) || !vis(W)) {
        values[s] = null;
        continue;
      }
      arms++;
      conf += (S.visibility + E.visibility + W.visibility) / 3;
      const len = dist(S, E);
      // Upper-arm length is measured with the arm hanging (it foreshortens when curled toward the camera).
      if (W.y > E.y) this.ua[s].push(len);
      const ua = Math.max(this.ua[s].value ?? len, 1e-3);
      values[s] = (E.y - W.y) / ua;
      this.lastElbowOk[s] = E.y - S.y >= c.elbowDrop * ua;
      if (values[s]! <= c.bottom) extended = true;
    }
    return {
      confidence: arms ? conf / arms : 0,
      issue: !arms ? 'ARMS_NOT_VISIBLE' : !upright ? 'STAND_UPRIGHT' : null,
      values,
      startReady: extended && upright,
      metrics: { left: +(values.left ?? 0).toFixed(2), right: +(values.right ?? 0).toFixed(2), lean: Math.round(this.lean) },
    };
  }

  protected onStart(key: string): void {
    this.startLean[key] = this.lean;
    this.swing[key] = 0;
    this.elbowUp[key] = false;
  }

  protected onMidRep(key: string): void {
    this.swing[key] = Math.max(this.swing[key] ?? 0, Math.abs(this.lean - (this.startLean[key] ?? this.lean)));
    if (!this.lastElbowOk[key as Side]) this.elbowUp[key] = true;
  }

  protected validate(key: string): GuidanceCode | null {
    return (this.swing[key] ?? 0) > this.cfg.maxSwingDeg || this.elbowUp[key] ? 'NO_SWING' : null;
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }
}

// ── Supported one-arm dumbbell rows ─────────────────────────────────────

export interface RowConfig extends LimbCycleConfig {
  /** Torso within this many degrees of horizontal = bent over. */
  maxTorsoIncline: number;
  /** Elbow angle at or above which the arm hangs straight. */
  bottomElbow: number;
  /** Elbow angle at or below which the row reached the top... */
  topElbow: number;
  /** ...with the wrist lifted to within this × upper arm below the shoulder. */
  topWrist: number;
}

export const ROW_DEFAULTS: RowConfig = { minConfidence: 0.5, lostGraceMs: 600, readyFrames: 5, minRepMs: 600, maxTorsoIncline: 55, bottomElbow: 145, topElbow: 105, topWrist: 1.35 };

/**
 * One-arm dumbbell rows with a hand or knee on a chair or bench, side-on to
 * the phone. Each arm is its own cycle, so the supporting arm (straight and
 * still) never counts; switch sides by turning around. The body must be bent
 * over with the legs standing under it, which tells a row from a push-up.
 */
export class RowDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'GET_INTO_ROW';
  private readonly ua: Record<Side, Ema> = { left: new Ema(0.15), right: new Ema(0.15) };
  private lifted: Record<Side, boolean> = { left: false, right: false };
  private reached: Partial<Record<string, boolean>> = {};

  constructor(private readonly cfg: RowConfig = ROW_DEFAULTS) {
    super('dumbbell_row', cfg, [
      { key: 'left', side: 'left', dir: 'down', rest: cfg.bottomElbow, peak: cfg.topElbow },
      { key: 'right', side: 'right', dir: 'down', rest: cfg.bottomElbow, peak: cfg.topElbow },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const c = this.cfg;
    const bent = torsoIncline(l) <= c.maxTorsoIncline;
    const torso = Math.max(dist(mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]), mid(l[LM.L_HIP], l[LM.R_HIP])), 1e-3);
    // Standing legs: at least one ankle well below the hips (a push-up has them level).
    const legs = SIDES.some((s) => vis(l[SIDE[s].ankle], 0.4) && (l[SIDE[s].ankle].y - l[SIDE[s].hip].y) / torso >= 0.8);
    const values: Record<string, number | null> = {};
    let conf = 0;
    let arms = 0;
    let hanging = false;
    for (const s of SIDES) {
      const S = l[SIDE[s].shoulder];
      const E = l[SIDE[s].elbow];
      const W = l[SIDE[s].wrist];
      if (!vis(S) || !vis(E) || !vis(W)) {
        values[s] = null;
        continue;
      }
      arms++;
      conf += (S.visibility + E.visibility + W.visibility) / 3;
      const a = angle(S, E, W);
      if (a >= c.bottomElbow) this.ua[s].push(dist(S, E));
      const ua = Math.max(this.ua[s].value ?? dist(S, E), 1e-3);
      this.lifted[s] = (W.y - S.y) / ua <= c.topWrist;
      values[s] = a;
      if (a >= c.bottomElbow) hanging = true;
    }
    return {
      confidence: arms ? conf / arms : 0,
      issue: !arms ? 'ARMS_NOT_VISIBLE' : !bent || !legs ? 'GET_INTO_ROW' : null,
      values,
      startReady: hanging && bent && legs,
      metrics: { left: Math.round(values.left ?? 0), right: Math.round(values.right ?? 0), incline: Math.round(torsoIncline(l)) },
    };
  }

  protected onStart(key: string): void {
    this.reached[key] = false;
  }

  protected onMidRep(key: string): void {
    if (this.lifted[key as Side]) this.reached[key] = true;
  }

  protected validate(key: string): GuidanceCode | null {
    // A bent elbow without the weight coming up (e.g. a shrug of the forearm) isn't a row.
    return this.reached[key] ? null : 'GO_LOWER';
  }

  protected shallowCue(): GuidanceCode {
    return 'GET_INTO_ROW';
  }
}

// ── Standing leg measurements (lunges, high knees, cross crunches) ──────

/** Tracks the standing thigh length and hip height while the player stands tall. */
class StandingLegs {
  readonly thigh = new Ema(0.15);
  readonly hipY = new Ema(0.15);

  /** Feed a frame; returns null when the legs aren't readable. */
  read(l: Landmark[], aspect: number, calibrate: boolean): { thigh: number; hipY: number; kneeLift: Record<Side, number>; kneeY: Record<Side, number>; straight: boolean } | null {
    for (const s of SIDES) {
      const k = SIDE[s];
      if (!vis(l[k.hip]) || !vis(l[k.knee]) || !vis(l[k.ankle], 0.4) || !inFrame(l[k.ankle], aspect, 0.02)) return null;
    }
    const hipY = (l[LM.L_HIP].y + l[LM.R_HIP].y) / 2;
    const straight = SIDES.every((s) => angle(l[SIDE[s].hip], l[SIDE[s].knee], l[SIDE[s].ankle]) >= 160);
    const len = (dist(l[LM.L_HIP], l[LM.L_KNEE]) + dist(l[LM.R_HIP], l[LM.R_KNEE])) / 2;
    const kneeLevel = Math.abs(l[LM.L_KNEE].y - l[LM.R_KNEE].y) < 0.15 * len;
    if (calibrate && straight && kneeLevel) {
      this.thigh.push(len);
      this.hipY.push(hipY);
    }
    const thigh = Math.max(this.thigh.value ?? len, 1e-3);
    const kneeLift = { left: (l[LM.L_KNEE].y - l[LM.L_HIP].y) / thigh, right: (l[LM.R_KNEE].y - l[LM.R_HIP].y) / thigh };
    return { thigh, hipY: this.hipY.value ?? hipY, kneeLift, kneeY: { left: l[LM.L_KNEE].y, right: l[LM.R_KNEE].y }, straight: straight && kneeLevel };
  }

  reset(): void {
    this.thigh.reset();
    this.hipY.reset();
  }
}

// ── Reverse lunges ───────────────────────────────────────────────────────

export interface LungeConfig extends LimbCycleConfig {
  /** Hip drop (thigh lengths below standing) that reaches the bottom. */
  bottomDrop: number;
  /** Back to standing below this drop. */
  standDrop: number;
  /** At the bottom, one knee must sit this much (thigh lengths) lower than the other. */
  minSplit: number;
}

export const LUNGE_DEFAULTS: LungeConfig = { minConfidence: 0.5, lostGraceMs: 600, readyFrames: 5, minRepMs: 700, bottomDrop: 0.32, standDrop: 0.12, minSplit: 0.28 };

export function lungeConfig(d: Difficulty): LungeConfig {
  if (d === 'beginner') return { ...LUNGE_DEFAULTS, bottomDrop: 0.24, minSplit: 0.22 };
  if (d === 'advanced') return { ...LUNGE_DEFAULTS, bottomDrop: 0.4 };
  return LUNGE_DEFAULTS;
}

/**
 * Reverse lunges, counted per side: the side is the leg that stepped back
 * (its knee drops toward the floor, below the front knee). Facing the phone
 * or side-on. The hips must drop and the knees must split; a squat (both
 * knees level) doesn't count, and neither does a step without going down.
 */
export class LungeDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';
  private readonly legs = new StandingLegs();
  private split = 0;
  private sideAtBottom: Side | null = null;
  private splitAtBottom = 0;

  constructor(private readonly cfg: LungeConfig = LUNGE_DEFAULTS) {
    super('reverse_lunge', cfg, [{ key: 'hips', dir: 'up', rest: cfg.standDrop, peak: cfg.bottomDrop }]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const legs = this.legs.read(l, frame.aspect, true);
    if (!legs) return { confidence: 0.6, issue: 'LEGS_NOT_VISIBLE', values: { hips: null }, startReady: false };
    const hipY = (l[LM.L_HIP].y + l[LM.R_HIP].y) / 2;
    const drop = (hipY - legs.hipY) / legs.thigh;
    // Positive when the left knee is lower (the left leg stepped back).
    this.split = (legs.kneeY.left - legs.kneeY.right) / legs.thigh;
    if (drop >= this.cfg.bottomDrop * 0.8 && Math.abs(this.split) > Math.abs(this.splitAtBottom)) {
      this.splitAtBottom = this.split;
      this.sideAtBottom = this.split > 0 ? 'left' : 'right';
    }
    const conf = [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE].reduce((a, i) => a + l[i].visibility, 0) / 6;
    return {
      confidence: conf,
      issue: null,
      values: { hips: drop },
      startReady: legs.straight && drop < this.cfg.standDrop,
      metrics: { drop: +drop.toFixed(2), split: +this.split.toFixed(2) },
    };
  }

  protected onStart(): void {
    this.sideAtBottom = null;
    this.splitAtBottom = 0;
  }

  protected validate(): GuidanceCode | null {
    return Math.abs(this.splitAtBottom) >= this.cfg.minSplit ? null : 'STEP_BACK_TOGETHER';
  }

  update(frame: PoseFrame | null, now: number) {
    const u = super.update(frame, now);
    // The side is only known at the bottom of the lunge.
    return u.repCompleted && this.sideAtBottom ? { ...u, repSide: this.sideAtBottom } : u;
  }

  reset(): void {
    super.reset();
    this.legs.reset();
  }
}

// ── High knees ───────────────────────────────────────────────────────────

export interface KneeDriveConfig extends LimbCycleConfig {
  /** Knee below the hip by at least this × thigh = leg down. */
  down: number;
  /** Knee raised to within this × thigh of hip height = a high knee. */
  up: number;
}

export const HIGH_KNEE_DEFAULTS: KneeDriveConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 220, down: 0.8, up: 0.5 };

/**
 * High knees, facing the phone: each knee driven up toward hip height counts
 * (so 20 reps ≈ 10 each leg). Ordinary marching lifts the knee far less and
 * never counts.
 */
export class HighKneesDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';
  private readonly legs = new StandingLegs();

  constructor(cfg: KneeDriveConfig = HIGH_KNEE_DEFAULTS) {
    super('high_knees', cfg, [
      { key: 'left', side: 'left', dir: 'down', rest: cfg.down, peak: cfg.up },
      { key: 'right', side: 'right', dir: 'down', rest: cfg.down, peak: cfg.up },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const legs = this.legs.read(l, frame.aspect, true);
    // A raised foot may leave the frame's bottom edge briefly; the knees are what count.
    if (!legs) return { confidence: 0.6, issue: 'LEGS_NOT_VISIBLE', values: { left: null, right: null }, startReady: false };
    return {
      confidence: (l[LM.L_KNEE].visibility + l[LM.R_KNEE].visibility) / 2,
      issue: null,
      values: { left: legs.kneeLift.left, right: legs.kneeLift.right },
      startReady: legs.straight,
      metrics: { left: +legs.kneeLift.left.toFixed(2), right: +legs.kneeLift.right.toFixed(2) },
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'GO_LOWER';
  }

  reset(): void {
    super.reset();
    this.legs.reset();
  }
}

// ── Standing cross-body crunches ─────────────────────────────────────────

export const CROSS_CRUNCH_DEFAULTS: KneeDriveConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 450, down: 0.8, up: 0.62 };

/**
 * Standing cross-body crunches, per side: drive one knee up while bringing the
 * opposite elbow down across to meet it. The side is the knee's side. A knee
 * lift without the elbow coming across doesn't count.
 */
export class CrossCrunchDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'STAND_UPRIGHT';
  private readonly legs = new StandingLegs();
  private close: Record<Side, number> = { left: 9, right: 9 };
  private best: Partial<Record<string, number>> = {};

  constructor(cfg: KneeDriveConfig = CROSS_CRUNCH_DEFAULTS) {
    super('cross_crunch', cfg, [
      { key: 'left', side: 'left', dir: 'down', rest: cfg.down, peak: cfg.up },
      { key: 'right', side: 'right', dir: 'down', rest: cfg.down, peak: cfg.up },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const legs = this.legs.read(l, frame.aspect, true);
    if (!legs) return { confidence: 0.6, issue: 'LEGS_NOT_VISIBLE', values: { left: null, right: null }, startReady: false };
    const torso = Math.max(dist(mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]), mid(l[LM.L_HIP], l[LM.R_HIP])), 1e-3);
    for (const s of SIDES) {
      const elbow = l[SIDE[other(s)].elbow];
      this.close[s] = vis(elbow, 0.3) ? dist(elbow, l[SIDE[s].knee]) / torso : 9;
    }
    return {
      confidence: (l[LM.L_KNEE].visibility + l[LM.R_KNEE].visibility) / 2,
      issue: null,
      values: { left: legs.kneeLift.left, right: legs.kneeLift.right },
      startReady: legs.straight,
      metrics: { left: +legs.kneeLift.left.toFixed(2), right: +legs.kneeLift.right.toFixed(2), elbowL: +this.close.left.toFixed(2), elbowR: +this.close.right.toFixed(2) },
    };
  }

  protected onStart(key: string): void {
    this.best[key] = 9;
  }

  protected onMidRep(key: string): void {
    this.best[key] = Math.min(this.best[key] ?? 9, this.close[key as Side]);
  }

  protected validate(key: string): GuidanceCode | null {
    return (this.best[key] ?? 9) <= 0.55 ? null : 'NO_SWING';
  }

  reset(): void {
    super.reset();
    this.legs.reset();
  }
}

// ── Mountain climbers (experimental) ─────────────────────────────────────

export interface ClimberConfig extends LimbCycleConfig {
  maxTorsoIncline: number;
  /** Shoulder–hip–knee angle at or above which the leg is back. */
  extended: number;
  /** ...and at or below which the knee has driven in. */
  driven: number;
}

export const CLIMBER_DEFAULTS: ClimberConfig = { minConfidence: 0.5, lostGraceMs: 500, readyFrames: 4, minRepMs: 250, maxTorsoIncline: 40, extended: 150, driven: 115 };

/**
 * Mountain climbers, side-on in a high plank: each knee drive counts. From
 * one side the two legs overlap and blur at speed, so this stays
 * experimental until checked on your setup.
 */
export class ClimberDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'GET_INTO_PUSHUP';

  constructor(private readonly cfg: ClimberConfig = CLIMBER_DEFAULTS) {
    super('mountain_climber', cfg, [
      { key: 'left', side: 'left', dir: 'down', rest: cfg.extended, peak: cfg.driven },
      { key: 'right', side: 'right', dir: 'down', rest: cfg.extended, peak: cfg.driven },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const flat = torsoIncline(l) <= this.cfg.maxTorsoIncline;
    const sh = mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
    const hands = [l[LM.L_WRIST], l[LM.R_WRIST]].some((w) => vis(w, 0.4) && w.y > sh.y);
    const values: Record<string, number | null> = {};
    let conf = 0;
    let n = 0;
    for (const s of SIDES) {
      const k = SIDE[s];
      if (!vis(l[k.shoulder]) || !vis(l[k.hip]) || !vis(l[k.knee], 0.4)) {
        values[s] = null;
        continue;
      }
      n++;
      conf += (l[k.hip].visibility + l[k.knee].visibility) / 2;
      values[s] = angle(l[k.shoulder], l[k.hip], l[k.knee]);
    }
    const bothBack = SIDES.every((s) => values[s] === null || values[s]! >= this.cfg.extended);
    return {
      confidence: n ? conf / n : 0,
      issue: !n ? 'LEGS_NOT_VISIBLE' : !flat || !hands ? 'GET_INTO_PUSHUP' : null,
      values,
      startReady: flat && hands && bothBack,
      metrics: { left: Math.round(values.left ?? 0), right: Math.round(values.right ?? 0) },
    };
  }
}

// ── Dead bugs (experimental) ─────────────────────────────────────────────

export interface DeadBugConfig extends LimbCycleConfig {
  maxTorsoIncline: number;
  /** Knee angle at or below which the leg is in tabletop. */
  tabletop: number;
  /** ...and at or above which it has extended. */
  extended: number;
}

export const DEAD_BUG_DEFAULTS: DeadBugConfig = { minConfidence: 0.5, lostGraceMs: 600, readyFrames: 5, minRepMs: 600, maxTorsoIncline: 30, tabletop: 125, extended: 155 };

/**
 * Dead bugs, lying on your back side-on to the phone, arms up: each leg
 * extension from tabletop and back counts. Only the legs are checked (the
 * arms need to point up to start); from the side the two legs overlap, so
 * this stays experimental.
 */
export class DeadBugDetector extends LimbCycleDetector {
  protected setupCue: GuidanceCode = 'LIE_ON_BACK';

  constructor(private readonly cfg: DeadBugConfig = DEAD_BUG_DEFAULTS) {
    super('dead_bug', cfg, [
      { key: 'left', side: 'left', dir: 'up', rest: cfg.tabletop, peak: cfg.extended },
      { key: 'right', side: 'right', dir: 'up', rest: cfg.tabletop, peak: cfg.extended },
    ]);
  }

  protected read(frame: PoseFrame): LimbReading {
    const l = frame.landmarks;
    const flat = torsoIncline(l) <= this.cfg.maxTorsoIncline;
    const sh = mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
    const hp = mid(l[LM.L_HIP], l[LM.R_HIP]);
    const torso = Math.max(dist(sh, hp), 1e-3);
    const armsUp = [l[LM.L_WRIST], l[LM.R_WRIST]].some((w) => vis(w, 0.4) && sh.y - w.y >= 0.4 * torso);
    const values: Record<string, number | null> = {};
    let conf = 0;
    let n = 0;
    for (const s of SIDES) {
      const k = SIDE[s];
      if (!vis(l[k.hip]) || !vis(l[k.knee]) || !vis(l[k.ankle], 0.4)) {
        values[s] = null;
        continue;
      }
      n++;
      conf += (l[k.hip].visibility + l[k.knee].visibility + l[k.ankle].visibility) / 3;
      values[s] = angle(l[k.hip], l[k.knee], l[k.ankle]);
    }
    const tabletop = SIDES.some((s) => values[s] !== null && values[s]! <= this.cfg.tabletop);
    return {
      confidence: n ? conf / n : 0,
      issue: !n ? 'LEGS_NOT_VISIBLE' : !flat || !armsUp ? 'LIE_ON_BACK' : null,
      values,
      startReady: flat && armsUp && tabletop,
      metrics: { left: Math.round(values.left ?? 0), right: Math.round(values.right ?? 0) },
    };
  }

  protected shallowCue(): GuidanceCode {
    return 'EXTEND_FULLY';
  }
}
