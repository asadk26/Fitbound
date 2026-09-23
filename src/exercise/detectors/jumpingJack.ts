import { dist, inFrame, LM, meanVisibility, mid } from '../geometry';
import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { Difficulty, DetectorUpdate, ExerciseDetector, GuidanceCode, PoseFrame } from '../types';

/**
 * Jumping jack detector. Facing the camera, full body in frame.
 *
 * CLOSED → OPENING → OPEN → CLOSING → COMPLETED_REPETITION
 *
 * A rep needs *both* halves of the movement together: hands above the
 * shoulders and feet apart at the same time (OPEN), then hands back down and
 * feet together (CLOSED). Arm waving alone, or stepping side to side alone,
 * never reaches OPEN and never counts.
 *
 * Distances are normalised by torso length so the thresholds hold whether
 * the player is near or far from the phone.
 */
export interface JackConfig {
  minConfidence: number;
  /** Wrists above shoulders by this fraction of torso length = arms up. */
  armsUpRatio: number;
  /** Wrists below shoulders by this fraction of torso length = arms down. */
  armsDownRatio: number;
  /** Ankle spread / shoulder width at or above which legs are open. */
  legsOpenRatio: number;
  /** Ankle spread / shoulder width at or below which legs are closed. */
  legsClosedRatio: number;
  /** Shoulder width / torso length below which the player is side-on. */
  minFacingRatio: number;
  minRepMs: number;
  readyFrames: number;
  lostGraceMs: number;
}

export const JACK_DEFAULTS: JackConfig = {
  minConfidence: 0.5,
  armsUpRatio: 0.15,
  armsDownRatio: 0.45,
  legsOpenRatio: 1.45,
  legsClosedRatio: 1.05,
  minFacingRatio: 0.45,
  minRepMs: 350,
  readyFrames: 4,
  lostGraceMs: 500,
};

export function jackConfig(d: Difficulty): JackConfig {
  // Beginners may step out instead of jumping, so a narrower open stance counts.
  if (d === 'beginner') return { ...JACK_DEFAULTS, legsOpenRatio: 1.25, armsUpRatio: 0.05 };
  if (d === 'advanced') return { ...JACK_DEFAULTS, legsOpenRatio: 1.6, armsUpRatio: 0.25 };
  return JACK_DEFAULTS;
}

type Phase = 'SETUP' | 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING';

const BODY_IDX = [
  LM.L_SHOULDER,
  LM.R_SHOULDER,
  LM.L_WRIST,
  LM.R_WRIST,
  LM.L_HIP,
  LM.R_HIP,
  LM.L_ANKLE,
  LM.R_ANKLE,
];

export class JumpingJackDetector implements ExerciseDetector {
  readonly exerciseId = 'jumping_jack';
  readonly kind = 'reps' as const;
  private phase: Phase = 'SETUP';
  private readonly gate: TrackingGate;
  private readonly ready: StableCounter;
  private repStart = 0;
  private cue: { code: GuidanceCode; until: number } | null = null;

  constructor(private readonly cfg: JackConfig = JACK_DEFAULTS) {
    this.gate = new TrackingGate(cfg.lostGraceMs);
    this.ready = new StableCounter(cfg.readyFrames);
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.cue = null;
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const c = this.cfg;
    let confidence = 0;
    let setupIssue: GuidanceCode | null = null;
    let armsUp = false;
    let armsDown = false;
    let legsOpen = false;
    let legsClosed = false;
    let progress = 0;

    if (frame) {
      const lms = frame.landmarks;
      confidence = meanVisibility(lms, BODY_IDX);
      const ls = lms[LM.L_SHOULDER];
      const rs = lms[LM.R_SHOULDER];
      const shoulders = mid(ls, rs);
      const hips = mid(lms[LM.L_HIP], lms[LM.R_HIP]);
      const torso = Math.max(dist(shoulders, hips), 1e-3);
      const shoulderW = Math.max(dist(ls, rs), 1e-3);
      const la = lms[LM.L_ANKLE];
      const ra = lms[LM.R_ANKLE];
      const anklesVisible = la.visibility > 0.4 && ra.visibility > 0.4 && inFrame(la, frame.aspect) && inFrame(ra, frame.aspect);
      const lw = lms[LM.L_WRIST];
      const rw = lms[LM.R_WRIST];
      const wristsVisible = lw.visibility > 0.3 && rw.visibility > 0.3;

      // Wrist height above the shoulder line, in torso lengths (positive = above).
      const lUp = (shoulders.y - lw.y) / torso;
      const rUp = (shoulders.y - rw.y) / torso;
      armsUp = lUp >= c.armsUpRatio && rUp >= c.armsUpRatio;
      armsDown = lUp <= -c.armsDownRatio && rUp <= -c.armsDownRatio;
      const spread = Math.abs(la.x - ra.x) / shoulderW;
      legsOpen = spread >= c.legsOpenRatio;
      legsClosed = spread <= c.legsClosedRatio;

      const armP = clamp01((Math.min(lUp, rUp) + c.armsDownRatio) / (c.armsUpRatio + c.armsDownRatio));
      const legP = clamp01((spread - c.legsClosedRatio) / (c.legsOpenRatio - c.legsClosedRatio));
      progress = (armP + legP) / 2;

      if (!anklesVisible) setupIssue = inFrame(lms[LM.NOSE], frame.aspect) ? 'LEGS_NOT_VISIBLE' : 'MOVE_BACK';
      else if (!wristsVisible) setupIssue = 'ARMS_NOT_VISIBLE';
      else if (shoulderW / torso < c.minFacingRatio) setupIssue = 'FACE_CAMERA';
    }

    const trackedOk = frame !== null && confidence >= c.minConfidence && setupIssue === null;
    const g = this.gate.check(trackedOk, now);
    if (g !== 'ok') {
      if (g === 'lost') this.toSetup();
      return untrackedUpdate(this.phase, g, this.gate.hadTracking, frame !== null, confidence, setupIssue);
    }

    let repCompleted = false;
    let partialRep = false;
    const open = armsUp && legsOpen;
    const closed = armsDown && legsClosed;

    switch (this.phase) {
      case 'SETUP':
        if (this.ready.push(closed)) this.phase = 'CLOSED';
        break;
      case 'CLOSED':
        if (open) {
          this.phase = 'OPEN';
          this.repStart = now;
        } else if (!closed) {
          this.phase = 'OPENING';
          this.repStart = now;
        }
        break;
      case 'OPENING':
        if (open) this.phase = 'OPEN';
        else if (closed) {
          this.phase = 'CLOSED';
          partialRep = true;
          this.cue = { code: 'ARMS_AND_LEGS_TOGETHER', until: now + 1800 };
        }
        break;
      case 'OPEN':
        if (!armsUp || !legsOpen) this.phase = 'CLOSING';
        break;
      case 'CLOSING':
        if (open) this.phase = 'OPEN';
        else if (closed) {
          this.phase = 'CLOSED';
          if (now - this.repStart >= c.minRepMs) repCompleted = true;
        }
        break;
    }

    if (this.cue && now > this.cue.until) this.cue = null;
    let guidance: GuidanceCode | null = null;
    if (this.phase === 'SETUP') guidance = 'STAND_UPRIGHT';
    else if (this.cue) guidance = this.cue.code;

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
