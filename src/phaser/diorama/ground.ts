import { ARENA, BOARD, FENCE_X, POND } from './layout';
import { trailPaths } from './trailGraph';
import { canvas, darken, lighten, rng, type Ctx } from './paint';

/**
 * Paints the diorama board: a slab of meadow sitting on a table, with a
 * visible soil edge, a dirt trail, a pond and a flagstone arena. Painted at
 * half resolution and scaled up, which gives the soft, felt-and-flock look of
 * a tabletop model and keeps texture memory modest on phones.
 */
export const GROUND_SCALE = 0.5;
export const EDGE = 70;

export function paintGround(): HTMLCanvasElement {
  const s = GROUND_SCALE;
  const W = BOARD.w;
  const H = BOARD.h + EDGE;
  const [c, ctx] = canvas(Math.round(W * s), Math.round(H * s));
  ctx.scale(s, s);
  const r = rng(77);

  // Meadow base with broad light falloff.
  const g = ctx.createRadialGradient(W * 0.35, H * 0.3, 100, W * 0.5, H * 0.5, W * 0.8);
  g.addColorStop(0, '#7cc768');
  g.addColorStop(0.6, '#5fb25a');
  g.addColorStop(1, '#468f4e');
  ctx.fillStyle = g;
  roundedBoard(ctx, W, BOARD.h);
  ctx.fill();
  ctx.save();
  roundedBoard(ctx, W, BOARD.h);
  ctx.clip();

  // Mottled patches of lighter / darker grass.
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(160,220,120,0.18)' : 'rgba(40,110,60,0.14)';
    ctx.beginPath();
    ctx.ellipse(r() * W, r() * BOARD.h, 40 + r() * 120, 30 + r() * 70, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grass blades / flock.
  const greens = ['#8fd173', '#6cbd5f', '#4f9f52', '#9fdc80', '#3f8a4a'];
  for (let i = 0; i < 16000; i++) {
    ctx.fillStyle = greens[Math.floor(r() * greens.length)];
    const x = r() * W;
    const y = r() * BOARD.h;
    ctx.fillRect(x, y, 2 + r() * 2, 4 + r() * 5);
  }

  // Arena flagstones
  const ag = ctx.createRadialGradient(ARENA.x, ARENA.y, 10, ARENA.x, ARENA.y, ARENA.r);
  ag.addColorStop(0, '#b9b4c4');
  ag.addColorStop(1, '#8b86a0');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.ellipse(ARENA.x, ARENA.y, ARENA.r, ARENA.r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,60,90,0.5)';
  ctx.lineWidth = 3;
  for (let ring = 1; ring <= 3; ring++) {
    ctx.beginPath();
    ctx.ellipse(ARENA.x, ARENA.y, (ARENA.r * ring) / 3.2, (ARENA.r * 0.8 * ring) / 3.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.beginPath();
    ctx.moveTo(ARENA.x + Math.cos(a) * 55, ARENA.y + Math.sin(a) * 44);
    ctx.lineTo(ARENA.x + Math.cos(a) * ARENA.r, ARENA.y + Math.sin(a) * ARENA.r * 0.8);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(201,66,79,0.6)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(ARENA.x, ARENA.y, 50, 40, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Trail: a darker bed, the path, then a lighter worn centre and pebbles.
  const paths = trailPaths(10);
  const pts = paths.flat();
  const stroke = (w: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const path of paths) path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  };
  stroke(118, 'rgba(70,90,50,0.35)');
  stroke(100, '#c89a66');
  stroke(64, '#d8b07a');
  stroke(26, 'rgba(240,210,160,0.5)');
  for (let i = 0; i < 1200; i++) {
    const p = pts[Math.floor(r() * pts.length)];
    const a = r() * Math.PI * 2;
    const d = r() * 46;
    ctx.fillStyle = r() < 0.5 ? '#a47a4e' : '#efd3a4';
    ctx.beginPath();
    ctx.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2 + r() * 3, 1.5 + r() * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pond with a sandy rim and reflective depth.
  ctx.fillStyle = '#d8c08a';
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx + 16, POND.ry + 12, 0, 0, Math.PI * 2);
  ctx.fill();
  const pg = ctx.createRadialGradient(POND.x - 40, POND.y - 30, 10, POND.x, POND.y, POND.rx);
  pg.addColorStop(0, '#8fe3f2');
  pg.addColorStop(0.5, '#41a6f6');
  pg.addColorStop(1, '#2d5fb0');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  for (const [dx, dy, w] of [
    [-60, -30, 50],
    [20, 10, 70],
    [-10, 45, 40],
  ]) {
    ctx.beginPath();
    ctx.moveTo(POND.x + dx, POND.y + dy);
    ctx.lineTo(POND.x + dx + w, POND.y + dy);
    ctx.stroke();
  }
  // Lily pads
  for (const [dx, dy] of [
    [70, -40],
    [-90, 30],
    [40, 50],
  ]) {
    ctx.fillStyle = '#4faa5a';
    ctx.beginPath();
    ctx.arc(POND.x + dx, POND.y + dy, 14, 0.4, Math.PI * 2);
    ctx.lineTo(POND.x + dx, POND.y + dy);
    ctx.fill();
  }

  // Flowers
  const petals = ['#ffffff', '#ffd77a', '#f2a0c8', '#c8a4ff', '#ff8a7a'];
  for (let i = 0; i < 420; i++) {
    const x = r() * W;
    const y = r() * BOARD.h;
    ctx.fillStyle = petals[Math.floor(r() * petals.length)];
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(k * 1.57) * 3, y + Math.sin(k * 1.57) * 3, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffcd4a';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // A faint ground shadow along where the fence stands.
  ctx.fillStyle = 'rgba(30,50,30,0.18)';
  ctx.fillRect(FENCE_X - 6, 30, 26, BOARD.h - 60);

  ctx.restore();

  // Rim highlight on the board edge
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 6;
  roundedBoard(ctx, W, BOARD.h);
  ctx.stroke();

  // Front soil face: strata with stones, like a cut-away model base.
  const face = ctx.createLinearGradient(0, BOARD.h, 0, BOARD.h + EDGE);
  face.addColorStop(0, '#4f8a3f');
  face.addColorStop(0.12, '#7a5236');
  face.addColorStop(0.5, '#62412c');
  face.addColorStop(1, '#3f2a1f');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.moveTo(0, BOARD.h - 40);
  ctx.quadraticCurveTo(0, BOARD.h, 40, BOARD.h);
  ctx.lineTo(W - 40, BOARD.h);
  ctx.quadraticCurveTo(W, BOARD.h, W, BOARD.h - 40);
  ctx.lineTo(W, BOARD.h + EDGE - 30);
  ctx.quadraticCurveTo(W, BOARD.h + EDGE, W - 30, BOARD.h + EDGE);
  ctx.lineTo(30, BOARD.h + EDGE);
  ctx.quadraticCurveTo(0, BOARD.h + EDGE, 0, BOARD.h + EDGE - 30);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 160; i++) {
    const col = r() < 0.5 ? '#8a6a52' : '#4a3326';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(20 + r() * (W - 40), BOARD.h + 16 + r() * (EDGE - 26), 4 + r() * 8, 3 + r() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = darken('#62412c', 0.3);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, BOARD.h + EDGE * 0.55);
  ctx.bezierCurveTo(W * 0.3, BOARD.h + EDGE * 0.4, W * 0.6, BOARD.h + EDGE * 0.7, W - 10, BOARD.h + EDGE * 0.5);
  ctx.stroke();
  return c;
}

function roundedBoard(ctx: Ctx, w: number, h: number): void {
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 40);
}

/** Warm wooden tabletop the board sits on (tiled). */
export function paintTable(): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 256);
  const r = rng(5);
  ctx.fillStyle = '#8a5d3b';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = y % 128 ? '#94643f' : '#835838';
    ctx.fillRect(0, y, 256, 62);
    ctx.fillStyle = darken('#8a5d3b', 0.35);
    ctx.fillRect(0, y + 62, 256, 2);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = r() < 0.5 ? lighten('#8a5d3b', 0.12) : darken('#8a5d3b', 0.15);
      ctx.lineWidth = 1 + r() * 2;
      const yy = y + 4 + r() * 54;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(80, yy + (r() - 0.5) * 8, 170, yy + (r() - 0.5) * 8, 256, yy);
      ctx.stroke();
    }
  }
  return c;
}
