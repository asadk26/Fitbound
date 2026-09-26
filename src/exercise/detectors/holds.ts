import { angle, bestSide, Ema, inclineFromHorizontal, LM, meanVisibility, mid, SIDE } from '../geometry';
import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { DetectorUpdate, ExerciseDetector, GuidanceCode, PoseFrame, Side, SideCounts } from '../types';

/**
 * Timed holds beyond the plank: wall sits and side planks. Both follow the
 * plank's rules: SETUP → HOLDING ⇄ PAUSED; time accumulates only while the
 * position is valid, per-frame time is capped (a stalled camera can't bank a
 * burst), and breaking the hold pauses the clock — it never resets it.
 */
interface HoldTiming {
  minConfidence: number;
  readyFrames: number;
  lostGraceMs: number;
  maxFrameGapMs: number;
}

const TIMING: HoldTiming = { minConfidence: 0.5, readyFrames: 6, lostGraceMs: 600, maxFrameGapMs: 200 };

type Phase = 'SETUP' | 'HOLDING' | 'PAUSED';

/** What one frame says about the position. */
interface Reading {
  confidence: number;
  issue: GuidanceCode | null;
  metrics: Record<string, number>;
}

/** The shared hold clock: tracking grace, a stable start, capped time. */
abstract class HoldDetector implements ExerciseDetector {
  abstract readonly exerciseId: string;
  readonly kind = 'hold' as const;
  protected phase: Phase = 'SETUP';
  private readonly gate = new TrackingGate(TIMING.lostGraceMs);
  private readonly ready = new StableCounter(TIMING.readyFrames);
  private lastNow: number | null = null;

  protected abstract read(frame: PoseFrame): Reading;
  /** Credit `dt` of valid holding; returns false if this frame can't be credited (e.g. switch sides). */
  protected abstract credit(dt: number): boolean;
  protected abstract held(): number;
  protected abstract clear(): void;
  /** The cue shown when holding but not being credited. */
  protected blockedCue(): GuidanceCode | null {
    return null;
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.lastNow = null;
    this.clear();
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const dt = this.lastNow === null ? 0 : Math.min(Math.max(now - this.lastNow, 0), TIMING.maxFrameGapMs);
    this.lastNow = now;
    const r: Reading = frame ? this.read(frame) : { confidence: 0, issue: null, metrics: {} };
    const valid = frame !== null && r.issue === null;

    const g = this.gate.check(frame !== null && r.confidence >= TIMING.minConfidence, now);
    if (g !== 'ok') {
      if (this.phase === 'HOLDING') this.phase = 'PAUSED';
      if (g === 'lost') this.ready.reset();
      const u = untrackedUpdate(this.phase, g, this.gate.hadTracking, frame !== null, r.confidence, r.issue);
      return { ...u, holdMs: this.held(), ...this.sideTimes(), holding: false };
    }

    let credited = false;
    if (this.phase === 'HOLDING') {
      if (valid) credited = this.credit(dt);
      else {
        this.phase = 'PAUSED';
        this.ready.reset();
      }
    } else if (this.ready.push(valid)) {
      this.phase = 'HOLDING';
      credited = this.credit(0);
    }

    const inPosition = this.phase === 'HOLDING';
    const holding = inPosition && credited;
    return {
      phase: this.phase,
      tracking: 'good',
      confidence: r.confidence,
      guidance: holding ? null : inPosition ? this.blockedCue() : (r.issue ?? this.startCue()),
      ready: inPosition,
      repCompleted: false,
      progress: clamp01(this.held() / 60000),
      holdMs: this.held(),
      ...this.sideTimes(),
      holding,
      metrics: r.metrics,
    };
  }

  protected abstract startCue(): GuidanceCode;

  /** Split holds report the credited time per side. */
  protected sideTimes(): { holdSides?: SideCounts } {
    return {};
  }

  /** The position changed under a running hold (e.g. rolled to the other side): it must settle again. */
  protected pauseHold(): void {
    if (this.phase === 'HOLDING') this.phase = 'PAUSED';
    this.ready.reset();
  }
}

export interface WallSitConfig {
  /** Knee angle (hip–knee–ankle) must be within this window, degrees. */
  minKnee: number;
  maxKnee: number;
  /** Max thigh (hip→knee) tilt from horizontal. */
  maxThigh: number;
  /** Min torso (shoulder→hip) and shin (knee→ankle) tilt from horizontal: upright. */
  minTorso: number;
  minShin: number;
}

export const WALL_SIT_DEFAULTS: WallSitConfig = { minKnee: 65, maxKnee: 120, maxThigh: 28, minTorso: 55, minShin: 55 };

export function wallSitConfig(d: 'beginner' | 'intermediate' | 'advanced'): WallSitConfig {
  // Beginners may sit higher: a shallower knee bend and a sloping thigh.
  if (d === 'beginner') return { ...WALL_SIT_DEFAULTS, maxKnee: 140, maxThigh: 48 };
  return WALL_SIT_DEFAULTS;
}

/**
 * Wall sit, side-on to the phone (the way you face for push-ups). Valid while
 * the knees are bent near a right angle, the thighs are near level, and the
 * back and shins are upright. The camera can't see the wall: a free-standing
 * squat hold with the same shape also counts, which is harder, not easier.
 */
export class WallSitDetector extends HoldDetector {
  readonly exerciseId = 'wall_sit';
  private readonly knee = new Ema(0.4);
  private heldMs = 0;

  constructor(private readonly cfg: WallSitConfig = WALL_SIT_DEFAULTS) {
    super();
  }

  protected read(frame: PoseFrame): Reading {
    const c = this.cfg;
    const lms = frame.landmarks;
    const s = SIDE[bestSide(lms, ['shoulder', 'hip', 'knee', 'ankle'])];
    const confidence = meanVisibility(lms, [s.shoulder, s.hip, s.knee, s.ankle]);
    const kneeDeg = this.knee.push(angle(lms[s.hip], lms[s.knee], lms[s.ankle]));
    const thigh = inclineFromHorizontal(lms[s.hip], lms[s.knee]);
    const torso = inclineFromHorizontal(lms[s.shoulder], lms[s.hip]);
    const shin = inclineFromHorizontal(lms[s.knee], lms[s.ankle]);
    let issue: GuidanceCode | null = null;
    if (confidence < TIMING.minConfidence) issue = lms[s.ankle].visibility < 0.5 || lms[s.knee].visibility < 0.5 ? 'LEGS_NOT_VISIBLE' : 'REPOSITION';
    else if (kneeDeg > 155) issue = 'GET_INTO_WALL_SIT';
    else if (kneeDeg > c.maxKnee || thigh > c.maxThigh) issue = 'GO_LOWER';
    else if (kneeDeg < c.minKnee) issue = 'GET_INTO_WALL_SIT';
    else if (torso < c.minTorso || shin < c.minShin) issue = 'BACK_AGAINST_WALL';
    return { confidence, issue, metrics: { knee: Math.round(kneeDeg), thigh: Math.round(thigh), torso: Math.round(torso) } };
  }

  protected credit(dt: number): boolean {
    this.heldMs += dt;
    return true;
  }
  protected held(): number {
    return this.heldMs;
  }
  protected clear(): void {
    this.knee.reset();
    this.heldMs = 0;
  }
  protected startCue(): GuidanceCode {
    return 'GET_INTO_WALL_SIT';
  }
}

export interface SidePlankConfig {
  /** Min shoulder–hip–foot angle: hips lifted in a straight line. */
  minBodyLine: number;
  /** Shoulder→foot tilt from horizontal: raised off the floor, but not standing. */
  minIncline: number;
  maxIncline: number;
  /** Knees down (beginner): use the knees as the base. */
  allowKnees: boolean;
}

export const SIDE_PLANK_DEFAULTS: SidePlankConfig = { minBodyLine: 150, minIncline: 8, maxIncline: 60, allowKnees: false };

export function sidePlankConfig(d: 'beginner' | 'intermediate' | 'advanced'): SidePlankConfig {
  if (d === 'beginner') return { ...SIDE_PLANK_DEFAULTS, minBodyLine: 140, allowKnees: true };
  return SIDE_PLANK_DEFAULTS;
}

/**
 * Side plank, lying on your side *facing* the phone (the way you face for
 * push-ups, then rolled toward it), so both shoulders show, one above the
 * other. The side you're resting on is the lower shoulder; its time is kept
 * separately from the other side's.
 *
 * Balance: the set's target is the total, split evenly. Once one side has
 * held its half, holding that side stops adding time and the cue says to
 * switch; only the other side can finish the set. The reported hold time is
 * min(left, half) + min(right, half), so the clock reads in real seconds and
 * reaching the target means both sides reached theirs. Without a target (not
 * yet told), both sides count freely.
 */
export class SidePlankDetector extends HoldDetector {
  readonly exerciseId = 'side_plank';
  private readonly line = new Ema(0.4);
  private sideMs: Record<Side, number> = { left: 0, right: 0 };
  private down: Side | null = null;
  private halfMs = Infinity;

  constructor(private readonly cfg: SidePlankConfig = SIDE_PLANK_DEFAULTS) {
    super();
  }

  /** The set's total target; each side's share is half. */
  setHoldTarget(ms: number): void {
    this.halfMs = ms > 0 ? ms / 2 : Infinity;
  }

  /** Time held on each side, uncapped. */
  get sides(): Record<Side, number> {
    return { ...this.sideMs };
  }

  protected read(frame: PoseFrame): Reading {
    const c = this.cfg;
    const lms = frame.landmarks;
    const lsh = lms[LM.L_SHOULDER];
    const rsh = lms[LM.R_SHOULDER];
    // The lower shoulder (larger y) carries the weight.
    const down: Side = lsh.y >= rsh.y ? 'left' : 'right';
    const s = SIDE[down];
    const shMid = mid(lsh, rsh);
    const hipMid = mid(lms[LM.L_HIP], lms[LM.R_HIP]);
    const anklesOk = Math.min(lms[LM.L_ANKLE].visibility, lms[LM.R_ANKLE].visibility) > 0.5;
    const useKnees = c.allowKnees && !anklesOk;
    const foot = useKnees ? mid(lms[LM.L_KNEE], lms[LM.R_KNEE]) : mid(lms[LM.L_ANKLE], lms[LM.R_ANKLE]);
    const confidence = meanVisibility(lms, [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP, s.elbow, ...(useKnees ? [LM.L_KNEE, LM.R_KNEE] : [LM.L_ANKLE, LM.R_ANKLE])]);
    const torsoLen = Math.hypot(shMid.x - hipMid.x, shMid.y - hipMid.y) || 1;
    // Stacked shoulders: facing the phone on your side, one shoulder sits well above the other.
    const stacked = Math.abs(lsh.y - rsh.y) >= 0.3 * torsoLen;
    const incline = inclineFromHorizontal(shMid, foot);
    const bodyLine = this.line.push(angle(shMid, hipMid, foot));
    // Propped on the lower arm (forearm or hand): the elbow sits below its shoulder, the feet below the shoulders.
    const supported = lms[s.elbow].y > lms[s.shoulder].y && foot.y > shMid.y;

    let issue: GuidanceCode | null = null;
    if (confidence < TIMING.minConfidence) issue = !anklesOk && !useKnees ? 'LEGS_NOT_VISIBLE' : 'REPOSITION';
    else if (!stacked) issue = 'GET_INTO_SIDE_PLANK';
    else if (!supported || incline > c.maxIncline) issue = 'GET_INTO_SIDE_PLANK';
    else if (incline < c.minIncline || bodyLine < c.minBodyLine) issue = 'LIFT_HIPS';
    if (issue === null) {
      // Rolled onto the other side mid-hold: that's a new hold, it must settle again.
      if (this.down !== null && this.down !== down) this.pauseHold();
      this.down = down;
    }
    return {
      confidence,
      issue,
      metrics: {
        bodyLine: Math.round(bodyLine),
        incline: Math.round(incline),
        down: down === 'left' ? -1 : 1,
        leftS: Math.floor(this.sideMs.left / 1000),
        rightS: Math.floor(this.sideMs.right / 1000),
      },
    };
  }

  protected credit(dt: number): boolean {
    if (this.down === null || this.sideMs[this.down] >= this.halfMs) return false;
    this.sideMs[this.down] = Math.min(this.halfMs, this.sideMs[this.down] + dt);
    return true;
  }
  protected held(): number {
    return Math.min(this.sideMs.left, this.halfMs) + Math.min(this.sideMs.right, this.halfMs);
  }
  protected blockedCue(): GuidanceCode | null {
    return 'SWITCH_SIDES';
  }
  protected sideTimes(): { holdSides: SideCounts } {
    return { holdSides: { left: Math.min(this.sideMs.left, this.halfMs), right: Math.min(this.sideMs.right, this.halfMs) } };
  }
  protected clear(): void {
    this.line.reset();
    this.sideMs = { left: 0, right: 0 };
    this.down = null;
  }
  protected startCue(): GuidanceCode {
    return 'GET_INTO_SIDE_PLANK';
  }
}
