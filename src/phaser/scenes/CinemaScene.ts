import Phaser from 'phaser';
import { audio } from '../../game/audio';
import { bus } from '../../game/bus';
import type { SetId, Soundscape } from '../../story/cinema';
import { paintCavern, paintFragments, paintHeart, paintMemories, paintSanctuary, paintSlab, paintWeather, paintWell, SANCT, SANCT_SPOTS } from '../diorama/cinemaArt';
import { FIG_H, FIG_ORIGIN_Y, paintFigure } from '../diorama/figures';

/**
 * In-engine cinematics, in the diorama style. Four stages live side by side
 * in world space and the camera moves between them: darkness, the kingdom's
 * memories, the Heart's cavern, and the Sanctuary garden (in the rain, until
 * the first restoration). Scripts drive it through `cine:beat` events — a
 * stage change, named staging cues, and the soundscape — so the same scene
 * plays the opening, the short ritual, and the quiet garden behind the
 * Sanctuary setup screen.
 */
const W = 200;
const H = 112.5;
const FIG = 26;
const WARM = 0xffb45a;
const SETS: Record<SetId, { x: number; y: number }> = {
  sanctuary: { x: 100, y: 62 },
  heart: { x: 1100, y: 56 },
  memory: { x: 2100, y: 56 },
  dark: { x: 3100, y: 56 },
};
const IDLE = { x: 100, y: 64, zoom: 1 };
/** How wide a memory fragment is (a little under the view, so it floats in the dark). */
const MEM = 138;

export interface CinemaData {
  /** Playing a script, or just the quiet garden behind the Sanctuary screen. */
  mode: 'play' | 'idle';
  /** After the first restoration: no rain, sunlight. The opening always rains. */
  restored: boolean;
}

export class CinemaScene extends Phaser.Scene {
  private data0: CinemaData = { mode: 'idle', restored: false };
  private baseZoom = 1;
  private set: SetId = 'sanctuary';
  private offBus: (() => void)[] = [];
  private beat = { bpm: 0, vol: 0, t: 0 };
  private hero!: Phaser.GameObjects.Sprite;
  private elara!: Phaser.GameObjects.Sprite;
  private wellGlow!: Phaser.GameObjects.Image;
  private puddleGlows: Phaser.GameObjects.Image[] = [];
  private spark!: Phaser.GameObjects.Image;
  private darkGlow!: Phaser.GameObjects.Image;
  private heart!: Phaser.GameObjects.Image;
  private heartGlow!: Phaser.GameObjects.Image;
  private rings!: Phaser.GameObjects.Graphics;
  private ringSpeed = 0.2;
  private ringAngle = 0;
  private memories: Phaser.GameObjects.Image[] = [];
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private elaraBaseX: number = SANCT_SPOTS.elara.x;
  /** Each stage's objects: only the stage on camera is drawn. */
  private groups: Partial<Record<SetId, Phaser.GameObjects.GameObject[]>> = {};

  constructor() {
    super('Cinema');
  }

  init(data: Partial<CinemaData>): void {
    this.data0 = { mode: data.mode ?? 'idle', restored: !!data.restored };
    this.offBus = [];
    this.puddleGlows = [];
    this.memories = [];
    this.beat = { bpm: 0, vol: 0, t: 0 };
    this.rain = undefined;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#07060a');
    this.paintOnce();
    this.groups = {};
    const build = (set: SetId, fn: () => void) => {
      const n = this.children.list.length;
      fn();
      this.groups[set] = this.children.list.slice(n);
    };
    build('dark', () => this.buildDark());
    build('memory', () => this.buildMemory());
    build('heart', () => this.buildHeart());
    build('sanctuary', () => this.buildSanctuary(this.data0.restored));
    this.fit();
    this.scale.on('resize', this.fit, this);
    if (this.data0.mode === 'idle') this.idle(this.data0.restored);
    else this.cut('dark');
    this.offBus.push(
      bus.on('cine:beat', (b) => this.onBeat(b.set, b.cues, b.sound)),
      bus.on('cine:idle', ({ restored }) => {
        if (restored !== this.data0.restored) this.scene.restart({ mode: 'idle', restored });
        else this.idle(restored);
      }),
    );
    this.events.once('shutdown', () => {
      this.offBus.forEach((f) => f());
      this.scale.off('resize', this.fit, this);
      audio.rain(0);
      audio.score(null);
    });
    bus.emit('cine:ready');
  }

  /** Cinematic art is painted the first time it's needed, not at boot. */
  private paintOnce(): void {
    const t = this.textures;
    if (t.exists('cine-heart')) return;
    const add = (key: string, c: HTMLCanvasElement) => t.addCanvas(key, c);
    add('fig-elara-blink-free', paintFigure('elara', false, true));
    add('cine-sanct', paintSanctuary(false));
    add('cine-sanct-dry', paintSanctuary(true));
    add('cine-well', paintWell(false));
    add('cine-slab', paintSlab());
    add('cine-cavern', paintCavern());
    add('cine-heart', paintHeart());
    for (const [k, c] of Object.entries(paintMemories())) add(`cine-mem-${k}`, c);
    for (const [k, c] of Object.entries(paintFragments())) add(`cine-frag-${k}`, c);
    for (const [k, c] of Object.entries(paintWeather())) add(`cine-${k}`, c);
  }

  // ── Stages ──────────────────────────────────────────────────────────────

  private buildDark(): void {
    const { x, y } = SETS.dark;
    this.add.rectangle(x, y, W * 3, H * 3, 0x050407);
    this.darkGlow = this.add.image(x, y, 'glow').setTint(WARM).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setAlpha(0);
  }

  private buildMemory(): void {
    const { x, y } = SETS.memory;
    this.add.rectangle(x, y, W * 3, H * 3, 0x0a080c);
    for (const k of ['square', 'towers', 'field']) {
      this.memories.push(
        this.add
          .image(x, y, `cine-mem-${k}`)
          .setScale(MEM / 960)
          .setAlpha(0),
      );
    }
    // Haze drifting across the memories.
    for (let i = 0; i < 7; i++) {
      const wisp = this.add
        .image(x - 140 + i * 40, y - 30 + (i % 3) * 30, 'glow')
        .setTint(0x9a9aa8)
        .setScale(3 + (i % 3), 1.4)
        .setAlpha(0.18);
      this.tweens.add({ targets: wisp, x: wisp.x + 90, duration: 9000 + i * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private buildHeart(): void {
    const { x, y } = SETS.heart;
    this.add
      .image(x - 100, y - 60, 'cine-cavern')
      .setOrigin(0)
      .setScale(0.2);
    this.heartGlow = this.add.image(x, y, 'glow').setTint(WARM).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setAlpha(0.35);
    this.rings = this.add.graphics();
    this.heart = this.add.image(x, y, 'cine-heart').setScale(0.13);
    // Slow motes rising in the dark.
    this.add.particles(x, y + 40, 'glow', {
      x: { min: -100, max: 100 },
      lifespan: 6000,
      speedY: { min: -6, max: -2 },
      speedX: { min: -2, max: 2 },
      scale: { start: 0.08, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: WARM,
      blendMode: 'ADD',
      frequency: 180,
    });
  }

  private buildSanctuary(restored: boolean): void {
    this.add
      .image(SANCT.ox, SANCT.oy, restored ? 'cine-sanct-dry' : 'cine-sanct')
      .setOrigin(0)
      .setScale(1 / SANCT.ppu)
      .setDepth(-10);
    // The Spark: small and stubborn on the far rise.
    const sp = SANCT_SPOTS.spark;
    this.spark = this.add.image(sp.x, sp.y, 'glow').setTint(0xffc46a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.7).setDepth(-5);
    const core = this.add.image(sp.x, sp.y, 'glow').setTint(0xfff4d8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.07).setDepth(-5);
    this.tweens.add({ targets: [this.spark, core], alpha: { from: 0.55, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // Puddles holding the Heart's warm light.
    for (const [px, py, pr] of SANCT_SPOTS.puddles) {
      const g = this.add
        .image(px, py, 'glow')
        .setTint(WARM)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(pr / 12, pr / 34)
        .setAlpha(restored ? 0.12 : 0.28)
        .setDepth(1);
      this.puddleGlows.push(g);
    }
    const sl = SANCT_SPOTS.slab;
    this.add
      .image(sl.x, sl.y, 'cine-slab')
      .setOrigin(0.5, 0.78)
      .setScale(0.1)
      .setDepth(sl.y - 6);
    const w = SANCT_SPOTS.well;
    this.add.image(w.x, w.y, 'cine-well').setOrigin(0.5, 0.9).setScale(0.1).setDepth(w.y);
    this.wellGlow = this.add
      .image(w.x, w.y - 5, 'glow')
      .setTint(WARM)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.7, 0.35)
      .setAlpha(0.7)
      .setDepth(w.y + 0.5);
    // Light rising from the well.
    this.add
      .particles(w.x, w.y - 5, 'glow', {
        x: { min: -5, max: 5 },
        lifespan: 2600,
        speedY: { min: -7, max: -3 },
        scale: { start: 0.05, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: WARM,
        blendMode: 'ADD',
        frequency: 260,
      })
      .setDepth(w.y + 1);
    const k = FIG / FIG_H;
    this.hero = this.add.sprite(SANCT_SPOTS.heroStand.x, SANCT_SPOTS.heroStand.y, 'fig-hero-free').setOrigin(0.5, FIG_ORIGIN_Y).setScale(k).setAlpha(0);
    this.elara = this.add
      .sprite(SANCT_SPOTS.elara.x, SANCT_SPOTS.elara.y, 'fig-elara-free')
      .setOrigin(0.5, FIG_ORIGIN_Y)
      .setScale(k * 1.04)
      .setDepth(SANCT_SPOTS.elara.y);
    if (!restored) {
      // Rain-light: a cool cast on the figures.
      this.hero.setTint(0xdfe5f2);
      this.elara.setTint(0xe6ebf5);
    }
    // Small signs of life: breathing, a slow sway of hair, a blink now and then.
    this.tweens.add({ targets: this.elara, scaleY: k * 1.04 * 1.012, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.elara, angle: { from: -0.8, to: 0.8 }, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.hero, scaleY: k * 1.015, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const blink = () => {
      if (!this.elara.active) return;
      this.elara.setTexture('fig-elara-blink-free');
      this.time.delayedCall(130, () => this.elara.active && this.elara.setTexture('fig-elara-free'));
      this.time.delayedCall(2800 + Math.random() * 3500, blink);
    };
    this.time.delayedCall(2200, blink);
    if (restored) {
      for (let i = 0; i < 4; i++) {
        const b = this.add
          .image(30 + i * 42, -10, 'cine-beam')
          .setOrigin(0.5, 0)
          .setScale(0.5, 0.26)
          .setAngle(-16)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.14)
          .setDepth(400);
        this.tweens.add({ targets: b, alpha: 0.24, duration: 3000 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      return;
    }
    // Soft, steady rain over the garden, and ripples where it lands.
    this.rain = this.add.particles(0, 0, 'cine-rain', {
      x: { min: -40, max: 380 },
      y: { min: -30, max: -10 },
      lifespan: 1100,
      speedY: { min: 120, max: 150 },
      speedX: { min: -24, max: -18 },
      rotate: 9,
      scaleX: 0.12,
      scaleY: { min: 0.1, max: 0.16 },
      alpha: { min: 0.16, max: 0.34 },
      tint: 0xdce6f5,
      frequency: 9,
      quantity: 2,
    });
    this.rain.setDepth(500);
    const isl = SANCT_SPOTS.island;
    this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        if (this.set !== 'sanctuary') return;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * 0.92;
        const rx = isl.x + Math.cos(a) * isl.rx * d;
        const ry = isl.y + Math.sin(a) * isl.ry * d;
        const rp = this.add.image(rx, ry, 'cine-ripple').setScale(0.01, 0.01).setAlpha(0.45).setDepth(2);
        this.tweens.add({ targets: rp, scaleX: 0.07, scaleY: 0.06, alpha: 0, duration: 650, onComplete: () => rp.destroy() });
      },
    });
  }

  // ── Camera ──────────────────────────────────────────────────────────────

  private fit(): void {
    this.baseZoom = Math.min(this.scale.width / W, this.scale.height / H);
    this.cameras.main.setZoom(this.baseZoom);
  }

  private look(x: number, y: number, zoom = 1, ms = 0, ease = 'Sine.easeInOut'): void {
    const cam = this.cameras.main;
    if (!ms) {
      cam.centerOn(x, y);
      cam.setZoom(this.baseZoom * zoom);
      return;
    }
    cam.pan(x, y, ms, ease, true);
    cam.zoomTo(this.baseZoom * zoom, ms, ease, true);
  }

  private cut(set: SetId): void {
    this.set = set;
    const c = SETS[set];
    this.look(c.x, c.y);
    for (const [k, objs] of Object.entries(this.groups)) for (const o of objs!) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(k === set);
    if (set === 'sanctuary') this.rain?.resume();
    else this.rain?.pause();
  }

  private changeSet(set: SetId, how: 'fade' | 'flash'): void {
    const cam = this.cameras.main;
    if (how === 'flash') {
      this.cut(set);
      cam.flash(1100, 255, 238, 205);
      return;
    }
    cam.fadeOut(500, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cut(set);
      cam.fadeIn(900, 0, 0, 0);
    });
  }

  /** The quiet garden behind the Sanctuary screen: both of them there, the rain going on. */
  private idle(restored: boolean): void {
    this.tweens.killTweensOf([this.hero]);
    this.cut('sanctuary');
    this.look(IDLE.x, IDLE.y, IDLE.zoom);
    this.hero.setAlpha(1).setAngle(0).setPosition(SANCT_SPOTS.heroStand.x, SANCT_SPOTS.heroStand.y).setDepth(SANCT_SPOTS.heroStand.y);
    this.elara.setPosition(SANCT_SPOTS.elara.x, SANCT_SPOTS.elara.y).setFlipX(false).setDepth(SANCT_SPOTS.elara.y);
    this.beat.bpm = 0;
    audio.rain(restored ? 0 : 0.32, false);
    audio.score('sanctuary');
  }

  // ── Beats ───────────────────────────────────────────────────────────────

  private onBeat(set: SetId | undefined, cues: string[], sound: Soundscape): void {
    if (set && set !== this.set) this.changeSet(set, cues.includes('flash') ? 'flash' : 'fade');
    audio.rain(this.data0.restored ? 0 : sound.rain, sound.muffled);
    audio.score(sound.music);
    this.beat.bpm = sound.heart;
    this.beat.vol = sound.heartVol;
    for (const c of cues) this.cue(c);
  }

  private cue(c: string): void {
    const S = SANCT_SPOTS;
    const k = FIG / FIG_H;
    switch (c) {
      case 'heart-glow':
        this.tweens.add({ targets: this.darkGlow, alpha: 0.75, duration: 2500 });
        break;
      case 'mem-square':
      case 'mem-towers':
      case 'mem-field': {
        const i = ['mem-square', 'mem-towers', 'mem-field'].indexOf(c);
        this.memories.forEach((m, j) => {
          if (j === i) {
            m.setScale(MEM / 960);
            this.tweens.add({ targets: m, alpha: 1, duration: 1400 });
            this.tweens.add({ targets: m, scale: (MEM / 960) * 1.08, x: SETS.memory.x + (i - 1) * 4, duration: 10000 });
          } else if (m.alpha > 0) this.tweens.add({ targets: m, alpha: 0, duration: 1400 });
        });
        break;
      }
      case 'heart-wake':
        this.look(SETS.heart.x, SETS.heart.y, 0.95);
        this.look(SETS.heart.x, SETS.heart.y, 1.12, 7000);
        this.tweens.add({ targets: this.heartGlow, alpha: 0.75, scale: 2.8, duration: 3000 });
        this.tweens.addCounter({ from: 0.2, to: 1, duration: 3000, onUpdate: (tw) => (this.ringSpeed = tw.getValue() ?? 1) });
        break;
      case 'heart-gather': {
        const { x, y } = SETS.heart;
        (
          [
            ['sword', -80, -30],
            ['cape', 84, -20],
            ['hand', -40, 44],
          ] as const
        ).forEach(([f, dx, dy], i) => {
          const img = this.add
            .image(x + dx, y + dy, `cine-frag-${f}`)
            .setScale(0.12)
            .setAlpha(0)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: img, alpha: 0.95, duration: 600, delay: i * 350 });
          this.tweens.add({ targets: img, x, y, scale: 0.02, duration: 2600, delay: i * 350, ease: 'Sine.easeIn', onComplete: () => img.destroy() });
        });
        break;
      }
      case 'heart-flare':
        this.tweens.add({ targets: this.heartGlow, scale: 6, alpha: 1, duration: 1200, ease: 'Quad.in' });
        this.tweens.add({ targets: this.heart, scale: 0.17, duration: 1200, ease: 'Quad.in' });
        break;
      case 'sanct-open':
        this.hero
          .setAlpha(0)
          .setAngle(-90)
          .setPosition(S.slab.x, S.slab.y - 5)
          .setDepth(S.slab.y);
        this.elara.setPosition(S.elara.x, S.elara.y).setFlipX(true).setDepth(S.elara.y);
        this.look(96, 56, 0.92);
        this.look(92, 66, 1.08, 8000);
        break;
      case 'hero-form':
        this.gather(S.slab.x, S.slab.y - 6, () => this.tweens.add({ targets: this.hero, alpha: 1, duration: 900 }));
        break;
      case 'hero-rise':
        this.tweens.add({
          targets: this.hero,
          angle: 0,
          y: S.slab.y - 6,
          duration: 1300,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.tweens.add({ targets: this.hero, x: S.heroStand.x, y: S.heroStand.y, duration: 700, ease: 'Sine.easeInOut', onComplete: () => this.hero.setDepth(S.heroStand.y) });
            this.tweens.add({ targets: this.hero, scaleY: k * 0.94, duration: 160, delay: 700, yoyo: true });
          },
        });
        break;
      case 'elara-stand':
        // A step toward him, in front of the well.
        this.elara.setFlipX(false);
        this.tweens.add({ targets: this.elara, x: S.elara.x - 3, y: S.elara.y + 4, duration: 1100, ease: 'Sine.easeInOut', onUpdate: () => this.elara.setDepth(this.elara.y) });
        this.elaraBaseX = S.elara.x - 3;
        break;
      case 'two-shot':
        this.look((S.heroStand.x + S.elara.x) / 2, 86, 1.6, 1800);
        break;
      case 'elara-look-away':
        this.elara.setFlipX(true);
        this.tweens.add({ targets: this.elara, x: this.elaraBaseX + 2, duration: 600 });
        break;
      case 'elara-look-back':
        this.elara.setFlipX(false);
        this.tweens.add({ targets: this.elara, x: this.elaraBaseX, duration: 500 });
        break;
      case 'to-spark':
        this.elara.setFlipX(true);
        this.tweens.add({ targets: this.elara, x: S.edge.x, y: S.edge.y, duration: 2600, ease: 'Sine.easeInOut', onUpdate: () => this.elara.setDepth(this.elara.y) });
        this.look(224, 66, 1, 3800);
        this.tweens.add({ targets: this.spark, scale: 0.7, duration: 3800 });
        break;
      case 'from-spark':
        this.elara.setFlipX(false);
        this.tweens.add({ targets: this.elara, x: S.elara.x - 4, y: S.elara.y, duration: 2000, ease: 'Sine.easeInOut', onUpdate: () => this.elara.setDepth(this.elara.y) });
        this.look(112, 80, 1.45, 2400);
        this.tweens.add({ targets: this.spark, scale: 0.45, duration: 2400 });
        break;
      case 'settle':
        this.look(IDLE.x, IDLE.y, IDLE.zoom, 900);
        break;
      case 'ritual-open':
        this.cut('sanctuary');
        this.hero.setAlpha(0).setAngle(0).setPosition(S.heroStand.x, S.heroStand.y).setDepth(S.heroStand.y);
        this.elara.setPosition(S.elara.x, S.elara.y).setFlipX(true).setDepth(S.elara.y);
        this.elaraBaseX = S.elara.x;
        // Framed high, so both stay clear of the dialogue box.
        this.look(IDLE.x + 8, 76, 1.2);
        this.look(IDLE.x + 6, 82, 1.35, 5500);
        break;
      case 'ritual-form':
        this.gather(S.heroStand.x, S.heroStand.y - 12, () => this.tweens.add({ targets: this.hero, alpha: 1, duration: 700 }));
        break;
      case 'elara-glance':
        this.elara.setFlipX(false);
        this.tweens.add({ targets: this.elara, y: S.elara.y - 1.5, duration: 160, yoyo: true });
        break;
      case 'flash':
        break;
    }
  }

  /** Light gathers into a point, then a figure: the Heart's reconstruction. */
  private gather(x: number, y: number, then: () => void): void {
    const motes = this.add
      .particles(x, y, 'glow', {
        emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 26), quantity: 40 },
        moveToX: 0,
        moveToY: 0,
        lifespan: 1300,
        scale: { start: 0.1, end: 0.02 },
        alpha: { start: 0.2, end: 1 },
        tint: WARM,
        blendMode: 'ADD',
        frequency: 40,
      })
      .setDepth(600);
    const core = this.add.image(x, y, 'glow').setTint(0xfff0d0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1).setAlpha(0).setDepth(601);
    this.tweens.add({ targets: core, alpha: 0.9, scale: 1, duration: 1600, ease: 'Quad.in' });
    this.time.delayedCall(1700, () => {
      motes.stop();
      audio.form();
      then();
      this.tweens.add({ targets: core, alpha: 0, scale: 2, duration: 700, onComplete: () => core.destroy() });
      this.time.delayedCall(1500, () => motes.destroy());
    });
  }

  // ── Heartbeat and rings ─────────────────────────────────────────────────

  update(_t: number, dt: number): void {
    bus.emit('cine:tick', { dt });
    if (this.beat.bpm > 0) {
      this.beat.t += dt;
      if (this.beat.t >= 60000 / this.beat.bpm) {
        this.beat.t = 0;
        audio.thump(this.beat.vol);
        this.pulse();
      }
    }
    this.ringAngle += (dt / 1000) * this.ringSpeed;
    if (this.set === 'heart') this.drawRings();
  }

  private pulse(): void {
    const bump = (o: Phaser.GameObjects.Image, k: number) => {
      const sx = o.scaleX;
      const sy = o.scaleY;
      this.tweens.add({ targets: o, scaleX: sx * k, scaleY: sy * k, duration: 140, yoyo: true, ease: 'Quad.out' });
    };
    if (this.set === 'dark') bump(this.darkGlow, 1.25);
    else if (this.set === 'heart') {
      bump(this.heart, 1.06);
      bump(this.heartGlow, 1.12);
    } else if (this.set === 'sanctuary') {
      bump(this.wellGlow, 1.1);
      for (const g of this.puddleGlows) bump(g, 1.08);
    }
  }

  /** Brass rings turning slowly around the Heart: tilted ellipses with notches that travel. */
  private drawRings(): void {
    const g = this.rings.clear();
    const { x, y } = SETS.heart;
    (
      [
        [38, 12, 0.4, 1],
        [48, 16, -0.2, -0.7],
        [58, 20, 0.15, 0.5],
      ] as const
    ).forEach(([rx, ry, tilt, dir], i) => {
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      const pt = (a: number) => {
        const px = Math.cos(a) * rx;
        const py = Math.sin(a) * ry;
        return [x + px * cos - py * sin, y + px * sin + py * cos] as const;
      };
      g.lineStyle(1.4, 0xb8894a, 0.75);
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 40) {
        const [px, py] = pt(a);
        if (a === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      for (let n = 0; n < 10; n++) {
        const a = this.ringAngle * dir * (1 + i * 0.3) + (n / 10) * Math.PI * 2;
        const [px, py] = pt(a);
        const front = Math.sin(a) > 0;
        g.fillStyle(front ? 0xffd08a : 0x8a6a3a, front ? 0.95 : 0.5);
        g.fillCircle(px, py, front ? 1.3 : 0.9);
      }
    });
  }
}
