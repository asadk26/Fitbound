import { canvas, darken, ellipse, glint, lighten, rng, roundRect, shade, type Ctx } from './paint';

/**
 * Diorama props. Each returns a canvas; the scene anchors props at their
 * bottom-centre ("feet") and adds a soft contact shadow underneath.
 */
export interface PropArt {
  canvas: HTMLCanvasElement;
  /** Origin within the canvas where the prop touches the ground (0..1). */
  originY: number;
  /** Collision radius in world pixels (0 = walk-through). */
  radius: number;
  shadow: number;
}

function art(w: number, h: number, originY: number, radius: number, shadow: number, draw: (ctx: Ctx) => void): PropArt {
  const [c, ctx] = canvas(w, h);
  draw(ctx);
  return { canvas: c, originY, radius, shadow };
}

function tree(seed: number, green: string): PropArt {
  return art(180, 220, 0.94, 34, 1.2, (ctx) => {
    const r = rng(seed);
    roundRect(ctx, 80, 130, 22, 76, 8, '#7a4a2a', 3);
    ctx.strokeStyle = darken('#7a4a2a', 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(88, 150);
    ctx.lineTo(90, 196);
    ctx.stroke();
    const blobs: [number, number, number][] = [
      [90, 116, 54],
      [56, 100, 38],
      [124, 102, 40],
      [90, 70, 46],
      [66, 64, 30],
      [118, 62, 30],
    ];
    for (const [x, y, rad] of blobs) ellipse(ctx, x + (r() - 0.5) * 6, y + (r() - 0.5) * 6, rad, rad * 0.92, green, 3.5, 0.3);
    // Leaf highlights
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 50;
      ctx.fillStyle = lighten(green, 0.3 + r() * 0.2);
      ctx.beginPath();
      ctx.ellipse(80 + Math.cos(a) * d, 80 + Math.sin(a) * d * 0.8, 6, 3.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    if (seed % 3 === 0) {
      for (let i = 0; i < 5; i++) ellipse(ctx, 50 + r() * 80, 60 + r() * 70, 5, 5, '#e2534f', 1.5, 0.6);
    }
  });
}

function pine(seed: number): PropArt {
  return art(150, 230, 0.94, 30, 1.0, (ctx) => {
    roundRect(ctx, 66, 170, 18, 44, 6, '#6b4228', 3);
    const green = seed % 2 ? '#2f8a57' : '#3a9a5c';
    for (let i = 0; i < 4; i++) {
      const y = 40 + i * 36;
      const w = 34 + i * 16;
      ctx.beginPath();
      ctx.moveTo(75, y - 26);
      ctx.quadraticCurveTo(75 + w * 0.6, y + 20, 75 + w, y + 40);
      ctx.quadraticCurveTo(75, y + 52, 75 - w, y + 40);
      ctx.quadraticCurveTo(75 - w * 0.6, y + 20, 75, y - 26);
      shade(ctx, green, { x: 75 - w, y: y - 26, w: w * 2, h: 78 }, 3.5, 0.3);
    }
    glint(ctx, 62, 40, 4, 10, 0.25);
  });
}

function bush(seed: number): PropArt {
  return art(120, 90, 0.9, 20, 0.8, (ctx) => {
    const r = rng(seed);
    const g = seed % 2 ? '#4fa857' : '#5cb85c';
    for (const [x, y, rad] of [
      [38, 56, 26],
      [80, 54, 28],
      [60, 38, 26],
    ])
      ellipse(ctx, x, y, rad, rad * 0.85, g, 3, 0.35);
    for (let i = 0; i < 4; i++) ellipse(ctx, 30 + r() * 60, 30 + r() * 30, 4, 4, seed % 3 ? '#f2d0e8' : '#fff1a8', 1.2, 0.6);
  });
}

function rock(seed: number): PropArt {
  return art(110, 80, 0.86, 24, 0.9, (ctx) => {
    const r = rng(seed);
    ctx.beginPath();
    const pts = 9;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rad = 34 + r() * 12;
      const x = 55 + Math.cos(a) * rad;
      const y = 44 + Math.sin(a) * rad * 0.62;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    shade(ctx, '#9aa3b2', { x: 15, y: 18, w: 80, h: 54 }, 3.5, 0.45);
    ctx.fillStyle = 'rgba(111,191,90,0.9)';
    ctx.beginPath();
    ctx.ellipse(42, 28, 14, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function mushroom(): PropArt {
  return art(70, 70, 0.9, 0, 0.5, (ctx) => {
    roundRect(ctx, 28, 34, 14, 26, 5, '#f4ecdc', 2.5);
    ctx.beginPath();
    ctx.ellipse(35, 34, 26, 18, 0, Math.PI, 0);
    ctx.closePath();
    shade(ctx, '#e2534f', { x: 9, y: 16, w: 52, h: 20 }, 2.5, 0.5);
    for (const [x, y] of [
      [26, 26],
      [40, 22],
      [48, 30],
    ])
      ellipse(ctx, x, y, 3.5, 3, '#ffffff', 0, 0.2);
  });
}

function banner(): PropArt {
  return art(120, 220, 0.95, 12, 0.7, (ctx) => {
    roundRect(ctx, 26, 20, 9, 190, 4, '#8a5a34', 2.5);
    ellipse(ctx, 30, 18, 9, 9, '#e9b24a', 2.5, 0.6);
    ctx.beginPath();
    ctx.moveTo(35, 32);
    ctx.quadraticCurveTo(80, 26, 104, 36);
    ctx.lineTo(96, 76);
    ctx.lineTo(104, 116);
    ctx.quadraticCurveTo(70, 104, 35, 112);
    ctx.closePath();
    shade(ctx, '#c9424f', { x: 35, y: 26, w: 70, h: 90 }, 3, 0.4);
    // Emblem: a gold star
    ctx.fillStyle = '#ffe2a0';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 9 : 20;
      ctx.lineTo(68 + Math.cos(a) * rr, 72 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, 14, 204, 34, 10, 4, '#7a7f8c', 2);
  });
}

function signpost(): PropArt {
  return art(150, 170, 0.94, 14, 0.7, (ctx) => {
    roundRect(ctx, 68, 60, 14, 104, 4, '#8a5a34', 2.5);
    ctx.beginPath();
    ctx.moveTo(18, 34);
    ctx.lineTo(118, 34);
    ctx.lineTo(136, 56);
    ctx.lineTo(118, 78);
    ctx.lineTo(18, 78);
    ctx.closePath();
    shade(ctx, '#c08a55', { x: 18, y: 34, w: 118, h: 44 }, 3, 0.35);
    ctx.strokeStyle = '#6a4228';
    ctx.lineWidth = 3;
    for (const y of [48, 60]) {
      ctx.beginPath();
      ctx.moveTo(34, y);
      ctx.lineTo(100, y);
      ctx.stroke();
    }
    ellipse(ctx, 116, 56, 5, 5, '#e9b24a', 1.5, 0.6);
  });
}

function cottage(): PropArt {
  return art(300, 280, 0.93, 90, 1.8, (ctx) => {
    // Walls
    roundRect(ctx, 50, 130, 200, 118, 10, '#efe0c0', 3.5, 0.25);
    ctx.strokeStyle = '#8a5a34';
    ctx.lineWidth = 7;
    for (const x of [58, 150, 242]) {
      ctx.beginPath();
      ctx.moveTo(x, 134);
      ctx.lineTo(x, 246);
      ctx.stroke();
    }
    // Door + glowing windows
    roundRect(ctx, 130, 174, 40, 72, 16, '#7a4a2a', 3);
    ellipse(ctx, 160, 212, 3.5, 3.5, '#e9b24a', 1.5, 0.6);
    for (const x of [78, 196]) {
      roundRect(ctx, x, 160, 34, 32, 6, '#ffd77a', 3, 0.6);
      ctx.strokeStyle = '#6a4228';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 17, 160);
      ctx.lineTo(x + 17, 192);
      ctx.moveTo(x, 176);
      ctx.lineTo(x + 34, 176);
      ctx.stroke();
    }
    // Chimney
    roundRect(ctx, 196, 36, 30, 70, 5, '#a3575a', 3);
    // Roof
    ctx.beginPath();
    ctx.moveTo(26, 142);
    ctx.quadraticCurveTo(150, 20, 274, 142);
    ctx.quadraticCurveTo(150, 124, 26, 142);
    shade(ctx, '#d0584c', { x: 26, y: 40, w: 248, h: 104 }, 4, 0.35);
    ctx.strokeStyle = 'rgba(120,40,40,0.5)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(26 + i * 20, 142 - i * 24);
      ctx.quadraticCurveTo(150, 124 - i * 26, 274 - i * 20, 142 - i * 24);
      ctx.stroke();
    }
    glint(ctx, 110, 70, 20, 6, 0.3);
  });
}

function campfire(): PropArt {
  return art(110, 90, 0.8, 16, 0.6, (ctx) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ellipse(ctx, 55 + Math.cos(a) * 34, 62 + Math.sin(a) * 14, 9, 7, '#8f99a8', 2, 0.4);
    }
    ctx.save();
    ctx.translate(55, 62);
    for (const rot of [-0.4, 0.4]) {
      ctx.save();
      ctx.rotate(rot);
      roundRect(ctx, -26, -5, 52, 10, 5, '#7a4a2a', 2.5);
      ctx.restore();
    }
    ctx.restore();
  });
}

function flame(): PropArt {
  return art(60, 80, 0.95, 0, 0, (ctx) => {
    const g = ctx.createRadialGradient(30, 56, 2, 30, 50, 30);
    g.addColorStop(0, '#fff6c0');
    g.addColorStop(0.35, '#ffcd4a');
    g.addColorStop(0.7, '#ef7d57');
    g.addColorStop(1, 'rgba(239,125,87,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(30, 6);
    ctx.quadraticCurveTo(54, 40, 46, 62);
    ctx.quadraticCurveTo(30, 80, 14, 62);
    ctx.quadraticCurveTo(6, 40, 30, 6);
    ctx.fill();
  });
}

function fence(): PropArt {
  // A vertical run of fence seen from the front-left; tiled along its length.
  return art(60, 120, 0.9, 0, 0, (ctx) => {
    roundRect(ctx, 22, 10, 16, 100, 5, '#9a6a3e', 2.5);
    roundRect(ctx, 2, 40, 56, 10, 4, '#b07c48', 2.5);
    roundRect(ctx, 2, 72, 56, 10, 4, '#b07c48', 2.5);
  });
}

function gate(open: boolean): PropArt {
  return art(140, 150, 0.92, 0, 0, (ctx) => {
    roundRect(ctx, 4, 20, 20, 124, 6, '#8a5a34', 3);
    roundRect(ctx, 116, 20, 20, 124, 6, '#8a5a34', 3);
    ellipse(ctx, 14, 18, 12, 8, '#e9b24a', 2.5, 0.5);
    ellipse(ctx, 126, 18, 12, 8, '#e9b24a', 2.5, 0.5);
    if (!open) {
      for (let i = 0; i < 4; i++) roundRect(ctx, 26 + i * 22, 40, 18, 96, 5, '#b07c48', 2.5);
      roundRect(ctx, 24, 60, 92, 10, 4, '#8a5a34', 2.5);
      roundRect(ctx, 24, 104, 92, 10, 4, '#8a5a34', 2.5);
      ellipse(ctx, 70, 86, 12, 12, '#c9424f', 2.5, 0.5);
    }
  });
}

function crystal(): PropArt {
  return art(90, 110, 0.92, 14, 0.6, (ctx) => {
    for (const [x, h, w, c] of [
      [45, 90, 18, '#b58cf0'],
      [26, 60, 13, '#9d6ee0'],
      [64, 66, 14, '#c8a4ff'],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, 100 - h);
      ctx.lineTo(x + w, 100 - h * 0.7);
      ctx.lineTo(x + w * 0.8, 100);
      ctx.lineTo(x - w * 0.8, 100);
      ctx.lineTo(x - w, 100 - h * 0.7);
      ctx.closePath();
      shade(ctx, c, { x: x - w, y: 100 - h, w: w * 2, h }, 2.5, 0.6);
    }
    glint(ctx, 40, 30, 3, 9, 0.8);
  });
}

function beacon(): PropArt {
  return art(80, 300, 1, 0, 0, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, 'rgba(255,240,180,0)');
    g.addColorStop(0.7, 'rgba(255,230,150,0.35)');
    g.addColorStop(1, 'rgba(255,220,120,0.75)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(60, 0);
    ctx.lineTo(74, 300);
    ctx.lineTo(6, 300);
    ctx.closePath();
    ctx.fill();
  });
}

function ring(): PropArt {
  return art(200, 90, 0.5, 0, 0, (ctx) => {
    ctx.strokeStyle = 'rgba(255,236,160,0.95)';
    ctx.lineWidth = 7;
    ctx.setLineDash([22, 14]);
    ctx.beginPath();
    ctx.ellipse(100, 45, 90, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** Heading arrow painted on the ground under the hero. */
function heading(): PropArt {
  return art(120, 120, 0.5, 0, 0, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = 'rgba(40,40,70,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(60, 4);
    ctx.lineTo(84, 34);
    ctx.lineTo(68, 30);
    ctx.lineTo(68, 44);
    ctx.lineTo(52, 44);
    ctx.lineTo(52, 30);
    ctx.lineTo(36, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(60, 60, 50, 50, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

export function paintProps(): Record<string, PropArt> {
  return {
    tree0: tree(3, '#4fae5a'),
    tree1: tree(7, '#3f9f58'),
    tree2: tree(11, '#62b85c'),
    pine0: pine(1),
    pine1: pine(2),
    bush0: bush(4),
    bush1: bush(9),
    rock0: rock(5),
    rock1: rock(13),
    mushroom: mushroom(),
    banner: banner(),
    signpost: signpost(),
    cottage: cottage(),
    campfire: campfire(),
    flame: flame(),
    fence: fence(),
    gateClosed: gate(false),
    gateOpen: gate(true),
    crystal: crystal(),
    beacon: beacon(),
    ring: ring(),
    heading: heading(),
  };
}
