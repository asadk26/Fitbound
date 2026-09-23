import Phaser from 'phaser';
import { bus } from '../../game/bus';
import { getSave } from '../../game/store';
import { audio } from '../../game/audio';
import { BOSS_GATE, buildTiles, findPath, GUARDIANS, MAPS, T, TILE, WALKABLE, type Entity, type MapDef, type MapId } from '../maps';

type Facing = 'down' | 'up' | 'left' | 'right';

interface WorldData {
  map?: MapId;
  x?: number;
  y?: number;
}

const SPEED = 70; // px per second

/** Top-down exploration for both the village and the dungeon. */
export class WorldScene extends Phaser.Scene {
  private def!: MapDef;
  private tiles!: number[][];
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private facing: Facing = 'down';
  private path: { x: number; y: number }[] = [];
  private pending: Entity | null = null;
  private entities = new Map<string, { ent: Entity; sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image }>();
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space' | 'enter', Phaser.Input.Keyboard.Key>;
  private marker!: Phaser.GameObjects.Image;
  private paused = false;
  private lastTile = { x: -1, y: -1 };
  private transitioning = false;
  private encounterCooldown = 0;
  private gateOpen = false;
  private offBus: (() => void)[] = [];
  private stepTimer = 0;

  constructor() {
    super('World');
  }

  init(data: WorldData): void {
    const save = getSave();
    const map = data.map ?? save.location?.map ?? 'village';
    this.def = MAPS[map];
    const spawn = data.x !== undefined && data.y !== undefined ? { x: data.x, y: data.y } : save.location?.map === map ? { x: save.location.x, y: save.location.y } : this.def.spawn;
    this.registry.set('spawn', spawn);
    this.path = [];
    this.pending = null;
    this.entities.clear();
    this.transitioning = false;
    this.paused = false;
    this.encounterCooldown = 800;
  }

  create(): void {
    const save = getSave();
    this.gateOpen = GUARDIANS.every((g) => save.defeated.includes(g));
    this.tiles = buildTiles(this.def, this.gateOpen);
    this.cameras.main.setBackgroundColor(this.def.bg);

    const map = this.make.tilemap({ data: this.tiles, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.layer = map.createLayer(0, tileset, 0, 0)!;

    this.decorate();

    for (const ent of this.def.entities) {
      if (ent.kind === 'enemy' && ent.id !== 'dummy' && save.defeated.includes(ent.id)) continue;
      this.spawnEntity(ent);
    }

    const spawn = this.registry.get('spawn') as { x: number; y: number };
    const safe = this.walkable(spawn.x, spawn.y) ? spawn : this.def.spawn;
    this.shadow = this.add.image(0, 0, 'shadow');
    this.player = this.add.sprite(0, 0, 'hero', 3);
    this.placePlayer(safe.x, safe.y);
    this.lastTile = { ...safe };

    this.marker = this.add.image(0, 0, 'marker').setVisible(false).setDepth(1);

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.2, 0.2);
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    cam.fadeIn(350, 26, 28, 44);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
      space: 'SPACE',
      enter: 'ENTER',
    }) as typeof this.keys;

    this.input.on('pointerdown', this.onTap, this);

    this.offBus.push(
      bus.on('world:setPaused', ({ paused }) => {
        this.paused = paused;
        if (paused) this.stopWalking();
      }),
      bus.on('world:goto', ({ map, x, y }) => this.goto(map, x, y)),
      bus.on('world:refresh', () => this.refresh()),
    );
    this.events.once('shutdown', () => {
      this.offBus.forEach((f) => f());
      this.offBus = [];
      this.scale.off('resize', this.fitCamera, this);
    });
    this.events.on('wake', () => {
      this.paused = false;
      this.encounterCooldown = 1200;
      this.refresh();
    });

    audio.music(this.def.id);
    bus.emit('world:ready', { map: this.def.id });
    bus.emit('world:moved', { map: this.def.id, x: safe.x, y: safe.y, initial: true });
  }

  private decorate(): void {
    // Flickering torch glows and a few ambient touches.
    for (let y = 0; y < this.tiles.length; y++) {
      for (let x = 0; x < this.tiles[0].length; x++) {
        const t = this.tiles[y][x];
        if (t === T.TORCH) {
          const glow = this.add
            .image(x * TILE + 8, y * TILE + 5, 'glow')
            .setTint(0xffa040)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.7)
            .setScale(1.6)
            .setDepth(2);
          this.tweens.add({ targets: glow, alpha: { from: 0.45, to: 0.85 }, scale: { from: 1.4, to: 1.8 }, duration: 380 + Math.random() * 300, yoyo: true, repeat: -1 });
        }
        if (t === T.WATER && Math.random() < 0.25) {
          const s = this.add.image(x * TILE + 4 + Math.random() * 8, y * TILE + 4 + Math.random() * 8, 'px').setTint(0xf4f4f4).setAlpha(0);
          this.tweens.add({ targets: s, alpha: 0.9, duration: 600, yoyo: true, repeat: -1, delay: Math.random() * 2000, repeatDelay: 1500 + Math.random() * 2000 });
        }
        if (t === T.CAVE || t === T.STAIRS) {
          const g = this.add.image(x * TILE + 8, y * TILE + 8, 'glow').setTint(t === T.CAVE ? 0x73eff7 : 0xffcd75).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(1.3);
          this.tweens.add({ targets: g, alpha: 0.7, duration: 900, yoyo: true, repeat: -1 });
        }
        if (t === T.RUNE) {
          const g = this.add.image(x * TILE + 8, y * TILE + 8, 'glow').setTint(0xb13e53).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3);
          this.tweens.add({ targets: g, alpha: 0.6, duration: 1200, yoyo: true, repeat: -1 });
        }
      }
    }
    if (this.def.id === 'dungeon') {
      // Drifting motes of dust.
      this.add.particles(0, 0, 'px', {
        x: { min: 0, max: this.tiles[0].length * TILE },
        y: { min: 0, max: this.tiles.length * TILE },
        lifespan: 4000,
        speedY: { min: -6, max: -2 },
        alpha: { start: 0.5, end: 0 },
        tint: [0x94b0c2, 0x73eff7],
        frequency: 250,
        scale: 0.5,
      });
    } else {
      // Butterflies over the village green.
      for (let i = 0; i < 4; i++) {
        const b = this.add.image(80 + i * 90, 60 + (i % 2) * 120, 'px').setTint([0xffcd75, 0xf4f4f4, 0x73eff7, 0xef7d57][i]).setDepth(50);
        this.tweens.add({ targets: b, x: `+=${40 + i * 10}`, duration: 3000 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.tweens.add({ targets: b, y: `+=${10}`, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }
  }

  private spawnEntity(ent: Entity): void {
    const isChar = ent.kind === 'npc';
    const key = isChar ? ent.sprite : `enemy-${ent.sprite}`;
    const sprite = this.add.sprite(ent.x * TILE + 8, ent.y * TILE + 16, key, isChar ? 3 : 0).setOrigin(0.5, 1);
    const big = ent.sprite === 'golem' || ent.sprite === 'warden';
    if (big) sprite.setScale(ent.sprite === 'warden' ? 1.1 : 0.9);
    const shadow = this.add.image(sprite.x, sprite.y - 1, 'shadow').setScale(big ? 1.4 : 1);
    sprite.setDepth(sprite.y);
    shadow.setDepth(sprite.y - 0.5);
    if (isChar) {
      this.tweens.add({ targets: sprite, scaleY: 1.04, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } else {
      this.tweens.add({ targets: sprite, y: sprite.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (ent.id !== 'dummy') {
        // A small alert mark so enemies read as enemies.
        const mark = this.add.text(sprite.x, sprite.y - sprite.displayHeight - 4, '!', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#ffcd75' }).setOrigin(0.5, 1).setDepth(9999).setResolution(4);
        this.tweens.add({ targets: mark, y: mark.y - 3, duration: 500, yoyo: true, repeat: -1 });
        sprite.setData('mark', mark);
      }
    }
    this.entities.set(ent.id, { ent, sprite, shadow });
  }

  /** After a battle: remove defeated enemies with a flourish; open the gate. */
  private refresh(): void {
    const save = getSave();
    for (const [id, e] of this.entities) {
      if (e.ent.kind === 'enemy' && id !== 'dummy' && save.defeated.includes(id)) {
        this.entities.delete(id);
        (e.sprite.getData('mark') as Phaser.GameObjects.Text | undefined)?.destroy();
        this.tweens.killTweensOf(e.sprite);
        this.tweens.add({ targets: [e.sprite, e.shadow], alpha: 0, y: '-=6', duration: 500, onComplete: () => (e.sprite.destroy(), e.shadow.destroy()) });
        this.burst(e.sprite.x, e.sprite.y - 8, [0xffcd75, 0xf4f4f4], 16);
      }
    }
    const open = GUARDIANS.every((g) => save.defeated.includes(g));
    if (open && !this.gateOpen && this.def.id === 'dungeon') {
      this.gateOpen = true;
      for (const g of BOSS_GATE) {
        this.tiles[g.y][g.x] = T.RUBBLE;
        this.layer.putTileAt(T.RUBBLE, g.x, g.y);
        this.burst(g.x * TILE + 8, g.y * TILE + 8, [0x94b0c2, 0x566c86], 12);
      }
      this.cameras.main.shake(400, 0.006);
      audio.phaseBreak();
      bus.emit('world:blocked', { text: 'A deep rumble... the sealed gate to the north crumbles open!' });
    }
    // Respawn enemies if the dungeon was reset for a new run.
    if (this.def.id === 'dungeon') {
      for (const ent of this.def.entities) if (!this.entities.has(ent.id) && !save.defeated.includes(ent.id)) this.spawnEntity(ent);
    }
  }

  private burst(x: number, y: number, tint: number[], n: number): void {
    const p = this.add.particles(x, y, 'px', { speed: { min: 20, max: 60 }, lifespan: 600, tint, quantity: n, emitting: false, gravityY: 40 }).setDepth(9000);
    p.explode(n);
    this.time.delayedCall(800, () => p.destroy());
  }

  private fitCamera(): void {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    const zoom = Phaser.Math.Clamp(Math.floor((Math.min(w, h) / 170) * 2) / 2, 2, 5);
    cam.setZoom(zoom);
    const mw = this.tiles[0].length * TILE;
    const mh = this.tiles.length * TILE;
    const vw = w / zoom;
    const vh = h / zoom;
    // When the map is smaller than the view, pad the bounds so it stays centred.
    const bx = mw < vw ? -(vw - mw) / 2 : 0;
    const by = mh < vh ? -(vh - mh) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mw, vw), Math.max(mh, vh));
  }

  private walkable(x: number, y: number): boolean {
    if (y < 0 || x < 0 || y >= this.tiles.length || x >= this.tiles[0].length) return false;
    if (!WALKABLE.has(this.tiles[y][x])) return false;
    for (const e of this.entities.values()) if (e.ent.x === x && e.ent.y === y) return false;
    return true;
  }

  private placePlayer(tx: number, ty: number): void {
    this.player.setPosition(tx * TILE + 8, ty * TILE + 15).setOrigin(0.5, 1);
    this.syncPlayer();
  }

  private syncPlayer(): void {
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y - 1).setDepth(this.player.y - 0.5);
  }

  private playerTile(): { x: number; y: number } {
    return { x: Math.floor(this.player.x / TILE), y: Math.floor((this.player.y - 4) / TILE) };
  }

  private onTap(pointer: Phaser.Input.Pointer): void {
    if (this.paused || this.transitioning) return;
    audio.unlock();
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tx = Math.floor(wp.x / TILE);
    const ty = Math.floor(wp.y / TILE);
    const from = this.playerTile();

    // Tapped an NPC or enemy: walk next to it, then interact.
    const target = [...this.entities.values()].find((e) => {
      const tall = e.sprite.displayHeight > 20;
      return e.ent.x === tx && (e.ent.y === ty || (tall && e.ent.y - 1 === ty));
    });
    if (target) {
      this.pending = target.ent;
      if (Math.abs(target.ent.x - from.x) + Math.abs(target.ent.y - from.y) === 1) {
        this.path = [];
        this.interact(target.ent);
        return;
      }
      const path = this.pathToAdjacent(from, target.ent);
      if (path) this.setPath(path, target.ent.x, target.ent.y);
      return;
    }
    this.pending = null;

    const t = this.tiles[ty]?.[tx];
    if (t === T.GATE) {
      const path = this.pathToAdjacent(from, { x: tx, y: ty });
      if (path) this.setPath(path, tx, ty);
      this.time.delayedCall(path ? path.length * (TILE / SPEED) * 1000 + 50 : 0, () =>
        bus.emit('world:blocked', { text: 'An iron gate, sealed by dark magic. Defeat the three guardians of this dungeon to break the seal.' }),
      );
      return;
    }
    if (t === T.SIGN) {
      bus.emit('world:blocked', { text: 'North: the Hollow Deep. South: Maplebrook Village. The Warden watches the deep gate.' });
      return;
    }
    if (!this.walkable(tx, ty)) {
      audio.error();
      return;
    }
    const path = findPath((x, y) => this.walkable(x, y), from, { x: tx, y: ty }, this.tiles[0].length, this.tiles.length);
    if (path) this.setPath(path, tx, ty);
  }

  private pathToAdjacent(from: { x: number; y: number }, to: { x: number; y: number }) {
    let best: { x: number; y: number }[] | null = null;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const ax = to.x + dx;
      const ay = to.y + dy;
      if (!this.walkable(ax, ay) && !(ax === from.x && ay === from.y)) continue;
      const p = findPath((x, y) => this.walkable(x, y), from, { x: ax, y: ay }, this.tiles[0].length, this.tiles.length);
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best;
  }

  private setPath(path: { x: number; y: number }[], mx: number, my: number): void {
    this.path = path;
    this.marker.setPosition(mx * TILE + 8, my * TILE + 8).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.marker);
    this.tweens.add({ targets: this.marker, alpha: 0.2, duration: 300, yoyo: true, repeat: 2 });
    if (path.length === 0 && this.pending) this.interact(this.pending);
  }

  private stopWalking(): void {
    this.path = [];
    this.pending = null;
    this.marker.setVisible(false);
    this.idle();
  }

  private idle(): void {
    this.player.anims.stop();
    const f = this.facing === 'down' ? 3 : this.facing === 'up' ? 6 : 0;
    this.player.setFrame(f);
    this.player.setFlipX(this.facing === 'left');
  }

  private walkAnim(): void {
    const k = this.facing === 'down' ? 'hero-walk-down' : this.facing === 'up' ? 'hero-walk-up' : 'hero-walk-side';
    this.player.setFlipX(this.facing === 'left');
    if (this.player.anims.currentAnim?.key !== k || !this.player.anims.isPlaying) this.player.play(k);
  }

  private face(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else if (dy !== 0) this.facing = dy > 0 ? 'down' : 'up';
  }

  private interact(ent: Entity): void {
    this.pending = null;
    this.marker.setVisible(false);
    const p = this.playerTile();
    this.face(ent.x - p.x, ent.y - p.y);
    this.idle();
    const e = this.entities.get(ent.id);
    if (e && ent.kind === 'npc') {
      const px = this.player.x;
      e.sprite.setFlipX(false).setFrame(px < e.sprite.x - 4 ? 0 : px > e.sprite.x + 4 ? 0 : 3);
      if (px < e.sprite.x - 4) e.sprite.setFlipX(true);
      const bubble = this.add.image(e.sprite.x, e.sprite.y - 20, 'bubble').setDepth(9999);
      this.tweens.add({ targets: bubble, y: bubble.y - 3, alpha: 0, delay: 500, duration: 400, onComplete: () => bubble.destroy() });
    }
    audio.select();
    if (ent.kind === 'npc') bus.emit('world:talk', { npcId: ent.id });
    else this.encounter(ent);
  }

  private encounter(ent: Entity): void {
    if (this.transitioning) return;
    this.stopWalking();
    const e = this.entities.get(ent.id);
    if (e) {
      this.tweens.add({ targets: e.sprite, scaleX: e.sprite.scaleX * 1.2, scaleY: e.sprite.scaleY * 1.2, duration: 120, yoyo: true, repeat: 1 });
    }
    this.cameras.main.flash(250, 244, 244, 244);
    bus.emit('world:encounter', { enemyId: ent.id });
  }

  goto(map: MapId, x?: number, y?: number): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.stopWalking();
    this.cameras.main.fadeOut(300, 26, 28, 44);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ map, x, y }));
  }

  update(_t: number, dtMs: number): void {
    if (this.paused || this.transitioning) return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.encounterCooldown = Math.max(0, this.encounterCooldown - dtMs);

    // Keyboard movement (desktop testing / hardware keyboards).
    const k = this.keys;
    let kx = 0;
    let ky = 0;
    if (k.left.isDown || k.a.isDown) kx -= 1;
    if (k.right.isDown || k.d.isDown) kx += 1;
    if (k.up.isDown || k.w.isDown) ky -= 1;
    if (k.down.isDown || k.s.isDown) ky += 1;
    if ((Phaser.Input.Keyboard.JustDown(k.space) || Phaser.Input.Keyboard.JustDown(k.enter)) && !this.path.length) this.interactFacing();

    if (kx || ky) {
      this.path = [];
      this.pending = null;
      this.marker.setVisible(false);
      if (kx && ky) ky = 0;
      this.face(kx, ky);
      const nx = this.player.x + kx * SPEED * dt;
      const ny = this.player.y + ky * SPEED * dt;
      if (this.canStand(nx, ny)) this.player.setPosition(nx, ny);
      this.walkAnim();
      this.footstep(dtMs);
    } else if (this.path.length) {
      const next = this.path[0];
      const tx = next.x * TILE + 8;
      const ty = next.y * TILE + 15;
      const dx = tx - this.player.x;
      const dy = ty - this.player.y;
      const d = Math.hypot(dx, dy);
      const step = SPEED * dt;
      this.face(dx, dy);
      this.walkAnim();
      this.footstep(dtMs);
      if (d <= step) {
        this.player.setPosition(tx, ty);
        this.path.shift();
        if (!this.path.length) {
          this.marker.setVisible(false);
          this.idle();
          if (this.pending) this.interact(this.pending);
        }
      } else this.player.setPosition(this.player.x + (dx / d) * step, this.player.y + (dy / d) * step);
    } else if (this.player.anims.isPlaying) {
      this.idle();
    }
    this.syncPlayer();

    const tile = this.playerTile();
    if (tile.x !== this.lastTile.x || tile.y !== this.lastTile.y) {
      this.lastTile = tile;
      bus.emit('world:moved', { map: this.def.id, x: tile.x, y: tile.y });
      this.onEnterTile(tile.x, tile.y);
    }
  }

  private footstep(dtMs: number): void {
    this.stepTimer += dtMs;
    if (this.stepTimer > 260) {
      this.stepTimer = 0;
      audio.step();
    }
  }

  private canStand(x: number, y: number): boolean {
    // Feet hitbox 8×4 px.
    const pts = [
      [x - 4, y - 4],
      [x + 3, y - 4],
      [x - 4, y - 1],
      [x + 3, y - 1],
    ];
    return pts.every(([px, py]) => this.walkable(Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  private interactFacing(): void {
    const p = this.playerTile();
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    const tx = p.x + d[0];
    const ty = p.y + d[1];
    const e = [...this.entities.values()].find((e) => e.ent.x === tx && e.ent.y === ty);
    if (e) this.interact(e.ent);
    else if (this.tiles[ty]?.[tx] === T.GATE) bus.emit('world:blocked', { text: 'An iron gate, sealed by dark magic. Defeat the three guardians of this dungeon to break the seal.' });
    else if (this.tiles[ty]?.[tx] === T.SIGN) bus.emit('world:blocked', { text: 'North: the Hollow Deep. South: Maplebrook Village. The Warden watches the deep gate.' });
  }

  private onEnterTile(x: number, y: number): void {
    const exit = this.def.exits.find((e) => e.x === x && e.y === y);
    if (exit) {
      this.goto(exit.to, exit.spawn.x, exit.spawn.y);
      return;
    }
    if (this.encounterCooldown > 0) return;
    // Dungeon monsters engage when you step next to them.
    for (const e of this.entities.values()) {
      if (e.ent.kind !== 'enemy' || e.ent.id === 'dummy') continue;
      if (Math.abs(e.ent.x - x) + Math.abs(e.ent.y - y) <= 1) {
        this.face(e.ent.x - x, e.ent.y - y);
        this.idle();
        this.encounter(e.ent);
        return;
      }
    }
  }
}
