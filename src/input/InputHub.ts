import type { PoseFrame } from '../exercise/types';
import { ExercisePauseGesture, pausePolicy } from './exercisePause';
import { commandAllowed, isMenuMode, type CommandType, type InputMode } from './modes';
import { MotionReader, type MotionConfig, type MotionReading, type NeutralPose } from './motion';

export type { InputMode } from './modes';

/**
 * One place that decides which inputs count right now (see ./modes.ts).
 *
 * Every input source speaks the same small command language — move, turn,
 * nav, confirm, back, pause, step — and every command goes through
 * `command()`, which filters it by the current mode:
 *
 *   - single-device play: camera frames are fed in here and the local
 *     MotionReader turns them into commands;
 *   - Connected Play: the phone runs the MotionReader and sends the same
 *     commands over the network; after validation they arrive here too;
 *   - keyboard and touch are always available as a fallback.
 *
 * Every mode change resets motion history and disarms gestures (hands that
 * were already up when a mode starts must come down before they count) and
 * bumps `epoch`, so a command issued for the previous mode can be recognised
 * and dropped when it arrives late.
 */
export type InputSource = 'motion' | 'keyboard' | 'touch' | 'remote' | 'gamepad' | 'voice';

/** Simple commands (no payload). */
export type SimpleCommand = 'confirm' | 'back' | 'pause' | 'step' | 'ready' | 'finish' | 'resume' | 'recalibrate' | 'duck' | 'hop';

export type InputEvent = { type: SimpleCommand; source: InputSource } | { type: 'nav' | 'turn'; dir: -1 | 1; source: InputSource };

export type Command = { type: 'move'; forward: number } | { type: 'turn' | 'nav'; dir: -1 | 1 } | { type: SimpleCommand };

/** A conventional (non-exercise) movement vector, screen-relative, length ≤ 1. */
export interface FreeMove {
  x: number;
  y: number;
}

export interface MoveIntent {
  /** 0..1 forward speed. Turning is discrete: see takeTurns(). */
  forward: number;
}

/** Movement stops if no fresh move command arrives for this long. */
export const MOVE_TIMEOUT_MS = 1200;

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class InputHub {
  mode: InputMode = 'off';
  /** Increments on every mode change. */
  epoch = 0;
  /** 'remote' when a phone controller drives the game (Connected Play). */
  source: 'local' | 'remote' = 'local';
  readonly reader: MotionReader;
  latest: MotionReading | null = null;
  private listeners = new Set<(e: InputEvent) => void>();
  private readingListeners = new Set<(r: MotionReading | null) => void>();
  private modeListeners = new Set<(m: InputMode, epoch: number) => void>();
  private keys = { forward: false, up: false, down: false, left: false, right: false };
  private stick: FreeMove = { x: 0, y: 0 };
  private move = { forward: 0, at: -Infinity };
  private turns = 0;
  /** The exercise whose pause gesture is active during a set. */
  private exercisePause: ExercisePauseGesture | null = null;
  /** Which calibration the next 'calibration' mode runs. */
  calibrationKind: 'full' | 'quick' = 'full';

  constructor(cfg: Partial<MotionConfig> = {}) {
    this.reader = new MotionReader(cfg);
  }

  setMode(mode: InputMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.epoch++;
    this.reader.reset();
    this.exercisePause?.reset();
    this.stop();
    if (this.source === 'local') {
      this.latest = null;
      this.readingListeners.forEach((f) => f(null));
    }
    this.modeListeners.forEach((f) => f(mode, this.epoch));
  }

  /** Switch between the local camera and a remote phone controller. */
  useRemote(on: boolean): void {
    this.source = on ? 'remote' : 'local';
    this.stop();
    this.latest = null;
    this.readingListeners.forEach((f) => f(null));
  }

  /** The exercise being performed (sets its pause gesture), or null. */
  setExercise(exerciseId: string | null): void {
    this.exercisePause = exerciseId ? new ExercisePauseGesture(pausePolicy(exerciseId)) : null;
  }

  /** 0..1 progress of the mid-set pause gesture, for the on-screen ring. */
  get exercisePauseProgress(): number {
    return this.mode === 'exercise' ? (this.exercisePause?.progress ?? 0) : 0;
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

  onMode(fn: (m: InputMode, epoch: number) => void): () => void {
    this.modeListeners.add(fn);
    return () => this.modeListeners.delete(fn);
  }

  private emit(e: InputEvent): void {
    this.listeners.forEach((f) => f(e));
  }

  /**
   * The single entry point for input. Returns false when the current mode
   * doesn't allow the command (it is then ignored entirely).
   */
  command(cmd: Command, source: InputSource, now = clock()): boolean {
    const m = this.mode;
    let type: CommandType = cmd.type;
    // In menus a turn (lean / arrow key) moves the highlight instead.
    if (type === 'turn' && isMenuMode(m)) type = 'nav';
    // Between sets, a Continue press (not a raised hand) means "ready".
    if (type === 'confirm' && m === 'ready' && source !== 'motion' && source !== 'remote') {
      cmd = { type: 'ready' };
      type = 'ready';
    }
    if (!commandAllowed(m, type)) return false;
    switch (cmd.type) {
      case 'move':
        this.move = { forward: Math.max(0, Math.min(1, cmd.forward)), at: now };
        return true;
      case 'turn':
      case 'nav':
        if (type === 'turn') this.turns += cmd.dir;
        this.emit({ type: type === 'turn' ? 'turn' : 'nav', dir: cmd.dir, source });
        return true;
      default:
        this.emit({ type: cmd.type, source });
        return true;
    }
  }

  /** Feed one local camera frame. Ignored in off mode and while a remote controller drives the game.
   *  During an exercise only that exercise's pause gesture is read. */
  feed(frame: PoseFrame | null, now: number): MotionReading | null {
    const m = this.mode;
    if (m === 'off' || this.source !== 'local') return null;
    if (m === 'exercise') {
      if (this.exercisePause?.update(frame, now)) this.command({ type: 'pause' }, 'motion', now);
      return null;
    }
    const r = this.reader.update(frame, now);
    this.latest = r;
    this.command({ type: 'move', forward: r.marching ? r.intensity : 0 }, 'motion', now);
    for (const ev of r.events) {
      if (ev === 'turnLeft' || ev === 'turnRight') this.command({ type: 'turn', dir: ev === 'turnLeft' ? -1 : 1 }, 'motion', now);
      else this.command({ type: ev }, 'motion', now);
    }
    this.readingListeners.forEach((f) => f(r));
    return r;
  }

  /** A remote controller's latest reading, for the on-screen meters only. */
  setRemoteReading(r: MotionReading | null): void {
    if (this.source !== 'remote') return;
    this.latest = r;
    this.readingListeners.forEach((f) => f(r));
  }

  /** Forward speed for the exploration scene; zero outside explore mode. */
  intent(now = clock()): MoveIntent {
    if (this.mode !== 'explore') return { forward: 0 };
    if (this.keys.forward) return { forward: 1 };
    return { forward: now - this.move.at <= MOVE_TIMEOUT_MS ? this.move.forward : 0 };
  }

  /**
   * Conventional movement (gamepad left stick or keyboard), for Assisted
   * Traversal. The strongest single source wins — sources never add up, so
   * holding a key and pushing the stick can't double the speed. Zero outside
   * explore mode.
   */
  freeMove(): FreeMove {
    if (this.mode !== 'explore') return { x: 0, y: 0 };
    const k = this.keys;
    const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const kl = Math.hypot(kx, ky);
    const key = kl ? { x: kx / kl, y: ky / kl } : { x: 0, y: 0 };
    const sl = Math.hypot(this.stick.x, this.stick.y);
    const stick = sl > 1 ? { x: this.stick.x / sl, y: this.stick.y / sl } : this.stick;
    return Math.hypot(stick.x, stick.y) > kl ? stick : key;
  }

  /** The gamepad's left stick (already dead-zoned). */
  setStick(x: number, y: number): void {
    this.stick = { x, y };
  }

  /** True while the forward key forces movement (not physical activity). */
  get keyForward(): boolean {
    return this.mode === 'explore' && this.keys.forward;
  }

  /** Discrete turns requested since the last call (+1 per right, -1 per left). */
  takeTurns(): number {
    const t = this.turns;
    this.turns = 0;
    return t;
  }

  /** Stop all movement at once, e.g. when the controller disconnects. */
  stop(): void {
    this.move = { forward: 0, at: -Infinity };
    this.turns = 0;
  }

  /** Keyboard / touch equivalents, filtered by mode like motion input. */
  press(action: SimpleCommand | 'left' | 'right', source: 'keyboard' | 'touch' | 'gamepad' | 'voice' = 'keyboard'): boolean {
    if (action === 'left' || action === 'right') return this.command({ type: 'turn', dir: action === 'left' ? -1 : 1 }, source);
    return this.command({ type: action }, source);
  }

  setKey(key: 'forward' | 'up' | 'down' | 'left' | 'right', down: boolean): void {
    this.keys[key] = down;
  }

  /** Arrow keys / WASD / Enter / Esc / P for desktop testing. */
  attachKeyboard(target: Window): () => void {
    const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    const down = (e: KeyboardEvent) => {
      if (dirs[e.code]) this.setKey(dirs[e.code], true);
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.setKey('forward', true);
      if (e.repeat) return;
      // One press = one turn, like one lean.
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.press('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.press('right');
      // Enter / Space on a focused button or field belongs to that control, not the game.
      const onControl = e.target instanceof Element && !!e.target.closest?.('button, input, select, textarea, summary');
      if ((e.code === 'Enter' || e.code === 'Space') && onControl) return;
      if (e.code === 'Enter' || e.code === 'Space') this.press('confirm');
      if (e.code === 'Escape' || e.code === 'Backspace') this.press('back');
      if (e.code === 'KeyP') this.press('pause');
      if (e.code === 'KeyF') this.press('finish');
      // Dodging (only in dodge mode): down = duck, up / space = hop.
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.press('duck');
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this.press('hop');
    };
    const up = (e: KeyboardEvent) => {
      if (dirs[e.code]) this.setKey(dirs[e.code], false);
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.setKey('forward', false);
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
