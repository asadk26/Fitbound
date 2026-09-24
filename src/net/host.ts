import { getSave, subscribeSave } from '../game/store';
import type { CalState } from '../input/calibration';
import { input as defaultHub, type InputHub } from '../input/InputHub';
import type { MotionReading } from '../input/motion';
import { ControllerGate, toCommand } from './gate';
import type { CtrlMsg, GameMsg, Telemetry } from './protocol';
import type { RemoteSet } from './remoteSet';

/**
 * The game's side of Connected Play: one WebSocket to the local relay, the
 * pairing offer to show on screen, and the state of the one phone
 * controller. Every controller message goes through the ControllerGate before
 * it can touch the game; accepted commands are handed to the InputHub like
 * any other input.
 *
 * Safety: if the phone goes quiet for STALE_MS (Wi-Fi drop, phone locked,
 * browser backgrounded) the controller is treated as lost at once — movement
 * stops and listeners are told so the game can pause — even before the relay
 * notices the socket is gone.
 */
export const STALE_MS = 3000;

export interface Pairing {
  code: string;
  token: string;
  expiresAt: number;
  urls: string[];
}

export interface PhoneStatus {
  camera: 'off' | 'starting' | 'running' | 'error';
  model: 'loading' | 'ready' | 'error';
  calibrated: boolean;
  tracking: 'good' | 'partial' | 'lost';
  error?: string;
  /** The phone's motion sensor says it moved since calibration. */
  moved?: boolean;
}

export interface LinkState {
  relay: 'idle' | 'connecting' | 'online' | 'unavailable';
  pairing: Pairing | null;
  /** none: never paired · connected · lost: paired but not heard from. */
  controller: 'none' | 'connected' | 'lost';
  status: PhoneStatus | null;
  calibration: CalState | null;
  error: string | null;
}

type Listener = (s: LinkState) => void;

export class HostLink {
  state: LinkState = { relay: 'idle', pairing: null, controller: 'none', status: null, calibration: null, error: null };
  readonly gate = new ControllerGate();
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private lastHeard = 0;
  private timer: number | null = null;
  private retry: number | null = null;
  private offs: (() => void)[] = [];
  /** The exercise set currently receiving reps, if any. */
  activeSet: RemoteSet | null = null;
  /** The latest rep-diagnostics summary from the phone (arrives just after a set ends). */
  lastDiag: Extract<CtrlMsg, { type: 'EXERCISE_DIAG' }> | null = null;
  /** Rejected messages, by reason (shown in the debug hook and logged). */
  readonly rejected: Record<string, number> = {};

  constructor(private readonly hub: InputHub = defaultHub) {}

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<LinkState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((f) => f(this.state));
  }

  /** Controller connected, camera running, calibrated and seeing the player. */
  get ready(): boolean {
    const s = this.state.status;
    return this.state.controller === 'connected' && !!s && s.camera === 'running' && s.model === 'ready' && s.calibrated && s.tracking !== 'lost';
  }

  /** Controller connected with its camera and pose model running (calibration may be pending). */
  get cameraReady(): boolean {
    const s = this.state.status;
    return this.state.controller === 'connected' && !!s && s.camera === 'running' && s.model === 'ready';
  }

  start(url = defaultRelayUrl()): void {
    if (this.ws) return;
    this.hub.useRemote(true);
    this.set({ relay: 'connecting', error: null });
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      let saved: { room: string; key: string } | null = null;
      try {
        saved = JSON.parse(sessionStorage.getItem('fitbound.host') ?? 'null');
      } catch {
        /* no storage */
      }
      ws.send(JSON.stringify(saved ? { relay: 'host-resume', room: saved.room, key: saved.key } : { relay: 'host' }));
    };
    ws.onmessage = (e) => this.onRaw(e.data);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      const wasOnline = this.state.relay === 'online';
      this.lost();
      this.set({ relay: wasOnline ? 'connecting' : 'unavailable' });
      // Keep trying: the relay may have been restarted.
      this.retry = window.setTimeout(() => {
        this.retry = null;
        this.start(url);
      }, 2000);
    };
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 500);
    if (!this.offs.length) {
      this.offs.push(
        this.hub.onMode((mode, epoch) => {
          if (mode === 'calibration') this.set({ calibration: null });
          this.send({ type: 'MODE', mode, epoch, ...(mode === 'calibration' ? { calibration: this.hub.calibrationKind } : {}) });
        }),
        subscribeSave(() => this.sendSettings()),
      );
    }
  }

  stop(): void {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    if (this.timer !== null) clearInterval(this.timer);
    if (this.retry !== null) clearTimeout(this.retry);
    this.timer = this.retry = null;
    this.offs.forEach((f) => f());
    this.offs = [];
    this.gate.unbind();
    this.hub.stop();
    this.hub.useRemote(false);
    this.state = { relay: 'idle', pairing: null, controller: 'none', status: null, calibration: null, error: null };
    this.listeners.forEach((f) => f(this.state));
  }

  private lastRepair = 0;

  /** New pairing code; disconnects the current phone. */
  repair(): void {
    this.lastRepair = Date.now();
    this.ws?.readyState === 1 && this.ws.send(JSON.stringify({ relay: 'repair' }));
    this.gate.unbind();
    this.lost();
    this.set({ controller: 'none', status: null });
  }

  send(msg: GameMsg): void {
    if (this.ws?.readyState === 1 && this.gate.sid) this.ws.send(JSON.stringify(msg));
  }

  sendSettings(): void {
    const s = getSave().settings;
    this.send({ type: 'SETTINGS', turnStep: s.motion.turnStep, lean: s.motion.lean, march: s.motion.march, facing: s.cameraFacing, model: s.model, pcSound: s.sound });
  }

  private onRaw(data: unknown): void {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    switch (m.relay) {
      case 'room': {
        try {
          sessionStorage.setItem('fitbound.host', JSON.stringify({ room: m.room, key: m.key }));
        } catch {
          /* ignore */
        }
        const c = m.controller as { sid: string; online: boolean } | null;
        this.set({ relay: 'online', pairing: (m.pairing as Pairing) ?? null });
        if (c) {
          this.gate.bind(c.sid);
          if (c.online) this.welcome();
        } else if (!m.pairing) this.repair();
        return;
      }
      case 'pairing':
        this.set({ pairing: (m.pairing as Pairing) ?? null });
        return;
      case 'peer':
        if (m.state === 'joined' || m.state === 'resumed') {
          this.gate.bind(String(m.sid));
          this.welcome();
        } else if (m.state === 'left' && m.sid === this.gate.sid) this.lost();
        return;
      case 'error':
        this.set({ error: typeof m.message === 'string' ? m.message : 'Relay error' });
        return;
      case 'msg':
        this.onCtrl(m.sid, m.msg);
        return;
    }
  }

  private welcome(): void {
    this.lastHeard = performance.now();
    this.set({ controller: 'connected', pairing: null, error: null });
    this.send({ type: 'MODE', mode: this.hub.mode, epoch: this.hub.epoch, ...(this.hub.mode === 'calibration' ? { calibration: this.hub.calibrationKind } : {}) });
    this.sendSettings();
  }

  private onCtrl(sid: unknown, raw: unknown): void {
    const res = this.gate.check(sid, raw, { mode: this.hub.mode, epoch: this.hub.epoch });
    // Always acknowledge reps so the phone stops resending, accepted or not.
    const rawObj = raw as { type?: unknown; seq?: unknown };
    if (sid === this.gate.sid && rawObj?.type === 'EXERCISE_REP' && typeof rawObj.seq === 'number') this.send({ type: 'ACK', seq: rawObj.seq });
    if (!res.ok) {
      this.rejected[res.reason] = (this.rejected[res.reason] ?? 0) + 1;
      return;
    }
    const msg = res.msg;
    const now = performance.now();
    this.lastHeard = now;
    if (this.state.controller !== 'connected') this.set({ controller: 'connected' });
    this.handle(msg, now);
  }

  private handle(msg: CtrlMsg, now: number): void {
    switch (msg.type) {
      case 'HELLO':
      case 'HEARTBEAT':
        return;
      case 'STATUS': {
        const { camera, model, calibrated, tracking, error, moved } = msg;
        this.set({ status: { camera, model, calibrated, tracking, error, moved } });
        return;
      }
      case 'TELEMETRY':
        this.hub.setRemoteReading(toReading(msg.r));
        return;
      case 'CALIBRATION': {
        const { step, progress, hint, floorOk } = msg;
        this.set({ calibration: { step, progress, hint, floorOk } });
        return;
      }
      case 'EXERCISE_STATUS':
        this.activeSet?.status(msg);
        return;
      case 'EXERCISE_DIAG':
        this.activeSet?.diag(msg);
        this.lastDiag = msg.setId === this.activeSet?.setId || !this.activeSet ? msg : this.lastDiag;
        return;
      case 'EXERCISE_REP': {
        const verdict = this.activeSet ? this.activeSet.rep(msg, now) : 'wrong-set';
        if (verdict !== 'accepted') this.rejected[`rep:${verdict}`] = (this.rejected[`rep:${verdict}`] ?? 0) + 1;
        return;
      }
      case 'MANUAL_MODE':
        this.activeSet?.requestManual(msg);
        return;
    }
    const cmd = toCommand(msg);
    if (cmd) this.hub.command(cmd, 'remote', now);
  }

  private tick(): void {
    if (this.state.controller === 'connected' && performance.now() - this.lastHeard > STALE_MS) this.lost();
    // Pairing offers are short-lived; show a fresh one when it runs out.
    const p = this.state.pairing;
    const expired = p && Date.now() > p.expiresAt;
    // Also replace an offer the relay withdrew (e.g. after repeated wrong codes).
    const missing = !p && this.state.relay === 'online';
    if ((expired || missing) && this.state.controller === 'none' && Date.now() - this.lastRepair > 5000) this.repair();
  }

  /** The controller went away (or silent): stop everything it was doing. */
  private lost(): void {
    this.hub.stop();
    this.hub.setRemoteReading(null);
    if (this.state.controller === 'connected') this.set({ controller: 'lost' });
  }
}

/** Where the relay lives: the same host that served this page. */
export function defaultRelayUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/relay`;
}

/** Fill a full MotionReading from the phone's display-only telemetry. */
export function toReading(t: Telemetry): MotionReading {
  return { ...t, confidence: t.tracking === 'good' ? 1 : t.tracking === 'partial' ? 0.5 : 0, events: [], metrics: { legDiff: 0, rightUp: 0, leftUp: 0 } };
}

export const host = new HostLink();
