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
    if (!on) {
      this.stopMusic();
      this.rain(0);
      this.score(null);
    }
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
    this.calm(false);
  }

  private calmTimer: number | null = null;
  private calmGain: GainNode | null = null;

  /**
   * Soft, slow ambient pad for Havens: sustained chords that swell and fade
   * every eight seconds, with an occasional gentle chime. Synthesised here,
   * like everything else — nothing is downloaded.
   */
  calm(on: boolean): void {
    if (!on) {
      if (this.calmTimer !== null) window.clearInterval(this.calmTimer);
      this.calmTimer = null;
      if (this.calmGain && this.ctx) {
        const g = this.calmGain;
        g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.8);
        window.setTimeout(() => g.disconnect(), 4000);
      }
      this.calmGain = null;
      return;
    }
    if (this.calmTimer !== null || !this.soundOn || !this.ctx || !this.master) return;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicTrack = null;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    out.connect(lp);
    lp.connect(this.master);
    this.calmGain = out;
    const chords = [
      [48, 55, 64, 71],
      [45, 52, 60, 67],
      [41, 48, 57, 64],
      [43, 50, 59, 62],
    ];
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    let i = 0;
    const play = () => {
      if (!this.soundOn || !this.ctx) return;
      const t = ctx.currentTime;
      for (const n of chords[i % chords.length]) {
        for (const detune of [-4, 4]) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = midi(n);
          o.detune.value = detune;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05, t + 3);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 9.5);
          o.connect(g);
          g.connect(out);
          o.start(t);
          o.stop(t + 10);
        }
      }
      if (i % 2 === 1) this.tone(midi(chords[i % chords.length][3] + 12), 2.5, 'sine', 0.05, 2, undefined, out);
      i++;
    };
    play();
    this.calmTimer = window.setInterval(play, 8000);
  }

  // ── Cinematic soundscape ────────────────────────────────────────────────
  private rainNodes: { gain: GainNode; lp: BiquadFilterNode; srcs: AudioBufferSourceNode[] } | null = null;

  /**
   * Soft, steady rain: a looped bed of filtered noise plus a sparse patter of
   * drops. Muffled, it's rain heard through stone (a low cutoff). Kept well
   * under dialogue and music.
   */
  rain(level: number, muffled = false): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const on = this.soundOn && level > 0;
    if (!this.rainNodes && on) {
      const len = ctx.sampleRate * 4;
      const bed = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = bed.getChannelData(0);
      // Brown-ish noise for the steady hush.
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.035 * (Math.random() * 2 - 1)) / 1.035;
        d[i] = last * 3.2;
      }
      const drops = ctx.createBuffer(1, len, ctx.sampleRate);
      const p = drops.getChannelData(0);
      for (let n = 0; n < 900; n++) {
        const at = Math.floor(Math.random() * (len - 400));
        const amp = 0.15 + Math.random() * 0.35;
        for (let k = 0; k < 300; k++) p[at + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 40);
      }
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 180;
      const srcs = [bed, drops].map((buf, i) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.55 : 0.28;
        const bp = ctx.createBiquadFilter();
        bp.type = i === 0 ? 'lowpass' : 'bandpass';
        bp.frequency.value = i === 0 ? 1400 : 2600;
        src.connect(bp);
        bp.connect(g);
        g.connect(hp);
        src.start();
        return src;
      });
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(this.master);
      this.rainNodes = { gain, lp, srcs };
    }
    const r = this.rainNodes;
    if (!r) return;
    const t = ctx.currentTime;
    r.gain.gain.setTargetAtTime(on ? Math.max(0.0001, level * 0.5) : 0.0001, t, on ? 0.6 : 0.5);
    r.lp.frequency.setTargetAtTime(muffled ? 360 : 3200, t, 0.5);
    if (!on) {
      const nodes = r;
      this.rainNodes = null;
      window.setTimeout(() => {
        nodes.srcs.forEach((x) => x.stop());
        nodes.gain.disconnect();
      }, 3000);
    }
  }

  /** One heartbeat: a low lub-dub, felt more than heard. */
  thump(vol = 0.6): void {
    if (!this.soundOn || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const beat = (when: number, f0: number, v: number) => {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + 0.3);
    };
    beat(0, 68, vol);
    beat(0.26, 58, vol * 0.7);
  }

  /** A soft glassy chime: light gathering into a shape. */
  form(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.07, i * 0.12));
  }

  /** A barely-there tick as a line of dialogue appears. */
  lineTick(): void {
    this.tone(1320, 0.05, 'sine', 0.035);
  }

  private scoreTimer: number | null = null;
  private scoreGain: GainNode | null = null;
  private scoreTrack: string | null = null;

  /**
   * The cinematic score: slow minor pads with a sparse, music-box melody.
   * "opening" is the fuller cue; "sanctuary" is quieter, for the garden.
   */
  score(track: 'opening' | 'sanctuary' | null): void {
    if (track === this.scoreTrack) return;
    this.scoreTrack = track;
    if (this.scoreTimer !== null) window.clearInterval(this.scoreTimer);
    this.scoreTimer = null;
    if (this.scoreGain && this.ctx) {
      const g = this.scoreGain;
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 1);
      window.setTimeout(() => g.disconnect(), 5000);
    }
    this.scoreGain = null;
    if (!track || !this.soundOn || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.gain.setTargetAtTime(track === 'opening' ? 0.55 : 0.32, ctx.currentTime, 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    out.connect(lp);
    lp.connect(this.master);
    this.scoreGain = out;
    // A minor – F – C – E minor: hopeful and a little sad.
    const chords = [
      [45, 52, 60, 64],
      [41, 48, 57, 64],
      [48, 55, 64, 67],
      [40, 47, 59, 64],
    ];
    const melody = [76, 0, 72, 74, 0, 71, 0, 0, 72, 0, 69, 71, 0, 67, 0, 0];
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    let i = 0;
    const bar = 6;
    const play = () => {
      if (!this.soundOn || !this.ctx) return;
      const t = ctx.currentTime;
      for (const n of chords[i % chords.length]) {
        for (const detune of [-5, 5]) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = midi(n);
          o.detune.value = detune;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.045, t + 2.2);
          g.gain.exponentialRampToValueAtTime(0.0001, t + bar + 1.5);
          o.connect(g);
          g.connect(out);
          o.start(t);
          o.stop(t + bar + 1.6);
        }
      }
      if (track === 'opening' || i % 2 === 1) {
        for (let k = 0; k < 4; k++) {
          const n = melody[(i * 4 + k) % melody.length];
          if (n) this.tone(midi(n + 12), 2.2, 'triangle', 0.05, k * (bar / 4), undefined, out);
        }
      }
      i++;
    };
    play();
    this.scoreTimer = window.setInterval(play, bar * 1000);
  }

  /** Duck the music while the player exercises so cues are audible. */
  duck(on: boolean): void {
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.06 : 0.18, this.ctx.currentTime, 0.2);
  }

  /** When the game last finished speaking (Infinity while it speaks) — voice commands ignore that window. */
  speakingUntil = -Infinity;

  /** The time speech ended, or Infinity while the game is talking. */
  speechEndedAt(): number {
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) return Infinity;
    return this.speakingUntil === Infinity ? performance.now() : this.speakingUntil;
  }

  say(text: string, interrupt = true): void {
    if (!this.voiceOn || typeof speechSynthesis === 'undefined') return;
    try {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.rate = 1.05;
      u.pitch = 1;
      this.speakingUntil = Infinity;
      const done = () => {
        if (!speechSynthesis.speaking) this.speakingUntil = performance.now();
      };
      u.onend = done;
      u.onerror = done;
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
