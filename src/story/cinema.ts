/**
 * In-engine cinematics: a script is a list of beats, played by the Cinema
 * scene (visuals, soundscape) and the CinemaPlayer overlay (dialogue, input).
 *
 * The runner here is pure and has no timers of its own: the player calls
 * tick() every frame and advance() on input. Staging beats hold for a set
 * time; dialogue lines wait for the player, so nothing is forced onto a
 * fixed clock and reading speed is the player's own.
 */

import type { Expression } from '../phaser/diorama/figures';

/** The stage a beat shows. */
export type SetId = 'dark' | 'memory' | 'heart' | 'sanctuary';

export type Speaker = 'elara' | 'hero';

export interface Line {
  /** Stable id, e.g. "opening.elara.03". Prerecorded voice files are looked up by it. */
  id: string;
  who: Speaker;
  text: string;
  /** Heard, not seen: shown as a caption without a portrait. */
  offscreen?: boolean;
  /** The speaker's expression in the portrait (neutral if not given). */
  mood?: Expression;
}

/** What the player hears. Beats change only the parts they name. */
export interface Soundscape {
  /** Rain loudness, 0–1. */
  rain: number;
  /** Heard from inside the Heart's cavern: rain through stone. */
  muffled: boolean;
  /** Heartbeat tempo (0 = silent) and loudness. */
  heart: number;
  heartVol: number;
  music: 'opening' | 'sanctuary' | null;
}

export const SILENCE: Soundscape = { rain: 0, muffled: false, heart: 0, heartVol: 0, music: null };

export interface Beat {
  /** Change to this stage (crossfading). */
  set?: SetId;
  /** Staging cues for the scene: camera moves and character animation. */
  cues?: string[];
  sound?: Partial<Soundscape>;
  /** A line of dialogue: waits for the player. */
  line?: Line;
  /** A staging beat holds this long (ms), then moves on. */
  ms?: number;
}

export interface Script {
  id: string;
  beats: Beat[];
}

/** Characters per second for the text reveal. */
export const CPS = 42;
/** Presses in the first moment of a line are ignored, so one press can't skip two lines. */
export const GUARD_MS = 180;

export class CinemaRunner {
  index = -1;
  /** Time in the current beat. */
  elapsed = 0;
  done = false;
  sound: Soundscape = { ...SILENCE };

  constructor(
    readonly script: Script,
    private readonly hooks: { onBeat?: (b: Beat, i: number, sound: Soundscape) => void; onDone?: (skipped: boolean) => void } = {},
  ) {}

  get beat(): Beat | null {
    return this.script.beats[this.index] ?? null;
  }

  start(): void {
    this.go(0);
  }

  tick(dt: number): void {
    if (this.done || this.index < 0) return;
    this.elapsed += dt;
    const b = this.beat!;
    if (!b.line && this.elapsed >= (b.ms ?? 0)) this.go(this.index + 1);
  }

  /** Characters of the current line to show. */
  visibleChars(): number {
    const l = this.beat?.line;
    if (!l) return 0;
    return Math.min(l.text.length, Math.floor((this.elapsed * CPS) / 1000));
  }

  /** The player pressed on: finish revealing the line, or move to the next beat. */
  advance(): void {
    const b = this.beat;
    if (this.done || !b?.line || this.elapsed < GUARD_MS) return;
    if (this.visibleChars() < b.line.text.length) this.elapsed = (b.line.text.length * 1000) / CPS + GUARD_MS;
    else this.go(this.index + 1);
  }

  skip(): void {
    if (this.done) return;
    this.done = true;
    this.hooks.onDone?.(true);
  }

  private go(i: number): void {
    if (i >= this.script.beats.length) {
      this.done = true;
      this.hooks.onDone?.(false);
      return;
    }
    this.index = i;
    this.elapsed = 0;
    const b = this.script.beats[i];
    if (b.sound) this.sound = { ...this.sound, ...b.sound };
    this.hooks.onBeat?.(b, i, this.sound);
  }
}

/**
 * Prerecorded voice lines, by line id, when they exist. Voice acting can be
 * added later by dropping files in public/voice/ and listing them here; until
 * then every line is read, not spoken (the browser's robotic voice is never
 * used for Elara).
 */
export const VOICE_LINES: Record<string, string> = {};
