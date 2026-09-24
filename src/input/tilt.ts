/**
 * "Did the phone move since calibration?" from the phone's motion sensor.
 *
 * It compares the direction of gravity now with the direction captured when
 * calibration finished. Only the *angle between* the two vectors is used, so
 * it doesn't depend on axis or sign conventions (which differ between
 * browsers), and heavy smoothing plus a hold time keep normal sensor noise,
 * footsteps and floor thumps from raising false alarms.
 *
 *   moved:   more than MOVE_DEG from the reference for HOLD_MS
 *   settled: back under CLEAR_DEG for CLEAR_MS (e.g. put back in place)
 */
export const MOVE_DEG = 6;
export const CLEAR_DEG = 3;
export const HOLD_MS = 1500;
export const CLEAR_MS = 1000;

type V = [number, number, number];

const norm = (v: V, min = 1e-6): V | null => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > min ? [v[0] / l, v[1] / l, v[2] / l] : null;
};

export function angleBetween(a: V, b: V): number {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return (Math.acos(d) * 180) / Math.PI;
}

export class TiltWatch {
  private g: V | null = null;
  private at = 0;
  private ref: V | null = null;
  private overSince: number | null = null;
  private underSince: number | null = null;
  moved = false;
  /** Latest angle from the reference, degrees (for the debug display). */
  offDeg = 0;

  /** Feed one accelerometer sample (acceleration including gravity, m/s²). */
  push(x: number, y: number, z: number, now: number): void {
    // Ignore readings far too weak to contain gravity (sensor glitches, free fall).
    const v = norm([x, y, z], 1);
    if (!v) return;
    if (!this.g) this.g = v;
    else {
      // ~0.5 s time constant: ignores footsteps and taps.
      const a = 1 - Math.exp(-Math.max(0, Math.min(200, now - this.at)) / 500);
      this.g = norm([this.g[0] + a * (v[0] - this.g[0]), this.g[1] + a * (v[1] - this.g[1]), this.g[2] + a * (v[2] - this.g[2])]) ?? this.g;
    }
    this.at = now;
    if (!this.ref) return;
    this.offDeg = angleBetween(this.g, this.ref);
    if (this.offDeg > MOVE_DEG) {
      this.underSince = null;
      this.overSince ??= now;
      if (now - this.overSince >= HOLD_MS) this.moved = true;
    } else if (this.offDeg < CLEAR_DEG) {
      this.overSince = null;
      this.underSince ??= now;
      if (now - this.underSince >= CLEAR_MS) this.moved = false;
    } else this.overSince = null;
  }

  /** Remember the current orientation as "where the phone belongs". */
  setReference(): void {
    this.ref = this.g;
    this.moved = false;
    this.overSince = this.underSince = null;
  }

  get hasReference(): boolean {
    return !!this.ref;
  }
}

/**
 * Start listening to the motion sensor. On iOS this needs permission, which
 * can only be requested from a tap — call it from the Start camera button.
 */
export async function startMotion(watch: TiltWatch): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return 'unsupported';
  const req = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }).requestPermission;
  if (req) {
    try {
      if ((await req()) !== 'granted') return 'denied';
    } catch {
      return 'denied';
    }
  }
  window.addEventListener('devicemotion', (e) => {
    const g = e.accelerationIncludingGravity;
    if (g && g.x !== null && g.y !== null && g.z !== null) watch.push(g.x, g.y, g.z, performance.now());
  });
  return 'granted';
}

/** The one watcher for this page. */
export const tilt = new TiltWatch();
