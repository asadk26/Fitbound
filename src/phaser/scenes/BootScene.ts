import Phaser from 'phaser';
import { CHARACTERS, ENEMY_ART, ICON_ART, paintSprite, PAL, spriteSize, type PixelSprite } from '../art';
import { paintTileset } from '../tiles';
import { bus } from '../../game/bus';
import { FIGURES, paintFigure } from '../diorama/figures';
import { paintGround, paintTable } from '../diorama/ground';
import { shadowBlob } from '../diorama/paint';
import { paintProps } from '../diorama/props';
import { paintBattleBackdrops } from '../diorama/backdrops';

const NEAREST = Phaser.Textures.FilterMode.NEAREST;

/** Generates every texture procedurally, then hands off to the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.textures.addCanvas('tiles', paintTileset())!.setFilter(NEAREST);

    // Diorama art: smooth-filtered, painted once.
    for (const k of Object.keys(FIGURES)) {
      this.textures.addCanvas(`fig-${k}`, paintFigure(k));
      this.textures.addCanvas(`fig-${k}-free`, paintFigure(k, false));
    }
    for (const [k, p] of Object.entries(paintProps())) {
      this.textures.addCanvas(`prop-${k}`, p.canvas);
      this.registry.set(`prop-${k}`, { originY: p.originY, radius: p.radius, shadow: p.shadow });
    }
    this.textures.addCanvas('ground', paintGround());
    this.textures.addCanvas('table', paintTable());
    this.textures.addCanvas('dshadow', shadowBlob(128, 48));
    for (const [k, c] of Object.entries(paintBattleBackdrops())) this.textures.addCanvas(`bg-${k}`, c);

    for (const [key, s] of Object.entries(CHARACTERS)) this.addSheet(key, s);
    for (const [key, s] of Object.entries(ENEMY_ART)) this.addSheet(`enemy-${key}`, s);
    for (const [key, s] of Object.entries(ICON_ART)) this.addSheet(`icon-${key}`, s);

    this.makeShape('px', 2, 2, (c) => {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, 2, 2);
    });
    this.makeShape('spark', 5, 5, (c) => {
      c.fillStyle = '#fff';
      c.fillRect(2, 0, 1, 5);
      c.fillRect(0, 2, 5, 1);
      c.fillRect(1, 1, 3, 3);
    });
    this.makeShape('glow', 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    });
    this.makeShape('shadow', 16, 6, (c) => {
      c.fillStyle = 'rgba(26,28,44,0.45)';
      c.beginPath();
      c.ellipse(8, 3, 7, 2.5, 0, 0, Math.PI * 2);
      c.fill();
    });
    this.makeShape('marker', 16, 16, (c) => {
      c.strokeStyle = PAL.white;
      c.lineWidth = 2;
      c.strokeRect(2, 2, 12, 12);
    });
    this.makeShape('bubble', 11, 9, (c) => {
      c.fillStyle = PAL.ink;
      c.fillRect(0, 0, 11, 7);
      c.fillRect(4, 7, 3, 2);
      c.fillStyle = PAL.white;
      c.fillRect(1, 1, 9, 5);
      c.fillStyle = PAL.ink;
      c.fillRect(2, 3, 1, 1);
      c.fillRect(5, 3, 1, 1);
      c.fillRect(8, 3, 1, 1);
    });

    const anim = (key: string, sheet: string, frames: number[], rate = 6) =>
      this.anims.create({ key, frames: frames.map((f) => ({ key: sheet, frame: f })), frameRate: rate, repeat: -1 });
    for (const k of Object.keys(CHARACTERS)) {
      anim(`${k}-walk-side`, k, [1, 0, 2, 0], 8);
      anim(`${k}-walk-down`, k, [4, 3, 5, 3], 8);
      anim(`${k}-walk-up`, k, [7, 6, 8, 6], 8);
    }

    // Pixel-art textures stay crisp; everything else is smooth.
    for (const key of this.textures.getTextureKeys()) {
      if (/^(tiles|hero|elder|smith|innkeeper|trainer|enemy-|icon-|px|spark|marker|bubble|shadow)$|^(enemy|icon)-/.test(key)) this.textures.get(key).setFilter(NEAREST);
    }
    bus.emit('boot:ready');
  }

  private addSheet(key: string, s: PixelSprite): void {
    const { w, h } = spriteSize(s);
    const canvas = document.createElement('canvas');
    canvas.width = w * s.frames.length;
    canvas.height = h;
    paintSprite(canvas.getContext('2d')!, s);
    const tex = this.textures.addCanvas(key, canvas)!;
    s.frames.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
  }

  private makeShape(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d')!);
    this.textures.addCanvas(key, canvas);
  }
}
