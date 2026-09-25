/**
 * Voice commands: a deliberately tiny vocabulary, matched strictly.
 *
 *   "Pause"        → pause the game and any set in progress
 *   "Resume"       → leave the pause menu
 *   "Finish set"   → end the current set now; verified work so far counts
 *   "Recalibrate"  → quick camera recalibration (progress is kept)
 *
 * An utterance matches only if it *is* the command, give or take a couple of
 * filler words ("okay pause", "finish the set please"). Commands buried in a
 * sentence ("we should pause for a sec") don't fire. The same command can't
 * fire twice from one utterance or in quick succession, and nothing is
 * accepted while the game itself is speaking (its narration could otherwise
 * say a command word through the speakers).
 */
export type VoiceCommand = 'pause' | 'resume' | 'finish' | 'recalibrate';

export const VOICE_LABEL: Record<VoiceCommand, string> = { pause: 'Pause', resume: 'Resume', finish: 'Finish set', recalibrate: 'Recalibrate' };

/** Accepted phrasings, including common mishearings from speech engines. */
const PHRASES: Record<VoiceCommand, string[]> = {
  pause: ['pause', 'pause game', 'pause the game', 'paws', 'pods', 'pours', 'pause it', 'hold on'],
  resume: ['resume', 'resume game', 'resume the game', 'unpause', 'continue', 'keep going', 'presume', 're zoom', 'rezoom'],
  finish: ['finish set', 'finish the set', 'finish', 'finished', 'finished set', 'end set', 'end the set', 'set done', 'set finished', 'done', 'i am done', "i'm done", 'im done', 'finish that', 'finnish set'],
  recalibrate: ['recalibrate', 're calibrate', 'calibrate', 'recalibration', 'calibrate camera', 'recalibrate camera'],
};

const FILLER = new Set(['okay', 'ok', 'please', 'hey', 'now', 'game', 'um', 'uh', 'so', 'alright', 'right', 'yes', 'yeah']);

/** At most this many filler words around the phrase. */
const MAX_FILLER = 2;

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/re-/g, 're ')
    .replace(/[^a-z' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const TABLE: { cmd: VoiceCommand; words: string[] }[] = (Object.keys(PHRASES) as VoiceCommand[]).flatMap((cmd) => PHRASES[cmd].map((p) => ({ cmd, words: normalize(p) })));

/** The command an utterance is, or null. */
export function matchCommand(transcript: string): VoiceCommand | null {
  const w = normalize(transcript);
  if (!w.length || w.length > 6) return null;
  // Longest phrase first, so "finish set" wins over "finish".
  for (const { cmd, words } of [...TABLE].sort((a, b) => b.words.length - a.words.length)) {
    for (let i = 0; i + words.length <= w.length; i++) {
      if (!words.every((x, j) => w[i + j] === x)) continue;
      const rest = [...w.slice(0, i), ...w.slice(i + words.length)];
      if (rest.length <= MAX_FILLER && rest.every((x) => FILLER.has(x))) return cmd;
    }
  }
  return null;
}

export interface GateVerdict {
  ok: boolean;
  reason?: 'repeat' | 'too-soon' | 'game-speaking';
}

/** Debounce plus the self-hearing guard. */
export class VoiceGate {
  private last: { cmd: VoiceCommand; at: number } | null = null;

  constructor(
    private readonly opts = { sameMs: 2500, anyMs: 900, afterSpeechMs: 700 },
    /** Returns the time the game last finished speaking, or Infinity while it is speaking. */
    private readonly speechEndedAt: () => number = () => -Infinity,
  ) {}

  check(cmd: VoiceCommand, now: number): GateVerdict {
    const spoke = this.speechEndedAt();
    if (spoke === Infinity || now - spoke < this.opts.afterSpeechMs) return { ok: false, reason: 'game-speaking' };
    if (this.last) {
      if (this.last.cmd === cmd && now - this.last.at < this.opts.sameMs) return { ok: false, reason: 'repeat' };
      if (now - this.last.at < this.opts.anyMs) return { ok: false, reason: 'too-soon' };
    }
    this.last = { cmd, at: now };
    return { ok: true };
  }

  reset(): void {
    this.last = null;
  }
}

/**
 * Turns a stream of recognition results into commands: each result (interim
 * or final) can fire at most one command, once. Interim results fire only on
 * an exact, filler-free match (fast "pause" without waiting for the engine
 * to finalise); anything else waits for the final transcript.
 */
export class ResultTracker {
  private fired = new Set<string>();

  take(resultKey: string, transcript: string, isFinal: boolean): VoiceCommand | null {
    if (this.fired.has(resultKey)) return null;
    const cmd = matchCommand(transcript);
    if (!cmd) return null;
    if (!isFinal && !PHRASES[cmd].some((p) => normalize(p).join(' ') === normalize(transcript).join(' '))) return null;
    this.fired.add(resultKey);
    if (this.fired.size > 200) this.fired = new Set([...this.fired].slice(-100));
    return cmd;
  }

  reset(): void {
    this.fired.clear();
  }
}
