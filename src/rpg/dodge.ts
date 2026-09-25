import { dist, LM, mid } from '../exercise/geometry';
import type { Landmark, PoseFrame, TrackingQuality } from '../exercise/types';
import type { Height } from './enemies';

/**
 * High/low dodging, read from a standing, front-facing player.
 *
 *   HIGH attack → duck (a quick squat: shoulders drop a third of a torso)
 *   LOW attack  → a small hop (both ankles and the hips lift off the floor)
 *
 * Everything is measured against a *baseline* taken while the player stands
 * still — and only once they have been still for a moment, so getting up off
 * the floor after push-ups is never mistaken for anything. Before the
 * baseline exists nothing counts as a dodge.
 */
export interface DodgeConfig {
  /** Shoulder drop (torso lengths) that counts as ducking. */
  duckAt: number;
  /** Ankle lift (torso lengths, both feet) that counts as a hop... */
  hopAnkles: number;
  /** ...with the hips rising at least this much too. */
  hopHips: number;
  /** Frames of stillness needed for the baseline. */
  baselineFrames: number;
  /** Max shoulder wobble (torso lengths) while taking the baseline. */
  stillness: number;
  lostGraceMs: number;
}

export const DODGE_DEFAULTS: DodgeConfig = { duckAt: 0.3, hopAnkles: 0.09, hopHips: 0.05, baselineFrames: 15, stillness: 0.04, lostGraceMs: 400 };

export interface DodgeReading {
  tracking: TrackingQuality;
  baseline: boolean;
  ducking: boolean;
  /** 0..1 how far into a duck (for the on-screen meter). */
  duck: number;
  /** Hops so far (increments once per hop). */
  hops: number;
  airborne: boolean;
}

interface Base {
  shoulderY: number;
  hipY: number;
  ankleY: number;
  torso: number;
}

const ok = (l: Landmark) => l.visibility >= 0.5;

export class DodgeReader {
  private base: Base | null = null;
  private samples: Base[] = [];
  private hops = 0;
  private airborne = false;
  private badSince: number | null = null;

  constructor(private readonly cfg: DodgeConfig = DODGE_DEFAULTS) {}

  /** Forget the baseline (e.g. a new enemy turn, or after a pause). */
  reset(): void {
    this.base = null;
    this.samples = [];
    this.airborne = false;
    this.badSince = null;
  }

  get hasBaseline(): boolean {
    return !!this.base;
  }

  update(frame: PoseFrame | null, now: number): DodgeReading {
    const m = frame ? this.measure(frame) : null;
    if (!m) {
      this.badSince ??= now;
      const lost = now - this.badSince > this.cfg.lostGraceMs;
      if (lost) this.samples = [];
      return { tracking: lost ? 'lost' : 'partial', baseline: !!this.base, ducking: false, duck: 0, hops: this.hops, airborne: false };
    }
    this.badSince = null;
    if (!this.base) {
      this.samples.push(m);
      if (this.samples.length > this.cfg.baselineFrames) this.samples.shift();
      const ys = this.samples.map((s) => s.shoulderY);
      const still = Math.max(...ys) - Math.min(...ys) <= this.cfg.stillness * m.torso;
      if (this.samples.length >= this.cfg.baselineFrames && still) {
        const med = (f: (b: Base) => number) => [...this.samples.map(f)].sort((a, b) => a - b)[Math.floor(this.samples.length / 2)];
        this.base = { shoulderY: med((s) => s.shoulderY), hipY: med((s) => s.hipY), ankleY: med((s) => s.ankleY), torso: med((s) => s.torso) };
      }
      return { tracking: 'good', baseline: !!this.base, ducking: false, duck: 0, hops: this.hops, airborne: false };
    }
    const b = this.base;
    const drop = (m.shoulderY - b.shoulderY) / b.torso;
    const ducking = drop >= this.cfg.duckAt;
    const lift = (b.ankleY - m.ankleY) / b.torso;
    const hipLift = (b.hipY - m.hipY) / b.torso;
    const up = lift >= this.cfg.hopAnkles && hipLift >= this.cfg.hopHips;
    if (up && !this.airborne) {
      this.airborne = true;
      this.hops++;
    } else if (!up && this.airborne && lift < this.cfg.hopAnkles * 0.5) this.airborne = false;
    return { tracking: 'good', baseline: true, ducking, duck: Math.max(0, Math.min(1, drop / this.cfg.duckAt)), hops: this.hops, airborne: this.airborne };
  }

  private measure(f: PoseFrame): Base | null {
    const l = f.landmarks;
    const need = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP];
    if (!need.every((i) => ok(l[i]))) return null;
    if (!ok(l[LM.L_ANKLE]) && !ok(l[LM.R_ANKLE])) return null;
    const sh = mid(l[LM.L_SHOULDER], l[LM.R_SHOULDER]);
    const hp = mid(l[LM.L_HIP], l[LM.R_HIP]);
    // The higher (smaller y) of the visible ankles: a hop needs both feet up, so the lower foot decides.
    const ankles = [l[LM.L_ANKLE], l[LM.R_ANKLE]].filter(ok).map((a) => a.y);
    return { shoulderY: sh.y, hipY: hp.y, ankleY: Math.max(...ankles), torso: Math.max(dist(sh, hp), 1e-3) };
  }
}

// ── Strike timing ─────────────────────────────────────────────────────────

export interface StrikeTiming {
  /** Warning time before impact (the attack's wind-up on screen). */
  telegraphMs: number;
  /** How early before impact a correct dodge already counts. */
  earlyMs: number;
  /** How late after impact it still counts. */
  lateMs: number;
}

/** Generous by default; later enemies may shorten the telegraph a little. */
export const STRIKE_TIMING: StrikeTiming = { telegraphMs: 2600, earlyMs: 1000, lateMs: 400 };

export interface DodgeSample {
  tracking: TrackingQuality;
  ducking: boolean;
  hops: number;
}

export type StrikeState = 'waiting' | 'telegraph' | 'window' | 'done';

/**
 * One incoming strike. The telegraph clock only runs while the player is in
 * view (or when using a controller), so stepping out of frame pauses the
 * attack rather than costing HP. The result is:
 *   dodged   the right move (duck for HIGH, hop for LOW) inside the window;
 *   hit      the player was clearly seen and didn't make the right move;
 *   unclear  the camera couldn't see for most of the window — no damage.
 */
export class StrikeTimer {
  private elapsed = 0;
  private lastAt: number | null = null;
  private hopsAtStart: number | null = null;
  private windowSeen = 0;
  private windowLost = 0;
  private result: 'dodged' | 'hit' | 'unclear' | null = null;
  /** A controller press (duck / hop) and when. */
  private pressed: { move: 'duck' | 'hop'; at: number } | null = null;

  constructor(
    readonly height: Height,
    private readonly timing: StrikeTiming = STRIKE_TIMING,
    /** Controller mode: no body needed, only button presses count. */
    private readonly controller = false,
  ) {}

  get impactIn(): number {
    return this.timing.telegraphMs - this.elapsed;
  }

  get state(): StrikeState {
    if (this.result) return 'done';
    if (this.elapsed === 0) return 'waiting';
    return this.elapsed >= this.timing.telegraphMs - this.timing.earlyMs ? 'window' : 'telegraph';
  }

  get outcome(): 'dodged' | 'hit' | 'unclear' | null {
    return this.result;
  }

  /** A duck/hop from a controller, keyboard or touch. */
  press(move: 'duck' | 'hop', now: number): void {
    this.pressed = { move, at: now };
  }

  /** Advance the clock with the latest body sample (or none in controller mode). */
  update(now: number, s: DodgeSample | null): 'dodged' | 'hit' | 'unclear' | null {
    if (this.result) return this.result;
    const dt = this.lastAt === null ? 0 : Math.max(0, Math.min(250, now - this.lastAt));
    this.lastAt = now;
    const t = this.timing;
    const visible = this.controller || s?.tracking === 'good';
    const inWindow = this.elapsed >= t.telegraphMs - t.earlyMs;
    // Before the window the attack waits for you; once it's swinging, it lands.
    if (visible || inWindow) this.elapsed += dt;
    if (!inWindow && this.elapsed >= t.telegraphMs - t.earlyMs && s) this.hopsAtStart = s.hops;
    if (this.elapsed < t.telegraphMs - t.earlyMs) {
      if (s) this.hopsAtStart = s.hops;
      return null;
    }
    if (this.hopsAtStart === null && s) this.hopsAtStart = s.hops;
    if (s && !this.controller) {
      if (s.tracking === 'good') this.windowSeen += dt;
      else this.windowLost += dt;
    }
    const pressOk = this.pressed && this.pressed.move === (this.height === 'high' ? 'duck' : 'hop') && now - this.pressed.at <= t.earlyMs + t.lateMs;
    const bodyOk = !!s && s.tracking === 'good' && (this.height === 'high' ? s.ducking : s.hops > (this.hopsAtStart ?? s.hops));
    if (pressOk || bodyOk) return (this.result = 'dodged');
    if (this.elapsed >= t.telegraphMs + t.lateMs) {
      if (this.controller) return (this.result = 'hit');
      return (this.result = this.windowLost > this.windowSeen ? 'unclear' : 'hit');
    }
    return null;
  }
}
