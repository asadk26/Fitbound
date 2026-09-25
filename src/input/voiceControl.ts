import { audio } from '../game/audio';
import { input } from './InputHub';
import { ResultTracker, VoiceGate, VOICE_LABEL, type VoiceCommand } from './voice';

/**
 * Voice commands through the browser's speech recognition, on the computer
 * running the game (Connected Play's laptop, or the phone in phone-only play).
 *
 * Engines, honestly:
 *  - Chrome 139+ can recognise on this device ("processLocally") once its
 *    English language pack is installed; we ask for that first.
 *  - Otherwise Chrome sends the audio to Google's speech service and Edge to
 *    Microsoft's while listening. That needs the internet and isn't offline.
 *  - Firefox has no speech recognition; Safari's (iPhone) is not used for the
 *    phone controller because it interferes with the running camera.
 *
 * The microphone is used only while voice commands are switched on. Only the
 * matched command is used; transcripts aren't stored or sent anywhere by the
 * game.
 */
export type VoiceStatus = 'unsupported' | 'off' | 'starting' | 'listening' | 'denied' | 'error';

export interface Heard {
  text: string;
  cmd: VoiceCommand | null;
  verdict: 'accepted' | 'not-now' | 'ignored';
  at: number;
}

export interface VoiceState {
  status: VoiceStatus;
  engine: 'on-device' | 'online' | null;
  heard: Heard | null;
  error: string | null;
}

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  processLocally?: boolean;
  phrases?: unknown[];
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};
type RecEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type RecCtor = (new () => Rec) & {
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

function ctor(): RecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const HINTS = ['pause', 'resume', 'finish set', 'recalibrate'];

export class VoiceControl {
  state: VoiceState = { status: ctor() ? 'off' : 'unsupported', engine: null, heard: null, error: null };
  private listeners = new Set<(s: VoiceState) => void>();
  private rec: Rec | null = null;
  private want = false;
  private session = 0;
  private restarts = 0;
  private local = false;
  private readonly tracker = new ResultTracker();
  readonly gate = new VoiceGate(undefined, () => audio.speechEndedAt());

  constructor(private readonly onCommand: (cmd: VoiceCommand) => boolean) {}

  get supported(): boolean {
    return !!ctor();
  }

  subscribe(fn: (s: VoiceState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(p: Partial<VoiceState>): void {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((f) => f(this.state));
  }

  /** Start listening. Call from a click the first time (the browser asks for the microphone). */
  async enable(): Promise<void> {
    const C = ctor();
    if (!C) return this.set({ status: 'unsupported' });
    this.want = true;
    this.set({ status: 'starting', error: null });
    // Prefer on-device recognition where the browser offers it.
    this.local = false;
    try {
      if (C.available) {
        const opts = { langs: ['en-US'], processLocally: true };
        let a = await C.available(opts);
        if (a === 'downloadable' && C.install) a = (await Promise.race([C.install(opts), new Promise<boolean>((r) => setTimeout(() => r(false), 8000))])) ? 'available' : a;
        this.local = a === 'available';
      }
    } catch {
      this.local = false;
    }
    if (!this.want) return;
    this.begin();
  }

  disable(): void {
    this.want = false;
    try {
      this.rec?.abort();
    } catch {
      /* already stopped */
    }
    this.rec = null;
    this.set({ status: this.supported ? 'off' : 'unsupported', engine: null });
  }

  private begin(): void {
    const C = ctor();
    if (!C || !this.want) return;
    const rec = new C();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 3;
    if (this.local && 'processLocally' in rec) rec.processLocally = true;
    // Contextual biasing toward the command words, where supported.
    const Phrase = (window as unknown as { SpeechRecognitionPhrase?: new (p: string, boost: number) => unknown }).SpeechRecognitionPhrase;
    if (Phrase && 'phrases' in rec) {
      try {
        rec.phrases = HINTS.map((h) => new Phrase(h, 4));
      } catch {
        /* not supported */
      }
    }
    const session = ++this.session;
    this.tracker.reset();
    rec.onstart = () => {
      this.restarts = 0;
      this.set({ status: 'listening', engine: rec.processLocally ? 'on-device' : 'online', error: null });
    };
    rec.onresult = (e) => this.onResult(e, session);
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.want = false;
        this.set({ status: 'denied', error: 'Microphone access was blocked. Allow it in the browser’s site settings, then switch voice on again.' });
      } else if (e.error === 'language-not-supported' && this.local) {
        this.local = false; // retry online on the next start
      } else if (e.error === 'network') {
        this.set({ status: 'error', error: 'The speech service couldn’t be reached (this browser recognises speech online).' });
      }
      // 'no-speech' and 'aborted' are routine; onend restarts.
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.rec = null;
      if (!this.want) return;
      // Engines stop after silence or a network hiccup: keep listening, backing off if it keeps failing.
      const wait = Math.min(8000, 250 * 2 ** Math.min(this.restarts++, 5));
      window.setTimeout(() => this.want && !this.rec && this.begin(), wait);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch (err) {
      this.rec = null;
      this.set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  private onResult(e: RecEvent, session: number): void {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      for (let a = 0; a < res.length; a++) {
        const text = res[a].transcript;
        const cmd = this.tracker.take(`${session}:${i}`, text, res.isFinal);
        if (!cmd) continue;
        this.fire(cmd, text);
        break;
      }
    }
  }

  /** A recognised command (also used by the Voice test panel and tests). */
  fire(cmd: VoiceCommand, text: string = VOICE_LABEL[cmd]): Heard {
    const now = performance.now();
    const g = this.gate.check(cmd, now);
    let verdict: Heard['verdict'] = 'ignored';
    if (g.ok) verdict = this.onCommand(cmd) ? 'accepted' : 'not-now';
    const heard: Heard = { text, cmd, verdict, at: now };
    if (verdict !== 'ignored') {
      this.set({ heard });
      if (verdict === 'accepted') audio.gesture();
    }
    return heard;
  }
}

/** The app-wide voice control, feeding the input hub. */
export const voice = new VoiceControl((cmd) => input.press(cmd, 'voice'));
