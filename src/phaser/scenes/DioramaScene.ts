import Phaser from 'phaser';
import { audio } from '../../game/audio';
import { bus, type DioramaState } from '../../game/bus';
import { input } from '../../input/InputHub';
import { FIG_H, FIG_ORIGIN_Y } from '../diorama/figures';
import { EDGE, GROUND_SCALE } from '../diorama/ground';
import { getDioramaState } from '../game';
import { BOARD, FENCE_X, GATE_GAP, POND, scatter, SPOTS, START, type Placed } from '../diorama/layout';

/**
 * The Motion Trial board, explored with the body: march in place to walk,
 * lean to turn. Top-down "tank" steering — the hero walks where they face and
 * leaning rotates that heading — which needs no second axis from the player
 * and stays predictable from a fixed camera.
 */
const HERO_R = 26;
const SPEED = 190;
const TURN_MOVING = 1.9; // rad/s at full lean
const TURN_STILL = 1.2;
const INTERACT_R = 150;
const ENCOUNTER_R = 140;
const REACH_R = 110;
const HERO_UNITS = 104;

type Obstacle = { x: number; y: number; r: number };

interface Actor {
  id: string;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  mark?: Phaser.GameObjects.Text;
}

export class DioramaScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private heroShadow!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Image;
  private beacon!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private pointer!: Phaser.GameObjects.Text;
  private ward!: Phaser.GameObjects.Rectangle;
  private tilt!: Phaser.GameObjects.Image;
  private obstacles: Obstacle[] = [];
  private actors = new Map<string, Actor>();
  private heading = 0;
  private speed = 0;
  private walkT = 0;
  private attract = false;
  private state: DioramaState = { target: null, interact: [], enemies: [], defeated: [], gateOpen: false };
  private near: string | null = null;
  private reached = new Set<string>();
  private encounterLock = false;
  private offBus: (() => void)[] = [];
  private stepSfx = 0;

  constructor() {
    super('Diorama');
  }

  init(data: { attract?: boolean }): void {
    this.attract = !!data?.attract;
    this.heading = START.heading;
    this.speed = 0;
    this.near = null;
    this.reached.clear();
    this.encounterLock = false;
    this.actors.clear();
    this.obstacles = [];
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#6d4a31');
    const pad = 260;
    this.add.tileSprite(-pad, -pad, BOARD.w + pad * 2, BOARD.h + pad * 2 + EDGE, 'table').setOrigin(0).setDepth(-30);
    // Board drop shadow on the table
    this.add.rectangle(BOARD.w / 2 + 14, BOARD.h / 2 + EDGE / 2 + 24, BOARD.w + 20, BOARD.h + EDGE + 10, 0x1a1020, 0.4).setDepth(-25);
    this.add
      .image(0, 0, 'ground')
      .setOrigin(0)
      .setScale(1 / GROUND_SCALE)
      .setDepth(-20);

    // Props
    const meta = (k: string) => this.registry.get(`prop-${k}`) as { originY: number; radius: number; shadow: number };
    const radii: Record<string, number> = {};
    for (const k of ['tree0', 'tree1', 'tree2', 'pine0', 'pine1', 'bush0', 'bush1', 'rock0', 'rock1', 'mushroom', 'cottage', 'campfire', 'crystal']) radii[k] = meta(k).radius;
    for (const p of scatter(radii)) this.placeProp(p, meta(p.key));
    const flame = this.add.image(300, 1300 - 16, 'prop-flame').setOrigin(0.5, 0.95).setDepth(1300.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flame, scaleY: 1.2, scaleX: 0.9, duration: 260, yoyo: true, repeat: -1 });
    const fireGlow = this.add.image(300, 1280, 'glow').setScale(8).setTint(0xffa040).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);
    this.tweens.add({ targets: fireGlow, alpha: 0.4, duration: 400, yoyo: true, repeat: -1 });

    // Fence with a warded gateway
    for (let y = 60; y < BOARD.h - 30; y += 46) {
      if (y > GATE_GAP.y0 - 20 && y < GATE_GAP.y1 + 10) continue;
      this.add.image(FENCE_X, y, 'prop-fence').setOrigin(0.5, 0.9).setScale(0.75).setDepth(y);
    }
    for (const y of [GATE_GAP.y0 - 14, GATE_GAP.y1 + 14]) this.add.image(FENCE_X, y, 'prop-crystal').setOrigin(0.5, 0.92).setScale(0.8).setDepth(y);
    this.ward = this.add.rectangle(FENCE_X, (GATE_GAP.y0 + GATE_GAP.y1) / 2 - 30, 26, GATE_GAP.y1 - GATE_GAP.y0 + 60, 0x73eff7, 0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(GATE_GAP.y1);
    this.tweens.add({ targets: this.ward, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    // Landmarks & figures
    this.addActor('banner', 'prop-banner', SPOTS.banner, 0.9, 0.95);
    this.addActor('signpost', 'prop-signpost', SPOTS.signpost, 0.85, 0.94);
    this.addActor('dummy', 'fig-dummy', SPOTS.dummy, HERO_UNITS / FIG_H, FIG_ORIGIN_Y);
    for (const id of ['skeleton', 'golem', 'mage', 'warden'] as const) {
      const big = id === 'golem' || id === 'warden';
      const a = this.addActor(id, `fig-${id}`, SPOTS[id], (HERO_UNITS / FIG_H) * (big ? 1.35 : 1.1), FIG_ORIGIN_Y);
      a.mark = this.add.text(SPOTS[id].x, SPOTS[id].y - (big ? 190 : 150), '!', { fontFamily: '"Press Start 2P", monospace', fontSize: '34px', color: '#ffcd75', stroke: '#1a1c2c', strokeThickness: 8 }).setOrigin(0.5).setDepth(5000);
      this.tweens.add({ targets: a.mark, y: a.mark.y - 10, duration: 500, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: a.sprite, y: a.sprite.y - 5, duration: 900 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // Objective beacon
    this.ring = this.add.image(0, 0, 'prop-ring').setDepth(-9).setVisible(false);
    this.tweens.add({ targets: this.ring, scale: 1.15, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
    this.beacon = this.add.image(0, 0, 'prop-beacon').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(6000).setVisible(false);
    this.tweens.add({ targets: this.beacon, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });

    // Hero
    this.heroShadow = this.add.image(START.x, START.y, 'dshadow').setScale(0.6, 0.45);
    this.arrow = this.add.image(START.x, START.y, 'prop-heading').setScale(0.9).setAlpha(0.9).setDepth(-8);
    this.hero = this.add.image(START.x, START.y, 'fig-hero').setOrigin(0.5, FIG_ORIGIN_Y).setScale(HERO_UNITS / FIG_H);

    this.pointer = this.add.text(0, 0, '▲', { fontFamily: 'sans-serif', fontSize: '64px', color: '#ffe38a', stroke: '#1a1c2c', strokeThickness: 10 }).setOrigin(0.5).setDepth(9000).setVisible(false);

    // Screen-space tilt-shift haze + vignette (repositioned to the view each frame).
    this.tilt = this.add.image(0, 0, this.makeTiltShift()).setOrigin(0).setDepth(9500);

    cam.setBounds(-200, -160, BOARD.w + 400, BOARD.h + EDGE + 300);
    this.fit();
    cam.centerOn(START.x, START.y - 120);
    cam.startFollow(this.hero, false, 0.08, 0.08, 0, 60);
    this.scale.on('resize', this.fit, this);
    cam.fadeIn(500, 30, 20, 30);

    this.offBus.push(
      bus.on('diorama:state', (s) => this.applyState(s)),
      bus.on('diorama:hit', ({ id }) => this.hit(id)),
      bus.on('diorama:reset', () => this.resetHero()),
    );
    this.events.once('shutdown', () => {
      this.offBus.forEach((f) => f());
      this.offBus = [];
      this.scale.off('resize', this.fit, this);
    });
    this.events.on('wake', () => {
      this.encounterLock = false;
      this.speed = 0;
      audio.music('village');
    });
    this.applyState(getDioramaState());
    audio.music('village');
  }

  private makeTiltShift(): string {
    const key = 'tiltshift';
    if (this.textures.exists(key)) return key;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const top = ctx.createLinearGradient(0, 0, 0, 256);
    top.addColorStop(0, 'rgba(255,236,210,0.38)');
    top.addColorStop(0.2, 'rgba(255,236,210,0)');
    top.addColorStop(0.78, 'rgba(30,15,30,0)');
    top.addColorStop(1, 'rgba(30,15,30,0.38)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, 256, 256);
    const v = ctx.createRadialGradient(128, 128, 90, 128, 128, 190);
    v.addColorStop(0, 'rgba(20,10,20,0)');
    v.addColorStop(1, 'rgba(20,10,20,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 256, 256);
    this.textures.addCanvas(key, c);
    return key;
  }

  private fit(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // Show roughly 1150×650 world units — a hero and the next landmark.
    this.cameras.main.setZoom(Math.min(w / 1150, h / 650));
  }

  private placeProp(p: Placed, meta: { originY: number; shadow: number }): void {
    if (meta.shadow > 0) this.add.image(p.x, p.y, 'dshadow').setScale(meta.shadow * p.scale, meta.shadow * p.scale * 0.55).setDepth(p.y - 1);
    this.add.image(p.x, p.y, `prop-${p.key}`).setOrigin(0.5, meta.originY).setScale(p.scale).setDepth(p.y);
    if (p.radius > 0) this.obstacles.push({ x: p.x, y: p.y, r: p.radius });
  }

  private addActor(id: string, key: string, at: { x: number; y: number }, scale: number, originY: number): Actor {
    const shadow = this.add.image(at.x, at.y, 'dshadow').setScale(0.7, 0.5).setDepth(at.y - 1);
    const sprite = this.add.image(at.x, at.y, key).setOrigin(0.5, originY).setScale(scale).setDepth(at.y);
    const a = { id, sprite, shadow };
    this.actors.set(id, a);
    this.obstacles.push({ x: at.x, y: at.y, r: 34 });
    return a;
  }

  private applyState(s: DioramaState): void {
    this.state = s;
    // Remove defeated enemies with a flourish.
    for (const id of ['skeleton', 'golem', 'mage', 'warden']) {
      const a = this.actors.get(id);
      if (!a || !s.defeated.includes(id) || !a.sprite.visible) continue;
      a.mark?.destroy();
      this.tweens.killTweensOf(a.sprite);
      this.tweens.add({ targets: [a.sprite, a.shadow], alpha: 0, scaleY: 0.1, duration: 500, onComplete: () => (a.sprite.setVisible(false), a.shadow.setVisible(false)) });
      this.burst(a.sprite.x, a.sprite.y - 40, [0xffcd75, 0xffffff, 0xa7f070]);
      this.obstacles = this.obstacles.filter((o) => !(o.x === a.sprite.x && Math.abs(o.y - a.sprite.y) < 10));
    }
    if (s.gateOpen && this.ward.visible) {
      this.tweens.killTweensOf(this.ward);
      this.tweens.add({ targets: this.ward, alpha: 0, scaleX: 3, duration: 600, onComplete: () => this.ward.setVisible(false) });
      this.burst(FENCE_X, (GATE_GAP.y0 + GATE_GAP.y1) / 2, [0x73eff7, 0xffffff]);
      audio.phaseBreak();
    }
    const t = s.target ? (SPOTS as Record<string, { x: number; y: number }>)[s.target] : null;
    this.beacon.setVisible(!!t && !this.attract);
    this.ring.setVisible(!!t && !this.attract);
    if (t) {
      this.beacon.setPosition(t.x, t.y + 10);
      this.ring.setPosition(t.x, t.y);
    }
  }

  private burst(x: number, y: number, tint: number[]): void {
    const p = this.add.particles(x, y, 'glow', { speed: { min: 60, max: 220 }, lifespan: 700, tint, scale: { start: 0.9, end: 0 }, blendMode: 'ADD', emitting: false }).setDepth(7000);
    p.explode(28);
    this.time.delayedCall(900, () => p.destroy());
  }

  private hit(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    this.tweens.add({ targets: this.hero, x: this.hero.x + (a.sprite.x - this.hero.x) * 0.3, y: this.hero.y + (a.sprite.y - this.hero.y) * 0.3, duration: 120, yoyo: true });
    this.time.delayedCall(110, () => {
      this.tweens.add({ targets: a.sprite, angle: { from: -14, to: 0 }, duration: 500, ease: 'Elastic.out' });
      this.burst(a.sprite.x, a.sprite.y - 60, [0xffe38a, 0xffffff]);
      this.cameras.main.shake(160, 0.004);
      audio.slash(1);
      audio.hit();
    });
  }

  private resetHero(): void {
    this.hero.setPosition(START.x, START.y);
    this.heading = START.heading;
    this.speed = 0;
  }

  update(_t: number, dtMs: number): void {
    const dt = Math.min(dtMs, 50) / 1000;
    const cam = this.cameras.main;
    const view = cam.worldView;
    this.tilt.setPosition(view.x, view.y).setDisplaySize(view.width, view.height);

    if (this.attract) {
      // Title backdrop: drift slowly along the board.
      cam.stopFollow();
      cam.scrollX += dt * 30;
      if (cam.scrollX > BOARD.w - view.width) cam.scrollX = -100;
      return;
    }

    const intent = input.intent();
    const turnRate = intent.forward > 0 ? TURN_MOVING : TURN_STILL;
    this.heading += intent.turn * turnRate * dt;
    const target = intent.forward * SPEED;
    this.speed += (target - this.speed) * Math.min(1, dt * 6);

    const dx = Math.sin(this.heading) * this.speed * dt;
    const dy = -Math.cos(this.heading) * this.speed * dt;
    this.moveHero(dx, dy);

    // Marching bob and a little toy wobble.
    const moving = this.speed > 12;
    this.walkT += dt * (moving ? 9 : 2);
    const hs = HERO_UNITS / FIG_H;
    const bob = moving ? Math.abs(Math.sin(this.walkT)) * 8 : 0;
    this.hero.setScale(hs * (moving ? 1 + Math.sin(this.walkT * 2) * 0.02 : 1), hs * (moving ? 1 - Math.sin(this.walkT * 2) * 0.03 : 1));
    this.hero.setAngle(moving ? Math.sin(this.walkT) * 5 : 0);
    const sx = Math.sin(this.heading);
    if (Math.abs(sx) > 0.2) this.hero.setFlipX(sx < 0);
    const hx = this.hero.x;
    const hy = this.hero.y;
    this.hero.setDepth(hy);
    this.heroShadow.setPosition(hx, hy).setDepth(hy - 1).setAlpha(moving ? 0.7 : 0.85);
    this.arrow.setPosition(hx, hy).setRotation(this.heading);
    this.hero.setOrigin(0.5, FIG_ORIGIN_Y + bob / FIG_H);
    if (moving) {
      this.stepSfx += dt;
      if (this.stepSfx > 0.32) {
        this.stepSfx = 0;
        audio.step();
      }
    }

    this.checkSpots(hx, hy);
    this.updatePointer(view);
  }

  private moveHero(dx: number, dy: number): void {
    let x = this.hero.x + dx;
    let y = this.hero.y + dy;
    for (const o of this.obstacles) {
      const ox = x - o.x;
      const oy = (y - o.y) * 1.6; // ground ellipses are flatter than they are wide
      const d = Math.hypot(ox, oy);
      const min = o.r + HERO_R;
      if (d < min && d > 0.001) {
        x = o.x + (ox / d) * min;
        y = o.y + ((oy / d) * min) / 1.6;
      }
    }
    // Pond
    const px = (x - POND.x) / (POND.rx + HERO_R);
    const py = (y - POND.y) / (POND.ry + HERO_R * 0.6);
    const pd = Math.hypot(px, py);
    if (pd < 1 && pd > 0.001) {
      x = POND.x + (px / pd) * (POND.rx + HERO_R);
      y = POND.y + (py / pd) * (POND.ry + HERO_R * 0.6);
    }
    // Fence: passable only through the gateway once the ward is down.
    const through = this.state.gateOpen && y > GATE_GAP.y0 + 10 && y < GATE_GAP.y1 - 10;
    if (!through) {
      const wasLeft = this.hero.x < FENCE_X;
      if (wasLeft && x > FENCE_X - HERO_R) x = FENCE_X - HERO_R;
      if (!wasLeft && x < FENCE_X + HERO_R) x = FENCE_X + HERO_R;
    }
    x = Phaser.Math.Clamp(x, 50, BOARD.w - 50);
    y = Phaser.Math.Clamp(y, 60, BOARD.h - 30);
    this.hero.setPosition(x, y);
  }

  private checkSpots(x: number, y: number): void {
    const d = (id: string) => {
      const p = (SPOTS as Record<string, { x: number; y: number }>)[id];
      return Math.hypot(p.x - x, p.y - y);
    };
    const s = this.state;
    if (s.target && !this.reached.has(s.target) && !s.interact.includes(s.target) && !s.enemies.includes(s.target) && d(s.target) < REACH_R) {
      this.reached.add(s.target);
      audio.levelUp();
      bus.emit('diorama:reached', { id: s.target });
    }
    let near: string | null = null;
    for (const id of s.interact) if (d(id) < INTERACT_R && (!near || d(id) < d(near))) near = id;
    if (near !== this.near) {
      this.near = near;
      bus.emit('diorama:near', { id: near });
    }
    if (!this.encounterLock) {
      for (const id of s.enemies) {
        if (d(id) < ENCOUNTER_R) {
          this.encounterLock = true;
          this.speed = 0;
          this.cameras.main.flash(250, 255, 245, 220);
          bus.emit('world:encounter', { enemyId: id });
          break;
        }
      }
    }
  }

  /** An edge-of-screen arrow toward the objective when it's out of view. */
  private updatePointer(view: Phaser.Geom.Rectangle): void {
    const id = this.state.target;
    const t = id ? (SPOTS as Record<string, { x: number; y: number }>)[id] : null;
    if (!t || Phaser.Geom.Rectangle.Contains(view, t.x, t.y - 60)) {
      this.pointer.setVisible(false);
      return;
    }
    const cx = view.centerX;
    const cy = view.centerY;
    const ang = Math.atan2(t.y - cy, t.x - cx);
    const mx = view.width / 2 - 60 / this.cameras.main.zoom;
    const my = view.height / 2 - 60 / this.cameras.main.zoom;
    const k = Math.min(Math.abs(mx / Math.cos(ang)), Math.abs(my / Math.sin(ang)));
    this.pointer
      .setVisible(true)
      .setPosition(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k)
      .setRotation(ang + Math.PI / 2)
      .setScale(1 / this.cameras.main.zoom);
  }
}
