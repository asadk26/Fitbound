import type { ExerciseDefinition } from '../exercise/registry';
import type { SessionSnapshot, SessionStage } from '../exercise/session';
import type { DiagSummary } from '../exercise/diagnostics';
import type { DetectorUpdate, ExerciseEvent, Side, SideCounts } from '../exercise/types';
import type { CtrlMsg, GameMsg } from './protocol';

/**
 * One exercise set in Connected Play, as the PC sees it.
 *
 * The phone runs the detector and reports each rep it counts; this class is
 * the authority on what those reps are worth. A rep is accepted only if it
 * belongs to this set and this exercise, is newer than every rep already
 * accepted (duplicates and resends are ignored), arrives while the set is
 * live (not paused, not finished), and — for camera reps — isn't faster than
 * a human can move. Manual reps count only after manual counting was
 * switched on, and stay labelled manual.
 *
 * The accepted reps become the same ExerciseEvents a local set produces, so
 * the combat engine and progression don't know or care where they came from.
 */
export type RepVerdict = 'accepted' | 'wrong-set' | 'wrong-exercise' | 'duplicate' | 'paused' | 'not-active' | 'complete' | 'too-fast' | 'manual-off';

export interface SetDriver {
  pause(): void;
  resume(now: number): void;
  stop(reason?: 'stopped' | 'abandoned'): void;
  /** "Finish set": resolve the verified work so far as a partial set. */
  finish(): void;
  enableManualMode(): void;
  manualRep(side?: Side): void;
}

/** Hold time may run at most this much ahead of the wall clock between reports. */
export const HOLD_SLACK_MS = 400;
export const HOLD_TICK_MS = 5000;

/** Faster than this between camera reps is not a real rep. */
export const MIN_REP_GAP_MS = 300;

export class RemoteSet implements SetDriver {
  private count = 0;
  private cameraReps = 0;
  private manualReps = 0;
  private lastIndex = 0;
  private paused = false;
  private manualMode = false;
  private done = false;
  private phone: Extract<CtrlMsg, { type: 'EXERCISE_STATUS' }> | null = null;
  private readonly sideCounts: SideCounts = { left: 0, right: 0 };
  /** Hold exercises: accepted hold time, and when it was last reported. */
  private heldMs = 0;
  private heldAt: number | null = null;
  private nextTick = HOLD_TICK_MS;
  /** Why reps did or didn't count, as measured on the phone. */
  diagnostics: DiagSummary | null = null;

  constructor(
    readonly setId: string,
    readonly exercise: ExerciseDefinition,
    readonly target: number,
    private readonly emit: (e: ExerciseEvent) => void,
    private readonly send: (m: GameMsg) => void,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
  ) {
    // Holds that split their target by side (side planks) need it on the phone, where the sides are told apart.
    send({ type: 'EXERCISE_BEGIN', setId, exerciseId: exercise.id, difficulty, ...(exercise.holdSplit ? { holdTargetMs: target * 1000 } : {}) });
    this.progress();
  }

  get complete(): boolean {
    return this.done;
  }

  /** The phone's view of the set (stage, countdown, tracking, coaching). */
  status(msg: Extract<CtrlMsg, { type: 'EXERCISE_STATUS' }>): boolean {
    if (msg.setId !== this.setId) return false;
    this.phone = msg;
    return true;
  }

  diag(msg: Extract<CtrlMsg, { type: 'EXERCISE_DIAG' }>): boolean {
    if (msg.setId !== this.setId) return false;
    this.diagnostics = msg.summary;
    return true;
  }

  /** 0..1 progress of the phone's mid-set pause gesture (for the TV ring). */
  get pauseProgress(): number {
    return this.phone?.pauseProgress ?? 0;
  }

  rep(msg: Extract<CtrlMsg, { type: 'EXERCISE_REP' }>, now: number): RepVerdict {
    if (msg.setId !== this.setId) return 'wrong-set';
    if (msg.exerciseId !== this.exercise.id) return 'wrong-exercise';
    if (msg.index <= this.lastIndex) return 'duplicate';
    if (this.done) return 'complete';
    if (this.paused) return 'paused';
    if (msg.source === 'manual' && !this.manualMode) return 'manual-off';
    if (this.exercise.kind === 'hold') return 'wrong-exercise';
    if (this.exercise.sided && !msg.side) return 'wrong-exercise';
    if (msg.source === 'camera') {
      if (this.phone?.stage !== 'active') return 'not-active';
      // Two arms can finish a rep together (curls), so a sided exercise allows
      // one rep per side within the gap.
      const gapKey = this.exercise.sided ? msg.side! : 'all';
      const last = this.lastRepBy[gapKey] ?? -Infinity;
      if (now - last < MIN_REP_GAP_MS) return 'too-fast';
      this.lastRepBy[gapKey] = now;
    }
    this.lastIndex = msg.index;
    this.count++;
    if (msg.source === 'camera') this.cameraReps++;
    else this.manualReps++;
    const side = this.exercise.sided ? msg.side : undefined;
    if (side) this.sideCounts[side]++;
    this.emit({ type: 'rep', exerciseId: this.exercise.id, index: this.count, target: this.target, source: msg.source, ...(side ? { side } : {}) });
    this.checkComplete();
    this.progress();
    return 'accepted';
  }

  private lastRepBy: Record<string, number> = {};

  /**
   * Hold exercises: the phone's running total. Accepted only while the set is
   * live and only as fast as real time passes (plus a little network slack),
   * so a burst of messages can't bank time.
   */
  hold(msg: Extract<CtrlMsg, { type: 'EXERCISE_HOLD' }>, now: number): boolean {
    if (msg.setId !== this.setId || this.exercise.kind !== 'hold' || this.done || this.paused || this.manualMode) return false;
    if (this.phone?.stage !== 'active' && this.phone?.stage !== 'complete') {
      this.heldAt = now;
      return false;
    }
    const gain = msg.heldMs - this.heldMs;
    if (gain <= 0) return false;
    const allowed = this.heldAt === null ? HOLD_SLACK_MS : now - this.heldAt + HOLD_SLACK_MS;
    this.heldMs += Math.min(gain, allowed);
    this.heldAt = now;
    const targetMs = this.target * 1000;
    while (this.heldMs >= this.nextTick && this.nextTick < targetMs) {
      this.emit({ type: 'holdTick', exerciseId: this.exercise.id, heldMs: this.nextTick, targetMs, source: 'camera' });
      this.nextTick += HOLD_TICK_MS;
    }
    if (this.heldMs >= targetMs) {
      this.done = true;
      this.emit({ type: 'setComplete', exerciseId: this.exercise.id, verification: 'camera', completed: this.target, target: this.target });
      this.end();
    }
    this.progress();
    return true;
  }

  /** The phone's Finish button. */
  requestFinish(msg: Extract<CtrlMsg, { type: 'FINISH_SET' }>): boolean {
    if (msg.setId !== this.setId || this.done) return false;
    this.finish();
    return true;
  }

  finish(): void {
    if (this.done) return;
    this.done = true;
    this.paused = false;
    const completed = this.exercise.kind === 'hold' ? Math.floor(this.heldMs / 1000) : this.count;
    this.emit({ type: 'setEnded', exerciseId: this.exercise.id, completed, target: this.target, reason: 'finished', ...(this.exercise.sided ? { sides: { ...this.sideCounts } } : {}) });
    this.end();
  }

  /** The phone asked for manual counting (its player tapped the fallback). */
  requestManual(msg: Extract<CtrlMsg, { type: 'MANUAL_MODE' }>): boolean {
    if (msg.setId !== this.setId || this.done) return false;
    this.enableManualMode();
    return true;
  }

  enableManualMode(): void {
    if (this.manualMode || this.done) return;
    this.manualMode = true;
    this.send({ type: 'EXERCISE_CONTROL', setId: this.setId, action: 'manual' });
    this.progress();
  }

  /** A manual rep entered on the PC itself. */
  manualRep(side?: Side): void {
    if (!this.manualMode || this.done || this.paused || this.exercise.kind === 'hold') return;
    this.count++;
    this.manualReps++;
    const s: Side | undefined = this.exercise.sided ? (side ?? (this.sideCounts.left <= this.sideCounts.right ? 'left' : 'right')) : undefined;
    if (s) this.sideCounts[s]++;
    this.emit({ type: 'rep', exerciseId: this.exercise.id, index: this.count, target: this.target, source: 'manual', ...(s ? { side: s } : {}) });
    this.checkComplete();
    this.progress();
  }

  pause(): void {
    if (this.paused || this.done) return;
    this.paused = true;
    this.send({ type: 'EXERCISE_CONTROL', setId: this.setId, action: 'pause' });
    this.progress();
  }

  resume(now: number): void {
    if (!this.paused || this.done) return;
    this.paused = false;
    // Time spent paused never counts toward a hold.
    this.heldAt = now;
    this.send({ type: 'EXERCISE_CONTROL', setId: this.setId, action: 'resume' });
    this.progress();
  }

  stop(reason: 'stopped' | 'abandoned' = 'stopped'): void {
    if (this.done) return;
    this.done = true;
    const completed = this.exercise.kind === 'hold' ? Math.floor(this.heldMs / 1000) : this.count;
    this.emit({ type: 'setEnded', exerciseId: this.exercise.id, completed, target: this.target, reason, ...(this.exercise.sided ? { sides: { ...this.sideCounts } } : {}) });
    this.end();
  }

  /** Tell the phone the set is over (idempotent). */
  end(): void {
    this.send({ type: 'EXERCISE_END', setId: this.setId });
  }

  private checkComplete(): void {
    if (this.exercise.sided ? Math.min(this.sideCounts.left, this.sideCounts.right) < this.target : this.count < this.target) return;
    this.done = true;
    const verification = this.manualReps === 0 ? 'camera' : this.cameraReps === 0 ? 'manual' : 'mixed';
    this.emit({ type: 'setComplete', exerciseId: this.exercise.id, verification, completed: this.count, target: this.target, ...(this.exercise.sided ? { sides: { ...this.sideCounts } } : {}) });
    this.end();
  }

  private progress(): void {
    this.send({ type: 'EXERCISE_PROGRESS', setId: this.setId, count: this.count, target: this.target, manualMode: this.manualMode, paused: this.paused });
  }

  snapshot(): SessionSnapshot {
    const p = this.phone;
    const stage: SessionStage = this.done ? 'complete' : this.manualMode ? 'active' : (p?.stage === 'complete' ? 'active' : (p?.stage ?? 'setup'));
    const last: DetectorUpdate | null = p
      ? { phase: '', tracking: p.tracking, confidence: p.confidence, guidance: p.guidance, ready: p.ready, repCompleted: false, progress: 0, diag: { blocker: p.blocker ?? null, waiting: null } }
      : null;
    return {
      stage,
      count: this.count,
      target: this.target,
      ...(this.exercise.sided ? { sides: { ...this.sideCounts } } : {}),
      cameraReps: this.cameraReps,
      manualReps: this.manualReps,
      heldMs: this.heldMs,
      countdownLeftMs: stage === 'countdown' ? (p?.countdownLeftMs ?? 0) : 0,
      paused: this.paused,
      manualMode: this.manualMode,
      fallbackAvailable: !!p?.fallbackAvailable && !this.manualMode,
      last,
    };
  }
}
