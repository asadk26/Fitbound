/**
 * setTimeout that can be paused. Battle pacing (enemy turns, next-set cards,
 * victory) runs on these, so pausing mid-battle freezes the whole encounter
 * rather than letting the enemy act while the player is away.
 */
export class PausableTimers {
  private items = new Map<number, { fn: () => void; left: number; start: number; handle: number | null }>();
  private nextId = 1;
  private paused = false;

  constructor(private readonly clock: () => number = () => performance.now()) {}

  later(fn: () => void, ms: number): number {
    const id = this.nextId++;
    const item = { fn, left: ms, start: this.clock(), handle: null as number | null };
    this.items.set(id, item);
    if (!this.paused) this.arm(id);
    return id;
  }

  private arm(id: number): void {
    const it = this.items.get(id);
    if (!it) return;
    it.start = this.clock();
    it.handle = window.setTimeout(() => {
      this.items.delete(id);
      it.fn();
    }, it.left);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = this.clock();
    for (const it of this.items.values()) {
      if (it.handle !== null) clearTimeout(it.handle);
      it.handle = null;
      it.left = Math.max(0, it.left - (now - it.start));
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const id of this.items.keys()) this.arm(id);
  }

  clear(): void {
    for (const it of this.items.values()) if (it.handle !== null) clearTimeout(it.handle);
    this.items.clear();
  }

  get pending(): number {
    return this.items.size;
  }
}
