import type { ExerciseDefinition } from './registry';
import type { DetectorUpdate, ExerciseDetector, ExerciseEvent, PoseFrame, Side, SideCounts } from './types';

/**
 * Drives one set of one exercise: setup → countdown → active → complete.
 *
 * Owns the bridge from detector output to ExerciseEvents. It never invents a
 * repetition: camera reps come only from `detector.repCompleted`, and manual
 * reps come only from an explicit player action and are tagged 'manual'.
 *
 * The ways a set can end are kept apart:
 *   - reaching the target completes it automatically ('setComplete');
 *   - `finish()` is the player choosing to stop early ("Finish set"): the
 *     verified work so far resolves as a partial set ('setEnded', 'finished');
 *   - `stop()` is the older "end this set" with no resolution beyond reps;
 *   - pausing, hesitating or losing tracking never ends a set by itself.
 *
 * Sided exercises (lunges, rows, curls) count each side separately; the
 * target is per side and both sides must reach it to complete.
 */
export type SessionStage = 'setup' | 'countdown' | 'active' | 'complete';

export interface SessionOptions {
  /** How long the start position must be held before the countdown. */
  readyHoldMs: number;
  countdownMs: number;
  /** Hold exercises emit a holdTick this often. */
  holdTickMs: number;
  /** Offer the manual fallback after this long stuck in setup... */
  setupStuckMs: number;
  /** ...or this long active without a counted rep... */
  activeStuckMs: number;
  /** ...or after this many tracking losses. */
  maxLosses: number;
}

export const SESSION_DEFAULTS: SessionOptions = {
  readyHoldMs: 700,
  countdownMs: 3000,
  holdTickMs: 5000,
  setupStuckMs: 12000,
  activeStuckMs: 15000,
  maxLosses: 3,
};

/**
 * Session timing used by the Motion Trial (both the local camera and the phone
 * controller). Floor exercises skip the 3-2-1 countdown and start counting
 * as soon as the start position is recognised, so nobody has to hold a plank
 * while waiting; the standing exercises keep the countdown.
 */
export function trialSessionOptions(exerciseId: string): Partial<SessionOptions> {
  const base = { setupStuckMs: 20000, activeStuckMs: 20000 };
  return FLOOR_EXERCISES.has(exerciseId) ? { ...base, countdownMs: 0, readyHoldMs: 250 } : base;
}

/** Floor movements and wall sits start the moment you're in position (nobody should hold a plank or a wall sit through a 3-2-1). */
const FLOOR_EXERCISES = new Set(['pushup', 'plank', 'mountain_climber', 'dead_bug', 'glute_bridge', 'russian_twist', 'side_plank', 'wall_sit']);

export interface SessionSnapshot {
  stage: SessionStage;
  count: number;
  target: number;
  /** Sided exercises: verified reps per side (the target applies to each). */
  sides?: SideCounts;
  cameraReps: number;
  manualReps: number;
  /** Hold exercises: seconds held this set. */
  heldMs: number;
  /** Split holds (side planks): camera-credited time per side, ms. */
  holdSides?: SideCounts;
  countdownLeftMs: number;
  paused: boolean;
  manualMode: boolean;
  fallbackAvailable: boolean;
  last: DetectorUpdate | null;
}

export class ExerciseSessionController {
  private stage: SessionStage = 'setup';
  private stageStart: number | null = null;
  private readySince: number | null = null;
  private count = 0;
  private cameraReps = 0;
  private manualReps = 0;
  private heldMs = 0;
  private holdBaseline = 0;
  private manualHeldMs = 0;
  private cameraHeldMs = 0;
  private nextTickMs: number;
  private lastProgressAt: number | null = null;
  private losses = 0;
  private wasLost = false;
  private paused = false;
  private manualMode = false;
  private manualHoldRunning = false;
  private lastNow = 0;
  private last: DetectorUpdate | null = null;
  private cameraUnavailable = false;
  private readonly sideCounts: SideCounts = { left: 0, right: 0 };
  private readonly opts: SessionOptions;

  constructor(
    readonly exercise: ExerciseDefinition,
    private readonly detector: ExerciseDetector | null,
    readonly target: number,
    private readonly emit: (e: ExerciseEvent) => void,
    opts: Partial<SessionOptions> = {},
  ) {
    this.opts = { ...SESSION_DEFAULTS, ...opts };
    this.nextTickMs = this.opts.holdTickMs;
    if (!detector) this.cameraUnavailable = true;
    else if (exercise.kind === 'hold') detector.setHoldTarget?.(target * 1000);
  }

  /**
   * Hold time the detector banked before the set went active (while you
   * settled in) doesn't count. Split holds (side planks) are the exception:
   * the detector caps each side at half the target, so subtracting anything
   * would leave the set forever short; the few hundred ms before 'active'
   * were spent holding anyway.
   */
  private baselineOf(u: DetectorUpdate): number {
    return this.exercise.holdSplit ? 0 : (u.holdMs ?? 0);
  }

  get isHold(): boolean {
    return this.exercise.kind === 'hold';
  }

  get isSided(): boolean {
    return this.exercise.sided === true;
  }

  /** Camera failed or is denied: manual counting is the only option. */
  markCameraUnavailable(): void {
    this.cameraUnavailable = true;
  }

  update(frame: PoseFrame | null, now: number): SessionSnapshot {
    this.lastNow = now;
    if (this.stageStart === null) this.stageStart = now;
    if (this.stage === 'complete' || this.paused) return this.snapshot(now);

    if (this.manualMode) {
      if (this.isHold && this.manualHoldRunning) this.tickManualHold(now);
      return this.snapshot(now);
    }
    if (!this.detector) return this.snapshot(now);

    const u = this.detector.update(frame, now);
    this.last = u;
    if (u.tracking === 'lost' && !this.wasLost && this.stage !== 'setup') this.losses++;
    this.wasLost = u.tracking === 'lost';

    switch (this.stage) {
      case 'setup':
        if (u.ready && u.tracking === 'good') {
          if (this.readySince === null) this.readySince = now;
          if (now - this.readySince >= this.opts.readyHoldMs) {
            // No countdown (push-ups): counting starts the moment you're in position.
            if (this.opts.countdownMs > 0) this.setStage('countdown', now);
            else {
              this.setStage('active', now);
              this.holdBaseline = this.baselineOf(u);
              this.lastProgressAt = now;
            }
          }
        } else this.readySince = null;
        break;
      case 'countdown':
        // Keep feeding the detector so its state stays current, but nothing
        // done during the countdown counts.
        if (now - (this.stageStart ?? now) >= this.opts.countdownMs) {
          this.setStage('active', now);
          this.holdBaseline = this.baselineOf(u);
          this.lastProgressAt = now;
        }
        break;
      case 'active':
        if (this.isHold) {
          const held = Math.max(0, (u.holdMs ?? 0) - this.holdBaseline);
          if (held > this.cameraHeldMs) this.lastProgressAt = now;
          this.cameraHeldMs = held;
          this.heldMs = this.cameraHeldMs + this.manualHeldMs;
          this.emitHoldTicks('camera');
        } else if (u.repCompleted) {
          // A sided exercise's rep must say which side it was; otherwise it can't be credited.
          if (this.isSided && !u.repSide) break;
          this.count++;
          this.cameraReps++;
          this.lastProgressAt = now;
          if (u.repSide) this.sideCounts[u.repSide]++;
          this.emit({ type: 'rep', exerciseId: this.exercise.id, index: this.count, target: this.target, source: 'camera', ...(this.isSided && u.repSide ? { side: u.repSide } : {}) });
          this.checkRepComplete();
        }
        break;
    }
    return this.snapshot(now);
  }

  /** Player-initiated manual fallback. Reps from here on are tagged 'manual'. */
  enableManualMode(): void {
    this.manualMode = true;
    if (this.stage !== 'complete') this.stage = 'active';
  }

  /** A manual rep; sided exercises credit the side that is behind (or the one given). */
  manualRep(side?: Side): void {
    if (!this.manualMode || this.stage === 'complete' || this.isHold) return;
    this.count++;
    this.manualReps++;
    const s: Side | undefined = this.isSided ? (side ?? (this.sideCounts.left <= this.sideCounts.right ? 'left' : 'right')) : undefined;
    if (s) this.sideCounts[s]++;
    this.emit({ type: 'rep', exerciseId: this.exercise.id, index: this.count, target: this.target, source: 'manual', ...(s ? { side: s } : {}) });
    this.checkRepComplete();
  }

  /** Hold exercises in manual mode: a plain stopwatch the player starts/stops. */
  setManualHold(running: boolean): void {
    if (!this.manualMode || !this.isHold) return;
    if (running && !this.manualHoldRunning) this.manualTickFrom = this.lastNow;
    this.manualHoldRunning = running;
  }
  private manualTickFrom = 0;

  private tickManualHold(now: number): void {
    const dt = Math.min(Math.max(now - this.manualTickFrom, 0), 250);
    this.manualTickFrom = now;
    this.manualHeldMs += dt;
    this.heldMs = this.cameraHeldMs + this.manualHeldMs;
    this.emitHoldTicks('manual');
  }

  pause(): void {
    this.paused = true;
    this.detector?.reset();
    this.readySince = null;
  }

  resume(now: number): void {
    this.paused = false;
    // After a pause the player re-establishes position; progress is kept.
    if (this.stage !== 'complete' && !this.manualMode) this.setStage(this.stage === 'active' ? 'active' : 'setup', now);
    if (this.stage === 'active' && this.isHold && this.detector) this.holdBaseline = -this.cameraHeldMs;
    this.lastProgressAt = now;
  }

  /** Player ends the set early. Reps already done still count; no finisher. */
  stop(reason: 'stopped' | 'abandoned' = 'stopped'): void {
    if (this.stage === 'complete') return;
    this.stage = 'complete';
    const completed = this.isHold ? Math.floor(this.heldMs / 1000) : this.count;
    this.emit({ type: 'setEnded', exerciseId: this.exercise.id, completed, target: this.target, reason, ...(this.isSided ? { sides: { ...this.sideCounts } } : {}) });
  }

  /**
   * "Finish set": the player chooses to end the set now. The verified work so
   * far (reps, or whole seconds held) resolves as a partial set. Works while
   * paused too — it is always an explicit choice, never inferred.
   */
  finish(): void {
    if (this.stage === 'complete') return;
    this.paused = false;
    this.stage = 'complete';
    const completed = this.isHold ? Math.floor(this.heldMs / 1000) : this.count;
    this.emit({ type: 'setEnded', exerciseId: this.exercise.id, completed, target: this.target, reason: 'finished', ...(this.isSided ? { sides: { ...this.sideCounts } } : {}) });
  }

  private emitHoldTicks(source: 'camera' | 'manual'): void {
    const targetMs = this.target * 1000;
    while (this.heldMs >= this.nextTickMs && this.nextTickMs < targetMs) {
      this.emit({ type: 'holdTick', exerciseId: this.exercise.id, heldMs: this.nextTickMs, targetMs, source });
      this.nextTickMs += this.opts.holdTickMs;
    }
    if (this.heldMs >= targetMs) {
      this.stage = 'complete';
      const verification = this.manualHeldMs === 0 ? 'camera' : this.cameraHeldMs === 0 ? 'manual' : 'mixed';
      this.emit({ type: 'setComplete', exerciseId: this.exercise.id, verification, completed: this.target, target: this.target });
    }
  }

  private checkRepComplete(): void {
    if (this.isSided ? Math.min(this.sideCounts.left, this.sideCounts.right) < this.target : this.count < this.target) return;
    this.stage = 'complete';
    const verification = this.manualReps === 0 ? 'camera' : this.cameraReps === 0 ? 'manual' : 'mixed';
    this.emit({ type: 'setComplete', exerciseId: this.exercise.id, verification, completed: this.count, target: this.target, ...(this.isSided ? { sides: { ...this.sideCounts } } : {}) });
  }

  private setStage(s: SessionStage, now: number): void {
    this.stage = s;
    this.stageStart = now;
    this.readySince = null;
  }

  private snapshot(now: number): SessionSnapshot {
    const since = now - (this.stageStart ?? now);
    let fallback = this.cameraUnavailable || this.losses >= this.opts.maxLosses;
    if (this.stage === 'setup' && since >= this.opts.setupStuckMs) fallback = true;
    if (this.stage === 'active' && this.lastProgressAt !== null && now - this.lastProgressAt >= this.opts.activeStuckMs) fallback = true;
    return {
      stage: this.stage,
      count: this.count,
      target: this.target,
      ...(this.isSided ? { sides: { ...this.sideCounts } } : {}),
      cameraReps: this.cameraReps,
      manualReps: this.manualReps,
      heldMs: this.heldMs,
      ...(this.exercise.holdSplit && this.last?.holdSides ? { holdSides: { ...this.last.holdSides } } : {}),
      countdownLeftMs: this.stage === 'countdown' ? Math.max(0, this.opts.countdownMs - since) : 0,
      paused: this.paused,
      manualMode: this.manualMode,
      fallbackAvailable: fallback && !this.manualMode,
      last: this.last,
    };
  }
}
