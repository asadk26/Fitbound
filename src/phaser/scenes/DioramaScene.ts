import Phaser from 'phaser';
import { audio } from '../../game/audio';
import { bus, type DioramaState } from '../../game/bus';
import { getSave } from '../../game/store';
import { input } from '../../input/InputHub';
import { FIG_H, FIG_ORIGIN_Y } from '../diorama/figures';
import { lifelike } from '../faces';
import { EDGE, GROUND_SCALE } from '../diorama/ground';
import { getDioramaState } from '../game';
import { BOARD, FENCE_X, GATE_GAP, scatter, SPOTS, START, type Placed } from '../diorama/layout';
import { angleDelta, headingVector, resolveMove, turnHeading, type Obstacle } from '../diorama/steering';
import { GOAL_NODE, nearestOnTrail, node as trailNode, SEGS, SAMPLED, TrailWalker, type Fork } from '../diorama/trailGraph';
import { travel } from '../diorama/travel';

/**
 * The Motion Trial board. Three ways to get around, one world:
 *
 *  - Guided, active (default): marching walks the hero along the trail toward
 *    the current objective, following every bend by itself. At a fork the
 *    hero stops and one lean picks a route. No steering, no arrow to read.
 *  - Guided, assisted: a gamepad stick or the keyboard moves the hero freely
 *    around the same board (with collisions). Switching back to active walks
 *    the hero to the nearest reachable bit of trail and carries on from there.
 *  - Free roam (experimental): the older steering, where each lean turns the
 *    hero one 45°/90° step and marching walks straight ahead.
 *
 * Encounters, interactions and progression are the same in every mode.
 */
const SPEED = 190;
const INTERACT_R = 150;
const ENCOUNTER_R = 140;
const REACH_R = 110;
const HERO_UNITS = 104;

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
  /** Expedition stops (figures, the mirror, havens), keyed by marker id. */
  private markers = new Map<string, { at: { x: number; y: number }; objs: Phaser.GameObjects.GameObject[]; node: string }>();
  private markerKey = '';
  private startAt: string | null = null;
  /** Authoritative heading on the turn grid; `shown` eases toward it. */
  private heading = 0;
  private shown = 0;
  private speed = 0;
  private walkT = 0;
  private attract = false;
  private state: DioramaState = { target: null, interact: [], enemies: [], defeated: [], gateOpen: false };
  private near: string | null = null;
  private reached = new Set<string>();
  private encounterLock = false;
  private offBus: (() => void)[] = [];
  private stepSfx = 0;
  // Guided traversal
  /** Where the hero is on the trail (null while roaming off it in Assisted mode). */
  private walker = new TrailWalker();
  private onTrail = true;
  private choice: Fork | null = null;
  private rejoin: { seg: string; s: number; x: number; y: number; since: number } | null = null;


  constructor() {
    super('Diorama');
  }

  init(data: { attract?: boolean }): void {
    this.attract = !!data?.attract;
    this.heading = START.heading;
    this.shown = START.heading;
    this.speed = 0;
    this.near = null;
    this.reached.clear();
    this.encounterLock = false;
    this.actors.clear();
    this.markers.clear();
    this.markerKey = '';
    this.startAt = null;
    this.obstacles = [];
    this.walker = new TrailWalker();
    this.onTrail = true;
    this.choice = null;
    this.rejoin = null;
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
    // The Mossy Shrine (optional rest stop on the detour).
    const shrineGlow = this.add.image(SPOTS.shrine.x, SPOTS.shrine.y - 30, 'glow').setScale(3).setTint(0x73eff7).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(SPOTS.shrine.y - 2);
    this.tweens.add({ targets: shrineGlow, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
    this.addActor('shrine', 'prop-crystal', SPOTS.shrine, 1, 0.92);
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
    // A small facing chevron floating above the head (always visible, even
    // when the hero faces up the board and would hide a ground marker).
    this.arrow = this.add.image(START.x, START.y, 'prop-heading').setAlpha(0.95).setDepth(5200);
    this.hero = this.add.image(START.x, START.y, 'fig-hero').setOrigin(0.5, FIG_ORIGIN_Y).setScale(HERO_UNITS / FIG_H);
    lifelike(this, this.hero, 'hero', false);

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
      input.takeTurns();
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
    this.applyExpedition(s);
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
    const t = this.spot(s.target);
    this.beacon.setVisible(!!t && !this.attract);
    this.ring.setVisible(!!t && !this.attract);
    if (t) {
      this.beacon.setPosition(t.x, t.y + 10);
      this.ring.setPosition(t.x, t.y);
    }
  }

  /** Where a target / interaction id is on the board (expedition markers first). */
  private spot(id: string | null | undefined): { x: number; y: number } | null {
    if (!id) return null;
    return this.markers.get(id)?.at ?? (SPOTS as Record<string, { x: number; y: number }>)[id] ?? null;
  }

  /**
   * Expedition mode: hide the trial's guardians and stand the route's
   * encounters at their trail stops. Rebuilt only when the route changes.
   */
  private applyExpedition(s: DioramaState): void {
    const ex = s.expedition;
    for (const id of ['dummy', 'skeleton', 'golem', 'mage', 'warden']) {
      const a = this.actors.get(id);
      if (!a) continue;
      a.sprite.setVisible(!ex && !s.defeated.includes(id));
      a.shadow.setVisible(!ex && !s.defeated.includes(id));
      a.mark?.setVisible(!ex);
    }
    if (!ex) return;
    const key = JSON.stringify(ex.markers);
    if (key !== this.markerKey) {
      this.markerKey = key;
      for (const m of this.markers.values()) m.objs.forEach((o) => o.destroy());
      this.markers.clear();
      for (const m of ex.markers) {
        const n = trailNode(m.node);
        const at = { x: n.x + 60, y: n.y - 20 };
        const objs: Phaser.GameObjects.GameObject[] = [];
        if (m.kind === 'enemy') {
          const count = m.count ?? 1;
          for (let i = 0; i < count; i++) {
            const x = at.x + (i - (count - 1) / 2) * 70;
            const y = at.y + (i % 2) * 24;
            objs.push(this.add.image(x, y, 'dshadow').setScale(0.6 * (m.scale ?? 1), 0.45).setDepth(y - 1));
            const fig = this.add.image(x, y, `fig-${m.sprite}`).setOrigin(0.5, FIG_ORIGIN_Y).setScale((HERO_UNITS / FIG_H) * 1.15 * (m.scale ?? 1)).setDepth(y).setFlipX(true);
            if (m.tint) fig.setTint(m.tint);
            this.tweens.add({ targets: fig, y: y - 5, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            objs.push(fig);
          }
        } else {
          const glow = this.add.image(at.x, at.y - 40, 'glow').setScale(m.kind === 'mirror' ? 4 : 3).setTint(m.kind === 'mirror' ? 0xc77dff : 0x73eff7).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(at.y - 2);
          this.tweens.add({ targets: glow, alpha: 0.7, duration: 1100, yoyo: true, repeat: -1 });
          objs.push(glow, this.add.image(at.x, at.y, m.kind === 'mirror' ? 'prop-crystal' : 'prop-campfire').setOrigin(0.5, 0.92).setScale(m.kind === 'mirror' ? 1.5 : 1.1).setDepth(at.y));
        }
        this.markers.set(m.id, { at, objs, node: m.node });
      }
    }
    // Encounters already behind you fade away.
    for (const [id, m] of this.markers) {
      if (!s.defeated.includes(id) || !(m.objs[0] as Phaser.GameObjects.Image).visible) continue;
      this.tweens.add({ targets: m.objs, alpha: 0, duration: 500, onComplete: () => m.objs.forEach((o) => (o as Phaser.GameObjects.Image).setVisible(false)) });
    }
    if (ex.startAt && ex.startAt !== this.startAt) {
      this.startAt = ex.startAt;
      this.placeAt(ex.startAt);
    }
  }

  /** Stand the hero on a trail node. */
  private placeAt(nodeId: string): void {
    const seg = SEGS.find((g) => g.a === nodeId) ?? SEGS.find((g) => g.b === nodeId);
    if (!seg) return;
    const s = seg.a === nodeId ? 0 : SAMPLED.get(seg.id)!.len;
    this.walker = new TrailWalker(seg.id, s);
    this.onTrail = true;
    this.rejoin = null;
    const p = this.walker.position;
    this.hero?.setPosition(p.x, p.y);
    this.cameras.main.centerOn(p.x, p.y - 120);
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
    this.shown = START.heading;
    this.speed = 0;
    this.walker = new TrailWalker();
    this.onTrail = true;
    this.setChoice(null);
    this.rejoin = null;
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

    const motion = getSave().settings.motion;
    const x0 = this.hero.x;
    const y0 = this.hero.y;
    const freeRoam = motion.navigation === 'freeroam';
    const assisted = !freeRoam && motion.traversal === 'assisted';
    if (freeRoam) this.updateFreeRoam(dt);
    else if (assisted) this.updateAssisted(dt);
    else this.updateGuided(dt);
    // Only marching counts as physical activity; keyboard and gamepad movement is tallied apart.
    const moved = Math.hypot(this.hero.x - x0, this.hero.y - y0);
    if (moved > 0) {
      if (assisted || input.keyForward || this.rejoin) travel.assisted += moved;
      else travel.active += moved;
    }
    this.arrow.setVisible(freeRoam);

    // Marching bob and a little toy wobble.
    const moving = this.speed > 12;
    this.walkT += dt * (moving ? 9 : 2);
    const hs = HERO_UNITS / FIG_H;
    const bob = moving ? Math.abs(Math.sin(this.walkT)) * 8 : 0;
    this.hero.setScale(hs * (moving ? 1 + Math.sin(this.walkT * 2) * 0.02 : 1), hs * (moving ? 1 - Math.sin(this.walkT * 2) * 0.03 : 1));
    this.hero.setAngle(moving ? Math.sin(this.walkT) * 5 : 0);
    // Face the direction of travel (the figures are drawn facing right).
    const sx = Math.sin(this.heading);
    if (Math.abs(sx) > 0.2) this.hero.setFlipX(sx < 0);
    const hx = this.hero.x;
    const hy = this.hero.y;
    this.hero.setDepth(hy);
    this.heroShadow.setPosition(hx, hy).setDepth(hy - 1).setAlpha(moving ? 0.7 : 0.85);
    const ahead = headingVector(this.shown);
    this.arrow.setPosition(hx + ahead.x * 14, hy - HERO_UNITS * 1.32 + ahead.y * 10 - bob).setRotation(this.shown);
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

  /** Legacy steering: discrete lean turns, march straight ahead. */
  private updateFreeRoam(dt: number): void {
    this.onTrail = false;
    this.setChoice(null);
    const turns = input.takeTurns();
    if (turns !== 0) {
      this.heading = turnHeading(this.heading, turns, getSave().settings.motion.turnStep);
      audio.select();
    }
    // The figure and indicator swing round quickly; movement uses the exact
    // grid heading straight away.
    this.shown += angleDelta(this.shown, this.heading) * Math.min(1, dt * 14);
    this.accelerate(input.intent().forward * SPEED, dt);
    const v = headingVector(this.heading);
    this.moveHero(v.x * this.speed * dt, v.y * this.speed * dt);
  }

  /** Assisted Traversal: conventional free movement from a gamepad stick or keys. */
  private updateAssisted(dt: number): void {
    this.onTrail = false;
    this.rejoin = null;
    this.setChoice(null);
    input.takeTurns();
    const v = input.freeMove();
    const mag = Math.min(1, Math.hypot(v.x, v.y));
    this.accelerate(mag * SPEED * (this.state.expedition ? 0.75 : 1), dt);
    if (mag > 0.05) {
      this.heading = Math.atan2(v.x, -v.y);
      this.shown = this.heading;
      this.moveHero((v.x / mag) * this.speed * dt, (v.y / mag) * this.speed * dt);
    } else if (this.speed > 0) {
      const h = headingVector(this.heading);
      this.moveHero(h.x * this.speed * dt, h.y * this.speed * dt);
    }
  }

  /** Guided Traversal: march to follow the trail; lean to choose at forks. */
  private updateGuided(dt: number): void {
    const now = this.time.now;
    const gateOpen = this.state.gateOpen;
    const goals = this.goals();

    // Coming back from Assisted Traversal: walk (don't jump) to the trail.
    if (!this.onTrail && !this.rejoin) {
      const n = nearestOnTrail(this.hero, gateOpen);
      if (n && n.d > 10) {
        this.rejoin = { ...n, since: now };
        bus.emit('trail:rejoin', { active: true });
      } else if (n) {
        this.walker.place(n.seg, n.s);
        this.onTrail = true;
      }
    }
    if (this.rejoin) {
      input.takeTurns();
      const r = this.rejoin;
      const dx = r.x - this.hero.x;
      const dy = r.y - this.hero.y;
      const d = Math.hypot(dx, dy);
      this.accelerate(SPEED * 0.8, dt);
      const step = Math.min(d, this.speed * dt);
      if (d > 0.5) {
        this.heading = Math.atan2(dx, -dy);
        // Collisions apply, but after a few seconds stuck, slip past (never teleport).
        if (now - r.since < 4000) this.moveHero((dx / d) * step, (dy / d) * step);
        else this.hero.setPosition(this.hero.x + (dx / d) * step, this.hero.y + (dy / d) * step);
      }
      if (Math.hypot(r.x - this.hero.x, r.y - this.hero.y) < 6) {
        this.walker.place(r.seg, r.s);
        this.onTrail = true;
        this.rejoin = null;
        this.speed = 0;
        bus.emit('trail:rejoin', { active: false });
      }
      return;
    }

    const turns = input.takeTurns();
    const w = this.walker;
    if (w.choice) {
      this.speed = 0;
      if (turns !== 0) {
        const opt = w.choose(turns < 0 ? -1 : 1);
        if (opt) {
          audio.gesture();
          audio.say(opt.label);
          bus.emit('trail:chosen', { label: opt.label });
        }
      }
      this.setChoice(w.choice);
      return;
    }
    this.accelerate(w.halted(goals, now) ? 0 : input.intent().forward * SPEED * (this.state.expedition?.pace ?? 1), dt);
    const st = w.advance(this.speed * dt, goals, gateOpen, now);
    if (st.halted) this.speed = 0;
    this.setChoice(st.choice);
    if (Math.hypot(st.dx, st.dy) > 0.5) this.heading = Math.atan2(st.dx, -st.dy);
    this.hero.setPosition(st.x, st.y);
  }

  /** Trail nodes for the current objective(s). */
  private goals(): string[] {
    const s = this.state;
    const ids = [s.target, ...(s.alt ?? [])].filter((x): x is string => !!x && !s.defeated.includes(x));
    return [...new Set(ids.map((id) => this.markers.get(id)?.node ?? GOAL_NODE[id]).filter(Boolean))];
  }

  private setChoice(f: Fork | null): void {
    if (f === this.choice) return;
    this.choice = f;
    bus.emit('trail:choice', f ? { prompt: f.prompt, options: f.options.map(({ dir, label, detail, icon }) => ({ dir, label, detail, icon })) } : null);
  }

  /** Start briskly, stop even faster. */
  private accelerate(target: number, dt: number): void {
    this.speed += (target - this.speed) * Math.min(1, dt * (target > this.speed ? 9 : 14));
    if (target === 0 && this.speed < 4) this.speed = 0;
  }

  private moveHero(dx: number, dy: number): void {
    const p = resolveMove(this.hero, dx, dy, { obstacles: this.obstacles, gateOpen: this.state.gateOpen });
    this.hero.setPosition(p.x, p.y);
  }

  private checkSpots(x: number, y: number): void {
    const d = (id: string) => {
      const p = this.spot(id);
      return p ? Math.hypot(p.x - x, p.y - y) : Infinity;
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
    const t = this.spot(this.state.target);
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
