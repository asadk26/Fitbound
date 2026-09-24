import { angle, bestSide, dist, Ema, inclineFromHorizontal, LM, meanVisibility, SIDE } from '../geometry';
import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { DetectorDiag, DiagBlocker, DiagEvent, Difficulty, DetectorUpdate, ExerciseDetector, GuidanceCode, PoseFrame } from '../types';

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
 *
 * Real-world robustness (from the first physical playtest):
 *
 *  - One noisy frame no longer throws away a rep in progress: the player must
 *    be out of position for `outOfPositionMs` before a half-done rep is
 *    discarded. Until then the state machine simply holds.
 *  - The top of the movement is calibrated to the player. From a low camera,
 *    fully straight arms can measure well under 150 degrees in 2D. If the arms
 *    hold steady at a lower angle (never below `minTopAngle`), that becomes
 *    this player's "extended" angle, and the required *depth* (the drop from
 *    top to bottom) is kept the same, so the rep is no easier.
 *  - Every frame reports why a rep can't start or count (`diag`), so a set
 *    that doesn't count tells us exactly which check failed.
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
  /** Out of position this long before a half-done rep is discarded. */
  outOfPositionMs: number;
  /** Learn a lower "arms extended" angle from a steady starting hold... */
  adaptiveTop: boolean;
  /** ...but never below this. */
  minTopAngle: number;
  /** Frames the arms must hold steady (within `plateauRangeDeg`) to learn the top. */
  plateauFrames: number;
  plateauRangeDeg: number;
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
  outOfPositionMs: 300,
  adaptiveTop: true,
  minTopAngle: 135,
  plateauFrames: 15,
  plateauRangeDeg: 8,
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
  /** This player's extended-arm angle (defaults to the config's). */
  private top: number;
  private plateau: number[] = [];
  private outSince: number | null = null;

  /** Current thresholds, derived from the (possibly learned) top. */
  get thresholds(): { top: number; descend: number; bottom: number; rise: number } {
    const c = this.cfg;
    const depth = c.upAngle - c.bottomAngle;
    const bottom = Math.min(c.bottomAngle, this.top - depth);
    return { top: this.top, descend: this.top - (c.upAngle - c.descendAngle), bottom, rise: bottom + (c.riseAngle - c.bottomAngle) };
  }

  constructor(private readonly cfg: PushupConfig = PUSHUP_DEFAULTS) {
    this.gate = new TrackingGate(cfg.lostGraceMs);
    this.ready = new StableCounter(cfg.readyFrames);
    this.elbow = new Ema(cfg.smoothing);
    this.top = cfg.upAngle;
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.elbow.reset();
    this.cue = null;
    this.top = this.cfg.upAngle;
    this.plateau = [];
    this.outSince = null;
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const c = this.cfg;
    let confidence = 0;
    let setupIssue: GuidanceCode | null = null;
    let blocker: DiagBlocker | null = null;
    let elbowAngle = 0;
    let hipAngle = 180;
    let torsoIncline = 0;

    if (frame) {
      const lms = frame.landmarks;
      const side = bestSide(lms, ['shoulder', 'elbow', 'wrist', 'hip']);
      const s = SIDE[side];
      confidence = meanVisibility(lms, [s.shoulder, s.elbow, s.wrist, s.hip]);
      const sh = lms[s.shoulder];
      const hip = lms[s.hip];
      const knee = lms[s.knee];
      elbowAngle = angle(sh, lms[s.elbow], lms[s.wrist]);

      torsoIncline = inclineFromHorizontal(sh, hip);
      const torsoLen = dist(sh, hip);
      const shoulderSpread = dist(lms[LM.L_SHOULDER], lms[LM.R_SHOULDER]);
      if (knee.visibility > 0.4) hipAngle = angle(sh, hip, knee);

      if (confidence < c.minConfidence) {
        setupIssue = 'ARMS_NOT_VISIBLE';
        blocker = Math.min(sh.visibility, hip.visibility) < c.minConfidence ? 'BODY_HIDDEN' : 'ARMS_HIDDEN';
      } else if (torsoIncline > c.maxTorsoIncline) {
        setupIssue = 'GET_INTO_PUSHUP';
        blocker = 'NOT_LEVEL';
      } else if (shoulderSpread > torsoLen * 0.8) {
        setupIssue = 'TURN_SIDEWAYS';
        blocker = 'NOT_SIDEWAYS';
      } else if (hipAngle < c.minHipAngle) {
        setupIssue = 'KEEP_BODY_STRAIGHT';
        blocker = 'HIPS_PIKED';
      }
    }
    const inPosition = frame !== null && setupIssue === null;
    const midRep = this.phase === 'LOWERING' || this.phase === 'BOTTOM_POSITION' || this.phase === 'RISING';

    const trackedOk = frame !== null && confidence >= c.minConfidence;
    const g = this.gate.check(trackedOk, now);
    if (g !== 'ok') {
      let lostEvent: DiagEvent | undefined;
      if (g === 'lost') {
        if (midRep) lostEvent = 'lost-mid-rep';
        this.toSetup();
      }
      const u = untrackedUpdate(this.phase, g, this.gate.hadTracking, frame !== null, confidence, setupIssue);
      return { ...u, diag: { blocker: frame ? (blocker ?? 'ARMS_HIDDEN') : 'NO_BODY', waiting: this.waiting(), event: lostEvent } };
    }

    const e = this.elbow.push(elbowAngle);
    let repCompleted = false;
    let partialRep = false;
    let event: DiagEvent | undefined;
    const t = this.thresholds;

    if (!inPosition) {
      // Out of position (e.g. stood up mid-set). A single noisy frame just
      // holds the state machine; only a sustained break discards the rep.
      this.outSince ??= now;
      if (this.phase !== 'SETUP' && now - this.outSince >= c.outOfPositionMs) {
        if (midRep) event = 'reset-mid-rep';
        this.toSetup();
      }
      this.plateau = [];
    } else {
      this.outSince = null;
      switch (this.phase) {
        case 'SETUP': {
          let start = this.ready.push(e >= t.top);
          if (!start && c.adaptiveTop) start = this.learnTop(e);
          if (start) this.phase = 'STARTING_POSITION';
          break;
        }
        case 'STARTING_POSITION':
          if (e < t.descend) {
            this.phase = 'LOWERING';
            this.repStart = now;
          }
          break;
        case 'LOWERING':
          if (e <= t.bottom) this.phase = 'BOTTOM_POSITION';
          else if (e >= t.top) {
            this.phase = 'STARTING_POSITION';
            partialRep = true;
            event = 'partial-depth';
            this.cue = { code: 'GO_LOWER', until: now + 1800 };
          }
          break;
        case 'BOTTOM_POSITION':
          if (e >= t.rise) this.phase = 'RISING';
          break;
        case 'RISING':
          if (e <= t.bottom) {
            // Went back down without reaching the top: that rep never finished.
            this.phase = 'BOTTOM_POSITION';
            event = 'no-return';
            this.repStart = now;
            this.cue = { code: 'EXTEND_FULLY', until: now + 1800 };
          } else if (e >= t.top) {
            this.phase = 'STARTING_POSITION';
            if (now - this.repStart >= c.minRepMs) repCompleted = true;
            else event = 'too-fast';
          }
          break;
      }
    }

    if (this.cue && now > this.cue.until) this.cue = null;
    let guidance: GuidanceCode | null = setupIssue;
    if (!guidance && this.phase === 'SETUP') guidance = 'EXTEND_FULLY';
    if (!guidance && hipAngle < c.cueHipAngle) guidance = 'KEEP_BODY_STRAIGHT';
    if (!guidance && this.cue) guidance = this.cue.code;

    if (!blocker && this.phase === 'SETUP') blocker = 'ARMS_NOT_STRAIGHT';
    const diag: DetectorDiag = { blocker, waiting: this.waiting(), event };
    const progress = clamp01((t.top - e) / Math.max(1, t.top - t.bottom));
    return {
      phase: repCompleted ? 'COMPLETED_REPETITION' : this.phase,
      tracking: 'good',
      confidence,
      guidance,
      ready: this.phase !== 'SETUP',
      repCompleted,
      partialRep,
      progress,
      metrics: { elbow: Math.round(e), torsoIncline: Math.round(torsoIncline), hipAngle: Math.round(hipAngle), top: Math.round(t.top), bottom: Math.round(t.bottom) },
      diag,
    };
  }

  /** Learn this player's extended-arm angle from a steady hold in position. */
  private learnTop(e: number): boolean {
    const c = this.cfg;
    this.plateau.push(e);
    if (this.plateau.length > c.plateauFrames) this.plateau.shift();
    if (this.plateau.length < c.plateauFrames) return false;
    const lo = Math.min(...this.plateau);
    const hi = Math.max(...this.plateau);
    if (hi - lo > c.plateauRangeDeg || lo < c.minTopAngle) return false;
    // A little under the held angle, so the arms don't have to hit it exactly again.
    this.top = Math.max(c.minTopAngle, Math.min(c.upAngle, (lo + hi) / 2 - 4));
    return true;
  }

  private waiting(): DetectorDiag['waiting'] {
    switch (this.phase) {
      case 'SETUP':
        return 'start';
      case 'STARTING_POSITION':
        return 'lower';
      case 'LOWERING':
        return 'bottom';
      default:
        return 'return';
    }
  }

  private toSetup(): void {
    this.phase = 'SETUP';
    this.ready.reset();
    this.plateau = [];
  }
}
