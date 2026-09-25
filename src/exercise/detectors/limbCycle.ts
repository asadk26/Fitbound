import { clamp01, StableCounter, TrackingGate, untrackedUpdate } from '../tracking';
import type { DetectorUpdate, ExerciseDetector, ExerciseKind, GuidanceCode, PoseFrame, Side } from '../types';

/**
 * Shared machinery for detectors that count a limb moving out and back —
 * curls, rows, lunges, knee drives, dead-bug leg extensions.
 *
 * Each detector reads one or more *cycles* from a frame (one per arm or leg,
 * usually): a number that starts in a rest zone, travels past a peak and
 * comes back. A repetition is one full rest → peak → rest cycle. Leaving rest
 * and coming back without reaching the peak is a partial rep, reported but
 * never counted. A cycle only counts once it has been seen at rest, so a
 * limb that is already mid-movement when tracking starts can't count.
 *
 * Tracking and position problems go through the same grace period as the
 * older detectors: a few bad frames are tolerated (the cycles simply hold),
 * a sustained loss resets every cycle so a half-done rep is discarded.
 */
export interface CycleSpec {
  key: string;
  /** Counted as this side (sided exercises), or just for display. */
  side?: Side;
  /** 'up': the value rises from ≤ rest to ≥ peak. 'down': falls from ≥ rest to ≤ peak. */
  dir: 'up' | 'down';
  rest: number;
  peak: number;
}

export interface LimbReading {
  confidence: number;
  /** A visibility or position problem; while set, nothing moves and the grace timer runs. */
  issue: GuidanceCode | null;
  /** Current value of each cycle (null = that limb isn't readable this frame). */
  values: Record<string, number | null>;
  /** The start position is held (for the "ready" check before counting). */
  startReady: boolean;
  metrics?: Record<string, number>;
}

export interface LimbCycleConfig {
  minConfidence: number;
  lostGraceMs: number;
  readyFrames: number;
  /** Minimum rest → rest time for one rep. */
  minRepMs: number;
}

type CycleState = 'unarmed' | 'rest' | 'moving' | 'peak';

interface Cycle {
  spec: CycleSpec;
  state: CycleState;
  startedAt: number;
  lastRepAt: number;
}

export abstract class LimbCycleDetector implements ExerciseDetector {
  readonly kind: ExerciseKind = 'reps';
  private phase: 'SETUP' | 'ACTIVE' = 'SETUP';
  private readonly gate: TrackingGate;
  private readonly ready: StableCounter;
  private cycles: Cycle[];
  /** Two limbs finishing on the same frame are reported on consecutive updates. */
  private pending: (Side | undefined)[] = [];
  private cue: { code: GuidanceCode; until: number } | null = null;

  constructor(
    readonly exerciseId: string,
    protected readonly base: LimbCycleConfig,
    specs: CycleSpec[],
  ) {
    this.gate = new TrackingGate(base.lostGraceMs);
    this.ready = new StableCounter(base.readyFrames);
    this.cycles = specs.map((spec) => ({ spec, state: 'unarmed', startedAt: 0, lastRepAt: -Infinity }));
  }

  /** Measure the frame. */
  protected abstract read(frame: PoseFrame, now: number): LimbReading;

  /** The setup cue shown before the start position is found. */
  protected abstract setupCue: GuidanceCode;

  /** Called when a cycle leaves rest (a rep attempt begins). */
  protected onStart(_key: string, _now: number): void {}

  /** Called once per frame while a cycle is mid-rep. */
  protected onMidRep(_key: string, _now: number): void {}

  /** Called when a cycle completes: return a cue to reject the rep, or null to count it. */
  protected validate(_key: string, _now: number): GuidanceCode | null {
    return null;
  }

  reset(): void {
    this.phase = 'SETUP';
    this.gate.reset();
    this.ready.reset();
    this.pending = [];
    this.cue = null;
    for (const c of this.cycles) {
      c.state = 'unarmed';
      c.lastRepAt = -Infinity;
    }
  }

  update(frame: PoseFrame | null, now: number): DetectorUpdate {
    const r = frame ? this.read(frame, now) : null;
    const ok = !!r && r.confidence >= this.base.minConfidence && r.issue === null;
    const g = this.gate.check(ok, now);
    if (g !== 'ok' || !r) {
      if (g === 'lost') {
        this.phase = 'SETUP';
        this.ready.reset();
        for (const c of this.cycles) c.state = 'unarmed';
      }
      const u = untrackedUpdate(this.phase, g === 'ok' ? 'grace' : g, this.gate.hadTracking, frame !== null, r?.confidence ?? 0, r?.issue ?? null);
      return this.flushPending(u);
    }

    let partialRep = false;
    if (this.phase === 'SETUP') {
      if (this.ready.push(r.startReady)) this.phase = 'ACTIVE';
    }
    if (this.phase === 'ACTIVE') {
      for (const c of this.cycles) {
        const v = r.values[c.spec.key];
        if (v === null || v === undefined) continue;
        const { dir, rest, peak } = c.spec;
        const atRest = dir === 'up' ? v <= rest : v >= rest;
        const atPeak = dir === 'up' ? v >= peak : v <= peak;
        switch (c.state) {
          case 'unarmed':
            if (atRest) c.state = 'rest';
            break;
          case 'rest':
            if (!atRest) {
              c.state = atPeak ? 'peak' : 'moving';
              c.startedAt = now;
              this.onStart(c.spec.key, now);
            }
            break;
          case 'moving':
            this.onMidRep(c.spec.key, now);
            if (atPeak) c.state = 'peak';
            else if (atRest) {
              c.state = 'rest';
              partialRep = true;
              this.cue = { code: this.shallowCue(), until: now + 1800 };
            }
            break;
          case 'peak':
            this.onMidRep(c.spec.key, now);
            if (atRest) {
              c.state = 'rest';
              const rejected = this.validate(c.spec.key, now);
              if (rejected) {
                partialRep = true;
                this.cue = { code: rejected, until: now + 2200 };
              } else if (now - c.startedAt >= this.base.minRepMs && now - c.lastRepAt >= this.base.minRepMs) {
                c.lastRepAt = now;
                this.pending.push(c.spec.side);
              }
            }
            break;
        }
      }
    }

    if (this.cue && now > this.cue.until) this.cue = null;
    const guidance: GuidanceCode | null = this.phase === 'SETUP' ? this.setupCue : (this.cue?.code ?? null);
    let progress = 0;
    for (const c of this.cycles) {
      const v = r.values[c.spec.key];
      if (v === null || v === undefined || c.state === 'unarmed') continue;
      const { rest, peak } = c.spec;
      progress = Math.max(progress, clamp01((v - rest) / (peak - rest)));
    }
    return this.flushPending({
      phase: this.phase === 'SETUP' ? 'SETUP' : this.cycles.map((c) => `${c.spec.key}:${c.state}`).join(' '),
      tracking: 'good',
      confidence: r.confidence,
      guidance,
      ready: this.phase === 'ACTIVE',
      repCompleted: false,
      partialRep,
      progress,
      metrics: r.metrics,
    });
  }

  /** What to say when a movement stops short of the peak. */
  protected shallowCue(): GuidanceCode {
    return 'GO_LOWER';
  }

  private flushPending(u: DetectorUpdate): DetectorUpdate {
    if (!this.pending.length) return u;
    const side = this.pending.shift();
    return { ...u, phase: 'COMPLETED_REPETITION', repCompleted: true, ...(side ? { repSide: side } : {}) };
  }
}
