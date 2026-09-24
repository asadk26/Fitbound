/**
 * Tiny WebAudio synth for sound effects and a looping chiptune, plus spoken
 * cues via the Web Speech API. Nothing is loaded from the network.
 *
 * iOS Safari only allows audio after a user gesture, so `unlock()` is called
 * from the first tap.
 */

type Wave = OscillatorType;

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicTrack: string | null = null;
  soundOn = true;
  voiceOn = true;

  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.18;
        this.musicGain.connect(this.master);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio unavailable */
    }
    // iOS only lets speech start from a user gesture; a silent utterance
    // during the first tap unlocks it for later cues.
    if (!this.speechPrimed && typeof speechSynthesis !== 'undefined') {
      this.speechPrimed = true;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch {
        /* speech unavailable */
      }
    }
  }
  private speechPrimed = false;

  setSound(on: boolean): void {
    this.soundOn = on;
    if (!on) this.stopMusic();
  }

  private tone(freq: number, dur: number, wave: Wave = 'square', vol = 0.5, when = 0, slideTo?: number, dest?: AudioNode): void {
    if (!this.soundOn || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.4, when = 0, filterFreq = 1200): void {
    if (!this.soundOn || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  /** Confirmation blip for a counted rep; pitch climbs through the set. */
  rep(index: number, target: number): void {
    const k = Math.min(1, index / Math.max(1, target));
    const base = 440 * Math.pow(2, (k * 12) / 12);
    this.tone(base, 0.09, 'square', 0.35);
    this.tone(base * 1.5, 0.12, 'square', 0.25, 0.06);
  }
  slash(power = 0): void {
    this.noise(0.12 + power * 0.08, 0.5, 0, 3000 + power * 2000);
    this.tone(900, 0.1, 'sawtooth', 0.2, 0, 300);
  }
  hit(): void {
    this.tone(160, 0.15, 'square', 0.4, 0, 60);
    this.noise(0.1, 0.3, 0, 800);
  }
  magic(power = 0): void {
    this.tone(600 + power * 300, 0.25, 'triangle', 0.35, 0, 1400 + power * 600);
    this.tone(900, 0.2, 'sine', 0.2, 0.05, 1800);
  }
  shield(): void {
    this.tone(300, 0.2, 'triangle', 0.4, 0, 600);
    this.tone(600, 0.25, 'sine', 0.2, 0.05);
  }
  heal(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.3, i * 0.07));
  }
  hurt(): void {
    this.tone(220, 0.25, 'sawtooth', 0.35, 0, 80);
  }
  block(): void {
    this.tone(1200, 0.08, 'square', 0.25);
    this.noise(0.06, 0.2, 0, 4000);
  }
  finisher(): void {
    this.noise(0.4, 0.5, 0, 1500);
    [196, 262, 330, 392].forEach((f, i) => this.tone(f, 0.25, 'square', 0.3, i * 0.05));
  }
  countdown(final = false): void {
    this.tone(final ? 880 : 440, final ? 0.3 : 0.12, 'square', 0.35);
  }
  select(): void {
    this.tone(660, 0.06, 'square', 0.25);
  }
  error(): void {
    this.tone(200, 0.15, 'square', 0.3, 0, 150);
  }
  step(): void {
    this.noise(0.03, 0.08, 0, 600);
  }
  levelUp(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'square', 0.3, i * 0.09));
  }
  victory(): void {
    [392, 392, 392, 523, 466, 523].forEach((f, i) => this.tone(f, i === 5 ? 0.5 : 0.14, 'square', 0.3, [0, 0.14, 0.28, 0.42, 0.62, 0.76][i]));
  }
  /** A bright "go" chord when counting starts. */
  exerciseStart(): void {
    [523, 659, 784].forEach((f) => this.tone(f, 0.35, 'square', 0.22));
    this.tone(1047, 0.4, 'triangle', 0.3, 0.08);
  }
  setComplete(): void {
    [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.22, 'square', 0.28, i * 0.08));
  }
  /** Two-note chime announcing the next exercise. */
  nextExercise(): void {
    this.tone(784, 0.18, 'triangle', 0.35);
    this.tone(1175, 0.3, 'triangle', 0.35, 0.16);
  }
  /** Low double buzz: the camera lost the player. */
  trackingLost(): void {
    this.tone(180, 0.16, 'square', 0.3);
    this.tone(150, 0.22, 'square', 0.3, 0.2);
  }
  /** Soft rising blip when a gesture is recognised. */
  gesture(): void {
    this.tone(880, 0.08, 'sine', 0.3);
    this.tone(1320, 0.12, 'sine', 0.3, 0.07);
  }
  defeat(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, i * 0.18));
  }
  phaseBreak(): void {
    this.noise(0.6, 0.5, 0, 900);
    this.tone(110, 0.6, 'sawtooth', 0.35, 0, 55);
  }

  /** Simple looping chiptune. */
  music(track: 'village' | 'dungeon' | 'battle' | 'boss' | null): void {
    if (track === this.musicTrack) return;
    this.stopMusic();
    this.musicTrack = track;
    if (!track || !this.soundOn || !this.ctx) return;
    const songs: Record<string, { bpm: number; lead: number[]; bass: number[]; wave: Wave }> = {
      village: { bpm: 104, wave: 'triangle', lead: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 77, 74], bass: [48, 48, 53, 53, 48, 48, 55, 55] },
      dungeon: { bpm: 84, wave: 'triangle', lead: [69, 0, 72, 0, 71, 0, 67, 0, 69, 0, 72, 76, 75, 0, 71, 0], bass: [45, 45, 43, 43, 41, 41, 40, 40] },
      battle: { bpm: 150, wave: 'square', lead: [69, 72, 76, 72, 74, 77, 81, 77, 69, 72, 76, 79, 77, 76, 74, 72], bass: [45, 45, 45, 45, 41, 41, 43, 43] },
      boss: { bpm: 160, wave: 'square', lead: [64, 67, 70, 67, 63, 66, 70, 66, 64, 67, 71, 74, 73, 70, 67, 64], bass: [40, 40, 39, 39, 40, 40, 34, 34] },
    };
    const song = songs[track];
    const step = 60 / song.bpm / 2;
    let i = 0;
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    const tick = () => {
      if (!this.soundOn || !this.ctx) return;
      const n = song.lead[i % song.lead.length];
      if (n) this.tone(midi(n), step * 0.9, song.wave, 0.35, 0, undefined, this.musicGain!);
      if (i % 2 === 0) {
        const b = song.bass[(i / 2) % song.bass.length];
        this.tone(midi(b), step * 1.8, 'triangle', 0.5, 0, undefined, this.musicGain!);
      }
      i++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, step * 1000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicTrack = null;
  }

  /** Duck the music while the player exercises so cues are audible. */
  duck(on: boolean): void {
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.06 : 0.18, this.ctx.currentTime, 0.2);
  }

  say(text: string, interrupt = true): void {
    if (!this.voiceOn || typeof speechSynthesis === 'undefined') return;
    try {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.rate = 1.05;
      u.pitch = 1;
      speechSynthesis.speak(u);
    } catch {
      /* speech unavailable */
    }
  }
}

/**
 * Some voices read "Push-ups" as "push U-P-S" (the shipping company). Speak
 * exercise names in a form every voice pronounces as words.
 */
export function speakable(text: string): string {
  return text.replace(/\bpush-ups\b/gi, 'push ups').replace(/\bpush-up\b/gi, 'push up');
}

export const audio = new Audio();
