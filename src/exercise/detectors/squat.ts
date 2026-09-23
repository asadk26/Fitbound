import { angle, dist, Ema, inclineFromHorizontal, inFrame, LM, meanVisibility, mid } from '../geometry';
import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { Difficulty, DetectorUpdate, ExerciseDetector, GuidanceCode, Landmark, PoseFrame } from '../types';

/**
 * Squat detector. Works facing the camera or side-on, full body in frame.
 *
 * STANDING → LOWERING → BOTTOM_POSITION → RISING → COMPLETED_REPETITION
 *
 * Primary signal is knee flexion (hip–knee–ankle), averaged over both legs
 * when both are visible. A second, independent check requires the hips to
 * actually drop by a fraction of thigh length below the standing baseline,
 * so bending the knees while leaning or bobbing in place doesn't count.
 */
export interface SquatConfig {
  minConfidence: number;
  standAngle: number;
  descendAngle: number;
  bottomAngle: number;
  riseAngle: number;
  /** Required hip drop at the bottom, as a fraction of thigh length. */
  minHipDrop: number;
  /** Min torso incline from horizontal while standing (90 = upright). */
  minUprightIncline: number;
  minRepMs: number;
  readyFrames: number;
  lostGraceMs: number;
  smoothing: number;
}

export const SQUAT_DEFAULTS: SquatConfig = {
  minConfidence: 0.5,
  standAngle: 160,
  descendAngle: 148,
  bottomAngle: 112,
  riseAngle: 126,
  minHipDrop: 0.25,
  minUprightIncline: 60,
  minRepMs: 550,
  readyFrames: 5,
  lostGraceMs: 450,
  smoothing: 0.55,
};

export function squatConfig(d: Difficulty): SquatConfig {
  if (d === 'beginner') return { ...SQUAT_DEFAULTS, bottomAngle: 128, riseAngle: 140, minHipDrop: 0.15 };
  if (d === 'advanced') return { ...SQUAT_DEFAULTS, bottomAngle: 100, riseAngle: 115, minHipDrop: 0.35 };
  return SQUAT_DEFAULTS;
}

type Phase = 'SETUP' | 'STANDING' | 'LOWERING' | 'BOTTOM_POSITION' | 'RISING';

const LEG_IDX = [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE];

export class SquatDetector implements ExerciseDetector {
  readonly exerciseId = 'squat';
  readonly kind = 'reps' as const;
  private phase: Phase = 'SETUP';
  private readonly gate: TrackingGate;
  private readonly ready: StableCounter;
  private readonly knee: Ema;
  private readonly baselineHipY = new Ema(0.2);
  private deepestHipY = 0;
  private thighLen = 0.2;
  private repStart = 0;
  private cue: { code: GuidanceCode; until: number } | null = null;

  constructor(private readonly cfg: SquatConfig = SQUAT_DEFAULTS) {
    this.gate = new TrackingGate(cfg.lostGraceMs);
    this.ready = new StableCounter(cfg.readyFrames);
    this.knee = new Ema(cfg.smoothing);
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.knee.reset();
    this.baselineHipY.reset();
    this.cue = null;
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const c = this.cfg;
    let confidence = 0;
    let setupIssue: GuidanceCode | null = null;
    let kneeAngle = 180;
    let hipY = 0;
    let upright = false;

    if (frame) {
      const lms = frame.landmarks;
      confidence = meanVisibility(lms, LEG_IDX);
      const ankles = [lms[LM.L_ANKLE], lms[LM.R_ANKLE]];
      const anklesOk = ankles.some((a) => a.visibility > 0.5 && inFrame(a, frame.aspect));
      const headOk = inFrame(lms[LM.NOSE], frame.aspect, 0.02) || lms[LM.NOSE].visibility < 0.3;

      const legs = legAngles(lms);
      kneeAngle = legs.angle;
      thighFrom(lms, (t) => (this.thighLen = t));
      const hips = mid(lms[LM.L_HIP], lms[LM.R_HIP]);
      const shoulders = mid(lms[LM.L_SHOULDER], lms[LM.R_SHOULDER]);
      hipY = hips.y;
      upright = inclineFromHorizontal(shoulders, hips) >= c.minUprightIncline;

      if (!anklesOk && !headOk) setupIssue = 'MOVE_BACK';
      else if (!anklesOk) setupIssue = 'LEGS_NOT_VISIBLE';
      else if (!headOk) setupIssue = 'MOVE_BACK';
      else if (legs.count === 0) setupIssue = 'LEGS_NOT_VISIBLE';
    }

    const trackedOk = frame !== null && confidence >= c.minConfidence && setupIssue === null;
    const g = this.gate.check(trackedOk, now);
    if (g !== 'ok') {
      if (g === 'lost') this.toSetup();
      return untrackedUpdate(this.phase, g, this.gate.hadTracking, frame !== null, confidence, setupIssue);
    }

    const k = this.knee.push(kneeAngle);
    let repCompleted = false;
    let partialRep = false;

    switch (this.phase) {
      case 'SETUP':
        if (this.ready.push(k >= c.standAngle && upright)) {
          this.phase = 'STANDING';
          this.baselineHipY.reset();
          this.baselineHipY.push(hipY);
        }
        break;
      case 'STANDING':
        if (k >= c.standAngle) this.baselineHipY.push(hipY);
        if (k < c.descendAngle) {
          this.phase = 'LOWERING';
          this.repStart = now;
          this.deepestHipY = hipY;
        }
        break;
      case 'LOWERING':
        this.deepestHipY = Math.max(this.deepestHipY, hipY);
        if (k <= c.bottomAngle) this.phase = 'BOTTOM_POSITION';
        else if (k >= c.standAngle) {
          this.phase = 'STANDING';
          partialRep = true;
          this.cue = { code: 'GO_LOWER', until: now + 1800 };
        }
        break;
      case 'BOTTOM_POSITION':
        this.deepestHipY = Math.max(this.deepestHipY, hipY);
        if (k >= c.riseAngle) this.phase = 'RISING';
        break;
      case 'RISING':
        if (k <= c.bottomAngle) this.phase = 'BOTTOM_POSITION';
        else if (k >= c.standAngle) {
          this.phase = 'STANDING';
          const drop = this.deepestHipY - (this.baselineHipY.value ?? hipY);
          const deepEnough = drop >= c.minHipDrop * this.thighLen;
          if (!deepEnough) {
            partialRep = true;
            this.cue = { code: 'GO_LOWER', until: now + 1800 };
          } else if (now - this.repStart >= c.minRepMs) repCompleted = true;
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
      progress: clamp01((c.standAngle - k) / (c.standAngle - c.bottomAngle)),
    };
  }

  private toSetup(): void {
    this.phase = 'SETUP';
    this.ready.reset();
  }
}

function legAngles(lms: Landmark[]): { angle: number; count: number } {
  const legs: number[] = [];
  const sides: [number, number, number][] = [
    [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE],
    [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE],
  ];
  for (const [h, k, a] of sides) {
    if (lms[h].visibility > 0.5 && lms[k].visibility > 0.5 && lms[a].visibility > 0.5) {
      legs.push(angle(lms[h], lms[k], lms[a]));
    }
  }
  if (legs.length === 0) return { angle: 180, count: 0 };
  return { angle: legs.reduce((s, x) => s + x, 0) / legs.length, count: legs.length };
}

function thighFrom(lms: Landmark[], set: (t: number) => void): void {
  const l = dist(lms[LM.L_HIP], lms[LM.L_KNEE]);
  const r = dist(lms[LM.R_HIP], lms[LM.R_KNEE]);
  const t = Math.max(l, r);
  if (t > 0.02) set(t);
}
