import { angle, bestSide, dist, Ema, inclineFromHorizontal, LM, meanVisibility, SIDE } from '../geometry';
import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { Difficulty, DetectorUpdate, ExerciseDetector, GuidanceCode, PoseFrame } from '../types';

/**
 * Push-up detector for a side-facing camera.
 *
 * STARTING_POSITION → LOWERING → BOTTOM_POSITION → RISING → COMPLETED_REPETITION
 *
 * The primary signal is elbow flexion (shoulder–elbow–wrist). Hysteresis between
 * the thresholds means jitter around any one threshold can't cycle the machine,
 * and a rep only counts once the arms return to full extension after reaching
 * the bottom. The torso must be roughly horizontal throughout, so bending the
 * arms while standing (or waving at the camera) never counts.
 */
export interface PushupConfig {
  minConfidence: number;
  /** Elbow angle at or above which arms count as extended (top). */
  upAngle: number;
  /** Elbow angle below which a descent has started. */
  descendAngle: number;
  /** Elbow angle at or below which the bottom is reached. */
  bottomAngle: number;
  /** Elbow angle above which the player is rising out of the bottom. */
  riseAngle: number;
  /** Max shoulder→hip incline from horizontal, degrees. */
  maxTorsoIncline: number;
  /** Min shoulder–hip–knee angle; lower means hips are piked way up. */
  minHipAngle: number;
  /** Below this the body is sagging/piking enough to cue, but still counts. */
  cueHipAngle: number;
  minRepMs: number;
  readyFrames: number;
  lostGraceMs: number;
  smoothing: number;
}

export const PUSHUP_DEFAULTS: PushupConfig = {
  minConfidence: 0.5,
  upAngle: 150,
  descendAngle: 138,
  bottomAngle: 100,
  riseAngle: 112,
  maxTorsoIncline: 45,
  minHipAngle: 115,
  cueHipAngle: 145,
  minRepMs: 450,
  readyFrames: 5,
  lostGraceMs: 450,
  smoothing: 0.55,
};

export function pushupConfig(d: Difficulty): PushupConfig {
  if (d === 'beginner') return { ...PUSHUP_DEFAULTS, bottomAngle: 110, riseAngle: 122 };
  if (d === 'advanced') return { ...PUSHUP_DEFAULTS, bottomAngle: 95, riseAngle: 108 };
  return PUSHUP_DEFAULTS;
}

type Phase = 'SETUP' | 'STARTING_POSITION' | 'LOWERING' | 'BOTTOM_POSITION' | 'RISING';

export class PushupDetector implements ExerciseDetector {
  readonly exerciseId = 'pushup';
  readonly kind = 'reps' as const;
  private phase: Phase = 'SETUP';
  private readonly gate: TrackingGate;
  private readonly ready: StableCounter;
  private readonly elbow: Ema;
  private repStart = 0;
  private cue: { code: GuidanceCode; until: number } | null = null;

  constructor(private readonly cfg: PushupConfig = PUSHUP_DEFAULTS) {
    this.gate = new TrackingGate(cfg.lostGraceMs);
    this.ready = new StableCounter(cfg.readyFrames);
    this.elbow = new Ema(cfg.smoothing);
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.elbow.reset();
    this.cue = null;
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const c = this.cfg;
    let confidence = 0;
    let setupIssue: GuidanceCode | null = null;
    let elbowAngle = 0;
    let inPosition = false;
    let hipAngle = 180;

    if (frame) {
      const lms = frame.landmarks;
      const side = bestSide(lms, ['shoulder', 'elbow', 'wrist', 'hip']);
      const s = SIDE[side];
      confidence = meanVisibility(lms, [s.shoulder, s.elbow, s.wrist, s.hip]);
      const sh = lms[s.shoulder];
      const hip = lms[s.hip];
      const knee = lms[s.knee];
      elbowAngle = angle(sh, lms[s.elbow], lms[s.wrist]);

      const torsoIncline = inclineFromHorizontal(sh, hip);
      const torsoLen = dist(sh, hip);
      const shoulderSpread = dist(lms[LM.L_SHOULDER], lms[LM.R_SHOULDER]);
      if (knee.visibility > 0.4) hipAngle = angle(sh, hip, knee);

      if (confidence < c.minConfidence) setupIssue = 'ARMS_NOT_VISIBLE';
      else if (torsoIncline > c.maxTorsoIncline) setupIssue = 'GET_INTO_PUSHUP';
      else if (shoulderSpread > torsoLen * 0.8) setupIssue = 'TURN_SIDEWAYS';
      else if (hipAngle < c.minHipAngle) setupIssue = 'KEEP_BODY_STRAIGHT';
      inPosition = setupIssue === null;
    }

    const trackedOk = frame !== null && confidence >= c.minConfidence;
    const g = this.gate.check(trackedOk, now);
    if (g !== 'ok') {
      if (g === 'lost') this.toSetup();
      return untrackedUpdate(this.phase, g, this.gate.hadTracking, frame !== null, confidence, setupIssue);
    }

    const e = this.elbow.push(elbowAngle);
    let repCompleted = false;
    let partialRep = false;

    if (!inPosition) {
      // Out of position (e.g. stood up mid-set): discard any rep in progress.
      if (this.phase !== 'SETUP') this.toSetup();
    } else {
      switch (this.phase) {
        case 'SETUP':
          if (this.ready.push(e >= c.upAngle)) this.phase = 'STARTING_POSITION';
          break;
        case 'STARTING_POSITION':
          if (e < c.descendAngle) {
            this.phase = 'LOWERING';
            this.repStart = now;
          }
          break;
        case 'LOWERING':
          if (e <= c.bottomAngle) this.phase = 'BOTTOM_POSITION';
          else if (e >= c.upAngle) {
            this.phase = 'STARTING_POSITION';
            partialRep = true;
            this.cue = { code: 'GO_LOWER', until: now + 1800 };
          }
          break;
        case 'BOTTOM_POSITION':
          if (e >= c.riseAngle) this.phase = 'RISING';
          break;
        case 'RISING':
          if (e <= c.bottomAngle) this.phase = 'BOTTOM_POSITION';
          else if (e >= c.upAngle) {
            this.phase = 'STARTING_POSITION';
            if (now - this.repStart >= c.minRepMs) repCompleted = true;
          }
          break;
      }
    }

    if (this.cue && now > this.cue.until) this.cue = null;
    let guidance: GuidanceCode | null = setupIssue;
    if (!guidance && this.phase === 'SETUP') guidance = 'EXTEND_FULLY';
    if (!guidance && hipAngle < c.cueHipAngle) guidance = 'KEEP_BODY_STRAIGHT';
    if (!guidance && this.cue) guidance = this.cue.code;

    const progress = clamp01((c.upAngle - e) / (c.upAngle - c.bottomAngle));
    return {
      phase: repCompleted ? 'COMPLETED_REPETITION' : this.phase,
      tracking: 'good',
      confidence,
      guidance,
      ready: this.phase !== 'SETUP',
      repCompleted,
      partialRep,
      progress,
    };
  }

  private toSetup(): void {
    this.phase = 'SETUP';
    this.ready.reset();
  }
}
