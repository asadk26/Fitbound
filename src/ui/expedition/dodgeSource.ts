import { host } from '../../net/host';
import { tracker } from '../../pose/PoseTracker';
import { DodgeReader, type DodgeReading } from '../../rpg/dodge';

/**
 * Where dodge readings come from: the phone (Connected Play streams its
 * DodgeReader state while the PC is in dodge mode) or this device's camera.
 * A phone reading older than STALE_MS counts as "can't see you" — so a
 * dropped connection can never become a failed dodge.
 */
const STALE_MS = 600;

export class DodgeSource {
  private reader = new DodgeReader();
  private latest: DodgeReading | null = null;
  private off: (() => void) | null = null;

  constructor(private readonly connected: boolean) {}

  /** Begin a fresh baseline (the player has just said they're ready). */
  start(): void {
    this.stop();
    this.reader.reset();
    this.latest = null;
    if (!this.connected) this.off = tracker.subscribe((f) => (this.latest = this.reader.update(f.frame, f.now)));
    // The phone starts its own fresh baseline when the game enters dodge mode.
    else host.dodge = null;
  }

  stop(): void {
    this.off?.();
    this.off = null;
  }

  sample(now = performance.now()): DodgeReading | null {
    if (!this.connected) return this.latest;
    const d = host.dodge;
    if (!d || now - d.at > STALE_MS) return d ? { ...d, tracking: 'lost', ducking: false, airborne: false } : null;
    return { tracking: d.tracking, baseline: d.baseline, ducking: d.ducking, duck: d.duck, hops: d.hops, airborne: false };
  }
}
