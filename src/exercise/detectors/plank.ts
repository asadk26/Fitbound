import { angle, bestSide, Ema, inclineFromHorizontal, meanVisibility, SIDE } from '../geometry';
import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { Difficulty, DetectorUpdate, ExerciseDetector, GuidanceCode, PoseFrame } from '../types';

/**
 * Plank detector: a *hold* exercise, side-facing camera.
 *
 * SETUP → HOLDING ⇄ PAUSED
 *
 * Time accumulates only while the body is a roughly straight, roughly
 * horizontal line supported on the arms. Breaking the hold pauses the clock;
 * it never resets it, so a player who drops to rest keeps what they earned.
 * Per-frame time is capped so a stalled camera can't bank a burst of time.
 */
export interface PlankConfig {
  minConfidence: number;
  /** Max shoulder→ankle incline from horizontal, degrees. */
  maxIncline: number;
  /** Min shoulder–hip–ankle angle for a straight body line. */
  minBodyLine: number;
  /** Allow knee planks: use the knee in place of the ankle. */
  allowKnees: boolean;
  readyFrames: number;
  lostGraceMs: number;
  maxFrameGapMs: number;
}

export const PLANK_DEFAULTS: PlankConfig = {
  minConfidence: 0.5,
  maxIncline: 35,
  minBodyLine: 150,
  allowKnees: false,
  readyFrames: 6,
  lostGraceMs: 600,
  maxFrameGapMs: 200,
};

export function plankConfig(d: Difficulty): PlankConfig {
  if (d === 'beginner') return { ...PLANK_DEFAULTS, minBodyLine: 140, allowKnees: true };
  return PLANK_DEFAULTS;
}

type Phase = 'SETUP' | 'HOLDING' | 'PAUSED';

export class PlankDetector implements ExerciseDetector {
  readonly exerciseId = 'plank';
  readonly kind = 'hold' as const;
  private phase: Phase = 'SETUP';
  private readonly gate: TrackingGate;
  private readonly ready: StableCounter;
  private readonly line = new Ema(0.4);
  private heldMs = 0;
  private lastNow: number | null = null;

  constructor(private readonly cfg: PlankConfig = PLANK_DEFAULTS) {
    this.gate = new TrackingGate(cfg.lostGraceMs);
    this.ready = new StableCounter(cfg.readyFrames);
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.line.reset();
    this.heldMs = 0;
    this.lastNow = null;
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const c = this.cfg;
    const dt = this.lastNow === null ? 0 : Math.min(Math.max(now - this.lastNow, 0), c.maxFrameGapMs);
    this.lastNow = now;

    let confidence = 0;
    let setupIssue: GuidanceCode | null = null;
    let valid = false;
    let incline = 0;
    let bodyLine = 0;

    if (frame) {
      const lms = frame.landmarks;
      const side = bestSide(lms, ['shoulder', 'hip', 'ankle', 'elbow']);
      const s = SIDE[side];
      const ankleOk = lms[s.ankle].visibility > 0.5;
      const footIdx = ankleOk || !c.allowKnees ? s.ankle : s.knee;
      confidence = meanVisibility(lms, [s.shoulder, s.elbow, s.hip, footIdx]);
      const sh = lms[s.shoulder];
      const hip = lms[s.hip];
      const foot = lms[footIdx];
      const elbow = lms[s.elbow];
      incline = inclineFromHorizontal(sh, foot);
      bodyLine = this.line.push(angle(sh, hip, foot));
      // Supported on the arms: the elbow sits below the shoulder.
      const supported = elbow.y > sh.y;

      if (confidence < c.minConfidence) setupIssue = footIdx === s.ankle && !ankleOk ? 'LEGS_NOT_VISIBLE' : 'REPOSITION';
      else if (incline > c.maxIncline) setupIssue = 'GET_INTO_PLANK';
      else if (!supported) setupIssue = 'GET_INTO_PLANK';
      else if (bodyLine < c.minBodyLine) setupIssue = 'KEEP_BODY_STRAIGHT';
      valid = setupIssue === null;
    }

    const g = this.gate.check(frame !== null && confidence >= c.minConfidence, now);
    if (g !== 'ok') {
      if (this.phase === 'HOLDING') this.phase = 'PAUSED';
      if (g === 'lost') this.ready.reset();
      const u = untrackedUpdate(this.phase, g, this.gate.hadTracking, frame !== null, confidence, setupIssue);
      return { ...u, holdMs: this.heldMs, holding: false };
    }

    if (this.phase === 'HOLDING') {
      if (valid) this.heldMs += dt;
      else {
        this.phase = 'PAUSED';
        this.ready.reset();
      }
    } else if (this.ready.push(valid)) {
      this.phase = 'HOLDING';
    }

    const holding = this.phase === 'HOLDING';
    return {
      phase: this.phase,
      tracking: 'good',
      confidence,
      guidance: holding ? null : (setupIssue ?? 'GET_INTO_PLANK'),
      ready: holding,
      repCompleted: false,
      progress: clamp01(this.heldMs / 60000),
      holdMs: this.heldMs,
      holding,
      metrics: { bodyLine: Math.round(bodyLine), incline: Math.round(incline) },
    };
  }
}
