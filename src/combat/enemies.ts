export type DamageType = 'physical' | 'magic';

export interface BossPhase {
  name: string;
  /** Exercise whose completed set breaks this phase. */
  required: string;
  intro: string;
  /** Multiplier on damage from abilities other than `required`. */
  offTypeMultiplier: number;
  /** Enemy attack name and multiplier during this phase. */
  attack: { name: string; mult: number };
}

export interface EnemyDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  maxHp: number;
  atk: number;
  resist: Record<DamageType, number>;
  xp: number;
  gold: number;
  intro: string;
  /** Tip shown at the start of the fight. */
  tip: string;
  /** Attack pattern, cycled each enemy turn. */
  pattern: { name: string; mult: number; telegraph?: string; veil?: boolean }[];
  phases?: BossPhase[];
}

export const ENEMIES: Record<string, EnemyDef> = {
  dummy: {
    id: 'dummy',
    name: 'Training Dummy',
    title: 'Straw Sparring Partner',
    sprite: 'dummy',
    maxHp: 60,
    atk: 0,
    resist: { physical: 0, magic: 0 },
    xp: 10,
    gold: 5,
    intro: 'The Training Dummy wobbles expectantly.',
    tip: 'Practice here: find a good phone position for each exercise. The dummy never hits back.',
    pattern: [{ name: 'Wobble', mult: 0 }],
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    title: 'Rattling Sentry',
    sprite: 'skeleton',
    maxHp: 70,
    atk: 7,
    resist: { physical: 0, magic: 0 },
    xp: 45,
    gold: 15,
    intro: 'A Skeleton clatters out of the dark!',
    tip: 'Try Sword Slash — every push-up is a strike.',
    pattern: [
      { name: 'Bone Jab', mult: 1 },
      { name: 'Rusty Swipe', mult: 1.2 },
    ],
  },
  golem: {
    id: 'golem',
    name: 'Stone Golem',
    title: 'Hall Guardian',
    sprite: 'golem',
    maxHp: 110,
    atk: 11,
    resist: { physical: 0.3, magic: 0 },
    xp: 60,
    gold: 25,
    intro: 'The wall shifts... a Stone Golem rises!',
    tip: 'It telegraphs a Boulder Slam. Raise Shield Stance first to block it.',
    pattern: [
      { name: 'Stone Fist', mult: 1 },
      { name: 'Gather Stone', mult: 0, telegraph: 'The Golem hoists a boulder overhead...' },
      { name: 'Boulder Slam', mult: 2.4 },
    ],
  },
  mage: {
    id: 'mage',
    name: 'Shadow Mage',
    title: 'Hollow Acolyte',
    sprite: 'mage',
    maxHp: 100,
    atk: 9,
    resist: { physical: 0.1, magic: 0.1 },
    xp: 80,
    gold: 35,
    intro: 'A Shadow Mage flickers into being!',
    tip: 'Its Shadow Veil dulls the last ability you used. Switch exercises to combo through it.',
    pattern: [
      { name: 'Hex Bolt', mult: 1.1 },
      { name: 'Shadow Veil', mult: 0.5, veil: true, telegraph: 'Shadows coil around the Mage — it adapts to your last move!' },
      { name: 'Void Lance', mult: 1.5 },
    ],
  },
  warden: {
    id: 'warden',
    name: 'Dungeon Warden',
    title: 'Keeper of the Deep Gate',
    sprite: 'warden',
    maxHp: 240,
    atk: 12,
    resist: { physical: 0, magic: 0 },
    xp: 150,
    gold: 80,
    intro: 'The Dungeon Warden awakens, iron plates grinding!',
    tip: 'Each phase calls for a different exercise. Follow the Warden’s weakness.',
    pattern: [{ name: 'Iron Maul', mult: 1 }],
    phases: [
      {
        name: 'Iron Armor',
        required: 'pushup',
        intro: 'Its iron armor deflects magic. Break it with Sword Slash!',
        offTypeMultiplier: 0.4,
        attack: { name: 'Iron Maul', mult: 1 },
      },
      {
        name: 'Crushing Fury',
        required: 'squat',
        intro: 'The Warden gathers crushing fury! Brace with Shield Stance to turn it back.',
        offTypeMultiplier: 0.4,
        attack: { name: 'Crushing Fury', mult: 2.2 },
      },
      {
        name: 'Exposed Core',
        required: 'jumping_jack',
        intro: 'Its core is exposed! Charge Arcane Burst for the final blow!',
        offTypeMultiplier: 0.4,
        attack: { name: 'Core Flare', mult: 1.3 },
      },
    ],
  },
};

export const DUNGEON_ORDER = ['skeleton', 'golem', 'mage', 'warden'] as const;
