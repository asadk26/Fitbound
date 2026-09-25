import Phaser from 'phaser';
import { audio } from '../../game/audio';
import { bus, type BusEvents, type RpgFoeView } from '../../game/bus';
import type { RpgFx } from '../../rpg/engine';
import { PAL } from '../art';
import { BG } from '../diorama/backdrops';
import { FIG_H, FIG_ORIGIN_Y } from '../diorama/figures';

/**
 * Expedition battles: the hero on the left, one to four foes on the right,
 * drawn with the same diorama figurines and backdrops as the Motion Trial.
 * Pure animation: all numbers come from the RPG engine through the bus, and
 * the React HUD shows HP, intents and ability cards.
 */
const W = 200;
const H = 120;
const FLOOR = 98;
const FIG_UNITS = 50;
const HERO_X = 46;
const FONT = '"Press Start 2P", monospace';
const hex = (c: string) => parseInt(c.slice(1), 16);

interface FoeSprite {
  view: RpgFoeView;
  fig: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  ward: Phaser.GameObjects.Image;
  baseScale: number;
  x: number;
  idle?: Phaser.Tweens.Tween;
  alive: boolean;
}

const ELEMENT_TINT: Record<string, number[]> = {
  physical: [0xffffff, 0xffcd75],
  lightning: [0xc77dff, 0x73eff7, 0xffffff],
  fire: [0xef7d57, 0xffcd75, 0xb13e53],
  wind: [0x9ee7e3, 0xffffff],
};

const FAMILY_COLOR: Record<string, string> = { upper: '#f2c14e', legs: '#a7f070', cardio: '#c77dff', core: '#5fb3f5' };

export class RpgScene extends Phaser.Scene {
  private start0!: BusEvents['rpg:start'];
  private hero!: Phaser.GameObjects.Sprite;
  private heroScale = 1;
  private bubble!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private foes = new Map<number, FoeSprite>();
  private queue: (() => number)[] = [];
  private busy = false;
  private offBus: (() => void)[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private telegraph: Phaser.GameObjects.Graphics | null = null;
  private cueObjs: Phaser.GameObjects.GameObject[] = [];
  private maxHp = 100;

  constructor() {
    super('Rpg');
  }

  init(data: BusEvents['rpg:start']): void {
    this.start0 = data;
    this.foes = new Map();
    this.queue = [];
    this.busy = false;
    this.labels = [];
    this.maxHp = data.heroMaxHp;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(PAL.ink);
    this.add
      .image(BG.ox, BG.oy, `bg-${this.start0.backdrop}`)
      .setOrigin(0)
      .setScale(1 / BG.ppu)
      .setDepth(-10);
    this.heroScale = FIG_UNITS / FIG_H;
    this.add.image(HERO_X, FLOOR + 1, 'dshadow').setScale(0.28, 0.22).setAlpha(0.8);
    this.aura = this.add.image(HERO_X, FLOOR - 20, 'glow').setScale(0).setBlendMode(Phaser.BlendModes.ADD).setTint(0xc77dff);
    this.hero = this.add.sprite(HERO_X, FLOOR, 'fig-hero').setOrigin(0.5, FIG_ORIGIN_Y).setScale(this.heroScale);
    this.tweens.add({ targets: this.hero, scaleY: this.heroScale * 1.03, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.bubble = this.add.image(HERO_X, FLOOR - 22, 'glow').setTint(0x41a6f6).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setAlpha(0);
    this.placeFoes(this.start0.foes, true);
    this.hero.x = -20;
    this.tweens.add({ targets: this.hero, x: HERO_X, duration: 450, ease: 'Back.out' });

    this.fit();
    this.scale.on('resize', this.fit, this);
    this.offBus.push(
      bus.on('rpg:fx', ({ fx, foes }) => {
        if (foes?.length) this.queue.push(() => (this.placeFoes(foes, false), 400));
        for (const f of fx) this.queue.push(() => this.play(f));
        if (!this.busy) this.next();
      }),
      bus.on('rpg:strike', (s) => this.strike(s)),
      bus.on('rpg:pose', (p) => this.pose(p)),
    );
    this.events.once('shutdown', () => {
      this.offBus.forEach((f) => f());
      this.offBus = [];
      this.scale.off('resize', this.fit, this);
    });
    audio.music(this.start0.boss ? 'boss' : 'battle');
  }

  private fit(): void {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / W, this.scale.height / H);
    cam.setZoom(zoom);
    cam.centerOn(W / 2, H / 2);
    for (const t of this.labels) if (t.active) t.setResolution(Math.max(1, Math.ceil(zoom)));
  }

  /** Lay the living foes out across the right half. */
  private placeFoes(add: RpgFoeView[], entrance: boolean): void {
    for (const v of add) {
      const baseScale = this.heroScale * (v.scale ?? 1);
      const shadow = this.add.image(0, FLOOR + 1, 'dshadow').setScale(0.3 * (v.scale ?? 1), 0.22).setAlpha(0.8);
      const fig = this.add.sprite(W + 30, FLOOR, `fig-${v.sprite}`).setOrigin(0.5, FIG_ORIGIN_Y).setScale(baseScale);
      if (v.tint) fig.setTint(v.tint);
      const ward = this.add.image(0, FLOOR - 24, 'glow').setTint(0x73eff7).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4 * (v.scale ?? 1)).setAlpha(0);
      this.foes.set(v.uid, { view: v, fig, shadow, ward, baseScale, x: 0, alive: true });
    }
    const living = [...this.foes.values()].filter((f) => f.alive);
    const n = living.length;
    living.forEach((f, i) => {
      const x = n === 1 ? 146 : 104 + ((180 - 104) * i) / Math.max(1, n - 1);
      f.x = x;
      f.shadow.x = x;
      f.ward.x = x;
      f.idle?.stop();
      this.tweens.add({
        targets: f.fig,
        x,
        duration: entrance ? 450 : 350,
        delay: entrance ? 150 + i * 80 : 0,
        ease: 'Back.out',
        onComplete: () => {
          f.idle = this.tweens.add({ targets: f.fig, y: FLOOR - 2, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      });
    });
  }

  private next(): void {
    const step = this.queue.shift();
    if (!step) {
      this.busy = false;
      bus.emit('battle:animDone');
      return;
    }
    this.busy = true;
    const ms = step();
    this.time.delayedCall(ms, () => this.next());
  }

  private txt(x: number, y: number, s: string, size: number, color: string): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: PAL.ink, strokeThickness: Math.max(2, size / 3) });
    t.setResolution(Math.max(2, Math.ceil(this.cameras.main.zoom)));
    this.labels.push(t);
    return t;
  }

  private banner(s: string, color: string, ms = 1200, size = 8): void {
    const t = this.txt(W / 2, 36, s, size, color).setOrigin(0.5).setDepth(200).setScale(0.6).setAlpha(0);
    t.setWordWrapWidth(W * 1.6);
    t.setAlign('center');
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, y: 30, delay: ms, duration: 300, onComplete: () => t.destroy() });
  }

  private float(x: number, y: number, s: string, color: string, big = false): void {
    const t = this.txt(x + Phaser.Math.Between(-5, 5), y, s, big ? 11 : 7, color).setOrigin(0.5).setDepth(150);
    this.tweens.add({ targets: t, y: y - (big ? 24 : 16), duration: 700, ease: 'Cubic.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, tint: number[], n: number, speed = 60): void {
    const p = this.add.particles(x, y, 'px', { speed: { min: speed * 0.3, max: speed }, lifespan: 500, tint, emitting: false, scale: { start: 1.2, end: 0 }, gravityY: 60 }).setDepth(140);
    p.explode(n);
    this.time.delayedCall(700, () => p.destroy());
  }

  private foeTop(f: FoeSprite): number {
    return FLOOR - f.fig.displayHeight * 0.6;
  }

  private play(fx: RpgFx): number {
    const cam = this.cameras.main;
    const foe = 'uid' in fx ? this.foes.get(fx.uid) : undefined;
    switch (fx.kind) {
      case 'ability': {
        const color = FAMILY_COLOR[fx.family] ?? PAL.gold;
        this.aura.setTint(hex(color));
        this.tweens.add({ targets: this.aura, scale: { from: 0.4, to: 2.4 }, alpha: { from: 0.8, to: 0 }, duration: 500 });
        this.tweens.add({ targets: this.hero, x: HERO_X + 22, duration: 140, yoyo: true, ease: 'Quad.out' });
        this.banner(fx.partial ? `${fx.ability.toUpperCase()} · ${Math.round(fx.power * 100)}%` : fx.ability.toUpperCase(), color, 900, 7);
        audio.slash(fx.power);
        return 450;
      }
      case 'fizzle':
        this.banner('No reps counted — the ability rests', PAL.mist, 1400, 6);
        return 700;
      case 'hit': {
        if (!foe) return 0;
        const y = this.foeTop(foe);
        foe.fig.setTintFill(0xffffff);
        this.time.delayedCall(70, () => (foe.view.tint ? foe.fig.setTint(foe.view.tint) : foe.fig.clearTint()));
        this.tweens.add({ targets: foe.fig, x: foe.x + 4, duration: 50, yoyo: true, repeat: 1 });
        if (fx.toWard > 0) this.float(foe.x, y - 14, `-${fx.toWard} ward`, PAL.cyan);
        if (fx.damage > 0) this.float(foe.x, y - 6, `${fx.damage}${fx.weak ? '!' : ''}`, fx.weak ? PAL.gold : fx.resisted || fx.armored ? PAL.mist : PAL.white, fx.damage >= 20);
        this.burst(foe.x, y, ELEMENT_TINT[fx.element] ?? ELEMENT_TINT.physical, fx.damage >= 20 ? 18 : 8, 70);
        foe.ward.setAlpha(fx.ward > 0 ? 0.35 : 0);
        cam.shake(fx.damage >= 20 ? 180 : 70, fx.damage >= 20 ? 0.012 : 0.004);
        if (fx.element === 'lightning' || fx.element === 'wind') audio.magic(0.6);
        else audio.hit();
        return 230;
      }
      case 'armorBreak':
        if (!foe) return 0;
        this.burst(foe.x, this.foeTop(foe), [0x94b0c2, 0x566c86, 0xffffff], 14, 90);
        this.float(foe.x, this.foeTop(foe) - 18, fx.armor ? `ARMOUR ${fx.armor}` : 'ARMOUR BROKEN', PAL.mist);
        audio.block();
        return 300;
      case 'stagger':
        if (!foe) return 0;
        this.tweens.add({ targets: foe.fig, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => foe.fig.setAngle(0) });
        this.float(foe.x, this.foeTop(foe) - 20, 'STAGGERED!', PAL.gold);
        return 420;
      case 'disrupt':
        if (!foe) return 0;
        this.float(foe.x, this.foeTop(foe) - 20, 'DISRUPTED!', PAL.orange);
        return 420;
      case 'burn':
        if (!foe) return 0;
        this.burst(foe.x, this.foeTop(foe), ELEMENT_TINT.fire, 10, 40);
        return 150;
      case 'burnTick':
        if (!foe) return 0;
        this.burst(foe.x, this.foeTop(foe), ELEMENT_TINT.fire, 8, 40);
        this.float(foe.x, this.foeTop(foe) - 6, `${fx.damage}`, PAL.orange);
        return 300;
      case 'shield':
        this.bubble.setAlpha(Math.min(0.85, 0.25 + fx.total / this.maxHp));
        this.tweens.add({ targets: this.bubble, scale: { from: 3, to: 1.9 }, duration: 250, ease: 'Back.out' });
        this.float(HERO_X, FLOOR - 42, `+${fx.amount}`, PAL.sky);
        audio.shield();
        return 260;
      case 'heal': {
        const p = this.add.particles(HERO_X, FLOOR - 12, 'spark', { speedY: { min: -40, max: -15 }, speedX: { min: -12, max: 12 }, lifespan: 700, tint: [0x7ee081, 0xa7f070], emitting: false }).setDepth(130);
        p.explode(14);
        this.time.delayedCall(900, () => p.destroy());
        this.float(HERO_X, FLOOR - 42, `+${fx.amount}`, PAL.lime);
        audio.heal();
        return 300;
      }
      case 'charge':
        this.aura.setTint(0xc77dff);
        this.tweens.add({ targets: this.aura, scale: 0.6 + fx.charge * 0.7, alpha: fx.charge ? 0.35 + fx.charge * 0.15 : 0, duration: 200 });
        return 60;
      case 'counter':
        if (!foe) return 0;
        this.float(foe.x, this.foeTop(foe) - 14, 'COUNTER!', PAL.sky);
        return 250;
      case 'heartburst':
        cam.flash(300, 255, 230, 200);
        this.banner('HEARTBURST!', PAL.gold, 1200, 10);
        audio.finisher();
        return 600;
      case 'death':
        if (!foe) return 0;
        foe.alive = false;
        foe.idle?.stop();
        this.tweens.add({ targets: [foe.fig, foe.shadow, foe.ward], alpha: 0, duration: 600 });
        this.tweens.add({ targets: foe.fig, scaleY: foe.baseScale * 0.2, duration: 600, ease: 'Quad.in' });
        this.burst(foe.x, FLOOR - 16, [0xffcd75, 0xffffff, 0xa7f070], 24, 100);
        return 450;
      case 'enemyAct':
        if (!foe) return 0;
        this.tweens.add({ targets: foe.fig, scaleX: foe.baseScale * 1.08, scaleY: foe.baseScale * 1.08, duration: 160, yoyo: true });
        return 350;
      case 'ward':
        if (!foe) return 0;
        foe.ward.setAlpha(0.45);
        this.tweens.add({ targets: foe.ward, scale: { from: 3.4, to: 2.4 * (foe.view.scale ?? 1) }, duration: 300 });
        audio.shield();
        return 350;
      case 'armorUp':
        if (!foe) return 0;
        this.burst(foe.x, this.foeTop(foe), [0x94b0c2, 0x566c86], 10, 30);
        this.float(foe.x, this.foeTop(foe) - 18, `ARMOUR ${fx.armor}`, PAL.mist);
        return 350;
      case 'summon':
        return 200;
      case 'strike': {
        if (fx.outcome === 'dodged') {
          this.float(HERO_X, FLOOR - 50, 'DODGED!', PAL.lime, true);
          audio.select();
        } else if (fx.outcome === 'unclear') {
          this.float(HERO_X, FLOOR - 50, 'unseen — no damage', PAL.mist);
        } else {
          this.hero.setTintFill(0xff4060);
          this.time.delayedCall(90, () => this.hero.clearTint());
          this.tweens.add({ targets: this.hero, x: HERO_X - 6, duration: 60, yoyo: true, repeat: 1 });
          if (fx.absorbed) this.float(HERO_X, FLOOR - 50, `BLOCK ${fx.absorbed}`, PAL.sky);
          if (fx.damage) this.float(HERO_X, FLOOR - 40, `-${fx.damage}`, '#ff6b7a', fx.damage > 10);
          cam.shake(150, 0.006);
          audio.hurt();
        }
        this.bubble.setAlpha(fx.shield > 0 ? Math.min(0.85, 0.25 + fx.shield / this.maxHp) : 0);
        return 500;
      }
      case 'victory':
        this.banner('VICTORY!', PAL.gold, 2000, 14);
        this.tweens.add({ targets: this.hero, y: FLOOR - 10, duration: 200, yoyo: true, repeat: 2, ease: 'Quad.out' });
        audio.stopMusic();
        audio.victory();
        return 1600;
      case 'defeat':
        this.tweens.add({ targets: this.hero, angle: -90, y: FLOOR - 4, alpha: 0.5, duration: 600 });
        this.banner('Your form scatters into the Haze…', PAL.mist, 2200, 7);
        audio.stopMusic();
        audio.hurt();
        return 1800;
    }
  }

  /**
   * Wind-up and swing for one strike. The body language is always there —
   * HIGH: the foe rears up and back, a glint above its head; LOW: it drops
   * into a crouch and leans in, a glint at its feet. Clearer cue levels add
   * a line at head/foot height and, at 'obvious', a big ▲ DUCK / ▼ HOP.
   */
  private strike(s: BusEvents['rpg:strike']): void {
    const f = this.foes.get(s.uid);
    this.telegraph?.destroy();
    this.telegraph = null;
    this.cueObjs.forEach((o) => o.destroy());
    this.cueObjs = [];
    if (!f) return;
    const base = f.baseScale;
    const high = s.height === 'high';
    const cues = s.cues ?? 'obvious';
    const reset = () => {
      this.tweens.killTweensOf(f.fig);
      f.fig.setAngle(0).setScale(base);
      f.fig.y = FLOOR;
    };
    if (s.phase === 'clear') {
      reset();
      this.tweens.add({ targets: f.fig, x: f.x, duration: 200, onComplete: () => f.alive && (f.idle = this.tweens.add({ targets: f.fig, y: FLOOR - 2, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.inOut' })) });
      return;
    }
    const y = high ? FLOOR - 40 : FLOOR - 4;
    f.idle?.stop();
    reset();
    if (s.phase === 'telegraph') {
      // Body language (every cue level).
      if (high) this.tweens.add({ targets: f.fig, y: FLOOR - 8, angle: -14, scaleY: base * 1.12, scaleX: base * 0.95, x: f.x + 4, duration: 420, hold: 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      else this.tweens.add({ targets: f.fig, y: FLOOR + 3, angle: 12, scaleY: base * 0.78, scaleX: base * 1.1, x: f.x - 6, duration: 420, hold: 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const glint = this.add
        .image(f.x - 6, high ? FLOOR - f.fig.displayHeight - 4 : FLOOR - 3, 'glow')
        .setTint(high ? 0xef7d57 : 0xffcd75)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.5)
        .setDepth(165);
      this.tweens.add({ targets: glint, scale: 1.1, alpha: { from: 0.4, to: 1 }, duration: 300, yoyo: true, repeat: -1 });
      this.cueObjs.push(glint);
      if (cues !== 'subtle') {
        const g = this.add.graphics().setDepth(170);
        this.telegraph = g;
        g.lineStyle(2, high ? 0xef7d57 : 0xffcd75, 0.9);
        for (let x = HERO_X - 14; x < f.x - 10; x += 8) g.lineBetween(x, y, x + 4, y);
        this.tweens.add({ targets: g, alpha: { from: 0.3, to: 1 }, duration: 260, yoyo: true, repeat: -1 });
      }
      if (cues === 'obvious') {
        const t = this.txt(HERO_X + 26, high ? FLOOR - 58 : FLOOR - 22, high ? '▲ DUCK' : '▼ HOP', 9, high ? PAL.orange : PAL.gold).setOrigin(0.5).setDepth(175);
        this.tweens.add({ targets: t, y: t.y + (high ? -3 : 3), duration: 300, yoyo: true, repeat: -1 });
        this.cueObjs.push(t);
      }
    } else {
      // The swing: an overhead arc at head height, or a low sweep along the floor.
      this.tweens.add({ targets: f.fig, x: HERO_X + 30, angle: high ? -20 : 18, y: high ? FLOOR - 10 : FLOOR + 2, duration: 160, yoyo: true, ease: 'Quad.in' });
      const g = this.add.graphics().setDepth(170);
      this.telegraph = g;
      g.lineStyle(4, 0xffffff, 1);
      if (high) g.beginPath().arc(HERO_X + 6, y + 14, 26, -2.6, -0.5).strokePath();
      else g.lineBetween(HERO_X + 34, y, HERO_X - 26, y);
      this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
      audio.slash(0.5);
    }
  }

  /** Mirror the player's duck / hop on the hero figure. */
  private pose(p: BusEvents['rpg:pose']): void {
    const k = Math.max(0, Math.min(1, p.duck));
    this.hero.setScale(this.heroScale * (1 + 0.02 * k), this.heroScale * (1 - 0.35 * k));
    this.hero.y = FLOOR - (p.airborne ? 10 : 0);
  }
}
