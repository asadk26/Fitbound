import { canvas, darken, ellipse, glint, lighten, mix, rng, roundRect, shade, type Ctx } from './paint';

/**
 * Art for the cinematics, painted like the rest of the diorama: soft-focus
 * backgrounds (painted small, scaled up), crisp glossy foregrounds.
 *
 * Sanctuary logical space: x∈[0,360], y∈[-4,116], 5 px per unit. The garden
 * floats on a small island over a sea of haze; far to the right, on a
 * distant rise, is the Spark.
 */
export const SANCT = { w: 1800, h: 600, ox: 0, oy: -4, ppu: 5 };
/** Where things stand in the Sanctuary (logical units). */
export const SANCT_SPOTS = {
  island: { x: 100, y: 92, rx: 88, ry: 17 },
  slab: { x: 70, y: 97 },
  well: { x: 124, y: 90 },
  elara: { x: 140, y: 95 },
  heroStand: { x: 84, y: 101 },
  edge: { x: 176, y: 92 },
  spark: { x: 300, y: 45 },
  puddles: [
    [56, 101, 7],
    [110, 104, 6],
    [150, 98, 5],
    [92, 86, 4],
  ] as [number, number, number][],
};
const S = (x: number, y: number) => [(x - SANCT.ox) * SANCT.ppu, (y - SANCT.oy) * SANCT.ppu] as const;

function soft(w: number, h: number, draw: (ctx: Ctx) => void, factor = 7): HTMLCanvasElement {
  const [small, sctx] = canvas(Math.round(w / factor), Math.round(h / factor));
  sctx.scale(1 / factor, 1 / factor);
  draw(sctx);
  return small;
}

/** The garden: rain-dark by default; after the first restoration, dry and sunlit. */
export function paintSanctuary(restored: boolean): HTMLCanvasElement {
  const [c, ctx] = canvas(SANCT.w, SANCT.h);
  const far = soft(SANCT.w, SANCT.h, (s) => {
    const sky = s.createLinearGradient(0, 0, 0, SANCT.h * 0.62);
    if (restored) {
      sky.addColorStop(0, '#8cc6ea');
      sky.addColorStop(1, '#f5e6c4');
    } else {
      sky.addColorStop(0, '#4a566e');
      sky.addColorStop(1, '#8a96aa');
    }
    s.fillStyle = sky;
    s.fillRect(0, 0, SANCT.w, SANCT.h);
    const r = rng(21);
    // Cloud cover: long, low banks.
    for (let i = 0; i < 22; i++) {
      const x = r() * SANCT.w;
      const y = 10 + r() * 170;
      const g = restored ? 255 : 118 + r() * 26;
      s.fillStyle = restored ? 'rgba(255,255,255,0.55)' : `rgba(${g},${g + 6},${g + 20},0.4)`;
      s.beginPath();
      s.ellipse(x, y, 160 + r() * 200, 26 + r() * 22, 0, 0, Math.PI * 2);
      s.fill();
    }
    // Far ruins of the kingdom, barely there in the haze.
    s.fillStyle = restored ? 'rgba(120,130,160,0.35)' : 'rgba(70,78,100,0.45)';
    for (const [x, w, h] of [
      [1000, 26, 120],
      [1040, 40, 80],
      [1090, 22, 150],
      [1130, 34, 70],
      [1190, 18, 100],
    ]) {
      s.fillRect(x, 300 - h, w, h);
      s.beginPath();
      s.moveTo(x - 4, 300 - h);
      s.lineTo(x + w / 2, 300 - h - 26);
      s.lineTo(x + w + 4, 300 - h);
      s.fill();
    }
    // The sea of haze below; the distant rise the Spark stands on comes up out of it.
    const rise = () => {
      const [sx, sy] = S(SANCT_SPOTS.spark.x, SANCT_SPOTS.spark.y + 2);
      s.fillStyle = restored ? '#6d86a8' : '#353f5a';
      s.beginPath();
      s.moveTo(sx - 230, 420);
      s.lineTo(sx - 120, 330);
      s.quadraticCurveTo(sx - 40, sy + 6, sx - 12, sy);
      s.lineTo(sx + 14, sy);
      s.quadraticCurveTo(sx + 50, sy + 10, sx + 130, 320);
      s.lineTo(sx + 250, 420);
      s.closePath();
      s.fill();
    };
    let first = true;
    for (const [y, col] of (restored
      ? [
          [300, '#d9dde8'],
          [350, '#c7cde0'],
          [410, '#b7bfd6'],
        ]
      : [
          [300, '#7a8298'],
          [350, '#6a728a'],
          [410, '#5b627b'],
        ]) as [number, string][]) {
      s.fillStyle = col;
      s.beginPath();
      s.moveTo(0, SANCT.h);
      for (let x = 0; x <= SANCT.w; x += 30) s.lineTo(x, y + Math.sin(x / 90 + y) * 16 + Math.sin(x / 37) * 6);
      s.lineTo(SANCT.w, SANCT.h);
      s.fill();
      if (first) rise();
      first = false;
    }
  });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(far, 0, 0, SANCT.w, SANCT.h);
  island(ctx, restored);
  return c;
}

function island(ctx: Ctx, restored: boolean): void {
  const { x, y, rx, ry } = SANCT_SPOTS.island;
  const [cx, cy] = S(x, y);
  const RX = rx * SANCT.ppu;
  const RY = ry * SANCT.ppu;
  const r = rng(5);
  // Underside: earth and rock tapering into the haze, roots trailing.
  const earth = restored ? '#6a5140' : '#4d3c33';
  ctx.beginPath();
  ctx.moveTo(cx - RX, cy);
  ctx.bezierCurveTo(cx - RX * 0.9, cy + 90, cx - RX * 0.35, cy + 150, cx + 20, cy + 190);
  ctx.bezierCurveTo(cx + RX * 0.4, cy + 140, cx + RX * 0.92, cy + 80, cx + RX, cy);
  ctx.closePath();
  const ug = ctx.createLinearGradient(0, cy, 0, cy + 190);
  ug.addColorStop(0, lighten(earth, 0.08));
  ug.addColorStop(1, darken(earth, 0.5));
  ctx.fillStyle = ug;
  ctx.fill();
  ctx.strokeStyle = darken(earth, 0.6);
  ctx.lineWidth = 4;
  ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const a = r();
    ctx.fillStyle = r() < 0.5 ? darken(earth, 0.25) : lighten(earth, 0.12);
    ctx.beginPath();
    ctx.ellipse(cx - RX * 0.85 + a * RX * 1.7, cy + 14 + r() * 70 * (1 - Math.abs(a - 0.5)), 10 + r() * 14, 5 + r() * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = darken(earth, 0.3);
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const rx0 = cx - RX * 0.6 + r() * RX * 1.2;
    ctx.beginPath();
    ctx.moveTo(rx0, cy + 40 + r() * 40);
    ctx.bezierCurveTo(rx0 - 10, cy + 120, rx0 + 14, cy + 150, rx0 - 4, cy + 190 + r() * 40);
    ctx.stroke();
  }
  // Top: wet flagstones with moss.
  const stone = restored ? '#9aa29a' : '#737c7a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, RX, RY, 0, 0, Math.PI * 2);
  ctx.fillStyle = darken(stone, 0.35);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, RX, RY, 0, 0, Math.PI * 2);
  ctx.clip();
  // Irregular old flagstones, bigger toward the front.
  for (let row = 0; row < 6; row++) {
    const t = row / 5;
    const yy = cy - RY + 6 + t * (RY * 2 - 10);
    const h = 12 + t * 16;
    let xx = cx - RX - r() * 40;
    while (xx < cx + RX) {
      const w = (34 + r() * 40) * (0.7 + t * 0.6);
      const tone = mix(stone, r() < 0.5 ? '#5d6b66' : '#8b9189', r() * 0.45);
      ctx.save();
      ctx.translate(xx + w / 2, yy);
      ctx.rotate((r() - 0.5) * 0.06);
      roundRect(ctx, -w / 2, -h / 2 + (r() - 0.5) * 4, w, h, 6 + r() * 4, tone, 1.2, restored ? 0.3 : 0.45);
      ctx.restore();
      xx += w + 3 + r() * 5;
    }
  }
  // Moss.
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.7 + r() * 0.35;
    ctx.fillStyle = restored ? (i % 2 ? '#7fb56b' : '#5f9d56') : i % 2 ? '#56805a' : '#46704f';
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * RX * d, cy + Math.sin(a) * RY * d, 6 + r() * 10, 3 + r() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Puddles, holding the sky (and, in the scene, the Heart's warm light).
  for (const [px, py, pr] of SANCT_SPOTS.puddles) {
    const [qx, qy] = S(px, py);
    ctx.beginPath();
    ctx.ellipse(qx, qy, pr * SANCT.ppu, pr * SANCT.ppu * 0.32, 0, 0, Math.PI * 2);
    const pg = ctx.createLinearGradient(0, qy - 10, 0, qy + 10);
    pg.addColorStop(0, restored ? '#b9d6ee' : '#6d7a92');
    pg.addColorStop(1, restored ? '#88a9c8' : '#3d465c');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,34,44,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    glint(ctx, qx - pr * 2, qy - 2, pr * 1.2, 1.4, 0.35);
  }
  if (!restored) {
    // A wet sheen over everything.
    const sheen = ctx.createLinearGradient(cx - RX, cy - RY, cx + RX, cy + RY);
    sheen.addColorStop(0, 'rgba(200,215,235,0.18)');
    sheen.addColorStop(0.5, 'rgba(200,215,235,0)');
    sheen.addColorStop(1, 'rgba(200,215,235,0.1)');
    ctx.fillStyle = sheen;
    ctx.fillRect(cx - RX, cy - RY, RX * 2, RY * 2);
  }
  ctx.restore();
  // Low garden wall along the back edge, and the stone arch.
  const wall = restored ? '#a39d90' : '#7c7a78';
  // Low, old and broken in places: two runs of stone along the back.
  for (const [a0, a1] of [
    [1.08, 1.36],
    [1.58, 1.9],
  ]) {
    for (let a = Math.PI * a0; a < Math.PI * a1; a += 0.07) {
      const wx = cx + Math.cos(a) * (RX - 12);
      const wy = cy + Math.sin(a) * (RY - 4);
      const h = 14 + r() * 12;
      roundRect(ctx, wx - 16, wy - h, 32, h, 6, mix(wall, '#5c5a58', r() * 0.35), 2, 0.35);
    }
  }
  const [ax, ay] = S(56, 76);
  for (const dx of [-38, 38]) roundRect(ctx, ax + dx - 12, ay - 130, 24, 132, 6, wall, 3, 0.4);
  ctx.beginPath();
  ctx.arc(ax, ay - 128, 50, Math.PI, 0);
  ctx.arc(ax, ay - 128, 26, 0, Math.PI, true);
  ctx.closePath();
  shade(ctx, wall, { x: ax - 50, y: ay - 180, w: 100, h: 52 }, 3, 0.4);
  // Ivy on the arch.
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = restored ? '#6fae5f' : '#4d7a52';
    ctx.beginPath();
    ctx.ellipse(ax - 48 + r() * 30, ay - 160 + r() * 120, 5, 3.5, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // A stone bench at the back right.
  const [bx, by] = S(152, 82);
  roundRect(ctx, bx - 36, by - 16, 72, 12, 4, wall, 2.5, 0.45);
  roundRect(ctx, bx - 30, by - 5, 10, 16, 3, darken(wall, 0.15), 2);
  roundRect(ctx, bx + 20, by - 5, 10, 16, 3, darken(wall, 0.15), 2);
  // Flowers by the wall; closed and grey in the rain, open in the sun.
  for (let i = 0; i < 30; i++) {
    const a = Math.PI * (1.1 + r() * 0.8);
    const fx = cx + Math.cos(a) * (RX - 26);
    const fy = cy + Math.sin(a) * (RY - 6) + 6;
    ctx.fillStyle = restored ? ['#ffffff', '#ffd77a', '#f2a0c8'][i % 3] : ['#b8b8c4', '#9ea3b4', '#aaa0b0'][i % 3];
    ctx.beginPath();
    ctx.arc(fx, fy, restored ? 4 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The well: mossy stone, a little roof, water lit from below by the Heart. */
export function paintWell(restored: boolean): HTMLCanvasElement {
  const [c, ctx] = canvas(260, 260);
  const stone = restored ? '#9c978c' : '#7a7876';
  // Posts and roof.
  roundRect(ctx, 40, 40, 14, 170, 4, '#6b4a33', 2.5);
  roundRect(ctx, 206, 40, 14, 170, 4, '#6b4a33', 2.5);
  ctx.beginPath();
  ctx.moveTo(20, 60);
  ctx.lineTo(130, 10);
  ctx.lineTo(240, 60);
  ctx.lineTo(228, 72);
  ctx.lineTo(130, 28);
  ctx.lineTo(32, 72);
  ctx.closePath();
  shade(ctx, restored ? '#8a5a3a' : '#5c4a44', { x: 20, y: 10, w: 220, h: 62 }, 3, 0.4);
  roundRect(ctx, 50, 86, 160, 8, 3, '#6b4a33', 2);
  // Rope and bucket.
  ctx.strokeStyle = '#b89a6a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(130, 90);
  ctx.lineTo(130, 140);
  ctx.stroke();
  roundRect(ctx, 120, 138, 20, 18, 3, '#7a5a3a', 2);
  // Stone ring.
  ctx.beginPath();
  ctx.ellipse(130, 212, 92, 30, 0, 0, Math.PI);
  ctx.lineTo(38, 170);
  ctx.ellipse(130, 170, 92, 30, 0, Math.PI, 0, true);
  ctx.closePath();
  shade(ctx, stone, { x: 38, y: 140, w: 184, h: 102 }, 3, 0.35);
  const r = rng(4);
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = 'rgba(40,40,48,0.35)';
    ctx.lineWidth = 2;
    const x = 50 + r() * 160;
    ctx.beginPath();
    ctx.moveTo(x, 180 + r() * 20);
    ctx.lineTo(x, 200 + r() * 20);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(130, 170, 92, 30, 0, 0, Math.PI * 2);
  shade(ctx, lighten(stone, 0.1), { x: 38, y: 140, w: 184, h: 60 }, 3, 0.3);
  // Water, glowing warm.
  const wg = ctx.createRadialGradient(130, 170, 4, 130, 170, 76);
  wg.addColorStop(0, '#ffe2a8');
  wg.addColorStop(0.45, '#f0a85a');
  wg.addColorStop(1, '#5a4a60');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.ellipse(130, 172, 74, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  // Moss.
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = restored ? '#6fae5f' : '#4f7a55';
    ctx.beginPath();
    ctx.ellipse(46 + r() * 170, 196 + r() * 40, 6 + r() * 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** The stone slab the Heart gathers him onto, with a faint carved sigil. */
export function paintSlab(): HTMLCanvasElement {
  const [c, ctx] = canvas(340, 140);
  roundRect(ctx, 20, 60, 300, 56, 10, '#5f6468', 3, 0.3);
  roundRect(ctx, 14, 36, 312, 44, 12, '#8a8f92', 3, 0.45);
  ctx.save();
  ctx.shadowColor = '#ffb45a';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(255,190,110,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(170, 58, 60, 12, 0, 0, Math.PI * 2);
  ctx.moveTo(110, 58);
  ctx.lineTo(230, 58);
  ctx.moveTo(170, 46);
  ctx.lineTo(170, 70);
  ctx.stroke();
  ctx.restore();
  return c;
}

/** The Heart's cavern: roots, dark stone, a faint glow far below. 200×120 units at 5 px. */
export function paintCavern(): HTMLCanvasElement {
  const [c, ctx] = canvas(1000, 600);
  const back = soft(1000, 600, (s) => {
    const g = s.createRadialGradient(500, 330, 20, 500, 330, 620);
    g.addColorStop(0, '#3a2438');
    g.addColorStop(0.5, '#1c1224');
    g.addColorStop(1, '#0b0810');
    s.fillStyle = g;
    s.fillRect(0, 0, 1000, 600);
    const r = rng(33);
    for (let i = 0; i < 26; i++) {
      s.strokeStyle = `rgba(${60 + r() * 30},${40 + r() * 20},${40 + r() * 20},0.8)`;
      s.lineWidth = 6 + r() * 14;
      const x = r() * 1000;
      s.beginPath();
      s.moveTo(x, -10);
      s.bezierCurveTo(x + (r() - 0.5) * 200, 120, x + (r() - 0.5) * 240, 220, x + (r() - 0.5) * 160, 260 + r() * 200);
      s.stroke();
    }
  });
  ctx.drawImage(back, 0, 0, 1000, 600);
  // Nearer roots, crisp.
  const r = rng(9);
  for (let i = 0; i < 12; i++) {
    const x = r() < 0.5 ? r() * 260 : 740 + r() * 260;
    ctx.strokeStyle = '#3a2a2a';
    ctx.lineWidth = 10 + r() * 10;
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.bezierCurveTo(x + 40, 120, x - 30, 240, x + 20, 380 + r() * 180);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,180,100,0.12)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  return c;
}

/** The Heart: a faceted crystal heart, glossy, lit from within. */
export function paintHeart(): HTMLCanvasElement {
  const [c, ctx] = canvas(240, 240);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(120, 214);
    ctx.bezierCurveTo(40, 160, 12, 110, 30, 70);
    ctx.bezierCurveTo(48, 30, 104, 30, 120, 76);
    ctx.bezierCurveTo(136, 30, 192, 30, 210, 70);
    ctx.bezierCurveTo(228, 110, 200, 160, 120, 214);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = '#ffb45a';
  ctx.shadowBlur = 30;
  path();
  const g = ctx.createRadialGradient(100, 90, 8, 120, 120, 130);
  g.addColorStop(0, '#fff1c8');
  g.addColorStop(0.35, '#ffb45a');
  g.addColorStop(0.75, '#d0566a');
  g.addColorStop(1, '#6a2440');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  path();
  ctx.strokeStyle = '#5a2034';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Facets.
  ctx.save();
  path();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,240,210,0.45)';
  ctx.lineWidth = 2;
  for (const [x1, y1, x2, y2] of [
    [120, 76, 120, 214],
    [30, 70, 120, 140],
    [210, 70, 120, 140],
    [70, 40, 90, 150],
    [170, 40, 150, 150],
    [40, 120, 200, 120],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
  glint(ctx, 72, 66, 16, 8, 0.8);
  glint(ctx, 164, 60, 8, 4, 0.6);
  return c;
}

/** Soft oval edges, so a memory fades into the dark. */
function vignette(ctx: Ctx, w: number, h: number): void {
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, w * 0.56);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/** A faded tint over a memory: sepia in the middle, grey haze at the edges. */
function fade(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = 'rgba(120,100,80,0.18)';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.6);
  g.addColorStop(0, 'rgba(160,160,170,0)');
  g.addColorStop(1, 'rgba(150,152,165,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const MW = 960;
const MH = 540;

/** A festival square: bunting and lanterns up, the fountain running, nobody there. */
function memorySquare(): HTMLCanvasElement {
  const [c, ctx] = canvas(MW, MH);
  const sky = ctx.createLinearGradient(0, 0, 0, MH * 0.6);
  sky.addColorStop(0, '#c9b89a');
  sky.addColorStop(1, '#e8dcc2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, MW, MH);
  const r = rng(71);
  // Houses around the square.
  for (let i = 0; i < 9; i++) {
    const x = -40 + i * 118;
    const h = 170 + r() * 80;
    const col = ['#b69478', '#a88a74', '#c2a88a', '#9a8070'][i % 4];
    roundRect(ctx, x, 330 - h, 110, h, 4, col, 3, 0.25);
    ctx.beginPath();
    ctx.moveTo(x - 8, 330 - h);
    ctx.lineTo(x + 55, 330 - h - 60);
    ctx.lineTo(x + 118, 330 - h);
    ctx.closePath();
    shade(ctx, '#8a5e4a', { x: x - 8, y: 330 - h - 60, w: 126, h: 60 }, 3, 0.3);
    for (let k = 0; k < 2; k++) roundRect(ctx, x + 18 + k * 44, 360 - h + 20, 26, 34, 3, '#e8c98a', 2, 0.4);
  }
  // Cobbles.
  const ground = ctx.createLinearGradient(0, 320, 0, MH);
  ground.addColorStop(0, '#a89a88');
  ground.addColorStop(1, '#7c7064');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 320, MW, MH - 320);
  for (let y = 330; y < MH; y += 16) {
    for (let x = (y / 16) % 2 ? 0 : 12; x < MW; x += 26) {
      ctx.strokeStyle = 'rgba(70,60,54,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 11, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Fountain.
  ellipse(ctx, 480, 440, 150, 40, '#b8ad9c', 3, 0.35);
  ellipse(ctx, 480, 432, 124, 30, '#8fa8b4', 2, 0.5);
  roundRect(ctx, 466, 330, 28, 104, 6, '#b8ad9c', 3, 0.4);
  ellipse(ctx, 480, 330, 50, 14, '#b8ad9c', 3, 0.35);
  ctx.strokeStyle = 'rgba(220,235,245,0.8)';
  ctx.lineWidth = 3;
  for (const dx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(480, 318);
    ctx.quadraticCurveTo(480 + dx * 50, 290, 480 + dx * 80, 420);
    ctx.stroke();
  }
  // Bunting and lanterns strung across.
  const flags = ['#c96a5a', '#d9b25a', '#6a9ab0', '#8ab06a'];
  for (const [y0, sag] of [
    [150, 60],
    [210, 40],
  ]) {
    ctx.strokeStyle = '#5a4a40';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(MW / 2, y0 + sag * 2, MW, y0);
    ctx.stroke();
    for (let i = 1; i < 24; i++) {
      const t = i / 24;
      const x = t * MW;
      const y = y0 + 4 * sag * t * (1 - t);
      ctx.fillStyle = flags[i % 4];
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 24);
      ctx.closePath();
      ctx.fill();
      if (i % 5 === 0) ellipse(ctx, x, y + 30, 9, 12, '#f0c070', 2, 0.6);
    }
  }
  // Something left behind: a small drum on the stones.
  ellipse(ctx, 700, 470, 22, 9, '#a0584a', 2, 0.4);
  fade(ctx, MW, MH);
  vignette(ctx, MW, MH);
  return c;
}

/** Castle towers on a hill, their tops unmaking into drifting stones. */
function memoryTowers(): HTMLCanvasElement {
  const [c, ctx] = canvas(MW, MH);
  const sky = ctx.createLinearGradient(0, 0, 0, MH);
  sky.addColorStop(0, '#9aa0b8');
  sky.addColorStop(1, '#d8cdb8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, MW, MH);
  ctx.fillStyle = '#7e8a6e';
  ctx.beginPath();
  ctx.moveTo(0, MH);
  ctx.quadraticCurveTo(MW / 2, 250, MW, MH);
  ctx.fill();
  const r = rng(12);
  const stone = '#b0a898';
  roundRect(ctx, 300, 300, 360, 120, 6, stone, 3, 0.3);
  for (const [x, h] of [
    [300, 230],
    [420, 300],
    [560, 260],
    [640, 190],
  ]) {
    roundRect(ctx, x - 30, 420 - h, 64, h, 6, stone, 3, 0.35);
    // The top unmakes itself: blocks lift away and thin into the haze.
    for (let k = 0; k < 14; k++) {
      const a = k / 14;
      ctx.globalAlpha = 1 - a;
      roundRect(ctx, x - 30 + r() * 60, 420 - h - 16 - a * 170 - r() * 20, 12 + r() * 10, 10 + r() * 8, 2, stone, 2, 0.35);
    }
    ctx.globalAlpha = 1;
    for (let w = 0; w < 3; w++) roundRect(ctx, x - 8, 440 - h + w * 50, 16, 24, 6, '#4a4450', 2, 0.2);
  }
  fade(ctx, MW, MH);
  vignette(ctx, MW, MH);
  return c;
}

/** A wheat field toward evening, the gold giving way to grey from the edges in. */
function memoryField(): HTMLCanvasElement {
  const [c, ctx] = canvas(MW, MH);
  const sky = ctx.createLinearGradient(0, 0, 0, MH * 0.5);
  sky.addColorStop(0, '#d8a878');
  sky.addColorStop(1, '#f0d8a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, MW, MH);
  ctx.fillStyle = '#c89a4a';
  ctx.fillRect(0, 250, MW, MH - 250);
  const r = rng(51);
  for (let i = 0; i < 1400; i++) {
    const y = 250 + Math.pow(r(), 0.7) * (MH - 250);
    const x = r() * MW;
    const k = (y - 250) / (MH - 250);
    ctx.strokeStyle = r() < 0.5 ? '#e0b860' : '#b8863a';
    ctx.lineWidth = 1 + k * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - 6 - k * 26);
    ctx.stroke();
  }
  // A windmill on the far rise.
  roundRect(ctx, 700, 170, 40, 90, 4, '#b8a890', 3, 0.3);
  ctx.strokeStyle = '#6a5a4a';
  ctx.lineWidth = 6;
  for (const a of [0.3, 1.87, 3.44, 5.01]) {
    ctx.beginPath();
    ctx.moveTo(720, 180);
    ctx.lineTo(720 + Math.cos(a) * 80, 180 + Math.sin(a) * 80);
    ctx.stroke();
  }
  // Grey creeping in from every edge.
  ctx.globalCompositeOperation = 'saturation';
  const g = ctx.createRadialGradient(MW / 2, MH / 2, MW * 0.12, MW / 2, MH / 2, MW * 0.5);
  g.addColorStop(0, 'rgba(128,128,128,0)');
  g.addColorStop(1, 'rgba(128,128,128,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MW, MH);
  ctx.globalCompositeOperation = 'source-over';
  fade(ctx, MW, MH);
  vignette(ctx, MW, MH);
  return c;
}

export function paintMemories(): Record<'square' | 'towers' | 'field', HTMLCanvasElement> {
  return { square: memorySquare(), towers: memoryTowers(), field: memoryField() };
}

/** Pieces of him the Heart gathers: a sword, a cape, a hand, in warm light. */
export function paintFragments(): Record<'sword' | 'cape' | 'hand', HTMLCanvasElement> {
  const glow = (draw: (ctx: Ctx) => void) => {
    const [c, ctx] = canvas(128, 128);
    ctx.shadowColor = '#ffb45a';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffe0a8';
    draw(ctx);
    return c;
  };
  return {
    sword: glow((ctx) => {
      ctx.save();
      ctx.translate(64, 64);
      ctx.rotate(-0.6);
      ctx.fillRect(-5, -50, 10, 70);
      ctx.fillRect(-18, 18, 36, 8);
      ctx.fillRect(-4, 26, 8, 16);
      ctx.restore();
    }),
    cape: glow((ctx) => {
      ctx.beginPath();
      ctx.moveTo(44, 24);
      ctx.quadraticCurveTo(22, 70, 30, 108);
      ctx.lineTo(98, 108);
      ctx.quadraticCurveTo(106, 70, 84, 24);
      ctx.closePath();
      ctx.fill();
    }),
    hand: glow((ctx) => {
      ctx.beginPath();
      ctx.ellipse(64, 76, 22, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [x, h] of [
        [46, 34],
        [58, 42],
        [70, 40],
        [82, 32],
      ]) {
        ctx.beginPath();
        ctx.roundRect(x - 5, 60 - h, 10, h, 5);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(38, 80, 7, 16, -0.8, 0, Math.PI * 2);
      ctx.fill();
    }),
  };
}

/** Small textures: a raindrop streak, a ripple ring, a sunbeam. */
export function paintWeather(): Record<'rain' | 'ripple' | 'beam', HTMLCanvasElement> {
  const [rain, rc] = canvas(4, 40);
  const rg = rc.createLinearGradient(0, 0, 0, 40);
  rg.addColorStop(0, 'rgba(255,255,255,0)');
  rg.addColorStop(1, 'rgba(255,255,255,1)');
  rc.fillStyle = rg;
  rc.fillRect(1, 0, 2, 40);
  const [ripple, pc] = canvas(64, 24);
  pc.strokeStyle = 'rgba(255,255,255,0.9)';
  pc.lineWidth = 2.5;
  pc.beginPath();
  pc.ellipse(32, 12, 28, 9, 0, 0, Math.PI * 2);
  pc.stroke();
  const [beam, bc] = canvas(64, 512);
  const bg = bc.createLinearGradient(0, 0, 64, 0);
  bg.addColorStop(0, 'rgba(255,240,200,0)');
  bg.addColorStop(0.5, 'rgba(255,240,200,1)');
  bg.addColorStop(1, 'rgba(255,240,200,0)');
  bc.fillStyle = bg;
  bc.fillRect(0, 0, 64, 512);
  bc.globalCompositeOperation = 'destination-in';
  const bv = bc.createLinearGradient(0, 0, 0, 512);
  bv.addColorStop(0, 'rgba(0,0,0,1)');
  bv.addColorStop(1, 'rgba(0,0,0,0)');
  bc.fillStyle = bv;
  bc.fillRect(0, 0, 64, 512);
  return { rain, ripple, beam };
}
