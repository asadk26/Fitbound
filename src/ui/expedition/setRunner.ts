import { levelFrame } from '../../exercise/level';
import type { ExerciseDefinition } from '../../exercise/registry';
import { ExerciseSessionController, trialSessionOptions, type SessionSnapshot } from '../../exercise/session';
import type { Difficulty, ExerciseEvent, SideCounts } from '../../exercise/types';
import { input } from '../../input/InputHub';
import { host } from '../../net/host';
import { RemoteSet, type SetDriver } from '../../net/remoteSet';
import { tracker } from '../../pose/PoseTracker';

/**
 * Runs one exercise set, counted either by the phone (Connected Play: the PC
 * validates each rep in RemoteSet) or by this device's camera. Collects what
 * the workout log needs — verified reps by source and side, hold time, and
 * time actually spent in the active set — and reports once when the set ends.
 */
export interface SetResult {
  exerciseId: string;
  target: number;
  /** Reps (total) or whole seconds held. */
  done: number;
  sides?: SideCounts;
  full: boolean;
  /** Ended by the player's "Finish set" (or 'stopped' from older flows). */
  ending: 'complete' | 'finished' | 'stopped';
  camera: number;
  manual: number;
  holdMs: number;
  activeMs: number;
}

export interface SetRunnerOptions {
  connected: boolean;
  difficulty: Difficulty;
  onEvent?: (e: ExerciseEvent) => void;
  onSnap?: (s: SessionSnapshot) => void;
  onEnd: (r: SetResult) => void;
}

export class SetRunner {
  private driver: SetDriver | null = null;
  private local: ExerciseSessionController | null = null;
  private remote: RemoteSet | null = null;
  private off: (() => void) | null = null;
  private poll: number | null = null;
  private counts = { camera: 0, manual: 0, left: 0, right: 0 };
  private activeMs = 0;
  private lastTick: number | null = null;
  private snap: SessionSnapshot | null = null;
  private ex: ExerciseDefinition | null = null;
  private target = 0;
  private ended = false;

  constructor(private readonly opts: SetRunnerOptions) {}

  get snapshot(): SessionSnapshot | null {
    return this.snap;
  }

  get running(): boolean {
    return !!this.driver && !this.ended;
  }

  begin(ex: ExerciseDefinition, target: number): void {
    this.dispose();
    this.ex = ex;
    this.target = target;
    this.ended = false;
    this.counts = { camera: 0, manual: 0, left: 0, right: 0 };
    this.activeMs = 0;
    this.lastTick = null;
    input.setExercise(ex.id);
    const emit = (e: ExerciseEvent) => this.onEvent(e);
    if (this.opts.connected) {
      const setId = `${ex.id.slice(0, 14)}-${Date.now().toString(36)}`;
      const rs = new RemoteSet(setId, ex, target, emit, (m) => host.send(m), this.opts.difficulty);
      host.activeSet = rs;
      this.remote = rs;
      this.driver = rs;
    } else {
      const c = new ExerciseSessionController(ex, ex.createDetector!(this.opts.difficulty), target, emit, trialSessionOptions(ex.id));
      this.local = c;
      this.driver = c;
      this.off = tracker.subscribe((f) => {
        if (this.ended) return;
        const sn = c.update(levelFrame(f.frame, input.reader.neutral?.rollDeg), f.now);
        this.tick(sn, f.now);
      });
    }
    // Remote sets move by message; local ones by frame. Both refresh the view here.
    this.poll = window.setInterval(() => {
      if (this.ended) return;
      const sn = this.remote ? this.remote.snapshot() : this.local ? this.snap : null;
      if (sn) this.tick(sn, performance.now());
    }, 100);
  }

  private tick(sn: SessionSnapshot, now: number): void {
    if (this.lastTick !== null && sn.stage === 'active' && !sn.paused) this.activeMs += Math.min(250, now - this.lastTick);
    this.lastTick = now;
    this.snap = sn;
    this.opts.onSnap?.(sn);
  }

  private onEvent(e: ExerciseEvent): void {
    this.opts.onEvent?.(e);
    if (e.type === 'rep') {
      this.counts[e.source]++;
      if (e.side) this.counts[e.side]++;
    }
    if (e.type === 'setComplete' || e.type === 'setEnded') {
      if (this.ended) return;
      this.ended = true;
      const ex = this.ex!;
      const sn = this.remote ? this.remote.snapshot() : this.snap;
      const holdMs = ex.kind === 'hold' ? (e.type === 'setComplete' ? e.target * 1000 : Math.max(sn?.heldMs ?? 0, e.completed * 1000)) : 0;
      const sides = e.sides;
      const result: SetResult = {
        exerciseId: ex.id,
        target: this.target,
        done: e.completed,
        ...(sides ? { sides } : {}),
        full: e.type === 'setComplete',
        ending: e.type === 'setComplete' ? 'complete' : e.reason === 'finished' ? 'finished' : 'stopped',
        camera: ex.kind === 'hold' ? 0 : this.counts.camera,
        manual: this.counts.manual,
        holdMs,
        activeMs: Math.round(this.activeMs),
      };
      // Let the event finish propagating before tearing the set down.
      queueMicrotask(() => {
        this.cleanup();
        this.opts.onEnd(result);
      });
    }
  }

  pause(): void {
    this.driver?.pause();
  }

  resume(): void {
    this.driver?.resume(performance.now());
  }

  /** "Finish set": resolve what's been verified so far. */
  finish(): void {
    if (!this.ended) this.driver?.finish();
  }

  enableManual(): void {
    this.driver?.enableManualMode();
  }

  manualRep(): void {
    this.driver?.manualRep();
  }

  private cleanup(): void {
    this.off?.();
    this.off = null;
    if (this.poll !== null) clearInterval(this.poll);
    this.poll = null;
    if (this.remote && host.activeSet === this.remote) host.activeSet = null;
    this.remote = null;
    this.local = null;
    this.driver = null;
    input.setExercise(null);
  }

  /** Abandon without resolving (leaving the screen). */
  dispose(): void {
    if (this.remote && !this.ended) this.remote.end();
    this.ended = true;
    this.cleanup();
  }
}
