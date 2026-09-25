import Phaser from 'phaser';
import { audio } from '../../game/audio';
import { bus, type BusEvents, type RpgFoeStatus, type RpgFoeView } from '../../game/bus';
import type { RpgFx } from '../../rpg/engine';
import { PAL } from '../art';
import { BG } from '../diorama/backdrops';
import { FIG_H, FIG_ORIGIN_Y } from '../diorama/figures';
import { lifelike, type Face } from '../faces';

/**
 * Expedition battles, staged like a (much simpler) console turn-based RPG:
 * the hero stands front-left, foes on a receding line back-right. Every
 * exchange is shown in the world — the hero dashes in to strike, foes wind
 * up in place, charge across and swing — and the camera leans into each
 * one. HP, wards and intents float over each foe; intents say *what* a foe
 * will do (attack, charge, ward…) but never whether it will strike high or
 * low: that has to be read from its body.
 *
 * Pure animation: all numbers come from the RPG engine through the bus.
 */
const W = 200;
const H = 120;
const FIG_UNITS = 50;
const HERO = { x: 50, y: 106, scale: 1.25 };
const FONT = '"Press Start 2P", monospace';
const hex = (c: string) => parseInt(c.slice(1), 16);

/** Slots on the back-right diagonal, by foe count. */
const SLOTS: Record<number, [number, number][]> = {
  1: [[170, 80]],
  2: [[150, 88], [188, 76]],
  3: [[140, 91], [168, 82], [196, 73]],
  4: [[132, 93], [156, 85], [180, 77], [204, 69]],
};

interface FoeSprite {
  view: RpgFoeView;
  fig: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  ward: Phaser.GameObjects.Image;
  baseScale: number;
  x: number;
  y: number;
  idle?: Phaser.Tweens.Tween;
  alive: boolean;
  status: RpgFoeStatus | null;
  label: Phaser.GameObjects.Text;
  intent: Phaser.GameObjects.Text;
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
  private face!: Face;
  private heroScale = 1;
  private heroShadow!: Phaser.GameObjects.Image;
  /** Where the hero is dashing to, so its shadow can stay on the ground. */
  private heroDest = { x: HERO.x, y: HERO.y };
  private bubble!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private hud!: Phaser.GameObjects.Graphics;
  private foes = new Map<number, FoeSprite>();
  private queue: (() => number)[] = [];
  private busy = false;
  private offBus: (() => void)[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private telegraph: Phaser.GameObjects.Graphics | null = null;
  private cueObjs: Phaser.GameObjects.GameObject[] = [];
  private maxHp = 100;
  private baseZoom = 1;

  constructor() {
    super('Rpg');
  }

  init(data: BusEvents['rpg:start']): void {
    this.start0 = data;
    this.foes = new Map();
    this.queue = [];
    this.busy = false;
    this.labels = [];
    this.cueObjs = [];
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
    this.heroScale = (FIG_UNITS / FIG_H) * HERO.scale;
    this.heroShadow = this.add.image(HERO.x, HERO.y + 1, 'dshadow').setScale(0.34, 0.26).setAlpha(0.8).setDepth(HERO.y - 1);
    this.aura = this.add.image(HERO.x, HERO.y - 24, 'glow').setScale(0).setBlendMode(Phaser.BlendModes.ADD).setTint(0xc77dff).setDepth(HERO.y - 0.5);
    this.hero = this.add.sprite(HERO.x, HERO.y, 'fig-hero-free').setOrigin(0.5, FIG_ORIGIN_Y).setScale(this.heroScale).setDepth(HERO.y);
    this.face = lifelike(this, this.hero, 'hero', true);
    this.tweens.add({ targets: this.hero, scaleY: this.heroScale * 1.03, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.bubble = this.add.image(HERO.x, HERO.y - 26, 'glow').setTint(0x41a6f6).setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setAlpha(0).setDepth(HERO.y + 1);
    this.hud = this.add.graphics().setDepth(300);
    this.placeFoes(this.start0.foes, true);
    this.hero.x = -20;
    this.tweens.add({ targets: this.hero, x: HERO.x, duration: 450, ease: 'Back.out' });

    this.fit();
    this.scale.on('resize', this.fit, this);
    this.offBus.push(
      bus.on('rpg:fx', ({ fx, foes }) => {
        if (foes?.length) this.queue.push(() => (this.placeFoes(foes, false), 400));
        for (const f of fx) this.queue.push(() => this.play(f));
        if (!this.busy) this.next();
      }),
      bus.on('rpg:foes', ({ foes }) => {
        for (const s of foes) {
          const f = this.foes.get(s.uid);
          if (f) f.status = s;
        }
        this.drawHud();
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
    this.baseZoom = Math.min(this.scale.width / W, this.scale.height / H);
    cam.setZoom(this.baseZoom);
    cam.centerOn(W / 2, H / 2);
    for (const t of this.labels) if (t.active) t.setResolution(Math.max(1, Math.ceil(this.baseZoom)));
  }

  /**
   * Figures have no bases in battle, so each shadow tracks its figure along
   * the ground: it follows x, and takes y from the straight line between the
   * figure's spot and where it dashes to, so a jump or a stance leaves the
   * shadow on the floor.
   */
  update(): void {
    const ground = (x: number, from: { x: number; y: number }, to: { x: number; y: number }) => {
      if (Math.abs(to.x - from.x) < 1) return from.y;
      const t = Math.min(1, Math.max(0, (x - from.x) / (to.x - from.x)));
      return from.y + (to.y - from.y) * t;
    };
    if (this.hero) this.heroShadow.setPosition(this.hero.x, ground(this.hero.x, HERO, this.heroDest) + 1);
    const lunge = { x: HERO.x + 26, y: HERO.y - 1 };
    for (const f of this.foes.values()) {
      if (!f.alive) continue;
      const gy = ground(f.fig.x, f, lunge);
      f.shadow.setPosition(f.fig.x, gy + 1).setDepth(gy - 1);
    }
  }

  /** Lean the camera toward an exchange, then settle back. */
  private focus(x: number, y: number, ms = 700): void {
    const cam = this.cameras.main;
    cam.pan(W / 2 + (x - W / 2) * 0.35, H / 2 + (y - H / 2) * 0.25, 260, 'Sine.easeOut', true);
    cam.zoomTo(this.baseZoom * 1.1, 260, 'Sine.easeOut', true);
    this.hudAlpha(0);
    this.time.delayedCall(ms, () => this.settle());
  }

  /** The in-world HUD steps aside during a close-up, so it's never cropped. */
  private hudAlpha(alpha: number): void {
    const t = [this.hud, ...[...this.foes.values()].flatMap((f) => [f.label, f.intent])];
    this.tweens.add({ targets: t, alpha, duration: alpha ? 300 : 160 });
  }

  private settle(): void {
    const cam = this.cameras.main;
    cam.pan(W / 2, H / 2, 380, 'Sine.easeInOut', true);
    cam.zoomTo(this.baseZoom, 380, 'Sine.easeInOut', true);
    this.hudAlpha(1);
  }

  /** Lay the living foes out on the diagonal. */
  private placeFoes(add: RpgFoeView[], entrance: boolean): void {
    for (const v of add) {
      const baseScale = (FIG_UNITS / FIG_H) * (v.scale ?? 1);
      const shadow = this.add.image(0, 0, 'dshadow').setScale(0.3 * (v.scale ?? 1), 0.22).setAlpha(0.8);
      const fig = this.add.sprite(W + 30, 88, `fig-${v.sprite}-free`).setOrigin(0.5, FIG_ORIGIN_Y).setScale(baseScale).setFlipX(true);
      if (v.tint) fig.setTint(v.tint);
      const ward = this.add.image(0, 0, 'glow').setTint(0x73eff7).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4 * (v.scale ?? 1)).setAlpha(0);
      const label = this.txt(0, 0, v.name.toUpperCase(), 4, PAL.white).setOrigin(0.5, 1).setDepth(301);
      const intent = this.txt(0, 0, '', 4, PAL.gold).setOrigin(0.5, 1).setDepth(301);
      this.foes.set(v.uid, { view: v, fig, shadow, ward, baseScale, x: 0, y: 0, alive: true, status: null, label, intent });
    }
    const living = [...this.foes.values()].filter((f) => f.alive);
    const slots = SLOTS[Math.min(4, Math.max(1, living.length))];
    living.forEach((f, i) => {
      const [x, y] = slots[i];
      // Farther back = a little smaller.
      const depthScale = 0.86 + (y - 72) / 150;
      f.x = x;
      f.y = y;
      f.baseScale = (FIG_UNITS / FIG_H) * (f.view.scale ?? 1) * depthScale;
      f.shadow.setPosition(x, y + 1).setDepth(y - 1);
      f.ward.setPosition(x, y - 22).setDepth(y + 0.5);
      f.fig.setDepth(y).setScale(f.baseScale);
      f.idle?.stop();
      this.tweens.add({
        targets: f.fig,
        x,
        y,
        duration: entrance ? 450 : 350,
        delay: entrance ? 150 + i * 80 : 0,
        ease: 'Back.out',
        onComplete: () => this.idle(f, i),
      });
    });
    this.drawHud();
  }

  private idle(f: FoeSprite, i = 0): void {
    if (!f.alive) return;
    f.idle?.stop();
    f.idle = this.tweens.add({ targets: f.fig, y: f.y - 2, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Name, HP / ward bar, armour pips and intent over each foe. */
  private drawHud(): void {
    const g = this.hud.clear();
    for (const f of this.foes.values()) {
      const s = f.status;
      const show = f.alive && !!s;
      f.label.setVisible(show);
      f.intent.setVisible(show);
      if (!show || !s) continue;
      const top = f.y - f.fig.displayHeight * 0.95;
      const w = 26;
      const bx = f.x - w / 2;
      const by = top - 4;
      g.fillStyle(hex(PAL.ink), 0.85).fillRect(bx - 1, by - 1, w + 2, 4);
      g.fillStyle(hex(PAL.red)).fillRect(bx, by, Math.round(w * Math.max(0, s.hp / s.maxHp)), 2);
      if (s.ward > 0) g.fillStyle(hex(PAL.cyan)).fillRect(bx, by + 2, Math.min(w, Math.round((s.ward / s.maxHp) * w)), 1);
      for (let a = 0; a < s.armor; a++) g.fillStyle(hex(PAL.mist)).fillRect(bx + w + 2, by - 1 + a * 2, 2, 1.5);
      f.label.setPosition(f.x, by - 1);
      f.intent.setPosition(f.x, by - 7).setText(s.intent).setColor(s.charging ? PAL.orange : s.staggered ? PAL.mist : PAL.gold);
    }
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
    t.setResolution(Math.max(2, Math.ceil(this.cameras.main.zoom * 1.5)));
    this.labels.push(t);
    return t;
  }

  private banner(s: string, color: string, ms = 1200, size = 8): void {
    const t = this.txt(W / 2, 30, s, size, color).setOrigin(0.5).setDepth(400).setScale(0.6).setAlpha(0);
    t.setWordWrapWidth(W * 1.6);
    t.setAlign('center');
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, y: 24, delay: ms, duration: 300, onComplete: () => t.destroy() });
  }

  private float(x: number, y: number, s: string, color: string, big = false): void {
    const t = this.txt(x + Phaser.Math.Between(-5, 5), y, s, big ? 11 : 7, color).setOrigin(0.5).setDepth(350);
    this.tweens.add({ targets: t, y: y - (big ? 24 : 16), duration: 700, ease: 'Cubic.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, tint: number[], n: number, speed = 60): void {
    const p = this.add.particles(x, y, 'px', { speed: { min: speed * 0.3, max: speed }, lifespan: 500, tint, emitting: false, scale: { start: 1.2, end: 0 }, gravityY: 60 }).setDepth(340);
    p.explode(n);
    this.time.delayedCall(700, () => p.destroy());
  }

  private foeTop(f: FoeSprite): number {
    return f.y - f.fig.displayHeight * 0.6;
  }

  private heroTop(): number {
    return HERO.y - this.hero.displayHeight * 0.6;
  }

  private play(fx: RpgFx): number {
    const cam = this.cameras.main;
    const foe = 'uid' in fx ? this.foes.get(fx.uid) : undefined;
    switch (fx.kind) {
      case 'ability': {
        const color = FAMILY_COLOR[fx.family] ?? PAL.gold;
        const target = [...this.foes.values()].find((f) => f.alive);
        this.aura.setTint(hex(color));
        this.tweens.add({ targets: this.aura, scale: { from: 0.4, to: 2.6 }, alpha: { from: 0.8, to: 0 }, duration: 500 });
        // Dash in to strike, then back to the mark.
        if (target) {
          this.focus((HERO.x + target.x) / 2, (HERO.y + target.y) / 2, 900);
          this.heroDest = { x: target.x - 22, y: target.y + 4 };
          this.tweens.add({ targets: this.hero, x: target.x - 22, y: target.y + 4, duration: 220, yoyo: true, hold: 260, ease: 'Quad.out' });
        }
        this.banner(fx.partial ? `${fx.ability.toUpperCase()} · ${Math.round(fx.power * 100)}%` : fx.ability.toUpperCase(), color, 900, 7);
        audio.slash(fx.power);
        return 520;
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
        this.tweens.add({ targets: this.bubble, scale: { from: 3.4, to: 2.3 }, duration: 250, ease: 'Back.out' });
        this.float(HERO.x, this.heroTop() - 14, `+${fx.amount}`, PAL.sky);
        audio.shield();
        return 260;
      case 'heal': {
        const p = this.add.particles(HERO.x, HERO.y - 14, 'spark', { speedY: { min: -40, max: -15 }, speedX: { min: -12, max: 12 }, lifespan: 700, tint: [0x7ee081, 0xa7f070], emitting: false }).setDepth(330);
        p.explode(14);
        this.time.delayedCall(900, () => p.destroy());
        this.float(HERO.x, this.heroTop() - 14, `+${fx.amount}`, PAL.lime);
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
        this.burst(foe.x, foe.y - 16, [0xffcd75, 0xffffff, 0xa7f070], 24, 100);
        this.drawHud();
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
        const top = this.heroTop();
        if (fx.outcome === 'dodged') {
          this.float(HERO.x, top - 16, 'DODGED!', PAL.lime, true);
          audio.select();
        } else if (fx.outcome === 'unclear') {
          this.float(HERO.x, top - 16, 'unseen — no damage', PAL.mist);
        } else {
          this.hero.setTintFill(0xff4060);
          this.time.delayedCall(90, () => this.hero.clearTint());
          this.tweens.add({ targets: this.hero, x: HERO.x - 6, duration: 60, yoyo: true, repeat: 1 });
          if (fx.absorbed) this.float(HERO.x, top - 18, `BLOCK ${fx.absorbed}`, PAL.sky);
          if (fx.damage) this.float(HERO.x, top - 8, `-${fx.damage}`, '#ff6b7a', fx.damage > 10);
          cam.shake(150, 0.006);
          this.face.express('wince', 700);
          audio.hurt();
        }
        this.bubble.setAlpha(fx.shield > 0 ? Math.min(0.85, 0.25 + fx.shield / this.maxHp) : 0);
        return 500;
      }
      case 'victory':
        this.settle();
        this.banner('VICTORY!', PAL.gold, 2000, 14);
        this.face.express('soft', 0);
        this.tweens.add({ targets: this.hero, y: HERO.y - 10, duration: 200, yoyo: true, repeat: 2, ease: 'Quad.out' });
        audio.stopMusic();
        audio.victory();
        return 1600;
      case 'defeat':
        this.settle();
        this.face.express('blink', 0);
        this.tweens.add({ targets: this.hero, angle: -90, y: HERO.y - 4, alpha: 0.5, duration: 600 });
        this.banner('Your form scatters into the Haze…', PAL.mist, 2200, 7);
        audio.stopMusic();
        audio.hurt();
        return 1800;
    }
  }

  /**
   * One strike, in four beats:
   *   telegraph  the foe winds up in place. Its body is the cue — HIGH: it
   *              rears up and back, weapon glinting overhead; LOW: it drops
   *              into a crouch and leans in, a glint at its feet. Clearer cue
   *              levels add a line at head/foot height and (obvious) a ▲/▼.
   *   approach   it charges across to the hero, landing at the moment of impact
   *   swing      an overhead arc at head height, or a sweep along the floor
   *   clear      it returns to its place
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
    };
    const heroTop = HERO.y - this.hero.displayHeight * 0.8;
    const lineY = high ? heroTop : HERO.y - 3;
    if (s.phase === 'clear') {
      reset();
      this.settle();
      this.tweens.add({ targets: f.fig, x: f.x, y: f.y, duration: 380, ease: 'Sine.inOut', onComplete: () => this.idle(f) });
      return;
    }
    f.idle?.stop();
    if (s.phase === 'telegraph') {
      reset();
      f.fig.setPosition(f.x, f.y);
      // Body language (every cue level).
      if (high) this.tweens.add({ targets: f.fig, y: f.y - 8, angle: 14, scaleY: base * 1.14, scaleX: base * 0.94, x: f.x + 4, duration: 420, hold: 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      else this.tweens.add({ targets: f.fig, y: f.y + 3, angle: -12, scaleY: base * 0.76, scaleX: base * 1.1, x: f.x - 5, duration: 420, hold: 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const glint = this.add
        .image(f.x - 5, high ? f.y - f.fig.displayHeight - 3 : f.y - 2, 'glow')
        .setTint(high ? 0xef7d57 : 0xffcd75)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.5)
        .setDepth(f.y + 1);
      this.tweens.add({ targets: glint, scale: 1.1, alpha: { from: 0.4, to: 1 }, duration: 300, yoyo: true, repeat: -1 });
      this.cueObjs.push(glint);
      if (cues !== 'subtle') {
        const g = this.add.graphics().setDepth(320);
        this.telegraph = g;
        g.lineStyle(2, high ? 0xef7d57 : 0xffcd75, 0.9);
        for (let x = HERO.x - 14; x < HERO.x + 22; x += 7) g.lineBetween(x, lineY, x + 4, lineY);
        this.tweens.add({ targets: g, alpha: { from: 0.3, to: 1 }, duration: 260, yoyo: true, repeat: -1 });
      }
      if (cues === 'obvious') {
        const t = this.txt(HERO.x + 30, lineY - 2, high ? '▲' : '▼', 10, high ? PAL.orange : PAL.gold).setOrigin(0.5).setDepth(330);
        this.tweens.add({ targets: t, y: t.y + (high ? -3 : 3), duration: 300, yoyo: true, repeat: -1 });
        this.cueObjs.push(t);
      }
      return;
    }
    if (s.phase === 'approach') {
      reset();
      const ms = Math.max(200, s.ms ?? 600);
      // Keep the stance while charging across, so the tell stays readable.
      f.fig.setAngle(high ? 10 : -10).setScale(high ? base * 0.97 : base * 1.06, high ? base * 1.1 : base * 0.82);
      this.tweens.add({ targets: f.fig, x: HERO.x + 26, y: HERO.y - 1, duration: ms, ease: 'Quad.in' });
      this.focus(HERO.x + 16, HERO.y - 20, ms + 900);
      return;
    }
    // Swing.
    reset();
    f.fig.setPosition(HERO.x + 26, HERO.y - 1);
    this.tweens.add({ targets: f.fig, angle: high ? -24 : 20, y: high ? HERO.y - 8 : HERO.y + 1, duration: 120, yoyo: true, ease: 'Quad.out' });
    const g = this.add.graphics().setDepth(320);
    this.telegraph = g;
    g.lineStyle(4, 0xffffff, 1);
    if (high) g.beginPath().arc(HERO.x + 8, lineY + 16, 26, -2.7, -0.4).strokePath();
    else g.lineBetween(HERO.x + 34, lineY, HERO.x - 26, lineY);
    this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
    audio.slash(0.5);
  }

  /** Mirror the player's duck / hop on the hero figure. */
  private pose(p: BusEvents['rpg:pose']): void {
    const k = Math.max(0, Math.min(1, p.duck));
    this.hero.setScale(this.heroScale * (1 + 0.02 * k), this.heroScale * (1 - 0.35 * k));
    this.hero.y = HERO.y - (p.airborne ? 10 : 0);
  }
}
