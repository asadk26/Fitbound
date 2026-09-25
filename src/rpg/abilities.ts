import type { Family } from '../exercise/registry';

/**
 * Combat abilities for expeditions. The four exercise *families* are the four
 * ability slots; the *movement* in a slot picks the ability variant. Push-ups
 * and dumbbell rows both fill the Upper slot but power different techniques.
 *
 * Roles per family (a starting design, not a rule every variant follows):
 *   upper   heavy single-target hits, armour breaking, disruption
 *   legs    area hits and stagger, some guard
 *   cardio  elemental hits that chain or burn, and Storm Charge
 *   core    wards and shields, heals, counterattacks
 *
 * Numbers are for a full set. A partial set scales them (see effectiveness in
 * engine.ts); a set with no verified work fizzles without using the ability.
 */
export type Element = 'physical' | 'lightning' | 'fire' | 'wind';

export interface AbilityDef {
  id: string;
  family: Family;
  name: string;
  /** One line a player can read mid-workout. */
  role: string;
  icon: string;
  color: string;
  /** Turns before it can be used again (1 = not two turns in a row). */
  cooldown: number;
  element: Element;
  target: 'single' | 'all' | 'chain';
  damage?: number;
  hits?: number;
  armorBreak?: number;
  stagger?: number;
  /** Cancels a charging enemy's wind-up. */
  disrupt?: boolean;
  shield?: number;
  heal?: number;
  burn?: number;
  /** Storm Charge gained (cardio). */
  charge?: number;
  /** Counter stance: reflect this fraction of the next hit's damage. */
  counter?: number;
}

export const ABILITIES: Record<string, AbilityDef> = {
  sunder: { id: 'sunder', family: 'upper', name: 'Sundering Strike', role: 'Heavy hit · breaks 2 armour', icon: 'sword', color: '#f2c14e', cooldown: 1, element: 'physical', target: 'single', damage: 30, armorBreak: 2, stagger: 1 },
  hook: { id: 'hook', family: 'upper', name: 'Reaping Hook', role: 'Heavy hit · disrupts a charge · breaks 1 armour', icon: 'sword', color: '#e8a33d', cooldown: 1, element: 'physical', target: 'single', damage: 26, armorBreak: 1, disrupt: true, stagger: 1 },
  twinfang: { id: 'twinfang', family: 'upper', name: 'Twin Fang', role: 'Two strikes · breaks 1 armour', icon: 'sword', color: '#ffb35c', cooldown: 1, element: 'physical', target: 'single', damage: 15, hits: 2, armorBreak: 1 },
  quake: { id: 'quake', family: 'legs', name: 'Quake Stomp', role: 'Hits all · big stagger', icon: 'shield', color: '#a7f070', cooldown: 1, element: 'physical', target: 'all', damage: 16, stagger: 2 },
  stride: { id: 'stride', family: 'legs', name: 'Stone Stride', role: 'Hits all · stagger · small guard', icon: 'shield', color: '#7ec850', cooldown: 1, element: 'physical', target: 'all', damage: 13, stagger: 2, shield: 10 },
  arc: { id: 'arc', family: 'cardio', name: 'Arc Lightning', role: 'Lightning that chains · +1 Storm Charge', icon: 'bolt', color: '#c77dff', cooldown: 1, element: 'lightning', target: 'chain', damage: 22, charge: 1 },
  ember: { id: 'ember', family: 'cardio', name: 'Ember Rush', role: 'Fire · burns over time · +1 Storm Charge', icon: 'bolt', color: '#ff8c61', cooldown: 1, element: 'fire', target: 'single', damage: 14, burn: 3, charge: 1 },
  flurry: { id: 'flurry', family: 'cardio', name: 'Gale Flurry', role: 'Six wind blows spread across foes · +1 Storm Charge', icon: 'wind', color: '#9ee7e3', cooldown: 1, element: 'wind', target: 'chain', damage: 6, hits: 6, charge: 1 },
  aegis: { id: 'aegis', family: 'core', name: 'Aegis Ward', role: 'Big shield · blocked hits strike back', icon: 'heart', color: '#5fb3f5', cooldown: 1, element: 'physical', target: 'single', shield: 32, counter: 0.5 },
  tide: { id: 'tide', family: 'core', name: 'Mending Tide', role: 'Heal · small shield', icon: 'heart', color: '#73eff7', cooldown: 1, element: 'physical', target: 'single', heal: 24, shield: 10 },
  riposte: { id: 'riposte', family: 'core', name: 'Riposte Stance', role: 'Guard · the next hit is returned in full', icon: 'shield', color: '#8fd3ff', cooldown: 1, element: 'physical', target: 'single', damage: 10, shield: 16, counter: 1 },
};

export function ability(id: string): AbilityDef {
  const a = ABILITIES[id];
  if (!a) throw new Error(`Unknown ability: ${id}`);
  return a;
}
