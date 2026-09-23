/**
 * Small painting toolkit for the diorama look: soft radial shading lit from
 * the top-left, darker outlines for readability at TV distance, and seeded
 * randomness so the world is the same every time.
 */
export type Ctx = CanvasRenderingContext2D;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(hex: string, toward: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export const lighten = (hex: string, t: number) => mix(hex, '#ffffff', t);
export const darken = (hex: string, t: number) => mix(hex, '#10121e', t);

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

/** Fill the current path with a top-left-lit radial gradient and outline it. */
export function shade(ctx: Ctx, color: string, box: { x: number; y: number; w: number; h: number }, outline = 3, gloss = 0.4): void {
  const cx = box.x + box.w * 0.32;
  const cy = box.y + box.h * 0.28;
  const r = Math.max(box.w, box.h) * 0.95;
  const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
  g.addColorStop(0, lighten(color, gloss));
  g.addColorStop(0.45, color);
  g.addColorStop(1, darken(color, 0.35));
  ctx.fillStyle = g;
  ctx.fill();
  if (outline > 0) {
    ctx.strokeStyle = darken(color, 0.62);
    ctx.lineWidth = outline;
    ctx.stroke();
  }
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string, outline = 3, gloss = 0.4): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  shade(ctx, color, { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 }, outline, gloss);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string, outline = 3, gloss = 0.35): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  shade(ctx, color, { x, y, w, h }, outline, gloss);
}

/** A small specular glint that makes things read as glossy toys. */
export function glint(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.7): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Soft contact shadow texture (white; tinted/alpha'd in the scene). */
export function shadowBlob(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(20,16,30,0.55)');
  g.addColorStop(0.6, 'rgba(20,16,30,0.3)');
  g.addColorStop(1, 'rgba(20,16,30,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.scale(1, h / w);
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return c;
}
