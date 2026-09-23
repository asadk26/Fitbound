import type { ExerciseDefinition } from '../exercise/registry';
import type { SessionSnapshot, SessionStage } from '../exercise/session';
import type { DetectorUpdate, ExerciseEvent } from '../exercise/types';
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
  enableManualMode(): void;
  manualRep(): void;
}

/** Faster than this between camera reps is not a real rep. */
export const MIN_REP_GAP_MS = 300;

export class RemoteSet implements SetDriver {
  private count = 0;
  private cameraReps = 0;
  private manualReps = 0;
  private lastIndex = 0;
  private lastRepAt = -Infinity;
  private paused = false;
  private manualMode = false;
  private done = false;
  private phone: Extract<CtrlMsg, { type: 'EXERCISE_STATUS' }> | null = null;

  constructor(
    readonly setId: string,
    readonly exercise: ExerciseDefinition,
    readonly target: number,
    private readonly emit: (e: ExerciseEvent) => void,
    private readonly send: (m: GameMsg) => void,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
  ) {
    send({ type: 'EXERCISE_BEGIN', setId, exerciseId: exercise.id, difficulty });
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

  rep(msg: Extract<CtrlMsg, { type: 'EXERCISE_REP' }>, now: number): RepVerdict {
    if (msg.setId !== this.setId) return 'wrong-set';
    if (msg.exerciseId !== this.exercise.id) return 'wrong-exercise';
    if (msg.index <= this.lastIndex) return 'duplicate';
    if (this.done) return 'complete';
    if (this.paused) return 'paused';
    if (msg.source === 'manual' && !this.manualMode) return 'manual-off';
    if (msg.source === 'camera') {
      if (this.phone?.stage !== 'active') return 'not-active';
      if (now - this.lastRepAt < MIN_REP_GAP_MS) return 'too-fast';
      this.lastRepAt = now;
    }
    this.lastIndex = msg.index;
    this.count++;
    if (msg.source === 'camera') this.cameraReps++;
    else this.manualReps++;
    this.emit({ type: 'rep', exerciseId: this.exercise.id, index: this.count, target: this.target, source: msg.source });
    this.checkComplete();
    this.progress();
    return 'accepted';
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
  manualRep(): void {
    if (!this.manualMode || this.done || this.paused) return;
    this.count++;
    this.manualReps++;
    this.emit({ type: 'rep', exerciseId: this.exercise.id, index: this.count, target: this.target, source: 'manual' });
    this.checkComplete();
    this.progress();
  }

  pause(): void {
    if (this.paused || this.done) return;
    this.paused = true;
    this.send({ type: 'EXERCISE_CONTROL', setId: this.setId, action: 'pause' });
    this.progress();
  }

  resume(_now: number): void {
    if (!this.paused || this.done) return;
    this.paused = false;
    this.send({ type: 'EXERCISE_CONTROL', setId: this.setId, action: 'resume' });
    this.progress();
  }

  stop(reason: 'stopped' | 'abandoned' = 'stopped'): void {
    if (this.done) return;
    this.done = true;
    this.emit({ type: 'setEnded', exerciseId: this.exercise.id, completed: this.count, target: this.target, reason });
    this.end();
  }

  /** Tell the phone the set is over (idempotent). */
  end(): void {
    this.send({ type: 'EXERCISE_END', setId: this.setId });
  }

  private checkComplete(): void {
    if (this.count < this.target) return;
    this.done = true;
    const verification = this.manualReps === 0 ? 'camera' : this.cameraReps === 0 ? 'manual' : 'mixed';
    this.emit({ type: 'setComplete', exerciseId: this.exercise.id, verification, completed: this.count, target: this.target });
    this.end();
  }

  private progress(): void {
    this.send({ type: 'EXERCISE_PROGRESS', setId: this.setId, count: this.count, target: this.target, manualMode: this.manualMode, paused: this.paused });
  }

  snapshot(): SessionSnapshot {
    const p = this.phone;
    const stage: SessionStage = this.done ? 'complete' : this.manualMode ? 'active' : (p?.stage === 'complete' ? 'active' : (p?.stage ?? 'setup'));
    const last: DetectorUpdate | null = p ? { phase: '', tracking: p.tracking, confidence: p.confidence, guidance: p.guidance, ready: p.ready, repCompleted: false, progress: 0 } : null;
    return {
      stage,
      count: this.count,
      target: this.target,
      cameraReps: this.cameraReps,
      manualReps: this.manualReps,
      heldMs: 0,
      countdownLeftMs: stage === 'countdown' ? (p?.countdownLeftMs ?? 0) : 0,
      paused: this.paused,
      manualMode: this.manualMode,
      fallbackAvailable: !!p?.fallbackAvailable && !this.manualMode,
      last,
    };
  }
}
