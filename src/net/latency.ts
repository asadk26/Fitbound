/**
 * Measures how long the phone's movement messages take to reach the PC, over
 * your own Wi-Fi and relay. Nothing in the game uses it yet — dodge timing is
 * unchanged — it's recorded so a playtest report can say what the real delay
 * is (the future rhythm encounters will need to allow for it).
 *
 * How: the PC pings the phone every few seconds; the phone echoes the ping
 * with its own clock reading. From the round trip we estimate the offset
 * between the two clocks (the sample with the shortest round trip is the most
 * trustworthy). The phone stamps movement messages with its clock, so each
 * one's travel time is (arrival on the PC) − (sent on the phone, in PC time).
 */
export interface Spread {
  median: number;
  p90: number;
  n: number;
}

const MAX = 300;

function spread(xs: number[]): Spread | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { median: Math.round(q(0.5)), p90: Math.round(q(0.9)), n: s.length };
}

export class LatencyStats {
  private rtts: number[] = [];
  private offsets: { rtt: number; offset: number }[] = [];
  private events: Record<string, number[]> = {};

  /** The phone echoed a ping sent at `t` (PC clock) at `at` (phone clock); it arrived at `now`. */
  pong(t: number, at: number, now: number): void {
    const rtt = now - t;
    if (!(rtt >= 0 && rtt < 10_000)) return;
    this.rtts = [...this.rtts, rtt].slice(-MAX);
    this.offsets = [...this.offsets, { rtt, offset: at - (t + rtt / 2) }].slice(-20);
  }

  /** Phone clock minus PC clock, from the cleanest recent ping; null before any. */
  offset(): number | null {
    if (!this.offsets.length) return null;
    return this.offsets.reduce((b, s) => (s.rtt < b.rtt ? s : b)).offset;
  }

  /** A stamped message (sent at phone time `at`) arrived at PC time `now`. */
  event(kind: string, at: number, now: number): void {
    const off = this.offset();
    if (off === null) return;
    const d = now - (at - off);
    if (!(d > -50 && d < 10_000)) return;
    this.events[kind] = [...(this.events[kind] ?? []), Math.max(0, d)].slice(-MAX);
  }

  summary(): { rtt: Spread | null; events: Record<string, Spread> } {
    const events: Record<string, Spread> = {};
    for (const [k, v] of Object.entries(this.events)) {
      const s = spread(v);
      if (s) events[k] = s;
    }
    return { rtt: spread(this.rtts), events };
  }

  /** One line for the playtest report, or '' with no data. */
  text(): string {
    const { rtt, events } = this.summary();
    if (!rtt) return '';
    const parts = [`round trip ${rtt.median} ms (90% under ${rtt.p90} ms, ${rtt.n} pings)`];
    const names: Record<string, string> = { dodge: 'dodge readings', rep: 'reps' };
    for (const [k, s] of Object.entries(events)) parts.push(`${names[k] ?? k} arrive ${s.median} ms after the phone sees them (90% under ${s.p90} ms)`);
    return parts.join(' · ');
  }

  reset(): void {
    this.rtts = [];
    this.offsets = [];
    this.events = {};
  }
}
