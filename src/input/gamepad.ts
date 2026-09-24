import type { InputHub } from './InputHub';

/**
 * A standard gamepad connected to the computer running the game (USB or
 * Bluetooth — not the phone), read with the browser Gamepad API.
 *
 *   left stick / d-pad   free movement (Assisted Traversal); d-pad ◀ ▶ also
 *                        chooses routes and menu options
 *   A (bottom button)    confirm / continue
 *   B (right button)     back
 *   Start / Menu         pause
 *   Select / View        switch Active ⇄ Assisted traversal
 *
 * Browsers only reveal a gamepad after one of its buttons is pressed while
 * the page is open. Everything goes through InputHub, so gamepad input obeys
 * the same mode rules as every other source.
 */
export const STICK_DEADZONE = 0.25;

/** Radial dead zone, rescaled so movement starts smoothly from the edge. */
export function deadzone(x: number, y: number, dz = STICK_DEADZONE): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return { x: x * k, y: y * k };
}

const A = 0;
const B = 1;
const SELECT = 8;
const START = 9;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

export class GamepadInput {
  private prev = new Map<number, boolean[]>();
  private raf = 0;
  connected = false;

  constructor(
    private readonly hub: InputHub,
    private readonly onToggleTraversal: () => void,
  ) {}

  start(): void {
    if (this.raf || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.poll(navigator.getGamepads());
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.hub.setStick(0, 0);
  }

  /** One polling step (exposed for tests). */
  poll(pads: readonly (Gamepad | null)[]): void {
    let sx = 0;
    let sy = 0;
    let any = false;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      any = true;
      const pressed = pad.buttons.map((b) => b.pressed);
      const was = this.prev.get(pad.index) ?? [];
      const edge = (i: number) => !!pressed[i] && !was[i];
      if (edge(A)) this.hub.press('confirm', 'gamepad');
      if (edge(B)) this.hub.press('back', 'gamepad');
      if (edge(START)) this.hub.press('pause', 'gamepad');
      if (edge(SELECT)) this.onToggleTraversal();
      if (edge(LEFT)) this.hub.press('left', 'gamepad');
      if (edge(RIGHT)) this.hub.press('right', 'gamepad');
      this.prev.set(pad.index, pressed);
      // First pad with the stick pushed wins; pads never add together.
      if (!sx && !sy) {
        const s = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
        const dx = (pressed[RIGHT] ? 1 : 0) - (pressed[LEFT] ? 1 : 0);
        const dy = (pressed[DOWN] ? 1 : 0) - (pressed[UP] ? 1 : 0);
        if (s.x || s.y) ({ x: sx, y: sy } = s);
        else if (dx || dy) {
          const l = Math.hypot(dx, dy);
          sx = dx / l;
          sy = dy / l;
        }
      }
    }
    this.connected = any;
    this.hub.setStick(sx, sy);
  }
}
