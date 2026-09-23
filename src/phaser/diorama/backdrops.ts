import { canvas, darken, lighten, rng, type Ctx } from './paint';

/**
 * Battle backdrops: a round miniature stage in front of a soft-focus
 * background. The background is painted small and scaled up, which blurs it
 * like a macro lens — the tilt-shift cue that sells "tiny model".
 *
 * Canvas covers battle logical space x∈[-40,240], y∈[-24,144] at 5 px/unit.
 */
export const BG = { w: 1400, h: 840, ox: -40, oy: -24, ppu: 5 };
const toC = (x: number, y: number) => [(x - BG.ox) * BG.ppu, (y - BG.oy) * BG.ppu] as const;

function softLayer(w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void, factor = 5): HTMLCanvasElement {
  const [small, sctx] = canvas(Math.round(w / factor), Math.round(h / factor));
  sctx.scale(1 / factor, 1 / factor);
  draw(sctx, w, h);
  return small;
}

function stage(ctx: Ctx, top: string, side: string, texture: (ctx: Ctx, cx: number, cy: number, rx: number, ry: number) => void): void {
  const [cx, cy] = toC(100, 97);
  const rx = 470;
  const ry = 92;
  const depth = 58;
  // Shadow on the table
  const sh = ctx.createRadialGradient(cx, cy + depth + 20, 20, cx, cy + depth + 20, rx * 1.1);
  sh.addColorStop(0, 'rgba(20,10,20,0.45)');
  sh.addColorStop(1, 'rgba(20,10,20,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cx, cy + depth + 26, rx * 1.1, ry * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Side
  const sg = ctx.createLinearGradient(0, cy, 0, cy + depth + ry);
  sg.addColorStop(0, lighten(side, 0.1));
  sg.addColorStop(1, darken(side, 0.45));
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(cx, cy + depth, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  const r = rng(3);
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI;
    const d = r();
    ctx.fillStyle = r() < 0.5 ? darken(side, 0.3) : lighten(side, 0.15);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * rx * 0.97, cy + Math.sin(a) * ry + d * depth, 6 + r() * 8, 4 + r() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Top
  const tg = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 20, cx, cy, rx);
  tg.addColorStop(0, lighten(top, 0.25));
  tg.addColorStop(0.7, top);
  tg.addColorStop(1, darken(top, 0.2));
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  texture(ctx, cx, cy, rx, ry);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 3, ry - 2, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function meadow(): HTMLCanvasElement {
  const [c, ctx] = canvas(BG.w, BG.h);
  const blur = softLayer(BG.w, BG.h, (s, w, h) => {
    const sky = s.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, '#8fcff2');
    sky.addColorStop(1, '#e9f5dc');
    s.fillStyle = sky;
    s.fillRect(0, 0, w, h);
    const r = rng(8);
    s.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const x = r() * w;
      const y = 60 + r() * 160;
      for (let k = 0; k < 4; k++) {
        s.beginPath();
        s.arc(x + k * 40, y + (k % 2) * 10, 40 + r() * 20, 0, Math.PI * 2);
        s.fill();
      }
    }
    for (const [y, col] of [
      [380, '#9fd28a'],
      [440, '#7cc26e'],
    ] as const) {
      s.fillStyle = col;
      s.beginPath();
      s.moveTo(0, h);
      for (let x = 0; x <= w; x += 40) s.lineTo(x, y + Math.sin(x / 140 + y) * 40);
      s.lineTo(w, h);
      s.fill();
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const y = 400 + r() * 60;
      s.fillStyle = i % 2 ? '#4f9e56' : '#5cae5c';
      s.beginPath();
      s.arc(x, y, 40 + r() * 30, 0, Math.PI * 2);
      s.fill();
    }
    s.fillStyle = '#8a5d3b';
    s.fillRect(0, 600, w, h - 600);
  });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(blur, 0, 0, BG.w, BG.h);
  bokeh(ctx, '#fff6d0', 14);
  stage(ctx, '#6cbd5f', '#7a5236', (t, cx, cy, rx, ry) => {
    const r = rng(12);
    const greens = ['#8fd173', '#5fae55', '#9fdc80', '#4f9f52'];
    for (let i = 0; i < 3500; i++) {
      t.fillStyle = greens[Math.floor(r() * greens.length)];
      t.fillRect(cx - rx + r() * rx * 2, cy - ry + r() * ry * 2, 2 + r() * 2, 4 + r() * 4);
    }
    const petals = ['#ffffff', '#ffd77a', '#f2a0c8'];
    for (let i = 0; i < 70; i++) {
      t.fillStyle = petals[i % 3];
      t.beginPath();
      t.arc(cx - rx + r() * rx * 2, cy - ry + r() * ry * 2, 3.5, 0, Math.PI * 2);
      t.fill();
    }
  });
  return c;
}

function dungeon(): HTMLCanvasElement {
  const [c, ctx] = canvas(BG.w, BG.h);
  const blur = softLayer(BG.w, BG.h, (s, w, h) => {
    const back = s.createLinearGradient(0, 0, 0, h);
    back.addColorStop(0, '#231d33');
    back.addColorStop(0.7, '#3a2f4a');
    back.addColorStop(1, '#2a2233');
    s.fillStyle = back;
    s.fillRect(0, 0, w, h);
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 18; col++) {
        const x = col * 90 + (row % 2) * 45 - 30;
        const y = row * 46;
        s.fillStyle = row % 3 ? '#4a4060' : '#554a6e';
        s.beginPath();
        s.roundRect(x, y, 84, 40, 8);
        s.fill();
      }
    }
    for (const x of [180, 700, 1220]) {
      const g = s.createRadialGradient(x, 220, 5, x, 220, 260);
      g.addColorStop(0, 'rgba(255,200,110,0.9)');
      g.addColorStop(0.3, 'rgba(255,150,70,0.35)');
      g.addColorStop(1, 'rgba(255,120,60,0)');
      s.fillStyle = g;
      s.fillRect(x - 260, 0, 520, 520);
    }
    s.fillStyle = '#1a1424';
    s.fillRect(0, 640, w, h - 640);
  });
  ctx.drawImage(blur, 0, 0, BG.w, BG.h);
  bokeh(ctx, '#ffc27a', 18);
  stage(ctx, '#8d86a0', '#4a4060', (t, cx, cy, rx, ry) => {
    t.strokeStyle = 'rgba(40,30,60,0.55)';
    t.lineWidth = 4;
    for (let i = -6; i <= 6; i++) {
      t.beginPath();
      t.moveTo(cx + i * 80, cy - ry);
      t.lineTo(cx + i * 95, cy + ry);
      t.stroke();
    }
    for (const k of [-0.5, 0, 0.5]) {
      t.beginPath();
      t.ellipse(cx, cy + k * ry * 0.9, rx, 6, 0, 0, Math.PI * 2);
      t.stroke();
    }
    const glow = t.createRadialGradient(cx + 230, cy, 5, cx + 230, cy, 150);
    glow.addColorStop(0, 'rgba(201,66,79,0.45)');
    glow.addColorStop(1, 'rgba(201,66,79,0)');
    t.fillStyle = glow;
    t.fillRect(cx, cy - ry, rx, ry * 2);
  });
  return c;
}

function bokeh(ctx: Ctx, color: string, n: number): void {
  const r = rng(n);
  for (let i = 0; i < n; i++) {
    const x = r() * BG.w;
    const y = 40 + r() * 380;
    const rad = 12 + r() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.25 + r() * 0.3;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function paintBattleBackdrops(): Record<string, HTMLCanvasElement> {
  return { meadow: meadow(), dungeon: dungeon() };
}
