import Phaser from 'phaser';
import type { CombatEffect } from '../../combat/CombatEngine';
import { ENEMIES } from '../../combat/enemies';
import { audio } from '../../game/audio';
import { bus, type BusEvents } from '../../game/bus';
import { PAL } from '../art';
import { BG } from '../diorama/backdrops';
import { FIG_ORIGIN_Y, FIG_H } from '../diorama/figures';

/** Logical stage size; the camera zooms this to fit, keeping pixels crisp. */
const W = 200;
const H = 120;
const FLOOR = 98;
/** Figurine display height in logical units. */
const FIG_UNITS = 50;
const HERO_X = 58;
const ENEMY_X = 146;
const FONT = '"Press Start 2P", monospace';

const hex = (c: string) => parseInt(c.slice(1), 16);

type Step = () => number;

export class BattleScene extends Phaser.Scene {
  private data0!: BusEvents['battle:start'];
  private hero!: Phaser.GameObjects.Sprite;
  private enemy!: Phaser.GameObjects.Sprite;
  private enemyBaseScale = 2;
  private shieldBubble!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private bars!: Phaser.GameObjects.Graphics;
  private hp = { p: 0, pMax: 1, e: 0, eMax: 1, shield: 0 };
  private shown = { p: 0, e: 0 };
  private labels: Phaser.GameObjects.Text[] = [];
  private queue: Step[] = [];
  private busy = false;
  private offBus: (() => void)[] = [];
  private enemyIdleTween?: Phaser.Tweens.Tween;

  constructor() {
    super('Battle');
  }

  init(data: BusEvents['battle:start']): void {
    this.data0 = data;
    this.hp = { p: data.playerHp, pMax: data.playerMaxHp, e: data.enemyHp, eMax: data.enemyMaxHp, shield: 0 };
    this.shown = { p: data.playerHp, e: data.enemyHp };
    this.queue = [];
    this.busy = false;
    this.labels = [];
  }

  create(): void {
    const def = ENEMIES[this.data0.enemyId];
    const cam = this.cameras.main;
    cam.setBackgroundColor(PAL.ink);
    const outdoor = def.id === 'dummy' || this.data0.outdoor === true;
    this.add
      .image(BG.ox, BG.oy, outdoor ? 'bg-meadow' : 'bg-dungeon')
      .setOrigin(0)
      .setScale(1 / BG.ppu)
      .setDepth(-10);
    if (!outdoor) this.addTorchGlows();

    // Hero figurine
    const figScale = FIG_UNITS / FIG_H;
    this.add.image(HERO_X, FLOOR + 1, 'dshadow').setScale(0.28, 0.22).setAlpha(0.8);
    this.aura = this.add.image(HERO_X, FLOOR - 20, 'glow').setScale(0).setBlendMode(Phaser.BlendModes.ADD).setTint(0xc77dff);
    this.hero = this.add.sprite(HERO_X, FLOOR, 'fig-hero').setOrigin(0.5, FIG_ORIGIN_Y).setScale(figScale);
    this.tweens.add({ targets: this.hero, scaleY: figScale * 1.03, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.shieldBubble = this.add.image(HERO_X, FLOOR - 22, 'glow').setTint(0x41a6f6).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setAlpha(0);

    // Enemy figurine
    const big = def.sprite === 'golem' || def.sprite === 'warden';
    this.enemyBaseScale = figScale * (def.sprite === 'warden' ? 1.3 : big ? 1.2 : 1);
    this.add.image(ENEMY_X, FLOOR + 1, 'dshadow').setScale(big ? 0.4 : 0.3, 0.24).setAlpha(0.8);
    this.enemy = this.add.sprite(ENEMY_X, FLOOR, `fig-${def.sprite}`).setOrigin(0.5, FIG_ORIGIN_Y).setScale(this.enemyBaseScale);
    this.enemyIdleTween = this.tweens.add({ targets: this.enemy, y: FLOOR - 2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    if (def.id === 'warden') {
      const g = this.add.image(ENEMY_X, FLOOR - 24, 'glow').setTint(0xb13e53).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setAlpha(0.25).setDepth(-1);
      this.tweens.add({ targets: g, alpha: 0.45, duration: 900, yoyo: true, repeat: -1 });
    }

    this.bars = this.add.graphics().setDepth(100).setVisible(this.data0.hud !== false);
    if (this.data0.hud !== false)
      this.labels.push(
      this.txt(6, 5, this.data0.heroName.toUpperCase(), 6, PAL.white).setDepth(101),
      this.txt(W - 6, 5, (this.data0.enemyName ?? def.name).toUpperCase(), 6, PAL.white).setOrigin(1, 0).setDepth(101),
    );
    this.drawBars();

    // Entrance
    this.hero.x = -20;
    this.enemy.x = W + 30;
    this.tweens.add({ targets: this.hero, x: HERO_X, duration: 450, ease: 'Back.out' });
    this.tweens.add({ targets: this.enemy, x: ENEMY_X, duration: 450, ease: 'Back.out', delay: 150 });
    this.time.delayedCall(700, () => this.banner(def.intro.replace(/!$/, '!'), PAL.gold, 1600, 8));

    this.fit();
    this.scale.on('resize', this.fit, this);
    this.offBus.push(
      bus.on('battle:effects', ({ effects }) => this.enqueue(effects)),
      bus.on('battle:charge', ({ level, color }) => this.setAura(level, color)),
    );
    this.events.once('shutdown', () => {
      this.offBus.forEach((f) => f());
      this.offBus = [];
      this.scale.off('resize', this.fit, this);
    });
    audio.music(def.id === 'warden' ? 'boss' : 'battle');
    bus.emit('battle:ready');
  }

  update(): void {
    // Smoothly animate bars towards their targets.
    const lerp = (a: number, b: number) => (Math.abs(b - a) < 0.3 ? b : a + (b - a) * 0.15);
    const np = lerp(this.shown.p, this.hp.p);
    const ne = lerp(this.shown.e, this.hp.e);
    if (np !== this.shown.p || ne !== this.shown.e) {
      this.shown = { p: np, e: ne };
      this.drawBars();
    }
  }

  private fit(): void {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / W, this.scale.height / H);
    cam.setZoom(zoom);
    cam.centerOn(W / 2, H / 2);
    for (const t of this.labels) t.setResolution(Math.max(1, Math.ceil(zoom)));
  }

  private addTorchGlows(): void {
    for (const tx of [-4, 100, 204]) {
      const flame = this.add.image(tx, 20, 'glow').setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setAlpha(0.5).setDepth(-5);
      this.tweens.add({ targets: flame, scale: 3, alpha: 0.75, duration: 320 + Math.random() * 220, yoyo: true, repeat: -1 });
    }
  }

  private drawBars(): void {
    const g = this.bars.clear();
    const bar = (x: number, y: number, w: number, frac: number, color: string) => {
      g.fillStyle(hex(PAL.ink)).fillRect(x - 1, y - 1, w + 2, 7);
      g.fillStyle(hex(PAL.night)).fillRect(x, y, w, 5);
      const f = Phaser.Math.Clamp(frac, 0, 1);
      g.fillStyle(hex(color)).fillRect(x, y, Math.round(w * f), 5);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, Math.round(w * f), 1);
    };
    const pf = this.shown.p / this.hp.pMax;
    bar(6, 14, 80, pf, pf > 0.5 ? PAL.green : pf > 0.25 ? PAL.gold : PAL.red);
    if (this.hp.shield > 0) {
      const sf = this.hp.shield / this.hp.pMax;
      g.fillStyle(hex(PAL.sky)).fillRect(6, 21, Math.round(80 * Math.min(1, sf)), 2);
    }
    bar(W - 86, 14, 80, this.shown.e / this.hp.eMax, PAL.red);
  }

  private txt(x: number, y: number, s: string, size: number, color: string): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: PAL.ink, strokeThickness: Math.max(2, size / 3) });
    t.setResolution(Math.max(2, Math.ceil(this.cameras.main.zoom)));
    return t;
  }

  private banner(s: string, color: string, ms = 1200, size = 9): void {
    const t = this.txt(W / 2, 44, s, size, color).setOrigin(0.5).setDepth(200).setScale(0.6).setAlpha(0);
    t.setWordWrapWidth(W * 1.6);
    t.setAlign('center');
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, y: 36, delay: ms, duration: 300, onComplete: () => t.destroy() });
  }

  private floatNum(x: number, y: number, s: string, color: string, big = false): void {
    const t = this.txt(x + Phaser.Math.Between(-6, 6), y, s, big ? 12 : 8, color).setOrigin(0.5).setDepth(150);
    this.tweens.add({ targets: t, y: y - (big ? 26 : 18), duration: 700, ease: 'Cubic.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 550, duration: 300, onComplete: () => t.destroy() });
    if (big) this.tweens.add({ targets: t, scale: { from: 1.8, to: 1 }, duration: 250, ease: 'Back.out' });
  }

  private burst(x: number, y: number, tint: number[], n: number, speed = 60): void {
    const p = this.add.particles(x, y, 'px', { speed: { min: speed * 0.3, max: speed }, lifespan: 500, tint, emitting: false, scale: { start: 1.2, end: 0 }, gravityY: 60 }).setDepth(140);
    p.explode(n);
    this.time.delayedCall(700, () => p.destroy());
  }

  private flashEnemy(): void {
    this.enemy.setTintFill(0xffffff);
    this.time.delayedCall(70, () => this.enemy.clearTint());
    this.tweens.add({ targets: this.enemy, x: ENEMY_X + 5, duration: 50, yoyo: true, repeat: 1 });
  }

  private setAura(level: number, color: string): void {
    this.aura.setTint(hex(color));
    this.tweens.add({ targets: this.aura, scale: 0.8 + level * 2.2, alpha: 0.4 + level * 0.5, duration: 200 });
  }

  private enqueue(effects: CombatEffect[]): void {
    for (const fx of effects) this.queue.push(() => this.play(fx));
    if (!this.busy) this.next();
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

  private play(fx: CombatEffect): number {
    const cam = this.cameras.main;
    switch (fx.kind) {
      case 'hit': {
        this.hp.e = fx.hp;
        const k = fx.rep && fx.target ? fx.rep / fx.target : 1;
        const big = fx.finisher;
        const hy = FLOOR - this.enemy.displayHeight * 0.6;
        if (fx.effect === 'slash' || (fx.effect === 'shield' && big)) {
          const icon = fx.effect === 'slash' ? 'icon-sword' : 'icon-shield';
          this.tweens.add({ targets: this.hero, x: ENEMY_X - 30, duration: big ? 160 : 110, yoyo: true, ease: 'Quad.out' });
          this.time.delayedCall(big ? 150 : 100, () => {
            const sw = this.add.image(ENEMY_X - 16, hy, icon).setScale(big ? 2.2 : 1.3).setDepth(120).setAngle(-60);
            this.tweens.add({ targets: sw, angle: 60, duration: 140, onComplete: () => sw.destroy() });
            const arc = this.add.graphics().setDepth(119);
            arc.lineStyle(big ? 3 : 2, 0xffffff, 1).beginPath().arc(ENEMY_X - 6, hy, big ? 20 : 14, -2.2, 0.6).strokePath();
            this.tweens.add({ targets: arc, alpha: 0, duration: 200, onComplete: () => arc.destroy() });
            this.flashEnemy();
            this.floatNum(ENEMY_X, hy - 8, `${fx.damage}`, big ? PAL.gold : PAL.white, big);
            this.burst(ENEMY_X, hy, [0xffffff, 0xffcd75], big ? 24 : 5 + Math.round(10 * k), big ? 110 : 50 + 40 * k);
            cam.shake(big ? 260 : 90, big ? 0.02 : 0.003 + 0.007 * k);
            fx.effect === 'slash' ? audio.slash(big ? 1 : k) : audio.hit();
            if (big) {
              audio.finisher();
              cam.flash(150, 255, 240, 200);
              this.banner(fx.effect === 'slash' ? 'FINISHING BLOW!' : 'SHIELD BASH!', PAL.gold);
            }
          });
          return big ? 800 : 260;
        }
        if (fx.effect === 'arcane') {
          const orb = this.add.image(HERO_X + 10, FLOOR - 22, 'glow').setTint(0xc77dff).setBlendMode(Phaser.BlendModes.ADD).setScale(big ? 1.2 : 0.4 + 0.3 * k).setDepth(120);
          if (big) {
            this.tweens.add({ targets: orb, scale: 4, duration: 350, ease: 'Quad.in' });
            audio.magic(1);
          } else audio.magic(k);
          this.tweens.add({
            targets: orb,
            x: ENEMY_X,
            y: hy,
            delay: big ? 350 : 0,
            duration: big ? 220 : 180,
            ease: 'Quad.in',
            onComplete: () => {
              orb.destroy();
              this.flashEnemy();
              this.floatNum(ENEMY_X, hy - 8, `${fx.damage}`, big ? '#d6a2ff' : PAL.white, big);
              this.burst(ENEMY_X, hy, [0xc77dff, 0x73eff7, 0xffffff], big ? 40 : 6 + Math.round(10 * k), big ? 140 : 60);
              if (big) {
                cam.flash(250, 200, 150, 255);
                cam.shake(300, 0.02);
                audio.finisher();
                this.banner('ARCANE BURST!', '#d6a2ff');
                this.setAura(0, '#c77dff');
              } else cam.shake(60, 0.002 + 0.004 * k);
            },
          });
          return big ? 950 : 230;
        }
        // Fallback
        this.flashEnemy();
        this.floatNum(ENEMY_X, hy - 8, `${fx.damage}`, PAL.white, big);
        audio.hit();
        return 300;
      }
      case 'shield': {
        this.hp.shield = fx.total;
        this.drawBars();
        this.shieldBubble.setAlpha(Math.min(0.85, 0.25 + fx.total / this.hp.pMax));
        this.tweens.add({ targets: this.shieldBubble, scale: { from: fx.finisher ? 3 : 2.2, to: 1.8 }, duration: 250, ease: 'Back.out' });
        this.hero.setTint(0x9fd8ff);
        this.time.delayedCall(120, () => this.hero.clearTint());
        this.floatNum(HERO_X, FLOOR - 40, `+${fx.amount}`, PAL.sky, fx.finisher);
        audio.shield();
        if (fx.finisher) this.banner('SHIELD RAISED!', PAL.sky);
        return fx.finisher ? 500 : 220;
      }
      case 'heal': {
        this.hp.p = fx.hp;
        const p = this.add.particles(HERO_X, FLOOR - 12, 'spark', { speedY: { min: -40, max: -15 }, speedX: { min: -12, max: 12 }, lifespan: 700, tint: [0x7ee081, 0xa7f070], emitting: false }).setDepth(130);
        p.explode(fx.finisher ? 20 : 6);
        this.time.delayedCall(900, () => p.destroy());
        this.floatNum(HERO_X, FLOOR - 40, `+${fx.amount}`, PAL.lime, fx.finisher);
        audio.heal();
        return fx.finisher ? 500 : 250;
      }
      case 'charge':
        this.setAura(fx.level, '#c77dff');
        return 0;
      case 'combo':
        this.banner(`COMBO x${fx.mult}!`, PAL.orange, 1000);
        audio.select();
        return 350;
      case 'resisted':
        this.banner(fx.text, PAL.mist, 1500, 6);
        return 400;
      case 'enemyAttack': {
        this.enemyIdleTween?.pause();
        this.tweens.add({
          targets: this.enemy,
          x: HERO_X + 34,
          duration: 180,
          yoyo: true,
          ease: 'Quad.in',
          onComplete: () => this.enemyIdleTween?.resume(),
        });
        this.time.delayedCall(170, () => {
          this.hp.p = fx.hp;
          this.hp.shield = Math.max(0, this.hp.shield - fx.absorbed);
          this.shieldBubble.setAlpha(this.hp.shield > 0 ? Math.min(0.85, 0.25 + this.hp.shield / this.hp.pMax) : 0);
          this.drawBars();
          if (fx.absorbed > 0) {
            this.floatNum(HERO_X, FLOOR - 44, `BLOCK ${fx.absorbed}`, PAL.sky);
            this.tweens.add({ targets: this.shieldBubble, scale: { from: 2.4, to: 1.8 }, duration: 200 });
            audio.block();
          }
          if (fx.damage > 0) {
            this.hero.setTintFill(0xff4060);
            this.time.delayedCall(90, () => this.hero.clearTint());
            this.tweens.add({ targets: this.hero, x: HERO_X - 6, duration: 60, yoyo: true, repeat: 1 });
            this.floatNum(HERO_X, FLOOR - 36, `-${fx.damage}`, '#ff6b7a', fx.damage > 15);
            cam.shake(150, 0.006);
            audio.hurt();
          }
        });
        this.time.delayedCall(80, () => this.txtEnemyMove(fx.name));
        return 900;
      }
      case 'telegraph':
        this.banner(fx.text, PAL.orange, 2200, 6);
        this.tweens.add({ targets: this.enemy, scaleX: this.enemyBaseScale * 1.08, scaleY: this.enemyBaseScale * 1.08, duration: 200, yoyo: true, repeat: 2 });
        return 700;
      case 'phaseBreak': {
        this.cameras.main.shake(500, 0.02);
        this.cameras.main.flash(300, 255, 255, 255);
        audio.phaseBreak();
        this.burst(ENEMY_X, FLOOR - 30, [0x94b0c2, 0x566c86, 0xffcd75], 40, 130);
        this.banner(`${fx.name.toUpperCase()} BROKEN!`, PAL.gold, 1800, 8);
        const tints = [0xffffff, 0xff9a9a, 0xd6a2ff];
        if (fx.nextPhase !== null) this.enemy.setTint(tints[fx.nextPhase] ?? 0xffffff);
        return 1400;
      }
      case 'victory': {
        this.enemyIdleTween?.stop();
        this.enemy.clearTint();
        this.tweens.add({ targets: this.enemy, alpha: 0, scaleY: 0.2, y: FLOOR, duration: 700, ease: 'Quad.in' });
        this.burst(ENEMY_X, FLOOR - 16, [0xffcd75, 0xffffff, 0xa7f070], 50, 120);
        this.shieldBubble.setAlpha(0);
        this.setAura(0, '#c77dff');
        this.time.delayedCall(300, () => {
          this.banner('VICTORY!', PAL.gold, 2400, 14);
          this.tweens.add({ targets: this.hero, y: FLOOR - 10, duration: 200, yoyo: true, repeat: 2, ease: 'Quad.out' });
          const conf = this.add.particles(W / 2, -10, 'px', { x: { min: -W / 2, max: W / 2 }, speedY: { min: 30, max: 70 }, speedX: { min: -20, max: 20 }, lifespan: 2500, tint: [0xffcd75, 0x41a6f6, 0xb13e53, 0xa7f070], quantity: 3, frequency: 40, scale: 1.5 }).setDepth(180);
          this.time.delayedCall(1500, () => conf.stop());
        });
        audio.stopMusic();
        audio.victory();
        return 2000;
      }
      case 'defeat':
        this.tweens.add({ targets: this.hero, angle: -90, y: FLOOR - 4, duration: 500 });
        this.banner('You are exhausted...', PAL.mist, 2000, 8);
        audio.stopMusic();
        audio.hurt();
        return 1800;
    }
  }

  private txtEnemyMove(name: string): void {
    const t = this.txt(ENEMY_X, FLOOR - this.enemy.displayHeight - 12, name, 6, PAL.orange).setOrigin(0.5).setDepth(160);
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 6, delay: 800, duration: 300, onComplete: () => t.destroy() });
  }
}
