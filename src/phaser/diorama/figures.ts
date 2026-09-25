import { canvas, darken, ellipse, glint, lighten, roundRect, shade, type Ctx } from './paint';

/**
 * Tabletop-miniature figures: chunky chibi proportions, glossy toy shading,
 * each standing on a round painted base (on the board; battles use them
 * without it). Drawn at 160×200 so they stay crisp
 * when a mirrored TV blows them up.
 */
export const FIG_W = 160;
export const FIG_H = 200;
/** Where the figure's base sits, as an origin for Phaser. */
export const FIG_ORIGIN_Y = 176 / FIG_H;

let withBase = true;

function base(ctx: Ctx, top = '#5fae5a', side = '#4a3526', rx = 52): void {
  if (!withBase) return;
  const cx = 80;
  const cy = 176;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 7, rx, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = darken(side, 0.2);
  ctx.fill();
  ctx.fillStyle = side;
  ctx.fillRect(cx - rx, cy, rx * 2, 7);
  ellipse(ctx, cx, cy, rx, 16, top, 2.5, 0.25);
  // Tufts on the base.
  ctx.fillStyle = lighten(top, 0.25);
  for (const [x, y] of [
    [-30, -2],
    [22, 4],
    [34, -5],
    [-12, 7],
  ])
    ctx.fillRect(cx + x, cy + y, 3, 2);
}

function eyes(ctx: Ctx, cx: number, cy: number, gap: number, r: number, color = '#1d1a2b'): void {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * gap, cy, r * 0.75, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    glint(ctx, cx + s * gap - r * 0.25, cy - r * 0.4, r * 0.28, r * 0.28, 0.95);
  }
}

function hero(ctx: Ctx): void {
  base(ctx);
  // Cape
  ctx.beginPath();
  ctx.moveTo(56, 104);
  ctx.quadraticCurveTo(38, 140, 44, 166);
  ctx.lineTo(116, 166);
  ctx.quadraticCurveTo(122, 140, 104, 104);
  ctx.closePath();
  shade(ctx, '#3b5dc9', { x: 40, y: 104, w: 80, h: 62 }, 3);
  // Boots
  roundRect(ctx, 62, 146, 16, 24, 6, '#6b4428');
  roundRect(ctx, 83, 146, 16, 24, 6, '#6b4428');
  // Tunic
  ctx.beginPath();
  ctx.moveTo(58, 106);
  ctx.quadraticCurveTo(54, 150, 60, 154);
  ctx.lineTo(100, 154);
  ctx.quadraticCurveTo(106, 150, 102, 106);
  ctx.quadraticCurveTo(80, 96, 58, 106);
  shade(ctx, '#c9424f', { x: 54, y: 98, w: 52, h: 56 }, 3);
  roundRect(ctx, 57, 132, 46, 8, 3, '#e9b24a', 2);
  roundRect(ctx, 75, 131, 10, 10, 2, '#f5d98a', 2);
  // Arms
  ellipse(ctx, 52, 124, 9, 12, '#f2c49a', 2.5);
  ellipse(ctx, 108, 124, 9, 12, '#f2c49a', 2.5);
  // Sword in the figure's right hand (viewer's left)
  ctx.save();
  ctx.translate(46, 124);
  ctx.rotate(-0.35);
  roundRect(ctx, -4, -62, 9, 58, 3, '#dfe7f2', 2.5, 0.6);
  glint(ctx, -1, -48, 1.5, 14, 0.8);
  roundRect(ctx, -12, -6, 25, 7, 3, '#e9b24a', 2);
  roundRect(ctx, -3, 0, 7, 12, 3, '#6b4428', 2);
  ctx.restore();
  // Head
  ellipse(ctx, 80, 68, 34, 32, '#f2c49a', 3, 0.35);
  // Hair
  ctx.beginPath();
  ctx.moveTo(46, 70);
  ctx.quadraticCurveTo(44, 30, 80, 32);
  ctx.quadraticCurveTo(118, 30, 114, 72);
  ctx.quadraticCurveTo(104, 52, 92, 56);
  ctx.quadraticCurveTo(84, 46, 74, 56);
  ctx.quadraticCurveTo(58, 50, 46, 70);
  shade(ctx, '#7a4a2a', { x: 44, y: 30, w: 72, h: 42 }, 3, 0.45);
  eyes(ctx, 80, 76, 12, 6);
  // Blush + smile
  ctx.fillStyle = 'rgba(232,110,110,0.45)';
  ctx.beginPath();
  ctx.ellipse(60, 86, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(100, 86, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a2a22';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(80, 86, 5, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function skeleton(ctx: Ctx): void {
  base(ctx, '#6d7a6a', '#3a3440');
  const bone = '#eeeadf';
  // Legs
  roundRect(ctx, 64, 136, 9, 34, 4, bone, 2.5);
  roundRect(ctx, 87, 136, 9, 34, 4, bone, 2.5);
  // Pelvis + spine
  roundRect(ctx, 60, 128, 40, 12, 6, bone, 2.5);
  roundRect(ctx, 76, 96, 8, 36, 4, bone, 2.5);
  // Ribs
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(80, 102 + i * 9, 21 - i * 3, 5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = darken(bone, 0.5);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = bone;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  // Arms, rusty blade in the viewer's right hand
  roundRect(ctx, 48, 98, 8, 34, 4, bone, 2.5);
  roundRect(ctx, 104, 98, 8, 30, 4, bone, 2.5);
  ctx.save();
  ctx.translate(110, 126);
  ctx.rotate(0.5);
  roundRect(ctx, -4, -52, 9, 50, 2, '#9d8870', 2.5, 0.3);
  roundRect(ctx, -10, -4, 21, 6, 3, '#5d4a3a', 2);
  ctx.restore();
  // Skull
  ellipse(ctx, 80, 64, 30, 28, bone, 3, 0.45);
  roundRect(ctx, 68, 80, 24, 14, 5, bone, 2.5);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(80 + s * 12, 64, 8, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2233';
    ctx.fill();
    const g = ctx.createRadialGradient(80 + s * 12, 65, 0, 80 + s * 12, 65, 6);
    g.addColorStop(0, '#ff8a7a');
    g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.fillStyle = '#2a2233';
  for (let i = -1; i <= 1; i++) ctx.fillRect(78 + i * 6, 84, 3, 7);
}

function golem(ctx: Ctx): void {
  base(ctx, '#6b8a5e', '#3d3a36', 60);
  const stone = '#8a94a3';
  roundRect(ctx, 56, 140, 20, 32, 7, darken(stone, 0.1));
  roundRect(ctx, 86, 140, 20, 32, 7, darken(stone, 0.1));
  // Body
  roundRect(ctx, 40, 76, 82, 72, 22, stone, 3.5, 0.35);
  // Moss
  ctx.fillStyle = '#6fbf5a';
  for (const [x, y, r] of [
    [60, 84, 9],
    [72, 80, 7],
    [104, 120, 8],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cracks
  ctx.strokeStyle = darken(stone, 0.5);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(90, 96);
  ctx.lineTo(96, 108);
  ctx.lineTo(92, 118);
  ctx.stroke();
  // Fists
  ellipse(ctx, 32, 128, 18, 17, darken(stone, 0.05), 3.5);
  ellipse(ctx, 130, 128, 18, 17, darken(stone, 0.05), 3.5);
  // Head
  roundRect(ctx, 58, 38, 46, 42, 14, lighten(stone, 0.08), 3.5, 0.4);
  // Glowing eyes
  for (const s of [-1, 1]) {
    const g = ctx.createRadialGradient(81 + s * 10, 58, 0, 81 + s * 10, 58, 9);
    g.addColorStop(0, '#fff6c0');
    g.addColorStop(0.5, '#ffcd4a');
    g.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(81 + s * 10, 58, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function mage(ctx: Ctx): void {
  base(ctx, '#5a6b8a', '#2e2a3f');
  // Staff
  roundRect(ctx, 116, 40, 7, 132, 3, '#8a5a34', 2.5);
  const g = ctx.createRadialGradient(119, 38, 0, 119, 38, 20);
  g.addColorStop(0, '#f2ffd0');
  g.addColorStop(0.4, '#a7f070');
  g.addColorStop(1, 'rgba(120,230,100,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(119, 38, 20, 0, Math.PI * 2);
  ctx.fill();
  ellipse(ctx, 119, 38, 9, 9, '#a7f070', 2.5, 0.7);
  // Robe (cone)
  ctx.beginPath();
  ctx.moveTo(80, 44);
  ctx.quadraticCurveTo(40, 110, 38, 170);
  ctx.quadraticCurveTo(80, 180, 122, 170);
  ctx.quadraticCurveTo(120, 110, 80, 44);
  shade(ctx, '#6b3a8f', { x: 38, y: 44, w: 84, h: 130 }, 3.5, 0.35);
  // Trim
  ctx.strokeStyle = '#e9b24a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(44, 160);
  ctx.quadraticCurveTo(80, 172, 116, 160);
  ctx.stroke();
  // Hood opening
  ctx.beginPath();
  ctx.ellipse(80, 82, 20, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1428';
  ctx.fill();
  for (const s of [-1, 1]) {
    const e = ctx.createRadialGradient(80 + s * 8, 84, 0, 80 + s * 8, 84, 7);
    e.addColorStop(0, '#e8ffff');
    e.addColorStop(0.5, '#73eff7');
    e.addColorStop(1, 'rgba(115,239,247,0)');
    ctx.fillStyle = e;
    ctx.beginPath();
    ctx.arc(80 + s * 8, 84, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hand on staff
  ellipse(ctx, 116, 116, 8, 8, '#b9a5d6', 2.5);
}

function warden(ctx: Ctx): void {
  base(ctx, '#6a6a7a', '#2a2833', 64);
  const iron = '#6d7890';
  const gold = '#e9b24a';
  // Maul
  ctx.save();
  ctx.translate(128, 150);
  ctx.rotate(-0.25);
  roundRect(ctx, -4, -96, 9, 100, 3, '#5d3a22', 2.5);
  roundRect(ctx, -22, -122, 44, 30, 7, darken(iron, 0.15), 3.5, 0.45);
  roundRect(ctx, -22, -110, 44, 6, 2, gold, 2);
  ctx.restore();
  // Legs
  roundRect(ctx, 56, 138, 20, 34, 6, darken(iron, 0.1));
  roundRect(ctx, 86, 138, 20, 34, 6, darken(iron, 0.1));
  // Body with pauldrons
  roundRect(ctx, 46, 80, 70, 66, 18, iron, 3.5, 0.45);
  roundRect(ctx, 50, 128, 62, 8, 3, gold, 2);
  ellipse(ctx, 42, 86, 18, 14, lighten(iron, 0.1), 3.5, 0.5);
  ellipse(ctx, 120, 86, 18, 14, lighten(iron, 0.1), 3.5, 0.5);
  // Emblem
  ctx.beginPath();
  ctx.moveTo(81, 96);
  ctx.lineTo(92, 108);
  ctx.lineTo(81, 122);
  ctx.lineTo(70, 108);
  ctx.closePath();
  shade(ctx, '#c9424f', { x: 70, y: 96, w: 22, h: 26 }, 2.5, 0.5);
  // Helmet
  roundRect(ctx, 56, 28, 50, 54, 18, lighten(iron, 0.05), 3.5, 0.5);
  roundRect(ctx, 76, 18, 10, 16, 4, gold, 2.5);
  roundRect(ctx, 62, 52, 38, 10, 4, '#1c1826', 2);
  const v = ctx.createLinearGradient(62, 57, 100, 57);
  v.addColorStop(0, 'rgba(255,80,80,0)');
  v.addColorStop(0.5, '#ff5a5a');
  v.addColorStop(1, 'rgba(255,80,80,0)');
  ctx.fillStyle = v;
  ctx.fillRect(64, 55, 34, 4);
}

function dummy(ctx: Ctx): void {
  base(ctx, '#6aa85a', '#4a3526');
  roundRect(ctx, 75, 120, 11, 54, 4, '#8a5a34', 2.5);
  roundRect(ctx, 34, 96, 92, 12, 6, '#8a5a34', 2.5);
  // Straw body
  ellipse(ctx, 80, 118, 26, 30, '#e3bf6a', 3, 0.35);
  ctx.strokeStyle = '#b8903e';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(80 + i * 8, 92);
    ctx.lineTo(80 + i * 9, 146);
    ctx.stroke();
  }
  roundRect(ctx, 56, 112, 48, 7, 3, '#c9424f', 2);
  // Sack head with stitched eyes
  ellipse(ctx, 80, 66, 26, 26, '#d9c79a', 3, 0.35);
  ctx.strokeStyle = '#5a4230';
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    const x = 80 + s * 10;
    ctx.beginPath();
    ctx.moveTo(x - 5, 60);
    ctx.lineTo(x + 5, 70);
    ctx.moveTo(x + 5, 60);
    ctx.lineTo(x - 5, 70);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(70, 80);
  ctx.lineTo(90, 80);
  ctx.stroke();
}

/** Eyes closed, for blinking (Elara only for now). */
let blinking = false;

const SILVER = '#c4c7d4';
const IVORY = '#efe7d6';
const TEAL = '#1f5c61';
/** The Heart's colour: a warm amber. */
export const HEART = '#ffb45a';

/** Long wavy hair, from a top point down one side and across the ends. */
function wavyHair(ctx: Ctx, pts: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i += 2) ctx.quadraticCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  ctx.closePath();
}

/**
 * Elara: a young, doll-like woman — porcelain skin, large calm eyes, long
 * wavy silver-grey hair, ivory robes under deep teal, and one thin thread of
 * the Heart's warm light running through them. Glossy like the other
 * figures; soft blush and a small smile keep her approachable.
 */
function elara(ctx: Ctx): void {
  base(ctx, '#7f9a86', '#3d4a4a');
  // Hair behind: falls in waves to below the waist.
  const backHair = () =>
    wavyHair(ctx, [
      [80, 30],
      [124, 30],
      [118, 70],
      [128, 88],
      [120, 106],
      [130, 126],
      [118, 144],
      [124, 158],
      [104, 160],
      [92, 166],
      [80, 158],
      [68, 166],
      [56, 160],
      [36, 158],
      [42, 144],
      [30, 126],
      [40, 106],
      [32, 88],
      [42, 70],
      [36, 30],
      [80, 30],
    ]);
  backHair();
  shade(ctx, SILVER, { x: 30, y: 30, w: 100, h: 136 }, 3, 0.5);
  ctx.save();
  backHair();
  ctx.clip();
  hairStrands(ctx, 56, 160);
  ctx.restore();
  // Ivory gown, a soft bell to the floor.
  ctx.beginPath();
  ctx.moveTo(64, 98);
  ctx.quadraticCurveTo(50, 140, 44, 172);
  ctx.quadraticCurveTo(80, 180, 116, 172);
  ctx.quadraticCurveTo(110, 140, 96, 98);
  ctx.closePath();
  shade(ctx, IVORY, { x: 44, y: 98, w: 72, h: 80 }, 3, 0.3);
  // Deep-teal over-robe, open at the front.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(80 + s * 16, 98);
    ctx.quadraticCurveTo(80 + s * 34, 136, 80 + s * 37, 172);
    ctx.quadraticCurveTo(80 + s * 28, 176, 80 + s * 20, 174);
    ctx.quadraticCurveTo(80 + s * 16, 136, 80 + s * 8, 104);
    ctx.closePath();
    shade(ctx, TEAL, { x: s < 0 ? 42 : 86, y: 98, w: 32, h: 78 }, 2.5, 0.35);
  }
  // A soft teal shawl collar.
  ctx.beginPath();
  ctx.moveTo(58, 96);
  ctx.quadraticCurveTo(80, 116, 102, 96);
  ctx.quadraticCurveTo(80, 104, 58, 96);
  ctx.closePath();
  shade(ctx, TEAL, { x: 58, y: 94, w: 44, h: 18 }, 2.5, 0.45);
  // The thread of the Heart's light, from the collar down through the gown.
  ctx.save();
  ctx.shadowColor = HEART;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#ffd08a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(72, 104);
  ctx.bezierCurveTo(88, 118, 70, 132, 82, 144);
  ctx.bezierCurveTo(92, 154, 86, 164, 96, 172);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = HEART;
  ctx.shadowBlur = 10;
  ellipse(ctx, 72, 104, 3.2, 3.2, HEART, 1.5, 0.7);
  ctx.restore();
  // Wide ivory sleeves, hands folded in front.
  ellipse(ctx, 58, 126, 10, 19, IVORY, 2.5, 0.3);
  ellipse(ctx, 102, 126, 10, 19, IVORY, 2.5, 0.3);
  ellipse(ctx, 75, 138, 7, 6, '#f7e8de', 2, 0.4);
  ellipse(ctx, 85, 139, 7, 6, '#f7e8de', 2, 0.4);
  // Porcelain face.
  ellipse(ctx, 80, 64, 30, 29, '#f7e8de', 3, 0.45);
  // Eyes: large, calm, grey-teal; lids a touch lowered, never sleepy.
  for (const sx of [-1, 1]) {
    const ex = 80 + sx * 11;
    const ey = 70;
    if (blinking) {
      ctx.strokeStyle = '#4a3a44';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ex, ey - 3, 6, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5.6, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ex, ey + 0.8, 4.6, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4d7c84';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ex, ey + 1.2, 2.3, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1d2a33';
    ctx.fill();
    glint(ctx, ex - 1.6, ey - 2.2, 1.5, 1.5, 0.95);
    glint(ctx, ex + 1.8, ey + 3, 0.8, 0.8, 0.6);
    // Upper lid and lashes.
    ctx.strokeStyle = '#3e3140';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(ex, ey + 0.5, 6.2, 6.6, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ex + sx * 5.6, ey - 3.5);
    ctx.lineTo(ex + sx * 8, ey - 5);
    ctx.stroke();
  }
  // Brows, soft and light.
  ctx.strokeStyle = '#a3a6b6';
  ctx.lineWidth = 1.8;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(80 + sx * 11, 62, 6, 1.2 * Math.PI, 1.8 * Math.PI);
    ctx.stroke();
  }
  // Blush and a small smile.
  ctx.fillStyle = 'rgba(236,140,150,0.35)';
  ctx.beginPath();
  ctx.ellipse(62, 80, 5.5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(98, 80, 5.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a0525a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(80, 80, 3.6, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  // Hair in front: a side-swept fringe and two long wavy locks framing the face.
  wavyHair(ctx, [
    [49, 66],
    [46, 30],
    [82, 31],
    [116, 30],
    [111, 68],
    [106, 50],
    [96, 50],
    [86, 42],
    [74, 50],
    [60, 48],
    [49, 66],
  ]);
  shade(ctx, SILVER, { x: 46, y: 30, w: 70, h: 38 }, 3, 0.55);
  ctx.strokeStyle = 'rgba(140,144,166,0.7)';
  ctx.lineWidth = 1.4;
  for (const [x0, x1] of [
    [62, 70],
    [76, 88],
    [96, 104],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, 36);
    ctx.quadraticCurveTo((x0 + x1) / 2 - 4, 42, x1, 50);
    ctx.stroke();
  }
  for (const sx of [-1, 1]) lock(ctx, 80 + sx * 27, 54, 118, sx);
  // A small teal clasp with a bead of Heart-light.
  ellipse(ctx, 106, 46, 5, 4, TEAL, 2, 0.5);
  ellipse(ctx, 106, 46, 2, 2, HEART, 1, 0.8);
}

/** A long wavy lock framing the face: a ribbon that tapers as it waves down. */
function lock(ctx: Ctx, x: number, y0: number, y1: number, sx: number): void {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let y = y0; y <= y1; y += 3) {
    const t = (y - y0) / (y1 - y0);
    const cx = x + sx * (2 + 3.2 * Math.sin((y - y0) / 8));
    const hw = 5.2 * (1 - t) + 1.4;
    left.push([cx - hw, y]);
    right.push([cx + hw, y]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const [px, py] of left) ctx.lineTo(px, py);
  for (const [px, py] of right.reverse()) ctx.lineTo(px, py);
  ctx.closePath();
  shade(ctx, SILVER, { x: x - 9, y: y0, w: 18, h: y1 - y0 }, 2.2, 0.55);
}

/** Fine strands over the long hair, following its waves. */
function hairStrands(ctx: Ctx, y0: number, y1: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(140,144,166,0.6)';
  ctx.lineWidth = 1.4;
  for (const sx of [-1, 1]) {
    for (const k of [0, 1, 2]) {
      const x = 80 + sx * (30 + k * 7);
      ctx.beginPath();
      for (let y = y0; y <= y1 - k * 8; y += 3) {
        const px = x + sx * 3.5 * Math.sin((y - y0) / 9 + k);
        if (y === y0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const FIGURES: Record<string, (ctx: Ctx) => void> = {
  hero,
  skeleton,
  golem,
  mage,
  warden,
  dummy,
  elara,
};

/** A figure, on its round base or (for battles and scenes) standing free. */
export function paintFigure(name: string, onBase = true, blink = false): HTMLCanvasElement {
  const [c, ctx] = canvas(FIG_W, FIG_H);
  withBase = onBase;
  blinking = blink;
  try {
    (FIGURES[name] ?? hero)(ctx);
  } finally {
    withBase = true;
    blinking = false;
  }
  return c;
}

/**
 * A dialogue portrait: the same painting as the figure, larger and cropped
 * to head and shoulders, so a character looks the same in the scene and in
 * conversation.
 */
export function paintPortrait(name: string, blink = false): HTMLCanvasElement {
  const size = 256;
  const k = 2.5;
  const [c, ctx] = canvas(size, size);
  withBase = false;
  blinking = blink;
  try {
    ctx.translate(size / 2 - 80 * k, size * 0.47 - 72 * k);
    ctx.scale(k, k);
    (FIGURES[name] ?? hero)(ctx);
  } finally {
    withBase = true;
    blinking = false;
  }
  return c;
}
