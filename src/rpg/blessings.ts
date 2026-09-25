/**
 * Temporary blessings: fragments of techniques the Heart remembers from other
 * reconstructions of you. Each run offers a few; a handful interact with each
 * other and with your loadout, and occasionally stack into something strong.
 * Each is implemented as an explicit check in engine.ts (search for its id).
 */
export interface BlessingDef {
  id: string;
  name: string;
  text: string;
  icon: string;
  /** Families or mechanics it leans on, for offering sensible choices. */
  tags: string[];
}

export const BLESSINGS: BlessingDef[] = [
  { id: 'tempered_edge', name: 'Tempered Edge', text: 'Upper-body abilities break 1 more armour. Foes with no armour left take +25% from them.', icon: 'sword', tags: ['upper', 'armor'] },
  { id: 'aftershock', name: 'Aftershock', text: 'Whenever a foe is staggered, every foe takes 12 damage.', icon: 'shield', tags: ['legs', 'stagger'] },
  { id: 'stormcaller', name: 'Stormcaller', text: 'Chaining abilities reach every foe. Cardio grants +1 more Storm Charge.', icon: 'bolt', tags: ['cardio', 'chain', 'charge'] },
  { id: 'static_mantle', name: 'Static Mantle', text: 'While you hold Storm Charge, damage your shield blocks is thrown back as lightning.', icon: 'star', tags: ['core', 'cardio', 'charge', 'shield'] },
  { id: 'second_wind', name: 'Second Wind', text: 'Each dodge you make readies your slowest ability one turn sooner.', icon: 'wind', tags: ['dodge', 'recharge'] },
  { id: 'full_circle', name: 'Full Circle', text: 'Use all four families within four turns to release a Heartburst: 30 damage to every foe.', icon: 'star', tags: ['synergy'] },
  { id: 'echo_of_resolve', name: 'Echo of Resolve', text: 'A partial set works at no less than 70% strength. Finish early without worry.', icon: 'heart', tags: ['partial'] },
  { id: 'kindling', name: 'Kindling', text: 'Fire adds 2 more burn. Burning hurts staggered foes twice as much.', icon: 'bolt', tags: ['cardio', 'fire', 'stagger'] },
  { id: 'quickened_heart', name: 'Quickened Heart', text: 'Abilities recharge instantly (use one twice in a row), but hit 10% softer.', icon: 'heart', tags: ['recharge'] },
  { id: 'bulwark_echo', name: 'Bulwark Echo', text: 'Your next attack adds a quarter of your current shield as damage.', icon: 'shield', tags: ['core', 'shield', 'upper'] },
  { id: 'overload', name: 'Overload', text: 'Each Storm Charge spent adds +30% instead of +15%.', icon: 'bolt', tags: ['charge'] },
  { id: 'mirror_step', name: 'Mirror Step', text: 'Each dodge grants 1 Storm Charge and a 5-point shield.', icon: 'wind', tags: ['dodge', 'charge', 'shield'] },
  { id: 'gravity_well', name: 'Gravity Well', text: 'Abilities that hit every foe tear through wards 50% faster.', icon: 'shield', tags: ['legs', 'ward'] },
];

export function blessing(id: string): BlessingDef {
  const b = BLESSINGS.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown blessing: ${id}`);
  return b;
}

/** Offer `n` blessings not already held, favouring ones that fit the loadout's abilities. */
export function offerBlessings(held: string[], loadoutAbilities: { family: string; element: string; target: string }[], rng: () => number, n = 3): BlessingDef[] {
  const pool = BLESSINGS.filter((b) => !held.includes(b.id));
  const tagsOf = new Set<string>(loadoutAbilities.flatMap((a) => [a.family, a.element, a.target === 'chain' ? 'chain' : '', a.target === 'all' ? 'stagger' : '']));
  const weighted = pool.map((b) => ({ b, w: (1 + b.tags.filter((t) => tagsOf.has(t)).length) * (0.5 + rng()) }));
  weighted.sort((a, b) => b.w - a.w);
  return weighted.slice(0, n).map((x) => x.b);
}
