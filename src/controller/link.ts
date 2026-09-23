import { parseGameMsg, RELIABLE, type CtrlMsg, type CtrlPayload, type GameMsg } from '../net/protocol';

/**
 * The phone's connection to the relay. Pairs with a token (from the QR code)
 * or a 6-digit code, then keeps the session alive across Wi-Fi blips by
 * resuming with the secret key the relay issued — the key lives only in this
 * tab's sessionStorage.
 *
 * Sequence numbers start from the wall clock and only go up, so they stay
 * increasing even if the page is reloaded. Exercise reps are kept until the
 * PC acknowledges them and are re-sent (same sequence number, so the PC can
 * spot duplicates) after a reconnect.
 */
export type LinkPhase = 'idle' | 'joining' | 'connected' | 'reconnecting' | 'ended';

export interface CtrlLinkState {
  phase: LinkPhase;
  hostOnline: boolean;
  error: string | null;
}

const STORE = 'fitbound.ctrl';

export class CtrlLink {
  state: CtrlLinkState = { phase: 'idle', hostOnline: false, error: null };
  private ws: WebSocket | null = null;
  private seq = Date.now();
  private outbox = new Map<number, CtrlMsg>();
  private session: { sid: string; key: string } | null = null;
  private creds: { token?: string; code?: string } | null = null;
  private retries = 0;
  private timer: number | null = null;
  private listeners = new Set<(s: CtrlLinkState) => void>();
  private gameListeners = new Set<(m: GameMsg) => void>();

  constructor(
    private readonly url: string,
    /** The current input-mode epoch, stamped on every message. */
    private readonly epoch: () => number,
  ) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
      if (saved && typeof saved.sid === 'string' && typeof saved.key === 'string') this.session = saved;
    } catch {
      /* no storage */
    }
  }

  get hasSession(): boolean {
    return !!this.session;
  }

  onState(fn: (s: CtrlLinkState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onGame(fn: (m: GameMsg) => void): () => void {
    this.gameListeners.add(fn);
    return () => this.gameListeners.delete(fn);
  }

  private set(patch: Partial<CtrlLinkState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((f) => f(this.state));
  }

  /** Pair with a token or code, or resume the saved session if called with nothing. */
  connect(creds?: { token?: string; code?: string }): void {
    if (creds) {
      this.creds = creds;
      this.session = null;
      try {
        sessionStorage.removeItem(STORE);
      } catch {
        /* ignore */
      }
    }
    this.open();
  }

  private open(): void {
    this.ws?.close();
    this.set({ phase: this.session ? 'reconnecting' : 'joining', error: null });
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      if (this.session) ws.send(JSON.stringify({ relay: 'resume', sid: this.session.sid, key: this.session.key }));
      else if (this.creds) ws.send(JSON.stringify({ relay: 'join', ...this.creds }));
    };
    ws.onmessage = (e) => this.onRaw(ws, e.data);
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.state.phase === 'ended' || e.code === 4001) {
        this.end(e.code === 4001 ? 'Another phone was paired with this game.' : this.state.error);
        return;
      }
      if (!this.session) {
        this.set({ phase: 'idle' });
        return;
      }
      // Back off gently: 0.5, 1, 2, 4, 5, 5… seconds.
      this.set({ phase: 'reconnecting' });
      const wait = Math.min(5000, 500 * 2 ** this.retries++);
      this.timer = window.setTimeout(() => this.open(), wait);
    };
  }

  private end(error: string | null): void {
    this.session = null;
    try {
      sessionStorage.removeItem(STORE);
    } catch {
      /* ignore */
    }
    this.set({ phase: 'ended', error });
  }

  private onRaw(ws: WebSocket, data: unknown): void {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    switch (m.relay) {
      case 'joined':
        this.session = { sid: String(m.sid), key: String(m.key) };
        try {
          sessionStorage.setItem(STORE, JSON.stringify(this.session));
        } catch {
          /* ignore */
        }
        this.creds = null;
        this.retries = 0;
        this.set({ phase: 'connected', error: null });
        return;
      case 'resumed':
        this.retries = 0;
        this.set({ phase: 'connected', error: null });
        // Anything the PC may not have received goes again, in order.
        for (const msg of this.outbox.values()) ws.send(JSON.stringify(msg));
        return;
      case 'host':
        this.set({ hostOnline: m.state === 'online' });
        return;
      case 'error':
        if (m.code === 'session') this.end(String(m.message));
        else this.set({ phase: 'idle', error: typeof m.message === 'string' ? m.message : 'Could not connect' });
        return;
      case 'msg': {
        const msg = parseGameMsg(m.msg);
        if (!msg) return;
        if (msg.type === 'ACK') {
          this.outbox.delete(msg.seq);
          return;
        }
        this.gameListeners.forEach((f) => f(msg));
        return;
      }
    }
  }

  send(p: CtrlPayload): void {
    const msg = { ...p, seq: ++this.seq, epoch: this.epoch() } as CtrlMsg;
    if (RELIABLE.has(p.type)) this.outbox.set(msg.seq, msg);
    if (this.state.phase === 'connected' && this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.set({ phase: 'ended' });
    this.ws?.close();
  }
}
