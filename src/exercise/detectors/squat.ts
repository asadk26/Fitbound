import { angle, dist, Ema, inclineFromHorizontal, inFrame, LM, meanVisibility, mid } from '../geometry';
import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { Difficulty, DetectorUpdate, ExerciseDetector, GuidanceCode, Landmark, PoseFrame } from '../types';

/**
 * Squat detector. Works facing the camera or side-on, full body in frame.
 *
 * STANDING → LOWERING → BOTTOM_POSITION → RISING → COMPLETED_REPETITION
 *
 * Primary signal is *thigh rise*: the vertical hip-to-knee distance divided by
 * the thigh length measured while standing. Standing tall it is ~1; with the
 * thighs parallel to the floor it is ~0. Unlike the 2D knee angle — which
 * barely changes when a squat is seen from the front, because hip, knee and
 * ankle stay stacked in the image — this works from the front and the side.
 *
 * The standing thigh length is calibrated continuously while the player
 * stands, so moving nearer or farther between reps is fine. Hinging at the
 * hips (bending over) keeps the hips high over the knees and never counts.
 */
export interface SquatConfig {
  minConfidence: number;
  /** Thigh rise at or above which the player is standing. */
  standRatio: number;
  /** Thigh rise below which a descent has started. */
  descendRatio: number;
  /** Thigh rise at or below which the squat is deep enough. */
  bottomRatio: number;
  /** Thigh rise above which the player is rising out of the bottom. */
  riseRatio: number;
  /** Min 2D knee angle to accept a standing calibration frame. */
  standKneeAngle: number;
  /** Min torso incline from horizontal while standing (90 = upright). */
  minUprightIncline: number;
  minRepMs: number;
  readyFrames: number;
  lostGraceMs: number;
  smoothing: number;
}

export const SQUAT_DEFAULTS: SquatConfig = {
  minConfidence: 0.5,
  standRatio: 0.88,
  descendRatio: 0.82,
  bottomRatio: 0.6,
  riseRatio: 0.68,
  standKneeAngle: 155,
  minUprightIncline: 60,
  minRepMs: 400,
  readyFrames: 5,
  lostGraceMs: 450,
  smoothing: 0.5,
};

export function squatConfig(d: Difficulty): SquatConfig {
  // Beginners: a half squat or a chair squat counts.
  if (d === 'beginner') return { ...SQUAT_DEFAULTS, bottomRatio: 0.72, riseRatio: 0.78 };
  if (d === 'advanced') return { ...SQUAT_DEFAULTS, bottomRatio: 0.45, riseRatio: 0.55 };
  return SQUAT_DEFAULTS;
}

type Phase = 'SETUP' | 'STANDING' | 'LOWERING' | 'BOTTOM_POSITION' | 'RISING';

const LEG_IDX = [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE];

export class SquatDetector implements ExerciseDetector {

  readonly kind = 'reps' as const;
  private phase: Phase = 'SETUP';
  private readonly gate: TrackingGate;
  private readonly ready: StableCounter;
  private readonly rise: Ema;
  /** Thigh length while standing, in image units. */
  private readonly thigh = new Ema(0.2);
  private baseline: number | null = null;
  private repStart = 0;
  private cue: { code: GuidanceCode; until: number } | null = null;

  constructor(
    private readonly cfg: SquatConfig = SQUAT_DEFAULTS,
    /** Squat variants (goblet, sumo) share this detector under their own id. */
    readonly exerciseId: string = 'squat',
  ) {
    this.gate = new TrackingGate(cfg.lostGraceMs);
    this.ready = new StableCounter(cfg.readyFrames);
    this.rise = new Ema(cfg.smoothing);
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.rise.reset();
    this.thigh.reset();
    this.baseline = null;
    this.cue = null;
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const c = this.cfg;
    let confidence = 0;
    let setupIssue: GuidanceCode | null = null;
    let legs: LegReading | null = null;
    let upright = false;

    if (frame) {
      const lms = frame.landmarks;
      confidence = meanVisibility(lms, LEG_IDX);
      const ankles = [lms[LM.L_ANKLE], lms[LM.R_ANKLE]];
      const anklesOk = ankles.some((a) => a.visibility > 0.5 && inFrame(a, frame.aspect));
      const headOk = inFrame(lms[LM.NOSE], frame.aspect, 0.02) || lms[LM.NOSE].visibility < 0.3;
      legs = readLegs(lms);
      const hips = mid(lms[LM.L_HIP], lms[LM.R_HIP]);
      const shoulders = mid(lms[LM.L_SHOULDER], lms[LM.R_SHOULDER]);
      upright = inclineFromHorizontal(shoulders, hips) >= c.minUprightIncline;

      if (!anklesOk && !headOk) setupIssue = 'MOVE_BACK';
      else if (!anklesOk) setupIssue = 'LEGS_NOT_VISIBLE';
      else if (!headOk) setupIssue = 'MOVE_BACK';
      else if (!legs) setupIssue = 'LEGS_NOT_VISIBLE';
    }

    const trackedOk = frame !== null && confidence >= c.minConfidence && setupIssue === null && legs !== null;
    const g = this.gate.check(trackedOk, now);
    if (g !== 'ok' || !legs) {
      if (g === 'lost') this.toSetup();
      return untrackedUpdate(this.phase, g === 'ok' ? 'grace' : g, this.gate.hadTracking, frame !== null, confidence, setupIssue);
    }

    // Calibrate standing thigh length. In SETUP, average standing frames.
    // Once standing, the baseline only rises to a longer reading or decays
    // very slowly (~1.5%/s): the start of a front-view squat foreshortens the
    // thigh, and letting the baseline follow it would hide the squat.
    const looksStanding = legs.kneeAngle >= c.standKneeAngle && legs.verticality >= 0.9 && upright;
    if (looksStanding) {
      if (this.phase === 'SETUP') this.thigh.push(legs.length);
      else if (this.phase === 'STANDING' && this.baseline !== null) this.baseline = Math.max(this.baseline * 0.9995, legs.length);
    }
    if (this.phase === 'SETUP') this.baseline = this.thigh.value;
    const baseline = this.baseline;
    const r = this.rise.push(baseline ? legs.drop / baseline : 1);

    let repCompleted = false;
    let partialRep = false;

    switch (this.phase) {
      case 'SETUP':
        if (this.ready.push(looksStanding && baseline !== null)) this.phase = 'STANDING';
        break;
      case 'STANDING':
        if (r < c.descendRatio) {
          this.phase = 'LOWERING';
          this.repStart = now;
        }
        break;
      case 'LOWERING':
        if (r <= c.bottomRatio) this.phase = 'BOTTOM_POSITION';
        else if (r >= c.standRatio) {
          this.phase = 'STANDING';
          partialRep = true;
          this.cue = { code: 'GO_LOWER', until: now + 1800 };
        }
        break;
      case 'BOTTOM_POSITION':
        if (r >= c.riseRatio) this.phase = 'RISING';
        break;
      case 'RISING':
        if (r <= c.bottomRatio) this.phase = 'BOTTOM_POSITION';
        else if (r >= c.standRatio) {
          this.phase = 'STANDING';
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
      progress: clamp01((c.standRatio - r) / (c.standRatio - c.bottomRatio)),
      metrics: { thighRise: +r.toFixed(2), knee2d: Math.round(legs.kneeAngle), upright: upright ? 1 : 0 },
    };
  }

  private toSetup(): void {
    this.phase = 'SETUP';
    this.ready.reset();
    this.thigh.reset();
    this.baseline = null;
  }
}

interface LegReading {
  /** Vertical knee-minus-hip distance (positive when hips are above knees). */
  drop: number;
  /** Hip–knee distance in the image. */
  length: number;
  /** drop / length: 1 when the thigh is vertical in the image. */
  verticality: number;
  kneeAngle: number;
}

/** Average the legs that are clearly visible. */
function readLegs(lms: Landmark[]): LegReading | null {
  const sides: [number, number, number][] = [
    [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE],
    [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE],
  ];
  const got: LegReading[] = [];
  for (const [h, k, a] of sides) {
    if (lms[h].visibility > 0.5 && lms[k].visibility > 0.5 && lms[a].visibility > 0.5) {
      const length = dist(lms[h], lms[k]);
      if (length < 1e-3) continue;
      const drop = lms[k].y - lms[h].y;
      got.push({ drop, length, verticality: drop / length, kneeAngle: angle(lms[h], lms[k], lms[a]) });
    }
  }
  if (got.length === 0) return null;
  const avg = (f: (l: LegReading) => number) => got.reduce((s, l) => s + f(l), 0) / got.length;
  return { drop: avg((l) => l.drop), length: avg((l) => l.length), verticality: avg((l) => l.verticality), kneeAngle: avg((l) => l.kneeAngle) };
}
