import type { SessionStage } from './session';
import type { DetectorUpdate, DiagBlocker, DiagEvent } from './types';

/**
 * Collects *why* reps didn't count during one set, from the detector's
 * per-frame `diag`, for the post-set "camera notes" and live hints.
 *
 * Numbers only: nothing here keeps frames, images or landmarks. It stays on
 * the device that runs the detector (the phone in Connected Play, which sends
 * the short summary to the TV).
 */
export const BLOCKER_TEXT: Record<DiagBlocker, string> = {
  NO_BODY: 'No one in view',
  BODY_HIDDEN: 'Shoulder or hip not visible to the camera',
  ARMS_HIDDEN: 'Elbow or wrist landmarks not visible',
  NOT_LEVEL: 'Body not level — not in push-up position',
  NOT_SIDEWAYS: 'Not side-on to the camera',
  HIPS_PIKED: 'Hips raised too high',
  ARMS_NOT_STRAIGHT: 'Starting pose not detected — arms not straight at the top',
};

export const EVENT_TEXT: Record<DiagEvent, string> = {
  'partial-depth': 'Lowering depth not reached',
  'no-return': 'Return to starting position not detected',
  'too-fast': 'Too fast to count',
  'lost-mid-rep': 'Tracking lost mid-rep (could not be assessed)',
  'reset-mid-rep': 'Left the push-up position mid-rep (could not be assessed)',
};

/** Incomplete reps the camera saw vs. attempts it could not assess. */
export const INCOMPLETE: readonly DiagEvent[] = ['partial-depth', 'no-return', 'too-fast'];
export const UNASSESSED: readonly DiagEvent[] = ['lost-mid-rep', 'reset-mid-rep'];

export interface DiagSummary {
  /** Set started (countdown reached)? If not, `startBlocker` says why. */
  started: boolean;
  /** The main reason the set couldn't begin, if it spent a while in setup. */
  startBlocker: DiagBlocker | null;
  /** Milliseconds per blocker while the detector was blocked. */
  blockedMs: Partial<Record<DiagBlocker, number>>;
  events: Partial<Record<DiagEvent, number>>;
  counted: number;
}

export class SetDiagnostics {
  private blockedMs: Partial<Record<DiagBlocker, number>> = {};
  private setupMs: Partial<Record<DiagBlocker, number>> = {};
  private events: Partial<Record<DiagEvent, number>> = {};
  private counted = 0;
  private started = false;
  private last: number | null = null;

  feed(u: DetectorUpdate | null, stage: SessionStage, now: number): void {
    const dt = this.last === null ? 0 : Math.max(0, Math.min(250, now - this.last));
    this.last = now;
    if (!u) return;
    if (stage === 'countdown' || stage === 'active') this.started = true;
    if (u.repCompleted && stage === 'active') this.counted++;
    const d = u.diag;
    if (!d) return;
    if (d.blocker) {
      this.blockedMs[d.blocker] = (this.blockedMs[d.blocker] ?? 0) + dt;
      if (stage === 'setup') this.setupMs[d.blocker] = (this.setupMs[d.blocker] ?? 0) + dt;
    }
    // Only attempts made while the set is live count as "not counted".
    if (d.event && stage === 'active') this.events[d.event] = (this.events[d.event] ?? 0) + 1;
  }

  summary(): DiagSummary {
    let startBlocker: DiagBlocker | null = null;
    let most = 3000; // only worth mentioning after a few seconds stuck
    for (const [k, v] of Object.entries(this.setupMs) as [DiagBlocker, number][]) {
      if (v > most) {
        most = v;
        startBlocker = k;
      }
    }
    return { started: this.started, startBlocker, blockedMs: { ...this.blockedMs }, events: { ...this.events }, counted: this.counted };
  }
}

/** Plain-language lines for the TV and phone, most important first. */
export function diagLines(s: DiagSummary): string[] {
  const out: string[] = [];
  if (s.startBlocker) out.push(`${BLOCKER_TEXT[s.startBlocker]}${s.started ? ' (for a while before the set began)' : ''}`);
  const inc = INCOMPLETE.map((e) => [e, s.events[e] ?? 0] as const).filter(([, n]) => n > 0);
  const un = UNASSESSED.map((e) => [e, s.events[e] ?? 0] as const).filter(([, n]) => n > 0);
  for (const [e, n] of inc) out.push(`${n}× ${EVENT_TEXT[e]}`);
  for (const [e, n] of un) out.push(`${n}× ${EVENT_TEXT[e]}`);
  // A blocker that dominated the live set (not already reported).
  const live = (Object.entries(s.blockedMs) as [DiagBlocker, number][]).filter(([k, v]) => k !== s.startBlocker && v > 4000).sort((a, b) => b[1] - a[1]);
  if (live[0]) out.push(`${BLOCKER_TEXT[live[0][0]]} for ${Math.round(live[0][1] / 1000)} s`);
  return out;
}
