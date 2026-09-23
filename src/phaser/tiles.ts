import { PAL } from './art';
import { T, TILE, TILE_COUNT } from './maps';

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const px = (c: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function grass(c: Ctx, seed: number, dense = 0.12) {
  px(c, 0, 0, PAL.green, TILE, TILE);
  const r = rng(seed);
  for (let i = 0; i < TILE * TILE * dense; i++) {
    const x = Math.floor(r() * TILE);
    const y = Math.floor(r() * (TILE - 1));
    px(c, x, y, r() < 0.7 ? PAL.teal : PAL.lime);
    if (r() < 0.4) px(c, x, y + 1, PAL.teal);
  }
}

function dfloor(c: Ctx, seed: number) {
  px(c, 0, 0, PAL.night, TILE, TILE);
  px(c, 0, 0, PAL.navy, TILE, 1);
  px(c, 0, 0, PAL.navy, 1, TILE);
  px(c, 8, 8, PAL.navy, 8, 1);
  px(c, 8, 8, PAL.navy, 1, 8);
  const r = rng(seed);
  for (let i = 0; i < 6; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), PAL.slate);
}

function bricks(c: Ctx, base: string, mortar: string, hi: string) {
  px(c, 0, 0, base, TILE, TILE);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    px(c, 0, y, mortar, TILE, 1);
    const off = row % 2 ? 4 : 0;
    for (let x = off; x < TILE; x += 8) px(c, x, y, mortar, 1, 4);
    px(c, off + 1, y + 1, hi, 3, 1);
  }
}

const painters: Record<number, (c: Ctx) => void> = {
  [T.GRASS]: (c) => grass(c, 1),
  [T.GRASS2]: (c) => grass(c, 7, 0.2),
  [T.FLOWERS]: (c) => {
    grass(c, 3, 0.08);
    const spots = [
      [3, 4, PAL.white],
      [10, 3, PAL.gold],
      [6, 10, PAL.red],
      [12, 12, PAL.white],
      [2, 13, PAL.gold],
    ] as const;
    for (const [x, y, col] of spots) {
      px(c, x, y, col);
      px(c, x - 1, y, col);
      px(c, x + 1, y, col);
      px(c, x, y - 1, col);
      px(c, x, y + 1, col);
      px(c, x, y, PAL.gold);
    }
  },
  [T.PATH]: (c) => {
    px(c, 0, 0, PAL.dirt, TILE, TILE);
    const r = rng(11);
    for (let i = 0; i < 18; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? PAL.dirtDark : '#caa074');
  },
  [T.WATER]: (c) => {
    px(c, 0, 0, PAL.blue, TILE, TILE);
    px(c, 2, 4, PAL.sky, 5, 1);
    px(c, 9, 9, PAL.sky, 5, 1);
    px(c, 4, 13, PAL.cyan, 3, 1);
    px(c, 11, 2, PAL.cyan, 2, 1);
  },
  [T.TREE]: (c) => {
    grass(c, 5, 0.06);
    px(c, 7, 11, PAL.brown, 2, 4);
    px(c, 4, 15, PAL.teal, 8, 1);
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.arc(8, 7, 6.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAL.teal;
    c.beginPath();
    c.arc(8, 7, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAL.green;
    c.beginPath();
    c.arc(7, 6, 4.5, 0, Math.PI * 2);
    c.fill();
    px(c, 5, 4, PAL.lime, 2, 1);
    px(c, 4, 5, PAL.lime, 1, 1);
  },
  [T.ROOF]: (c) => {
    px(c, 0, 0, PAL.red, TILE, TILE);
    for (let y = 3; y < TILE; y += 4) px(c, 0, y, PAL.wine, TILE, 1);
    for (let y = 0; y < TILE; y += 4) for (let x = (y / 4) % 2 ? 2 : 6; x < TILE; x += 8) px(c, x, y, PAL.wine, 1, 3);
    px(c, 0, 0, PAL.orange, TILE, 1);
  },
  [T.WALL]: (c) => {
    px(c, 0, 0, PAL.plaster, TILE, TILE);
    px(c, 0, 0, PAL.brown, 2, TILE);
    px(c, 14, 0, PAL.brown, 2, TILE);
    px(c, 0, 0, PAL.brown, TILE, 2);
    px(c, 0, 14, PAL.dirtDark, TILE, 2);
  },
  [T.DOOR]: (c) => {
    painters[T.WALL](c);
    px(c, 3, 3, PAL.ink, 10, 13);
    px(c, 4, 4, PAL.brown, 8, 12);
    px(c, 8, 4, PAL.ink, 1, 12);
    px(c, 10, 10, PAL.gold, 1, 1);
  },
  [T.WINDOW]: (c) => {
    painters[T.WALL](c);
    px(c, 4, 4, PAL.ink, 8, 7);
    px(c, 5, 5, PAL.sky, 6, 5);
    px(c, 8, 5, PAL.ink, 1, 5);
    px(c, 5, 7, PAL.ink, 6, 1);
    px(c, 5, 5, PAL.cyan, 2, 1);
  },
  [T.FENCE]: (c) => {
    grass(c, 9, 0.06);
    px(c, 0, 5, PAL.brown, TILE, 2);
    px(c, 0, 10, PAL.brown, TILE, 2);
    px(c, 2, 3, PAL.ink, 3, 11);
    px(c, 3, 4, PAL.dirt, 1, 9);
    px(c, 11, 3, PAL.ink, 3, 11);
    px(c, 12, 4, PAL.dirt, 1, 9);
  },
  [T.WELL]: (c) => {
    grass(c, 13, 0.06);
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.arc(8, 9, 6.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAL.mist;
    c.beginPath();
    c.arc(8, 9, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAL.blue;
    c.beginPath();
    c.arc(8, 9, 3.5, 0, Math.PI * 2);
    c.fill();
    px(c, 7, 7, PAL.cyan, 2, 1);
    px(c, 2, 1, PAL.brown, 1, 7);
    px(c, 13, 1, PAL.brown, 1, 7);
    px(c, 1, 1, PAL.red, 14, 2);
  },
  [T.SIGN]: (c) => {
    grass(c, 17, 0.06);
    px(c, 7, 9, PAL.brown, 2, 6);
    px(c, 2, 3, PAL.ink, 12, 7);
    px(c, 3, 4, PAL.dirt, 10, 5);
    px(c, 5, 6, PAL.brown, 6, 1);
    px(c, 8, 5, PAL.brown, 1, 3);
  },
  [T.MOUNTAIN]: (c) => {
    px(c, 0, 0, PAL.slate, TILE, TILE);
    const r = rng(23);
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(r() * 14);
      const y = Math.floor(r() * 14);
      px(c, x, y, PAL.night, 3, 1);
      px(c, x, y + 1, PAL.mist, 2, 1);
    }
  },
  [T.CAVE]: (c) => {
    painters[T.MOUNTAIN](c);
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.ellipse(8, 12, 7, 10, 0, 0, Math.PI * 2);
    c.fill();
    px(c, 0, 15, PAL.ink, TILE, 1);
    px(c, 4, 4, PAL.night, 8, 1);
  },
  [T.DFLOOR]: (c) => dfloor(c, 29),
  [T.DFLOOR2]: (c) => {
    dfloor(c, 31);
    px(c, 3, 11, PAL.mist, 3, 1);
    px(c, 4, 10, PAL.white, 1, 1);
    px(c, 11, 4, PAL.teal, 2, 2);
  },
  [T.DWALL]: (c) => bricks(c, PAL.slate, PAL.night, PAL.mist),
  [T.DTOP]: (c) => {
    px(c, 0, 0, PAL.ink, TILE, TILE);
    const r = rng(37);
    for (let i = 0; i < 5; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), PAL.night);
  },
  [T.TORCH]: (c) => {
    bricks(c, PAL.slate, PAL.night, PAL.mist);
    px(c, 7, 7, PAL.brown, 2, 6);
    px(c, 6, 6, PAL.ink, 4, 1);
    px(c, 6, 2, PAL.orange, 4, 4);
    px(c, 7, 1, PAL.gold, 2, 4);
  },
  [T.STAIRS]: (c) => {
    px(c, 0, 0, PAL.night, TILE, TILE);
    for (let i = 0; i < 4; i++) {
      px(c, i * 2, 12 - i * 4, PAL.mist, TILE - i * 4, 3);
      px(c, i * 2, 15 - i * 4, PAL.ink, TILE - i * 4, 1);
    }
    px(c, 7, 0, PAL.gold, 2, 2);
  },
  [T.GATE]: (c) => {
    px(c, 0, 0, PAL.ink, TILE, TILE);
    for (let x = 1; x < TILE; x += 4) px(c, x, 0, PAL.mist, 2, TILE);
    px(c, 0, 3, PAL.slate, TILE, 2);
    px(c, 0, 11, PAL.slate, TILE, 2);
    px(c, 7, 6, PAL.red, 2, 3);
  },
  [T.RUNE]: (c) => {
    dfloor(c, 41);
    c.strokeStyle = PAL.red;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(8, 8, 5.5, 0, Math.PI * 2);
    c.stroke();
    px(c, 7, 4, PAL.red, 2, 8);
    px(c, 4, 7, PAL.red, 8, 2);
  },
  [T.RUBBLE]: (c) => {
    dfloor(c, 43);
    px(c, 2, 10, PAL.mist, 3, 2);
    px(c, 10, 4, PAL.mist, 2, 2);
    px(c, 11, 12, PAL.slate, 3, 2);
  },
};

/** Paint all tiles into a single horizontal strip canvas. */
export function paintTileset(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * TILE_COUNT;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < TILE_COUNT; i++) {
    ctx.save();
    ctx.translate(i * TILE, 0);
    ctx.beginPath();
    ctx.rect(0, 0, TILE, TILE);
    ctx.clip();
    painters[i]?.(ctx);
    ctx.restore();
  }
  return canvas;
}
