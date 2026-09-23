import type { DetectorUpdate, GuidanceCode, TrackingQuality } from './types';

/**
 * Debounces tracking loss. A few bad frames (motion blur mid-jump, a hand
 * passing in front of the lens) are tolerated: the state machine simply holds
 * still. Only after `graceMs` of continuous bad tracking does the gate report
 * 'lost', at which point detectors discard any half-finished repetition.
 */
export class TrackingGate {
  private badSince: number | null = null;
  private everTracked = false;

  constructor(private readonly graceMs: number) {}

  check(ok: boolean, now: number): 'ok' | 'grace' | 'lost' {
    if (ok) {
      this.badSince = null;
      this.everTracked = true;
      return 'ok';
    }
    if (this.badSince === null) this.badSince = now;
    return now - this.badSince > this.graceMs ? 'lost' : 'grace';
  }

  /** Whether we had a body at some point, so a loss is "lost" not "never found". */
  get hadTracking(): boolean {
    return this.everTracked;
  }

  reset(): void {
    this.badSince = null;
    this.everTracked = false;
  }
}

/** Build the update returned while tracking is bad. Never awards a rep. */
export function untrackedUpdate(
  phase: string,
  gate: 'grace' | 'lost',
  hadTracking: boolean,
  hasFrame: boolean,
  confidence: number,
  guidance: GuidanceCode | null,
): DetectorUpdate {
  const tracking: TrackingQuality = gate === 'lost' ? 'lost' : 'partial';
  let g = guidance;
  if (!hasFrame) g = hadTracking ? 'TRACKING_LOST' : 'NO_BODY';
  else if (!g) g = 'REPOSITION';
  return {
    phase,
    tracking,
    confidence,
    guidance: g,
    ready: false,
    repCompleted: false,
    progress: 0,
  };
}

/** Counts consecutive frames a condition has held, for "stable pose" checks. */
export class StableCounter {
  private n = 0;
  constructor(private readonly needed: number) {}
  push(cond: boolean): boolean {
    this.n = cond ? this.n + 1 : 0;
    return this.n >= this.needed;
  }
  reset(): void {
    this.n = 0;
  }
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
