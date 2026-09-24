import type { Command } from '../input/InputHub';
import { commandAllowed, isMenuMode, type CommandType, type InputMode } from '../input/modes';
import { parseCtrlMsg, type CtrlMsg } from './protocol';

/**
 * The PC's checkpoint for everything a phone controller sends. A message is
 * accepted only if it
 *
 *   1. is well-formed (protocol.parseCtrlMsg),
 *   2. comes from the controller session the relay paired with this game,
 *   3. has a sequence number above every one seen before in that session
 *      (duplicates and replays are dropped),
 *   4. makes sense right now: movement and gestures only in modes that allow
 *      them and only if produced for the current mode (epoch); exercise
 *      events only during an exercise; calibration only while calibrating.
 *
 * Exercise reps are checked again against the active set (see RemoteSet).
 */
export type GateResult = { ok: true; msg: CtrlMsg } | { ok: false; reason: 'malformed' | 'session' | 'duplicate' | 'mode' | 'stale-epoch' };

export interface GateContext {
  mode: InputMode;
  epoch: number;
}

const COMMAND_OF: Partial<Record<CtrlMsg['type'], CommandType>> = {
  MOVE_START: 'move',
  MOVE_STOP: 'move',
  TURN_LEFT: 'turn',
  TURN_RIGHT: 'turn',
  NAV: 'nav',
  INTERACT: 'confirm',
  BACK: 'back',
  PAUSE: 'pause',
  STEP: 'step',
  READY: 'ready',
};

export class ControllerGate {
  sid: string | null = null;
  private lastSeq = 0;

  /** A controller paired (or resumed). A new session starts sequence tracking over. */
  bind(sid: string): void {
    if (sid !== this.sid) this.lastSeq = 0;
    this.sid = sid;
  }

  unbind(): void {
    this.sid = null;
    this.lastSeq = 0;
  }

  check(sid: unknown, raw: unknown, ctx: GateContext): GateResult {
    if (!this.sid || sid !== this.sid) return { ok: false, reason: 'session' };
    const msg = parseCtrlMsg(raw);
    if (!msg) return { ok: false, reason: 'malformed' };
    if (msg.seq <= this.lastSeq) return { ok: false, reason: 'duplicate' };
    this.lastSeq = msg.seq;

    switch (msg.type) {
      case 'HELLO':
      case 'HEARTBEAT':
      case 'STATUS':
      case 'TELEMETRY':
      // Display-only: matched to the set by id, never awards anything.
      case 'EXERCISE_DIAG':
      case 'VIEW':
      case 'PEEK':
        return { ok: true, msg };
      case 'CALIBRATION':
        return ctx.mode === 'calibration' ? { ok: true, msg } : { ok: false, reason: 'mode' };
      case 'EXERCISE_STATUS':
      case 'EXERCISE_REP':
      case 'MANUAL_MODE':
        if (ctx.mode !== 'exercise') return { ok: false, reason: 'mode' };
        return msg.epoch === ctx.epoch ? { ok: true, msg } : { ok: false, reason: 'stale-epoch' };
    }

    let type = COMMAND_OF[msg.type]!;
    if (type === 'turn' && isMenuMode(ctx.mode)) type = 'nav';
    // Stopping is always safe; anything else must be allowed in this mode...
    if (msg.type !== 'MOVE_STOP' && !commandAllowed(ctx.mode, type)) return { ok: false, reason: 'mode' };
    // ...and must have been produced for this mode, except a pause, which
    // should never be lost to a mode change.
    if (msg.type !== 'MOVE_STOP' && msg.type !== 'PAUSE' && msg.epoch !== ctx.epoch) return { ok: false, reason: 'stale-epoch' };
    return { ok: true, msg };
  }
}

/** Translate an accepted controller message into a hub command, if it is one. */
export function toCommand(msg: CtrlMsg): Command | null {
  switch (msg.type) {
    case 'MOVE_START':
      return { type: 'move', forward: msg.intensity };
    case 'MOVE_STOP':
      return { type: 'move', forward: 0 };
    case 'TURN_LEFT':
      return { type: 'turn', dir: -1 };
    case 'TURN_RIGHT':
      return { type: 'turn', dir: 1 };
    case 'NAV':
      return { type: 'nav', dir: msg.dir };
    case 'INTERACT':
      return { type: 'confirm' };
    case 'BACK':
      return { type: 'back' };
    case 'PAUSE':
      return { type: 'pause' };
    case 'STEP':
      return { type: 'step' };
    case 'READY':
      return { type: 'ready' };
    default:
      return null;
  }
}
