import { dist, Ema, inFrame, LM, meanVisibility, mid } from '../exercise/geometry';
import type { Landmark, PoseFrame, TrackingQuality } from '../exercise/types';

/**
 * Body-as-controller: reads a front-facing, standing player and turns their
 * movement into game input.
 *
 *  - Marching in place  → move. A step is an *alternating* difference in the
 *    height of the two legs, so jumping, squatting, bobbing or walking toward
 *    the camera (all of which move both legs together) never register.
 *  - Leaning the torso  → steer. Measured against a calibrated neutral, with a
 *    dead zone, smoothing and hysteresis so posture shifts and marching sway
 *    don't steer.
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
  /** Hysteresis for the discrete lean direction used by menus. */
  leanEnterDeg: number;
  leanExitDeg: number;
  leanSmoothing: number;
  /** A raised hand's wrist must be above the nose by this × torso length. */
  raiseMargin: number;
  confirmHoldMs: number;
  pauseHoldMs: number;
  /** A gesture re-arms only after both hands have been down this long. */
  rearmMs: number;
}

export const MOTION_DEFAULTS: MotionConfig = {
  minVisibility: 0.5,
  lostGraceMs: 500,
  stepThreshold: 0.12,
  stepWindowMs: 1600,
  minStepsToMarch: 2,
  stopAfterMs: 900,
  legSmoothing: 0.5,
  leanDeadzoneDeg: 5,
  leanFullDeg: 16,
  leanEnterDeg: 7,
  leanExitDeg: 4,
  leanSmoothing: 0.3,
  raiseMargin: 0.1,
  confirmHoldMs: 450,
  pauseHoldMs: 800,
  rearmMs: 250,
};

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
}

export type MotionEvent = 'step' | 'confirm' | 'back' | 'pause';

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
  /** -1 (player's left) .. +1 (player's right); 0 inside the dead zone. */
  steer: number;
  leanDeg: number;
  /** Discrete lean with hysteresis, for menus. */
  leanDir: -1 | 0 | 1;
  /** 0..1 hold progress for each gesture, for UI rings. */
  hold: { confirm: number; back: number; pause: number };
  /** Gestures are ignored until the player's hands have been down once. */
  armed: boolean;
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

  const inside = (i: number) => l[i].visibility >= 0.5 && inFrame(l[i], frame.aspect, 0);
  const fullBody = confidence >= 0.5 && inside(LM.NOSE) && inside(LM.L_ANKLE) && inside(LM.R_ANKLE);

  return { confidence, fullBody, thigh, torso, legDiff, leanDeg, rightUp, leftUp, handsDown };
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
    return { progress: 1, still, neutral: { thigh: med((s) => s.thigh), torso: med((s) => s.torso), legDiff: med((s) => s.legDiff), leanDeg: med((s) => s.leanDeg) } };
  }

  reset(): void {
    this.samples = [];
    this.lastLean = null;
  }
}

type Gesture = 'confirm' | 'back' | 'pause';

export class MotionReader {
  neutral: NeutralPose | null = null;
  private readonly cfg: MotionConfig;
  private readonly leg: Ema;
  private readonly lean: Ema;
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

  constructor(cfg: Partial<MotionConfig> = {}) {
    this.cfg = { ...MOTION_DEFAULTS, ...cfg };
    this.leg = new Ema(this.cfg.legSmoothing);
    this.lean = new Ema(this.cfg.leanSmoothing);
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
      }
      return this.reading(lost ? 'lost' : 'partial', m, events, now);
    }
    this.badSince = null;
    this.everTracked = true;

    // ── Marching ────────────────────────────────────────────────────────
    const diff = this.leg.push(m.legDiff - (this.neutral?.legDiff ?? 0));
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
    const lean = this.lean.push(m.leanDeg - (this.neutral?.leanDeg ?? 0));
    // leanDir -1 = player's left (positive degrees). Enter at leanEnterDeg,
    // release only once back inside leanExitDeg.
    const target: -1 | 0 | 1 = lean >= c.leanEnterDeg ? -1 : lean <= -c.leanEnterDeg ? 1 : 0;
    if (this.leanDir === 0) this.leanDir = target;
    else {
      const held = this.leanDir === -1 ? lean : -lean;
      if (held < c.leanExitDeg) this.leanDir = target;
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
      hold: { confirm: holdFrac('confirm'), back: holdFrac('back'), pause: holdFrac('pause') },
      armed: this.armed,
      events,
      metrics: { legDiff: this.leg.value ?? 0, rightUp: m?.rightUp ?? 0, leftUp: m?.leftUp ?? 0 },
    };
  }

  get hadTracking(): boolean {
    return this.everTracked;
  }
}
