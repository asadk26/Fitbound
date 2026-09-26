import type { Element } from './abilities';

/**
 * Expedition enemies. Each announces its next move (its *intent*) before you
 * pick an ability, so the choice matters: break armour before it hardens,
 * disrupt or stagger a charge before it lands, chain lightning through a pack,
 * overload a ward with lightning.
 *
 * Attacks are one or more *strikes*, each HIGH (duck) or LOW (hop). They
 * happen only after your set is over and you've said you're ready.
 */
export type Height = 'high' | 'low';

/**
 * How plainly an attack announces itself. Early fights spell it out; later
 * ones rely on the enemy's body language (rearing up = HIGH, crouching = LOW),
 * so the player learns to read the movement itself.
 *   obvious  body wind-up + a line at head/foot height + ▲/▼ DUCK/HOP + spoken "Duck!/Hop!"
 *   clear    body wind-up + the line + "High!/Low!"
 *   subtle   body wind-up only; the call comes after, with the result
 */
export type Cues = 'obvious' | 'clear' | 'subtle';

export interface Strike {
  height: Height;
  damage: number;
}

export type Intent =
  | { kind: 'attack'; name: string; strikes: Strike[] }
  /** Winds up: next turn it unleashes `then`, unless disrupted or staggered first. */
  | { kind: 'charge'; name: string; then: { name: string; strikes: Strike[] } }
  | { kind: 'ward'; name: string; amount: number }
  | { kind: 'armor'; name: string; stacks: number }
  | { kind: 'summon'; name: string; enemyId: string; count: number }
  | { kind: 'rest'; name: string };

export interface RpgEnemyDef {
  id: string;
  name: string;
  /** Diorama figurine to draw (fig-<sprite>), plus an optional tint and scale. */
  sprite: string;
  tint?: number;
  scale?: number;
  maxHp: number;
  /** Armour stacks: each cuts incoming damage by 18% (up to 3 stacks). */
  armor?: number;
  /** A ward absorbs damage before HP; lightning tears through it twice as fast. */
  ward?: number;
  weak?: Element[];
  resist?: Element[];
  /** Stagger points to make it lose its next action. */
  staggerAt: number;
  /** Intents, cycled. */
  pattern: Intent[];
  intro: string;
  /** One line on how to beat it. */
  tip: string;
}

const hi = (damage: number): Strike => ({ height: 'high', damage });
const lo = (damage: number): Strike => ({ height: 'low', damage });

export const RPG_ENEMIES: Record<string, RpgEnemyDef> = {
  echo_dummy: {
    id: 'echo_dummy',
    name: 'Straw Echo',
    sprite: 'dummy',
    // A warm-up: two full sets of anything that deals damage (or one of push-ups).
    maxHp: 26,
    staggerAt: 3,
    pattern: [
      { kind: 'attack', name: 'Wobbling Swipe', strikes: [hi(3)] },
      { kind: 'attack', name: 'Clumsy Sweep', strikes: [lo(3)] },
    ],
    intro: 'A straw figure stirs — an echo of your old training yard.',
    tip: 'A warm-up. Attack cards deal damage; core cards defend. Watch it move: rearing up means duck, crouching low means a small hop.',
  },
  iron_husk: {
    id: 'iron_husk',
    name: 'Iron Husk',
    sprite: 'golem',
    scale: 1.15,
    maxHp: 80,
    armor: 3,
    staggerAt: 3,
    pattern: [
      { kind: 'attack', name: 'Stone Fist', strikes: [lo(8)] },
      { kind: 'armor', name: 'Harden', stacks: 1 },
      { kind: 'attack', name: 'Crushing Swing', strikes: [hi(9), lo(7)] },
    ],
    intro: 'Plates of haze-iron grind together. The Iron Husk turns toward you.',
    tip: 'Armour blunts everything. Upper-body abilities break it — then anything hurts.',
  },
  bone_charger: {
    id: 'bone_charger',
    name: 'Bone Charger',
    sprite: 'skeleton',
    maxHp: 74,
    staggerAt: 2,
    pattern: [
      { kind: 'attack', name: 'Bone Jab', strikes: [hi(7)] },
      { kind: 'charge', name: 'Lowers its horns…', then: { name: 'Horn Charge', strikes: [lo(10), hi(10)] } },
      { kind: 'attack', name: 'Rattling Kick', strikes: [lo(7)] },
    ],
    intro: 'Hooves of bone scrape the stone. It paws the ground, eager to charge.',
    tip: 'When it winds up, disrupt it (Reaping Hook) or stagger it (legs) to cancel the charge.',
  },
  haze_wisp: {
    id: 'haze_wisp',
    name: 'Haze Wisp',
    sprite: 'mage',
    tint: 0x9ee7e3,
    scale: 0.7,
    maxHp: 26,
    staggerAt: 2,
    weak: ['lightning', 'wind'],
    pattern: [
      { kind: 'attack', name: 'Flicker', strikes: [hi(4)] },
      { kind: 'attack', name: 'Low Drift', strikes: [lo(4)] },
    ],
    intro: 'Wisps of Haze drift together.',
    tip: 'A pack: abilities that hit all or chain clear them fastest.',
  },
  hollow_acolyte: {
    id: 'hollow_acolyte',
    name: 'Hollow Acolyte',
    sprite: 'mage',
    maxHp: 70,
    ward: 28,
    weak: ['lightning'],
    resist: ['fire'],
    staggerAt: 3,
    pattern: [
      { kind: 'attack', name: 'Hex Bolt', strikes: [hi(8)] },
      { kind: 'ward', name: 'Reweave the Ward', amount: 24 },
      { kind: 'attack', name: 'Void Sweep', strikes: [lo(9)] },
    ],
    intro: 'A hooded shape murmurs the Haze into a shimmering ward.',
    tip: 'Its ward drinks damage. Lightning overloads wards; fire barely touches it.',
  },
  warden_of_haze: {
    id: 'warden_of_haze',
    name: 'Warden of the Haze',
    sprite: 'warden',
    scale: 1.3,
    maxHp: 160,
    armor: 2,
    staggerAt: 4,
    pattern: [
      { kind: 'attack', name: 'Iron Maul', strikes: [hi(10)] },
      { kind: 'summon', name: 'Calls the Haze', enemyId: 'haze_wisp', count: 2 },
      { kind: 'charge', name: 'Draws the Haze inward…', then: { name: 'Haze Cataclysm', strikes: [lo(9), hi(9), lo(11)] } },
      { kind: 'ward', name: 'Haze Shroud', amount: 36 },
      { kind: 'armor', name: 'Reforge', stacks: 2 },
      { kind: 'attack', name: 'Crossing Blows', strikes: [hi(8), lo(8)] },
    ],
    intro: 'The Warden of the Haze rises between you and the Spark.',
    tip: 'Everything at once: break its armour, cancel its charge, clear its wisps, overload its shroud.',
  },
  // ── Medieval, role A: the Green Knight (a two-stage miniboss) ───────────
  green_knight: {
    id: 'green_knight',
    name: 'The Green Knight',
    sprite: 'greenKnight',
    scale: 1.25,
    maxHp: 60,
    armor: 1,
    staggerAt: 3,
    weak: ['fire'],
    pattern: [
      { kind: 'rest', name: 'Offers you the first blow' },
      { kind: 'attack', name: 'Great Axe', strikes: [hi(9)] },
      { kind: 'charge', name: 'Hefts the axe high…', then: { name: 'The Returned Blow', strikes: [hi(8), lo(10)] } },
      { kind: 'attack', name: 'Holly Sweep', strikes: [lo(8)] },
    ],
    intro: 'A knight all in green laughs at the crossroads, a holly bough in one hand and a great axe in the other.',
    tip: 'He lets you strike first. Upper-body abilities break his mail; disrupt or stagger him to cancel the Returned Blow.',
  },
  green_knight_headless: {
    id: 'green_knight_headless',
    name: 'The Green Knight',
    sprite: 'greenKnightHeadless',
    scale: 1.25,
    maxHp: 45,
    staggerAt: 3,
    weak: ['fire'],
    pattern: [
      { kind: 'ward', name: 'The head recites the terms', amount: 14 },
      { kind: 'attack', name: 'Blind Swing', strikes: [lo(8), hi(8)] },
      { kind: 'charge', name: 'The head counts down…', then: { name: 'A Year and a Day', strikes: [hi(9), lo(9)] } },
      { kind: 'attack', name: 'Holly Lash', strikes: [hi(9)] },
    ],
    intro: 'He carries his own head at his hip, and it is still talking.',
    tip: 'The head’s words ward him: lightning overloads a ward. Fire still bites.',
  },
};

export function rpgEnemy(id: string): RpgEnemyDef {
  const e = RPG_ENEMIES[id];
  if (!e) throw new Error(`Unknown enemy: ${id}`);
  return e;
}

export function intentStrikes(i: Intent): Strike[] {
  return i.kind === 'attack' ? i.strikes : [];
}
