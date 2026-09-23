/** Tile ids, in tileset order. */
export const T = {
  GRASS: 0,
  GRASS2: 1,
  FLOWERS: 2,
  PATH: 3,
  WATER: 4,
  TREE: 5,
  ROOF: 6,
  WALL: 7,
  DOOR: 8,
  WINDOW: 9,
  FENCE: 10,
  WELL: 11,
  SIGN: 12,
  MOUNTAIN: 13,
  CAVE: 14,
  DFLOOR: 15,
  DFLOOR2: 16,
  DWALL: 17,
  DTOP: 18,
  TORCH: 19,
  STAIRS: 20,
  GATE: 21,
  RUNE: 22,
  RUBBLE: 23,
} as const;
export const TILE_COUNT = 24;
export const TILE = 16;

export const WALKABLE = new Set<number>([T.GRASS, T.GRASS2, T.FLOWERS, T.PATH, T.CAVE, T.DFLOOR, T.DFLOOR2, T.STAIRS, T.RUNE, T.RUBBLE]);

export type MapId = 'village' | 'dungeon';

export interface Entity {
  id: string;
  kind: 'npc' | 'enemy';
  /** Sprite key (character or enemy art). */
  sprite: string;
  x: number;
  y: number;
  name: string;
}

export interface MapDef {
  id: MapId;
  rows: string[];
  spawn: { x: number; y: number };
  entities: Entity[];
  /** Tiles that move the player to another map. */
  exits: { x: number; y: number; to: MapId; spawn: { x: number; y: number } }[];
  bg: string;
}

export const VILLAGE: MapDef = {
  id: 'village',
  bg: '#38b764',
  rows: [
    'MMMMMMMMMMMMMCMMMMMMMMMMMMMM',
    'MMMMMMMMMMMMM:MMMMMMMMMMMMMM',
    'TTTT.........:..........TTTT',
    'TT...f.......:.......f....TT',
    'T..RRRRR.....:.....RRRRR...T',
    'T..RRRRR.....:.....RRRRR...T',
    'T..WwDwW..S..:.....WwDwW...T',
    'T....:.......:.......:.....T',
    'T....:::::::::::::::::.....T',
    'T.f..........:.......f.....T',
    'T.....RRRRR..:...O.........T',
    'T.....RRRRR..:.............T',
    'T.....WwDwW..:......===....T',
    'T.......:....:......=.=....T',
    'T.......::::::......=.=....T',
    'T...~~~~.....:.............T',
    'T..~~~~~~....:.......f.....T',
    'T..~~~~~~....:.............T',
    'TT..~~~~.....::::..........T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  spawn: { x: 13, y: 9 },
  entities: [
    { id: 'elder', kind: 'npc', sprite: 'elder', x: 7, y: 7, name: 'Elder Maren' },
    { id: 'smith', kind: 'npc', sprite: 'smith', x: 23, y: 7, name: 'Bruna the Smith' },
    { id: 'innkeeper', kind: 'npc', sprite: 'innkeeper', x: 10, y: 13, name: 'Tomas the Innkeeper' },
    { id: 'trainer', kind: 'npc', sprite: 'trainer', x: 19, y: 13, name: 'Coach Ilse' },
    { id: 'dummy', kind: 'enemy', sprite: 'dummy', x: 21, y: 13, name: 'Training Dummy' },
  ],
  exits: [{ x: 13, y: 0, to: 'dungeon', spawn: { x: 5, y: 20 } }],
};

export const DUNGEON: MapDef = {
  id: 'dungeon',
  bg: '#1a1c2c',
  rows: [
    '####t######t##################',
    '###..........#################',
    '###....**....#################',
    '###..........#################',
    '######..######################',
    '######GG######################',
    '#####t..#t#########t####t#####',
    '###........######..........###',
    '###........................###',
    '###........................###',
    '###........######..........###',
    '###........######..........###',
    '###........##########..#######',
    '#####################..#######',
    '#####################..#######',
    '#####################..#######',
    '####################t..#t#####',
    '#####t###t########.........###',
    '###........#######.........###',
    '###........................###',
    '###........................###',
    '###.U......#######.........###',
    '##############################',
  ],
  spawn: { x: 5, y: 20 },
  entities: [
    { id: 'skeleton', kind: 'enemy', sprite: 'skeleton', x: 23, y: 19, name: 'Skeleton' },
    { id: 'golem', kind: 'enemy', sprite: 'golem', x: 22, y: 8, name: 'Stone Golem' },
    { id: 'mage', kind: 'enemy', sprite: 'mage', x: 5, y: 9, name: 'Shadow Mage' },
    { id: 'warden', kind: 'enemy', sprite: 'warden', x: 7, y: 2, name: 'Dungeon Warden' },
  ],
  exits: [{ x: 4, y: 21, to: 'village', spawn: { x: 13, y: 2 } }],
};

export const MAPS: Record<MapId, MapDef> = { village: VILLAGE, dungeon: DUNGEON };

/** Gate tiles that open once the three guardians are defeated. */
export const BOSS_GATE = [
  { x: 6, y: 5 },
  { x: 7, y: 5 },
];
export const GUARDIANS = ['skeleton', 'golem', 'mage'];

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return h / 0x100000000;
}

/** Convert a map's ASCII rows into tile ids. */
export function buildTiles(def: MapDef, gateOpen: boolean): number[][] {
  const rows = def.rows;
  return rows.map((row, y) =>
    [...row].map((ch, x) => {
      switch (ch) {
        case '.':
          return def.id === 'village' ? (hash(x, y) < 0.3 ? T.GRASS2 : T.GRASS) : hash(x, y) < 0.25 ? T.DFLOOR2 : T.DFLOOR;
        case 'f':
          return T.FLOWERS;
        case ':':
          return T.PATH;
        case '~':
          return T.WATER;
        case 'T':
          return T.TREE;
        case 'R':
          return T.ROOF;
        case 'W':
          return T.WALL;
        case 'D':
          return T.DOOR;
        case 'w':
          return T.WINDOW;
        case '=':
          return T.FENCE;
        case 'O':
          return T.WELL;
        case 'S':
          return T.SIGN;
        case 'M':
          return T.MOUNTAIN;
        case 'C':
          return T.CAVE;
        case 't':
          return T.TORCH;
        case 'U':
          return T.STAIRS;
        case 'G':
          return gateOpen ? T.RUBBLE : T.GATE;
        case '*':
          return T.RUNE;
        case '#': {
          const below = rows[y + 1]?.[x];
          return below && below !== '#' && below !== 't' ? T.DWALL : T.DTOP;
        }
        default:
          return T.GRASS;
      }
    }),
  );
}

/** Breadth-first path on the tile grid (4-neighbour). Returns tiles to visit, excluding the start. */
export function findPath(
  walk: (x: number, y: number) => boolean,
  from: { x: number; y: number },
  to: { x: number; y: number },
  w: number,
  h: number,
): { x: number; y: number }[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  const key = (x: number, y: number) => y * w + x;
  const prev = new Map<number, number>();
  const q: [number, number][] = [[from.x, from.y]];
  prev.set(key(from.x, from.y), -1);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === to.x && y === to.y) {
      const out: { x: number; y: number }[] = [];
      let k = key(x, y);
      while (k !== key(from.x, from.y)) {
        out.push({ x: k % w, y: Math.floor(k / w) });
        k = prev.get(k)!;
      }
      return out.reverse();
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if (!walk(nx, ny)) continue;
      prev.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  return null;
}
