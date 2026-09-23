import type { PoseFrame } from '../exercise/types';
import { MotionReader, type MotionConfig, type MotionReading, type NeutralPose } from './motion';

/**
 * One place that decides which inputs count right now.
 *
 *  - calibration: motion is read (for the setup checklist); gestures fire.
 *  - explore:     march + lean move the hero; confirm / back / pause gestures.
 *  - menu:        lean moves a selection; confirm / back / pause gestures;
 *                 marching never moves anything.
 *  - exercise:    motion input is OFF. Only the active exercise detector
 *                 (owned by the battle) sees frames, so a jumping jack can't
 *                 be read as "pause" and a squat can't be read as a step.
 *  - off:         nothing.
 *
 * Every mode change resets motion history and disarms gestures: hands that
 * were already up when a mode starts must come down before they count.
 *
 * Inputs come from camera frames or a keyboard; later, a separate phone
 * controller or an auto-walk source can feed the same intents.
 */
export type InputMode = 'off' | 'calibration' | 'explore' | 'menu' | 'exercise';

export type InputEvent =
  | { type: 'confirm' | 'back' | 'pause' | 'step'; source: 'motion' | 'keyboard' | 'touch' }
  | { type: 'nav'; dir: -1 | 1; source: 'motion' | 'keyboard' };

export interface MoveIntent {
  /** 0..1 forward speed. */
  forward: number;
  /** -1 (turn left) .. +1 (turn right). */
  turn: number;
}

const NAV_REPEAT_MS = 900;

export class InputHub {
  mode: InputMode = 'off';
  readonly reader: MotionReader;
  latest: MotionReading | null = null;
  private listeners = new Set<(e: InputEvent) => void>();
  private readingListeners = new Set<(r: MotionReading | null) => void>();
  private navDir: -1 | 0 | 1 = 0;
  private navAt = 0;
  private keys = { forward: false, left: false, right: false };

  constructor(cfg: Partial<MotionConfig> = {}) {
    this.reader = new MotionReader(cfg);
  }

  setMode(mode: InputMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.reader.reset();
    this.navDir = 0;
    this.latest = null;
    this.readingListeners.forEach((f) => f(null));
  }

  setNeutral(n: NeutralPose | null): void {
    this.reader.setNeutral(n);
  }

  on(fn: (e: InputEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onReading(fn: (r: MotionReading | null) => void): () => void {
    this.readingListeners.add(fn);
    return () => this.readingListeners.delete(fn);
  }

  private emit(e: InputEvent): void {
    this.listeners.forEach((f) => f(e));
  }

  /** Feed one camera frame. Ignored in exercise / off modes. */
  feed(frame: PoseFrame | null, now: number): MotionReading | null {
    const m = this.mode;
    if (m === 'off' || m === 'exercise') return null;
    const r = this.reader.update(frame, now);
    this.latest = r;
    for (const ev of r.events) {
      if (ev === 'step' && m !== 'explore' && m !== 'calibration') continue;
      this.emit({ type: ev, source: 'motion' });
    }
    if (m === 'menu') {
      const d = r.leanDir;
      if (d !== 0 && (d !== this.navDir || now - this.navAt >= NAV_REPEAT_MS)) {
        this.navAt = now;
        this.emit({ type: 'nav', dir: d, source: 'motion' });
      }
      this.navDir = d;
    }
    this.readingListeners.forEach((f) => f(r));
    return r;
  }

  /** Movement for the exploration scene; zero outside explore mode. */
  intent(): MoveIntent {
    if (this.mode !== 'explore') return { forward: 0, turn: 0 };
    const k = this.keys;
    const kTurn = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (k.forward || kTurn) return { forward: k.forward ? 1 : 0, turn: kTurn };
    const r = this.latest;
    if (!r || r.tracking === 'lost') return { forward: 0, turn: 0 };
    return { forward: r.marching ? r.intensity : 0, turn: r.steer };
  }

  /** Keyboard / touch equivalents, filtered by mode like motion input. */
  press(action: 'confirm' | 'back' | 'pause' | 'left' | 'right', source: 'keyboard' | 'touch' = 'keyboard'): void {
    const m = this.mode;
    if (m === 'off') return;
    if (m === 'exercise' && action !== 'pause') return;
    if (action === 'left' || action === 'right') {
      if (m === 'menu' && source === 'keyboard') this.emit({ type: 'nav', dir: action === 'left' ? -1 : 1, source });
      return;
    }
    this.emit({ type: action, source });
  }

  setKey(key: 'forward' | 'left' | 'right', down: boolean): void {
    this.keys[key] = down;
  }

  /** Arrow keys / WASD / Enter / Esc / P for desktop testing. */
  attachKeyboard(target: Window): () => void {
    const map: Record<string, 'forward' | 'left' | 'right'> = {
      ArrowUp: 'forward',
      KeyW: 'forward',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    };
    const down = (e: KeyboardEvent) => {
      const k = map[e.code];
      if (k) {
        this.setKey(k, true);
        if (!e.repeat && (k === 'left' || k === 'right')) this.press(k);
      }
      if (e.repeat) return;
      if (e.code === 'Enter' || e.code === 'Space') this.press('confirm');
      if (e.code === 'Escape' || e.code === 'Backspace') this.press('back');
      if (e.code === 'KeyP') this.press('pause');
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.code];
      if (k) this.setKey(k, false);
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
    };
  }
}

/** The app-wide hub. */
export const input = new InputHub();
