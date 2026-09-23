/**
 * All FITBOUND art is generated here at boot: character sprites are drawn from
 * small pixel maps, tiles are painted procedurally. One palette (Sweetie 16,
 * plus a few skin/earth tones) keeps everything cohesive.
 */

export const PAL = {
  ink: '#1a1c2c',
  plum: '#5d275d',
  red: '#b13e53',
  orange: '#ef7d57',
  gold: '#ffcd75',
  lime: '#a7f070',
  green: '#38b764',
  teal: '#257179',
  navy: '#29366f',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  cyan: '#73eff7',
  white: '#f4f4f4',
  mist: '#94b0c2',
  slate: '#566c86',
  night: '#333c57',
  skin: '#f4c28f',
  skinShade: '#d08a5c',
  hair: '#6b3e26',
  brown: '#5d3a1a',
  dirt: '#b7835a',
  dirtDark: '#8f6040',
  plaster: '#e7d7b5',
  wine: '#742a3a',
} as const;

export type Palette = Record<string, string>;

export interface PixelSprite {
  frames: string[][];
  palette: Palette;
}

// ── Hero ──────────────────────────────────────────────────────────────────

const HERO_HEAD_SIDE = [
  '................',
  '.....kkkkk......',
  '....khhhhhk.....',
  '...khhhhhhhk....',
  '...khhhhssssk...',
  '...khhhsssesk...',
  '....khsssssk....',
  '.....kkSSkk.....',
];
const HERO_BODY_SIDE = [
  '....kcrrrrrk....',
  '...kccrrrrrsk...',
  '...kccryyyrsk...',
  '...kcrrrrrrk....',
  '....kRRkRRRk....',
];
const LEGS_SIDE_IDLE = ['....kbbk.kbbk...', '...kbbbk.kbbbk..', '...kkkk..kkkk...'];
const LEGS_SIDE_A = ['...kbbk..kbbk...', '..kbbbk...kbbk..', '..kkkk....kkkk..'];
const LEGS_SIDE_B = ['.....kbbbk......', '.....kbbbbk.....', '.....kkkkkk.....'];

const HERO_HEAD_FRONT = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khsssssshk...',
  '...kssessessk...',
  '....kssssssk....',
  '.....kkSSkk.....',
];
const HERO_BODY_FRONT = [
  '....kcrrrrck....',
  '...kscrrrrcsk...',
  '...kscryyrcsk...',
  '....kcrrrrck....',
  '....kRRkkRRk....',
];
const LEGS_FRONT_IDLE = ['....kbbkkbbk....', '...kbbbkkbbbk...', '...kkkkkkkkkk...'];
const LEGS_FRONT_A = ['....kbbkkbbk....', '....kkkkkbbbk...', '.........kkkk...'];
const LEGS_FRONT_B = ['....kbbkkbbk....', '...kbbbkkkkk....', '...kkkk.........'];

const HERO_HEAD_BACK = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '....khhhhhhk....',
  '.....kkkkkk.....',
];
const HERO_BODY_BACK = [
  '....kcccccck....',
  '...ksccccccsk...',
  '...ksCccccCsk...',
  '....kCCCCCCk....',
  '....kRRkkRRk....',
];

/** Frame order: 0-2 side (idle, walkA, walkB), 3-5 front, 6-8 back. */
const HERO_FRAMES: string[][] = [
  [...HERO_HEAD_SIDE, ...HERO_BODY_SIDE, ...LEGS_SIDE_IDLE],
  [...HERO_HEAD_SIDE, ...HERO_BODY_SIDE, ...LEGS_SIDE_A],
  [...HERO_HEAD_SIDE, ...HERO_BODY_SIDE, ...LEGS_SIDE_B],
  [...HERO_HEAD_FRONT, ...HERO_BODY_FRONT, ...LEGS_FRONT_IDLE],
  [...HERO_HEAD_FRONT, ...HERO_BODY_FRONT, ...LEGS_FRONT_A],
  [...HERO_HEAD_FRONT, ...HERO_BODY_FRONT, ...LEGS_FRONT_B],
  [...HERO_HEAD_BACK, ...HERO_BODY_BACK, ...LEGS_FRONT_IDLE],
  [...HERO_HEAD_BACK, ...HERO_BODY_BACK, ...LEGS_FRONT_A],
  [...HERO_HEAD_BACK, ...HERO_BODY_BACK, ...LEGS_FRONT_B],
];

const heroPalette = (hair: string, cape: string, capeDark: string, tunic: string, tunicDark: string): Palette => ({
  k: PAL.ink,
  h: hair,
  s: PAL.skin,
  S: PAL.skinShade,
  e: PAL.ink,
  c: cape,
  C: capeDark,
  r: tunic,
  R: tunicDark,
  y: PAL.gold,
  b: PAL.brown,
});

export const CHARACTERS: Record<string, PixelSprite> = {
  hero: { frames: HERO_FRAMES, palette: heroPalette(PAL.hair, PAL.blue, PAL.navy, PAL.red, PAL.wine) },
  elder: { frames: HERO_FRAMES, palette: heroPalette(PAL.white, PAL.plum, PAL.ink, PAL.plum, PAL.navy) },
  smith: { frames: HERO_FRAMES, palette: heroPalette(PAL.night, PAL.orange, PAL.wine, PAL.slate, PAL.night) },
  innkeeper: { frames: HERO_FRAMES, palette: heroPalette(PAL.red, PAL.teal, PAL.navy, PAL.green, PAL.teal) },
  trainer: { frames: HERO_FRAMES, palette: heroPalette(PAL.gold, PAL.sky, PAL.blue, PAL.teal, PAL.navy) },
};

// ── Enemies ───────────────────────────────────────────────────────────────

export const ENEMY_ART: Record<string, PixelSprite> = {
  skeleton: {
    palette: { k: PAL.ink, w: PAL.white, g: PAL.mist, e: PAL.red, a: PAL.slate },
    frames: [
      [
        '................',
        '......kkkk......',
        '.....kwwwwk.....',
        '....kwwwwwwk....',
        '....kwkewkewk...',
        '....kwwwwwwk....',
        '.....kwkwkwk....',
        '......kkkkk.....',
        '.....kgwgwgk....',
        '..ak.kwgwgwk.wk.',
        '.ak..kgwgwgk..wk',
        'ak....kwwwk...k.',
        '......kwkwk.....',
        '.....kwk.kwk....',
        '.....kwk.kwk....',
        '....kkwk.kwkk...',
      ],
    ],
  },
  mage: {
    palette: { k: PAL.ink, p: PAL.plum, d: PAL.night, e: PAL.cyan, o: PAL.lime, l: PAL.orange },
    frames: [
      [
        '.......kk.......',
        '......kppk......',
        '.....kppppk.....',
        '....kppppppk....',
        '....kpkkkkpk....',
        '....kpkeekpk....',
        '....kpkkkkpk....',
        '..okppppppppk...',
        '..lkpdppppdpk...',
        '..lkpdppppdpk...',
        '..lkpppppppk....',
        '..lkpdppppdpk...',
        '..lkppppppppk...',
        '..lkpdddddpk....',
        '..kpppppppppk...',
        '..kkkkkkkkkkk...',
      ],
    ],
  },
  golem: {
    palette: { k: PAL.ink, g: PAL.mist, G: PAL.slate, m: PAL.green, y: PAL.gold },
    frames: [
      [
        '........................',
        '........kkkkkkkk........',
        '.......kggggggggk.......',
        '......kgGGGGGGGGgk......',
        '......kgGyyGGyyGgk......',
        '......kgGGGGGGGGgk......',
        '......kkgGGmmGGgkk......',
        '...kkkkkkkkkkkkkkkkkk...',
        '..kgggGGGGGGGGGGGGgggk..',
        '.kgGGGkGGGGGGGGGGkGGGgk.',
        '.kgGGGkGGmmGGGGGGkGGGgk.',
        '.kgGGGkGGGGGGGmmGkGGGgk.',
        '.kgGGGkGGGGGGGGGGkGGGgk.',
        '.kkggkkGGGGGGGGGGkkggkk.',
        '.kGGGGkkGGGGGGGGkkGGGGk.',
        '.kGGGGk.kkkkkkkk.kGGGGk.',
        '..kkkk..kGGGkGGGk..kkkk.',
        '........kGGGkGGGk.......',
        '.......kgGGGkGGGgk......',
        '.......kGGGGkGGGGk......',
        '.......kGGGGkGGGGk......',
        '......kgGGGk.kGGGgk.....',
        '......kGGGGk.kGGGGk.....',
        '......kkkkkk.kkkkkk.....',
      ],
    ],
  },
  warden: {
    palette: { k: PAL.ink, g: PAL.mist, G: PAL.slate, y: PAL.gold, r: PAL.red },
    frames: [
      [
        '..........kkkk..........',
        '.........kyyyyk.........',
        '........kgGGGGgk........',
        '.......kgGGGGGGgk.......',
        '.......kGkkkkkkGk.......',
        '.......kGkrkkrkGk.......',
        '.......kGGkkkkGGk.......',
        '....kkkkyGGGGGGykkkk....',
        '...kgGGGkyyyyyykGGGgk...',
        '..kgGGGGkGGrrGGkGGGGgk..',
        '..kGGGGGkGrrrrGkGGGGGk..',
        '..kGGGGkkGGrrGGkkGGGGk..',
        '..kkGGk.kGGGGGGk.kGGkk..',
        '...kggk.kyyyyyyk.kggk...',
        '...kkk..kGGGGGGk..kkk...',
        '........kGGkkGGk........',
        '.......kGGGkkGGGk.......',
        '.......kGGk..kGGk.......',
        '.......kGGk..kGGk.......',
        '......kgGGk..kGGgk......',
        '......kGGGk..kGGGk......',
        '.....kyGGGk..kGGGyk.....',
        '.....kGGGGk..kGGGGk.....',
        '.....kkkkkk..kkkkkk.....',
      ],
    ],
  },
  dummy: {
    palette: { k: PAL.ink, y: PAL.gold, b: PAL.brown },
    frames: [
      [
        '................',
        '......kkkk......',
        '.....kyyyyk.....',
        '.....kykyyk.....',
        '.....kyyyyk.....',
        '......kkkk......',
        '..kkkkkbbkkkkk..',
        '..kyyyybbyyyyk..',
        '..kkkkybbykkkk..',
        '.....kybbyk.....',
        '.....kybbyk.....',
        '.....kkbbkk.....',
        '.......bb.......',
        '.......bb.......',
        '.....kkbbkk.....',
        '....kkkkkkkk....',
      ],
    ],
  },
};

// ── Ability icons (also used by the React UI as data URLs) ────────────────

export const ICON_ART: Record<string, PixelSprite> = {
  sword: {
    palette: { k: PAL.ink, w: PAL.white, y: PAL.gold, b: PAL.brown },
    frames: [
      [
        '.........kkk',
        '........kwwk',
        '.......kwwk.',
        '......kwwk..',
        '.....kwwk...',
        '.k..kwwk....',
        '.kkkwwk.....',
        '..kyyk......',
        '..kyk.......',
        '.kbkkk......',
        'kbk.........',
        'kk..........',
      ],
    ],
  },
  shield: {
    palette: { k: PAL.ink, b: PAL.blue, y: PAL.gold },
    frames: [
      [
        '..kkkkkkkk..',
        '.kbbbyybbbk.',
        '.kbbbyybbbk.',
        '.kbbbyybbbk.',
        '.kyyyyyyyyk.',
        '.kbbbyybbbk.',
        '.kbbbyybbbk.',
        '..kbbyybbk..',
        '..kbbyybbk..',
        '...kbyybk...',
        '....kyyk....',
        '.....kk.....',
      ],
    ],
  },
  star: {
    palette: { k: PAL.ink, y: '#d6a2ff' },
    frames: [
      [
        '.....kk.....',
        '....kyyk....',
        '....kyyk....',
        'kkkkkyykkkkk',
        'kyyyyyyyyyyk',
        '.kyyyyyyyyk.',
        '..kyyyyyyk..',
        '..kyyyyyyk..',
        '.kyyykkyyyk.',
        '.kyyk..kyyk.',
        'kyk......kyk',
        'kk........kk',
      ],
    ],
  },
  heart: {
    palette: { k: PAL.ink, r: PAL.green, w: PAL.lime },
    frames: [
      [
        '............',
        '.kkk....kkk.',
        'krrrk..krrrk',
        'krwrrkkrrrrk',
        'krwrrrrrrrrk',
        'krrrrrrrrrrk',
        '.krrrrrrrrk.',
        '..krrrrrrk..',
        '...krrrrk...',
        '....krrk....',
        '.....kk.....',
        '............',
      ],
    ],
  },
  wind: {
    palette: { c: PAL.cyan },
    frames: [
      [
        '............',
        '......ccc...',
        '.....c...c..',
        'cccccccc.c..',
        '........c...',
        '............',
        '..ccc.......',
        '.c...c......',
        'ccccccccccc.',
        '............',
        '...ccccc....',
        '............',
      ],
    ],
  },
  bolt: {
    palette: { k: PAL.ink, y: PAL.orange },
    frames: [
      [
        '......kkkk..',
        '.....kyyk...',
        '....kyyk....',
        '...kyyk.....',
        '..kyyykkkk..',
        '.kyyyyyyyk..',
        '.kkkkyyyk...',
        '....kyyk....',
        '...kyyk.....',
        '..kyyk......',
        '.kyk........',
        '.kk.........',
      ],
    ],
  },
  lock: {
    palette: { k: PAL.ink, y: PAL.mist },
    frames: [
      [
        '............',
        '....kkkk....',
        '...k....k...',
        '...k....k...',
        '.kkkkkkkkkk.',
        '.kyyyyyyyyk.',
        '.kyyykkyyyk.',
        '.kyyykkyyyk.',
        '.kyyyyyyyyk.',
        '.kkkkkkkkkk.',
        '............',
        '............',
      ],
    ],
  },
};

/** Validate that every frame is a proper rectangle. Used by tests. */
export function spriteSize(s: PixelSprite): { w: number; h: number } {
  const h = s.frames[0].length;
  const w = s.frames[0][0].length;
  for (const f of s.frames) {
    if (f.length !== h) throw new Error(`frame height ${f.length} != ${h}`);
    for (const row of f) if (row.length !== w) throw new Error(`row "${row}" width ${row.length} != ${w}`);
  }
  return { w, h };
}

/** Paint a sprite's frames side by side onto a 2D canvas context. */
export function paintSprite(ctx: CanvasRenderingContext2D, s: PixelSprite, scale = 1, ox = 0, oy = 0): void {
  const { w } = spriteSize(s);
  s.frames.forEach((f, fi) => {
    f.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = s.palette[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + (fi * w + x) * scale, oy + y * scale, scale, scale);
      }
    });
  });
}

/** Render an icon to a data URL for use in React <img> tags. */
const iconCache = new Map<string, string>();
export function iconDataUrl(name: string, scale = 4): string {
  const key = `${name}@${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const s = ICON_ART[name] ?? ICON_ART.lock;
  const { w, h } = spriteSize(s);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d')!;
  paintSprite(ctx, s, scale);
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

const spriteCache = new Map<string, string>();
export function spriteDataUrl(s: PixelSprite, scale = 4, frame = 0): string {
  const key = `${s.frames[frame].join('')}|${Object.values(s.palette).join()}|${scale}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const { w, h } = spriteSize(s);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  paintSprite(c.getContext('2d')!, { ...s, frames: [s.frames[frame]] }, scale);
  const url = c.toDataURL();
  spriteCache.set(key, url);
  return url;
}
