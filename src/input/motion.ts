import { dist, inFrame, LM, meanVisibility, mid } from '../exercise/geometry';
import type { Landmark, PoseFrame, TrackingQuality } from '../exercise/types';

/**
 * Body-as-controller: reads a front-facing, standing player and turns their
 * movement into game input.
 *
 *  - Marching in place  → move. A step is an *alternating* difference in the
 *    height of the two legs, so jumping, squatting, bobbing or walking toward
 *    the camera (all of which move both legs together) never register.
 *  - Leaning the torso  → turn. One deliberate lean is exactly one discrete
 *    turn (45° or 90°, chosen by the game); holding the lean never repeats,
 *    and the next turn is armed only after the torso comes back to neutral.
 *    Measured against a calibrated neutral with smoothing, a dead zone,
 *    hysteresis and a cooldown, so posture shifts and marching sway don't
 *    turn.
 *  - Raising a hand     → gestures (right = confirm, left = back, both =
 *    pause), each requiring a short hold and a return to neutral before the
 *    next one can fire.
 *
 * Left and right are the *player's* anatomical sides (MediaPipe reports them
 * that way), so the result is the same whether or not the camera mirrors.
 */

export interface MotionConfig {
  minVisibility: number;
  lostGraceMs: number;
  /** |leg height difference| / thigh length that registers a step. */
  stepThreshold: number;
  stepWindowMs: number;
  /** Steps within the window needed to start moving. */
  minStepsToMarch: number;
  /** Stop moving this long after the last step. */
  stopAfterMs: number;
  legSmoothing: number;
  /** Lean (degrees from neutral) below which steering is zero. */
  leanDeadzoneDeg: number;
  /** Lean at which steering is full. */
  leanFullDeg: number;
  /** Hysteresis for the discrete lean direction (calibration checks). */
  leanEnterDeg: number;
  leanExitDeg: number;
  leanSmoothing: number;
  /** A lean this far from neutral fires one turn. */
  turnEnterDeg: number;
  /** The torso must come back inside this... */
  turnNeutralDeg: number;
  /** ...for this long before the next turn is armed. */
  turnNeutralMs: number;
  /** Minimum time between two turns. */
  turnCooldownMs: number;
  /** A raised hand's wrist must be above the nose by this × torso length. */
  raiseMargin: number;
  confirmHoldMs: number;
  pauseHoldMs: number;
  /** A gesture re-arms only after both hands have been down this long. */
  rearmMs: number;
  /** Standing tall, hands relaxed: how long it must (mostly) hold. */
  readyHoldMs: number;
  /** Max lean from neutral that still counts as standing tall. */
  readyLeanDeg: number;
}

export const MOTION_DEFAULTS: MotionConfig = {
  minVisibility: 0.5,
  lostGraceMs: 500,
  stepThreshold: 0.11,
  stepWindowMs: 1600,
  minStepsToMarch: 2,
  stopAfterMs: 750,
  legSmoothing: 0.6,
  leanDeadzoneDeg: 5,
  leanFullDeg: 16,
  leanEnterDeg: 7,
  leanExitDeg: 4,
  leanSmoothing: 0.3,
  turnEnterDeg: 8,
  turnNeutralDeg: 4,
  turnNeutralMs: 120,
  turnCooldownMs: 350,
  raiseMargin: 0.1,
  confirmHoldMs: 450,
  pauseHoldMs: 800,
  rearmMs: 250,
  readyHoldMs: 500,
  readyLeanDeg: 10,
};

export type Sensitivity = 'low' | 'normal' | 'high';

/** Player-facing sensitivity settings mapped onto detector thresholds. */
export function motionPreset(p: { lean?: Sensitivity; march?: Sensitivity }): Partial<MotionConfig> {
  const lean = { low: { turnEnterDeg: 11, turnNeutralDeg: 5 }, normal: { turnEnterDeg: 8, turnNeutralDeg: 4 }, high: { turnEnterDeg: 6, turnNeutralDeg: 3 } };
  const march = { low: { stepThreshold: 0.15 }, normal: { stepThreshold: 0.11 }, high: { stepThreshold: 0.085 } };
  return { ...lean[p.lean ?? 'normal'], ...march[p.march ?? 'normal'] };
}

/** A player's standing neutral, measured during calibration. */
export interface NeutralPose {
  /** Mean hip–knee length in image units. */
  thigh: number;
  /** Mean shoulder–hip length. */
  torso: number;
  /** Resting leg-height difference (camera tilt, stance). */
  legDiff: number;
  /** Resting torso lean in degrees (positive = player's left). */
  leanDeg: number;
  /**
   * Camera roll estimated from the standing torso, in image degrees
   * (positive = the image is rotated so upright bodies lean toward image
   * right). A standing person is vertical, so this is how far the phone is
   * tilted sideways, to within their natural posture. Optional for saves
   * made before it existed.
   */
  rollDeg?: number;
}

export type MotionEvent = 'step' | 'confirm' | 'back' | 'pause' | 'turnLeft' | 'turnRight' | 'ready';

export interface MotionReading {
  tracking: TrackingQuality;
  /** Head to ankles inside the frame with good confidence. */
  fullBody: boolean;
  confidence: number;
  marching: boolean;
  /** Steps per second, smoothed. */
  cadence: number;
  /** 0..1 how briskly the player is marching. */
  intensity: number;
  steps: number;
  /** Which foot last stepped, for the HUD. */
  lastFoot: 'left' | 'right' | null;
  /** -1 (player's left) .. +1 (player's right); 0 inside the dead zone. For
   *  the lean gauge only — turning is discrete (see turnLeft / turnRight). */
  steer: number;
  leanDeg: number;
  /** Discrete lean with hysteresis, for the calibration checks. */
  leanDir: -1 | 0 | 1;
  /** True when the next lean will turn (the torso has been back at neutral). */
  turnArmed: boolean;
  /** 0..1 hold progress for each gesture, for UI rings. */
  hold: { confirm: number; back: number; pause: number };
  /** Gestures are ignored until the player's hands have been down once. */
  armed: boolean;
  /** 0..1 progress of the standing-tall "ready" hold. */
  readyProgress: number;
  events: MotionEvent[];
  metrics: { legDiff: number; rightUp: number; leftUp: number };
}

const BODY_IDX = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE];

interface Measure {
  confidence: number;
  fullBody: boolean;
  thigh: number;
  torso: number;
  legDiff: number;
  leanDeg: number;
  rightUp: number;
  leftUp: number;
  handsDown: boolean;
  /** Both wrists below the middle of the torso (or out of sight): hands relaxed at the sides. */
  handsLow: boolean;
  /** Ankles no wider than about shoulder width. */
  feetTogether: boolean;
  /** Torso angle in image space (degrees, + = top toward image right). */
  imgTorsoDeg: number;
}

/** Raw per-frame measurements, before any calibration or smoothing. */
export function measure(frame: PoseFrame, neutral?: NeutralPose | null): Measure {
  const l = frame.landmarks;
  const confidence = meanVisibility(l, BODY_IDX);
  const shoulders = mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
  const hips = mid(l[LM.L_HIP], l[LM.R_HIP]);
  const torso = neutral?.torso ?? Math.max(dist(shoulders, hips), 1e-3);
  const thigh = neutral?.thigh ?? Math.max((dist(l[LM.L_HIP], l[LM.L_KNEE]) + dist(l[LM.R_HIP], l[LM.R_KNEE])) / 2, 1e-3);

  // Positive when the player's right leg is higher (smaller y) than the left.
  const kneeDiff = (l[LM.L_KNEE].y - l[LM.R_KNEE].y) / thigh;
  const ankleDiff = (l[LM.L_ANKLE].y - l[LM.R_ANKLE].y) / thigh;
  const legDiff = 0.4 * kneeDiff + 0.6 * ankleDiff;

  // Toward the player's left in image x, whichever way the camera mirrors.
  const leftward = Math.sign(l[LM.L_HIP].x - l[LM.R_HIP].x) || 1;
  const dx = (shoulders.x - hips.x) * leftward;
  const dy = Math.max(hips.y - shoulders.y, 1e-3);
  const leanDeg = (Math.atan2(dx, dy) * 180) / Math.PI;

  // Wrist height above the nose, in torso lengths.
  const nose = l[LM.NOSE];
  const up = (w: Landmark) => (w.visibility >= 0.5 ? (nose.y - w.y) / torso : -1);
  const rightUp = up(l[LM.R_WRIST]);
  const leftUp = up(l[LM.L_WRIST]);
  const below = (w: Landmark, s: Landmark) => w.visibility < 0.5 || w.y > s.y;
  const handsDown = below(l[LM.R_WRIST], l[LM.R_SHOULDER]) && below(l[LM.L_WRIST], l[LM.L_SHOULDER]);
  const midTorsoY = (shoulders.y + hips.y) / 2;
  const handsLow = below(l[LM.R_WRIST], { ...shoulders, y: midTorsoY }) && below(l[LM.L_WRIST], { ...shoulders, y: midTorsoY });
  const hipW = Math.max(dist(l[LM.L_HIP], l[LM.R_HIP]), 1e-3);
  const feetTogether = Math.abs(l[LM.L_ANKLE].x - l[LM.R_ANKLE].x) < hipW * 2.2;
  const imgTorsoDeg = (Math.atan2(shoulders.x - hips.x, Math.max(hips.y - shoulders.y, 1e-3)) * 180) / Math.PI;

  const inside = (i: number) => l[i].visibility >= 0.5 && inFrame(l[i], frame.aspect, 0);
  const fullBody = confidence >= 0.5 && inside(LM.NOSE) && inside(LM.L_ANKLE) && inside(LM.R_ANKLE);

  return { confidence, fullBody, thigh, torso, legDiff, leanDeg, rightUp, leftUp, handsDown, handsLow, feetTogether, imgTorsoDeg };
}

/** Collects a still, standing neutral pose. */
export class NeutralCalibrator {
  private samples: Measure[] = [];
  private lastLean: number | null = null;
  constructor(
    private readonly needed = 30,
    private readonly maxJitterDeg = 3,
  ) {}

  /** Feed a frame; returns progress 0..1 and the pose once complete. */
  push(frame: PoseFrame | null): { progress: number; still: boolean; neutral: NeutralPose | null } {
    if (!frame) {
      this.samples = [];
      return { progress: 0, still: false, neutral: null };
    }
    const m = measure(frame);
    const still = m.fullBody && m.handsDown && (this.lastLean === null || Math.abs(m.leanDeg - this.lastLean) < this.maxJitterDeg) && Math.abs(m.legDiff) < 0.25;
    this.lastLean = m.leanDeg;
    if (!still) {
      this.samples = [];
      return { progress: 0, still: false, neutral: null };
    }
    this.samples.push(m);
    const progress = Math.min(1, this.samples.length / this.needed);
    if (this.samples.length < this.needed) return { progress, still, neutral: null };
    const med = (f: (m: Measure) => number) => {
      const v = this.samples.map(f).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    return {
      progress: 1,
      still,
      neutral: { thigh: med((s) => s.thigh), torso: med((s) => s.torso), legDiff: med((s) => s.legDiff), leanDeg: med((s) => s.leanDeg), rollDeg: med((s) => s.imgTorsoDeg) },
    };
  }

  reset(): void {
    this.samples = [];
    this.lastLean = null;
  }
}

type Gesture = 'confirm' | 'back' | 'pause';

/**
 * Exponential smoothing by elapsed time rather than per frame: `alpha` is the
 * weight of one new sample at 30 fps, and is scaled for longer or shorter
 * gaps. A phone that only manages 10 pose frames a second then lags no more
 * than one running at 30 — per-frame smoothing would triple the lag and could
 * stop a lean ever reading as back at neutral.
 */
class TimedEma {
  private v: number | null = null;
  private at = 0;
  constructor(private readonly alpha: number) {}
  push(x: number, now: number): number {
    if (this.v === null) this.v = x;
    else {
      const frames = Math.max(0.25, Math.min(15, (now - this.at) / (1000 / 30)));
      const a = 1 - Math.pow(1 - this.alpha, frames);
      this.v += a * (x - this.v);
    }
    this.at = now;
    return this.v;
  }
  get value(): number | null {
    return this.v;
  }
  reset(): void {
    this.v = null;
  }
}

export class MotionReader {
  neutral: NeutralPose | null = null;
  private cfg: MotionConfig;
  private readonly leg: TimedEma;
  private readonly lean: TimedEma;
  private stepTimes: number[] = [];
  private lastFoot: 'left' | 'right' | null = null;
  private steps = 0;
  private cadence = 0;
  private leanDir: -1 | 0 | 1 = 0;
  private badSince: number | null = null;
  private everTracked = false;
  private holding: Gesture | null = null;
  private holdSince = 0;
  private armed = false;
  private downSince: number | null = null;
  private turnArmed = false;
  private neutralSince: number | null = null;
  private lastTurnAt = -Infinity;
  private readyMs = 0;
  private readyAt = 0;
  private readyFired = false;

  constructor(cfg: Partial<MotionConfig> = {}) {
    this.cfg = { ...MOTION_DEFAULTS, ...cfg };
    this.leg = new TimedEma(this.cfg.legSmoothing);
    this.lean = new TimedEma(this.cfg.leanSmoothing);
  }

  /** Change thresholds (e.g. sensitivity settings) without losing history. */
  configure(cfg: Partial<MotionConfig>): void {
    this.cfg = { ...this.cfg, ...cfg };
  }

  get config(): Readonly<MotionConfig> {
    return this.cfg;
  }

  /** New calibration: restart movement history but keep gesture arming, so
   *  a hand raised right after "stand still" still counts. */
  setNeutral(n: NeutralPose | null): void {
    this.neutral = n;
    this.leg.reset();
    this.lean.reset();
    this.stepTimes = [];
    this.lastFoot = null;
    this.leanDir = 0;
    this.disarmTurn();
  }

  private disarmTurn(): void {
    this.turnArmed = false;
    this.neutralSince = null;
  }

  /** Clear motion history and disarm gestures, e.g. when the input mode changes. */
  reset(): void {
    this.leg.reset();
    this.lean.reset();
    this.stepTimes = [];
    this.lastFoot = null;
    this.cadence = 0;
    this.leanDir = 0;
    this.holding = null;
    this.armed = false;
    this.downSince = null;
    this.badSince = null;
    this.disarmTurn();
    this.readyMs = 0;
    this.readyFired = false;
  }

  update(frame: PoseFrame | null, now: number): MotionReading {
    const c = this.cfg;
    const events: MotionEvent[] = [];
    const m = frame ? measure(frame, this.neutral) : null;
    const ok = !!m && m.confidence >= c.minVisibility;

    if (!ok) {
      if (this.badSince === null) this.badSince = now;
      const lost = now - this.badSince > c.lostGraceMs;
      if (lost) {
        // Losing the player stops movement and cancels any half-held gesture.
        this.stepTimes = [];
        this.holding = null;
        this.armed = false;
        this.downSince = null;
        this.disarmTurn();
        this.readyMs = 0;
      }
      return this.reading(lost ? 'lost' : 'partial', m, events, now);
    }
    this.badSince = null;
    this.everTracked = true;

    // ── Marching ────────────────────────────────────────────────────────
    const diff = this.leg.push(m.legDiff - (this.neutral?.legDiff ?? 0), now);
    let foot: 'left' | 'right' | null = null;
    if (diff > c.stepThreshold && this.lastFoot !== 'right') foot = 'right';
    else if (diff < -c.stepThreshold && this.lastFoot !== 'left') foot = 'left';
    if (foot) {
      this.lastFoot = foot;
      this.steps++;
      this.stepTimes.push(now);
      events.push('step');
    }
    this.stepTimes = this.stepTimes.filter((t) => now - t <= c.stepWindowMs);

    // ── Lean ────────────────────────────────────────────────────────────
    const lean = this.lean.push(m.leanDeg - (this.neutral?.leanDeg ?? 0), now);
    // leanDir -1 = player's left (positive degrees). Enter at leanEnterDeg,
    // release only once back inside leanExitDeg.
    const target: -1 | 0 | 1 = lean >= c.leanEnterDeg ? -1 : lean <= -c.leanEnterDeg ? 1 : 0;
    if (this.leanDir === 0) this.leanDir = target;
    else {
      const held = this.leanDir === -1 ? lean : -lean;
      if (held < c.leanExitDeg) this.leanDir = target;
    }

    // ── Discrete turns ──────────────────────────────────────────────────
    // One lean = one turn. Holding the lean does nothing more; coming back
    // to neutral (and staying there briefly) re-arms the next one.
    if (Math.abs(lean) < c.turnNeutralDeg) {
      if (this.neutralSince === null) this.neutralSince = now;
      if (now - this.neutralSince >= c.turnNeutralMs) this.turnArmed = true;
    } else this.neutralSince = null;
    if (this.turnArmed && Math.abs(lean) >= c.turnEnterDeg && now - this.lastTurnAt >= c.turnCooldownMs) {
      events.push(lean > 0 ? 'turnLeft' : 'turnRight');
      this.lastTurnAt = now;
      this.turnArmed = false;
    }

    // ── Gestures ────────────────────────────────────────────────────────
    const rightUp = m.rightUp >= c.raiseMargin;
    const leftUp = m.leftUp >= c.raiseMargin;
    if (m.handsDown) {
      if (this.downSince === null) this.downSince = now;
      if (now - this.downSince >= c.rearmMs) this.armed = true;
    } else this.downSince = null;

    const want: Gesture | null = rightUp && leftUp ? 'pause' : rightUp ? 'confirm' : leftUp ? 'back' : null;
    if (want !== this.holding) {
      this.holding = want;
      this.holdSince = now;
    } else if (want && this.armed) {
      const need = want === 'pause' ? c.pauseHoldMs : c.confirmHoldMs;
      if (now - this.holdSince >= need) {
        events.push(want);
        // One gesture per raise: the hands must come down again first.
        this.armed = false;
        this.downSince = null;
      }
    }

    // ── Standing tall, hands relaxed ("ready") ──────────────────────────
    // Forgiving: brief wobbles only slow the hold down instead of resetting
    // it, and no stillness is required beyond not marching.
    const dt = Math.max(0, Math.min(200, now - this.readyAt));
    this.readyAt = now;
    const stepping = this.stepTimes.length > 0 && now - this.stepTimes[this.stepTimes.length - 1] < 600;
    const tall = m.fullBody && m.handsLow && m.feetTogether && !stepping && Math.abs(lean) < c.readyLeanDeg;
    this.readyMs = tall ? this.readyMs + dt : Math.max(0, this.readyMs - dt * 2);
    if (this.readyMs >= c.readyHoldMs && !this.readyFired) {
      events.push('ready');
      this.readyFired = true;
    }
    if (this.readyMs === 0) this.readyFired = false;

    return this.reading('good', m, events, now);
  }

  private reading(tracking: TrackingQuality, m: Measure | null, events: MotionEvent[], now: number): MotionReading {
    const c = this.cfg;
    const recent = this.stepTimes.length;
    const lastStep = this.stepTimes[recent - 1];
    const marching = tracking !== 'lost' && recent >= c.minStepsToMarch && lastStep !== undefined && now - lastStep <= c.stopAfterMs;
    if (recent >= 2) {
      const span = (this.stepTimes[recent - 1] - this.stepTimes[0]) / 1000;
      const rate = span > 0 ? (recent - 1) / span : 0;
      this.cadence = this.cadence * 0.6 + rate * 0.4;
    } else if (!marching) this.cadence *= 0.8;

    const lean = tracking === 'good' ? (this.lean.value ?? 0) : 0;
    const mag = Math.max(0, Math.min(1, (Math.abs(lean) - c.leanDeadzoneDeg) / (c.leanFullDeg - c.leanDeadzoneDeg)));
    const steer = tracking === 'good' && mag > 0 ? -Math.sign(lean) * mag : 0;
    const holdFrac = (g: Gesture) => {
      if (this.holding !== g || !this.armed || tracking !== 'good') return 0;
      const need = g === 'pause' ? c.pauseHoldMs : c.confirmHoldMs;
      return Math.min(1, (now - this.holdSince) / need);
    };
    return {
      tracking,
      fullBody: !!m?.fullBody,
      confidence: m?.confidence ?? 0,
      marching,
      cadence: this.cadence,
      intensity: marching ? Math.max(0.55, Math.min(1, this.cadence / 2.2)) : 0,
      steps: this.steps,
      lastFoot: this.lastFoot,
      steer,
      leanDeg: lean,
      leanDir: tracking === 'good' ? this.leanDir : 0,
      turnArmed: tracking === 'good' && this.turnArmed,
      hold: { confirm: holdFrac('confirm'), back: holdFrac('back'), pause: holdFrac('pause') },
      armed: this.armed,
      readyProgress: tracking === 'good' ? Math.min(1, this.readyMs / c.readyHoldMs) : 0,
      events,
      metrics: { legDiff: this.leg.value ?? 0, rightUp: m?.rightUp ?? 0, leftUp: m?.leftUp ?? 0 },
    };
  }

  get hadTracking(): boolean {
    return this.everTracked;
  }
}
