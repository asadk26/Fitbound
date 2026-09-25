import { FAMILIES, type Family } from '../exercise/registry';
import type { SideCounts } from '../exercise/types';
import { ability, type AbilityDef, type Element } from './abilities';
import { rpgEnemy, type Intent, type RpgEnemyDef, type Strike } from './enemies';

/**
 * Turn-based expedition combat, independent of the camera and of rendering.
 *
 *   player turn   pick an ability → do its set → useAbility(family, work)
 *   enemy turn    startEnemyTurn() → one or more strikes to dodge, each
 *                 resolved with resolveStrike(outcome) → endEnemyTurn()
 *
 * The UI decides *when* the enemy turn begins: only after the set is over
 * and the player is standing and ready. Strikes are only resolved as 'hit'
 * when the camera (or a controller) confirms a wrong or missing dodge;
 * 'unclear' (the camera couldn't see) never costs HP.
 *
 * Exercise volume is not tracked here (see workout.ts): combat outcomes and
 * the workout are kept separate on purpose.
 */

/** Verified work from one set. */
export interface SetWork {
  /** Reps (total), or whole seconds held. */
  done: number;
  target: number;
  sided: boolean;
  sides?: SideCounts;
  /** The target was reached (auto-completed). */
  full: boolean;
}

/**
 * How strongly a set powers its ability, 0..1. A full set is 1. A partial set
 * scales modestly — even a single rep is worth 35% + a share — so stopping
 * early is always fine. Sided sets credit each side only up to its target, so
 * lopsided work doesn't count double. No verified work: 0 (the ability fizzles).
 */
export function effectiveness(w: SetWork, floor = 0): number {
  let p: number;
  if (w.full) p = 1;
  else if (w.sided && w.sides) p = (Math.min(w.sides.left, w.target) + Math.min(w.sides.right, w.target)) / (2 * Math.max(1, w.target));
  else p = w.done / Math.max(1, w.target);
  p = Math.max(0, Math.min(1, p));
  if (p <= 0) return 0;
  return Math.max(floor, 0.35 + 0.65 * p);
}

export interface Foe {
  uid: number;
  def: RpgEnemyDef;
  hp: number;
  maxHp: number;
  armor: number;
  ward: number;
  stagger: number;
  staggered: boolean;
  burn: number;
  intentIdx: number;
  /** A wound-up attack that lands next enemy turn unless disrupted or staggered. */
  charging: { name: string; strikes: Strike[] } | null;
  alive: boolean;
}

export interface Hero {
  hp: number;
  maxHp: number;
  shield: number;
  /** Storm Charge, 0..3. */
  charge: number;
  /** Counter stance: fraction of the next hit reflected. */
  counter: number;
}

export interface PendingStrike extends Strike {
  from: number;
  attack: string;
}

export type StrikeOutcome = 'dodged' | 'hit' | 'unclear';

export type RpgFx =
  | { kind: 'ability'; family: Family; ability: string; power: number; partial: boolean }
  | { kind: 'fizzle'; family: Family }
  | { kind: 'hit'; uid: number; damage: number; toWard: number; element: Element; weak: boolean; resisted: boolean; armored: boolean; hp: number; maxHp: number; ward: number }
  | { kind: 'armorBreak'; uid: number; armor: number }
  | { kind: 'stagger'; uid: number }
  | { kind: 'disrupt'; uid: number }
  | { kind: 'burn'; uid: number; stacks: number }
  | { kind: 'burnTick'; uid: number; damage: number; hp: number }
  | { kind: 'shield'; amount: number; total: number }
  | { kind: 'heal'; amount: number; hp: number }
  | { kind: 'charge'; charge: number }
  | { kind: 'counter'; uid: number; damage: number }
  | { kind: 'heartburst' }
  | { kind: 'death'; uid: number }
  | { kind: 'enemyAct'; uid: number; text: string }
  | { kind: 'ward'; uid: number; ward: number }
  | { kind: 'armorUp'; uid: number; armor: number }
  | { kind: 'summon'; uids: number[] }
  | { kind: 'strike'; uid: number; height: 'high' | 'low'; outcome: StrikeOutcome; damage: number; absorbed: number; hp: number; shield: number }
  | { kind: 'victory' }
  | { kind: 'defeat' };

/** Ability id per family; a family with nothing eligible today sits out. */
export type Loadout = Partial<Record<Family, string>>;

export interface EngineOptions {
  blessings?: string[];
}

const ARMOR_PER_STACK = 0.18;
const MAX_FOES = 4;

export class RpgEngine {
  readonly foes: Foe[] = [];
  readonly hero: Hero;
  readonly cooldowns: Record<Family, number> = { upper: 0, legs: 0, cardio: 0, core: 0 };
  lastFamily: Family | null = null;
  private recent: Family[] = [];
  turn = 1;
  outcome: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
  private nextUid = 1;
  private strikes: PendingStrike[] = [];
  readonly blessings: Set<string>;

  constructor(
    enemies: string[],
    hero: { hp: number; maxHp: number },
    readonly loadout: Loadout,
    opts: EngineOptions = {},
  ) {
    this.hero = { hp: hero.hp, maxHp: hero.maxHp, shield: 0, charge: 0, counter: 0 };
    this.blessings = new Set(opts.blessings ?? []);
    for (const id of enemies) this.spawn(rpgEnemy(id));
  }

  private has(b: string): boolean {
    return this.blessings.has(b);
  }

  private spawn(def: RpgEnemyDef): Foe {
    const f: Foe = { uid: this.nextUid++, def, hp: def.maxHp, maxHp: def.maxHp, armor: def.armor ?? 0, ward: def.ward ?? 0, stagger: 0, staggered: false, burn: 0, intentIdx: 0, charging: null, alive: true };
    this.foes.push(f);
    return f;
  }

  get living(): Foe[] {
    return this.foes.filter((f) => f.alive);
  }

  abilityFor(family: Family): AbilityDef {
    const id = this.loadout[family];
    if (!id) throw new Error(`No ${family} ability today`);
    return ability(id);
  }

  hasSlot(family: Family): boolean {
    return !!this.loadout[family];
  }

  available(family: Family): boolean {
    return this.outcome === 'ongoing' && !!this.loadout[family] && this.cooldowns[family] === 0;
  }

  /** What this foe will do on the next enemy turn (shown before you choose). */
  shownIntent(f: Foe): Intent {
    if (f.charging) return { kind: 'attack', name: `${f.charging.name} (charged!)`, strikes: f.charging.strikes };
    return f.def.pattern[f.intentIdx % f.def.pattern.length];
  }

  /** How well an ability fits the current fight, for the ability cards. */
  hint(family: Family): { level: 'strong' | 'normal' | 'weak'; text: string } {
    if (!this.loadout[family]) return { level: 'normal', text: '' };
    const a = this.abilityFor(family);
    const foes = this.living;
    if (!foes.length) return { level: 'normal', text: '' };
    const charging = foes.some((f) => f.charging || this.shownIntent(f).kind === 'charge');
    if (a.disrupt && charging) return { level: 'strong', text: 'Cancels the charge' };
    if ((a.stagger ?? 0) > 0 && charging && foes.some((f) => f.stagger + (a.stagger ?? 0) >= f.def.staggerAt)) return { level: 'strong', text: 'Can stagger the charge away' };
    if (a.armorBreak && foes.some((f) => f.armor > 0)) return { level: 'strong', text: 'Breaks armour' };
    if ((a.target === 'all' || a.target === 'chain') && foes.length >= 2) return { level: 'strong', text: `Hits ${a.target === 'all' ? 'all' : 'several'} foes` };
    if (a.damage && foes.some((f) => f.ward > 0) && (a.element === 'lightning' || (a.target === 'all' && this.has('gravity_well')))) return { level: 'strong', text: 'Overloads the ward' };
    if (a.damage && foes.some((f) => f.def.weak?.includes(a.element))) return { level: 'strong', text: `Foe weak to ${a.element}` };
    if (a.damage && foes.every((f) => f.def.resist?.includes(a.element))) return { level: 'weak', text: `Resisted` };
    if (a.damage && !a.armorBreak && foes.every((f) => f.armor >= 2)) return { level: 'weak', text: 'Armour blunts it' };
    if (!a.damage && this.hero.hp < this.hero.maxHp * 0.5 && a.heal) return { level: 'strong', text: 'Heals you' };
    return { level: 'normal', text: '' };
  }

  // ── Player turn ─────────────────────────────────────────────────────────

  /**
   * Resolve an ability powered by one set. With no verified work it fizzles:
   * nothing happens and the ability is NOT spent (so there's no pressure to
   * push on). Either way the enemy turn follows.
   */
  useAbility(family: Family, work: SetWork): RpgFx[] {
    const fx: RpgFx[] = [];
    if (this.outcome !== 'ongoing') return fx;
    const e = effectiveness(work, this.has('echo_of_resolve') ? 0.7 : 0);
    if (e <= 0) {
      fx.push({ kind: 'fizzle', family });
      return fx;
    }
    const a = this.abilityFor(family);
    const cardio = family === 'cardio';
    let power = e;
    if (this.lastFamily && this.lastFamily !== family) power *= 1.1;
    if (this.has('quickened_heart')) power *= 0.9;
    // Spend Storm Charge on anything that isn't itself building it.
    if (!cardio && this.hero.charge > 0 && (a.damage || a.shield)) {
      power *= 1 + this.hero.charge * (this.has('overload') ? 0.3 : 0.15);
      this.hero.charge = 0;
      fx.push({ kind: 'charge', charge: 0 });
    }
    fx.push({ kind: 'ability', family, ability: a.id, power: Math.round(power * 100) / 100, partial: !work.full });

    // Defensive parts first (they can't be wasted by a kill).
    if (a.shield) this.addShield(fx, a.shield * e);
    if (a.heal) {
      const amt = Math.round(a.heal * e);
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + amt);
      fx.push({ kind: 'heal', amount: amt, hp: this.hero.hp });
    }
    if (a.counter) this.hero.counter = Math.max(this.hero.counter, a.counter);

    if (a.damage) {
      let flat = 0;
      if (this.has('bulwark_echo') && this.hero.shield > 0 && !a.shield) flat = Math.round(this.hero.shield * 0.25);
      this.hitting = family;
      this.attack(fx, a, power, flat);
      this.hitting = null;
    }

    if (a.charge) {
      this.hero.charge = Math.min(3, this.hero.charge + a.charge + (this.has('stormcaller') ? 1 : 0));
      fx.push({ kind: 'charge', charge: this.hero.charge });
    }

    // Recharge and variety.
    this.cooldowns[family] = this.has('quickened_heart') ? a.cooldown : a.cooldown + 1;
    this.lastFamily = family;
    this.recent.push(family);
    if (this.recent.length > 4) this.recent.shift();
    if (this.has('full_circle') && this.recent.length === 4 && FAMILIES.every((f) => this.recent.includes(f))) {
      fx.push({ kind: 'heartburst' });
      for (const f of this.living) this.damageFoe(fx, f, 30, 'physical');
      this.recent = [];
    }
    this.checkEnd(fx);
    return fx;
  }

  /** Pick a target for a single-target ability. */
  private target(a: AbilityDef): Foe | null {
    const foes = this.living;
    if (!foes.length) return null;
    if (a.disrupt) {
      const c = foes.find((f) => f.charging || this.shownIntent(f).kind === 'charge');
      if (c) return c;
    }
    if (a.armorBreak) {
      const armored = foes.filter((f) => f.armor > 0).sort((x, y) => y.armor - x.armor);
      if (armored.length) return armored[0];
    }
    return [...foes].sort((x, y) => x.hp - y.hp)[0];
  }

  private attack(fx: RpgFx[], a: AbilityDef, power: number, flat: number): void {
    const hits = a.hits ?? 1;
    const foes = this.living;
    if (!foes.length) return;
    const perHit = (a.damage ?? 0) * power;
    if (a.target === 'all') {
      for (const f of foes) {
        this.breakArmor(fx, f, a);
        for (let h = 0; h < hits; h++) this.damageFoe(fx, f, perHit + (h === 0 ? flat : 0), a.element, true);
        this.addStagger(fx, f, a.stagger ?? 0);
      }
      return;
    }
    if (a.target === 'chain') {
      // Chain: the first foe takes it all, then it jumps on (70%), or multi-hit spreads round-robin.
      const order = this.chainOrder(foes);
      const reach = this.has('stormcaller') ? order.length : Math.min(order.length, 3);
      if (hits > 1) {
        for (let h = 0; h < hits; h++) {
          const f = order[h % reach];
          if (f.alive) this.damageFoe(fx, f, perHit + (h === 0 ? flat : 0), a.element);
        }
      } else {
        order.slice(0, reach).forEach((f, i) => f.alive && this.damageFoe(fx, f, perHit * (i === 0 ? 1 : 0.7) + (i === 0 ? flat : 0), a.element));
      }
      return;
    }
    const t = this.target(a);
    if (!t) return;
    this.breakArmor(fx, t, a);
    if (a.disrupt && (t.charging || this.shownIntent(t).kind === 'charge')) {
      t.charging = null;
      if (this.shownIntent(t).kind === 'charge') t.intentIdx++;
      fx.push({ kind: 'disrupt', uid: t.uid });
    }
    for (let h = 0; h < hits; h++) if (t.alive) this.damageFoe(fx, t, perHit + (h === 0 ? flat : 0), a.element);
    if (t.alive) this.addStagger(fx, t, a.stagger ?? 0);
    if (a.burn && t.alive) {
      t.burn += a.burn + (this.has('kindling') ? 2 : 0);
      fx.push({ kind: 'burn', uid: t.uid, stacks: t.burn });
    }
  }

  private chainOrder(foes: Foe[]): Foe[] {
    const t = [...foes].sort((x, y) => (y.ward > 0 ? 1 : 0) - (x.ward > 0 ? 1 : 0) || x.hp - y.hp);
    return t;
  }

  private breakArmor(fx: RpgFx[], f: Foe, a: AbilityDef): void {
    const n = (a.armorBreak ?? 0) + (a.armorBreak && this.has('tempered_edge') ? 1 : 0);
    if (!n || f.armor <= 0) return;
    f.armor = Math.max(0, f.armor - n);
    fx.push({ kind: 'armorBreak', uid: f.uid, armor: f.armor });
  }

  private damageFoe(fx: RpgFx[], f: Foe, raw: number, el: Element, area = false): void {
    if (!f.alive) return;
    let d = raw;
    const weak = !!f.def.weak?.includes(el);
    const resisted = !!f.def.resist?.includes(el);
    if (weak) d *= 1.5;
    if (resisted) d *= 0.5;
    const armored = f.armor > 0;
    d *= 1 - ARMOR_PER_STACK * Math.min(3, f.armor);
    if (!armored && this.has('tempered_edge') && this.hitting === 'upper') d *= 1.25;
    let toWard = 0;
    if (f.ward > 0) {
      const wm = (el === 'lightning' ? 2 : 1) * (area && this.has('gravity_well') ? 1.5 : 1);
      const wd = d * wm;
      if (wd >= f.ward) {
        toWard = f.ward;
        d = (wd - f.ward) / wm;
        f.ward = 0;
      } else {
        toWard = wd;
        f.ward -= wd;
        d = 0;
      }
      toWard = Math.round(toWard);
      f.ward = Math.round(f.ward);
    }
    const dmg = Math.round(d);
    f.hp = Math.max(0, f.hp - dmg);
    fx.push({ kind: 'hit', uid: f.uid, damage: dmg, toWard, element: el, weak, resisted, armored, hp: f.hp, maxHp: f.maxHp, ward: f.ward });
    if (f.hp <= 0) this.kill(fx, f);
  }

  /** The family whose ability is resolving (Tempered Edge's bonus). */
  private hitting: Family | null = null;

  private addStagger(fx: RpgFx[], f: Foe, n: number): void {
    if (!n || !f.alive || f.staggered) return;
    f.stagger += n;
    if (f.stagger < f.def.staggerAt) return;
    f.stagger = 0;
    f.staggered = true;
    // A staggered foe loses its next action — including a wound-up charge —
    // and its armour cracks, so armour never *requires* upper-body work.
    f.charging = null;
    fx.push({ kind: 'stagger', uid: f.uid });
    if (f.armor > 0) {
      f.armor--;
      fx.push({ kind: 'armorBreak', uid: f.uid, armor: f.armor });
    }
    if (this.has('aftershock')) for (const o of this.living) this.damageFoe(fx, o, 12, 'physical');
  }

  private kill(fx: RpgFx[], f: Foe): void {
    f.alive = false;
    f.charging = null;
    fx.push({ kind: 'death', uid: f.uid });
  }

  private addShield(fx: RpgFx[], amount: number): void {
    const a = Math.max(1, Math.round(amount));
    this.hero.shield = Math.min(this.hero.maxHp, this.hero.shield + a);
    fx.push({ kind: 'shield', amount: a, total: this.hero.shield });
  }

  private checkEnd(fx: RpgFx[]): void {
    if (this.outcome !== 'ongoing') return;
    if (!this.living.length) {
      this.outcome = 'victory';
      fx.push({ kind: 'victory' });
    } else if (this.hero.hp <= 0) {
      this.outcome = 'defeat';
      fx.push({ kind: 'defeat' });
    }
  }

  // ── Enemy turn ──────────────────────────────────────────────────────────

  /**
   * The enemies act: burns tick, wards and armour go up, charges wind up, and
   * any attacks become strikes for the player to dodge (resolve each with
   * resolveStrike, then call endEnemyTurn).
   */
  startEnemyTurn(): { fx: RpgFx[]; strikes: PendingStrike[] } {
    const fx: RpgFx[] = [];
    this.strikes = [];
    if (this.outcome !== 'ongoing') return { fx, strikes: [] };
    for (const f of this.living) {
      if (f.burn <= 0) continue;
      const dmg = 4 * f.burn * (this.has('kindling') && f.staggered ? 2 : 1);
      f.hp = Math.max(0, f.hp - dmg);
      f.burn--;
      fx.push({ kind: 'burnTick', uid: f.uid, damage: dmg, hp: f.hp });
      if (f.hp <= 0) this.kill(fx, f);
    }
    for (const f of [...this.living]) {
      if (f.staggered) {
        f.staggered = false;
        f.intentIdx++;
        fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name} is staggered and loses its turn!` });
        continue;
      }
      if (f.charging) {
        const c = f.charging;
        f.charging = null;
        fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name}: ${c.name}!` });
        for (const s of c.strikes) this.strikes.push({ ...s, from: f.uid, attack: c.name });
        continue;
      }
      const i = f.def.pattern[f.intentIdx % f.def.pattern.length];
      f.intentIdx++;
      switch (i.kind) {
        case 'attack':
          fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name}: ${i.name}` });
          for (const s of i.strikes) this.strikes.push({ ...s, from: f.uid, attack: i.name });
          break;
        case 'charge':
          f.charging = i.then;
          fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name} ${i.name.charAt(0).toLowerCase()}${i.name.slice(1)} — it will unleash ${i.then.name} next turn!` });
          break;
        case 'ward':
          f.ward += i.amount;
          fx.push({ kind: 'ward', uid: f.uid, ward: f.ward });
          fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name}: ${i.name}` });
          break;
        case 'armor':
          f.armor = Math.min(3, f.armor + i.stacks);
          fx.push({ kind: 'armorUp', uid: f.uid, armor: f.armor });
          fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name}: ${i.name}` });
          break;
        case 'summon': {
          const room = Math.max(0, MAX_FOES - this.living.length);
          const uids: number[] = [];
          for (let k = 0; k < Math.min(room, i.count); k++) uids.push(this.spawn(rpgEnemy(i.enemyId)).uid);
          fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name}: ${i.name}` });
          if (uids.length) fx.push({ kind: 'summon', uids });
          break;
        }
        case 'rest':
          fx.push({ kind: 'enemyAct', uid: f.uid, text: `${f.def.name}: ${i.name}` });
          break;
      }
    }
    this.checkEnd(fx);
    return { fx, strikes: [...this.strikes] };
  }

  /**
   * One strike's result. 'unclear' (tracking lost, nobody in view) costs
   * nothing — it is never treated as a failed dodge.
   */
  resolveStrike(s: PendingStrike, outcome: StrikeOutcome): RpgFx[] {
    const fx: RpgFx[] = [];
    if (this.outcome !== 'ongoing') return fx;
    const from = this.foes.find((f) => f.uid === s.from);
    if (outcome !== 'hit') {
      if (outcome === 'dodged') {
        if (this.has('second_wind')) {
          const slow = FAMILIES.filter((f) => this.cooldowns[f] > 0).sort((a, b) => this.cooldowns[b] - this.cooldowns[a])[0];
          if (slow) this.cooldowns[slow]--;
        }
        if (this.has('mirror_step')) {
          this.hero.charge = Math.min(3, this.hero.charge + 1);
          fx.push({ kind: 'charge', charge: this.hero.charge });
          this.addShield(fx, 5);
        }
      }
      fx.push({ kind: 'strike', uid: s.from, height: s.height, outcome, damage: 0, absorbed: 0, hp: this.hero.hp, shield: this.hero.shield });
      return fx;
    }
    const absorbed = Math.min(this.hero.shield, s.damage);
    this.hero.shield -= absorbed;
    const taken = s.damage - absorbed;
    this.hero.hp = Math.max(0, this.hero.hp - taken);
    fx.push({ kind: 'strike', uid: s.from, height: s.height, outcome, damage: taken, absorbed, hp: this.hero.hp, shield: this.hero.shield });
    if (from?.alive) {
      if (this.hero.counter > 0) {
        const d = Math.round(s.damage * this.hero.counter * 1.5);
        this.hero.counter = 0;
        fx.push({ kind: 'counter', uid: from.uid, damage: d });
        this.damageFoe(fx, from, d, 'physical');
      }
      if (this.has('static_mantle') && this.hero.charge > 0 && absorbed > 0 && from.alive) {
        fx.push({ kind: 'counter', uid: from.uid, damage: Math.round(absorbed * 0.5) });
        this.damageFoe(fx, from, absorbed * 0.5, 'lightning');
      }
    }
    this.checkEnd(fx);
    return fx;
  }

  /** After the strikes: abilities recharge a turn. */
  endEnemyTurn(): RpgFx[] {
    for (const f of FAMILIES) this.cooldowns[f] = Math.max(0, this.cooldowns[f] - 1);
    this.turn++;
    this.strikes = [];
    const fx: RpgFx[] = [];
    this.checkEnd(fx);
    return fx;
  }
}
