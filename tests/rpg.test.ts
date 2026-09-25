import { describe, expect, it } from 'vitest';
import { DodgeReader, StrikeTimer, type DodgeSample } from '../src/rpg/dodge';
import { effectiveness, RpgEngine, type Loadout, type PendingStrike, type RpgFx, type SetWork } from '../src/rpg/engine';
import { FRAME_MS, squatPose, standPose } from '../src/testing/poses';

const LOADOUT: Loadout = { upper: 'sunder', legs: 'quake', cardio: 'arc', core: 'aegis' };
const full = (target = 8): SetWork => ({ done: target, target, sided: false, full: true });
const part = (done: number, target = 8): SetWork => ({ done, target, sided: false, full: false });
const kinds = (fx: RpgFx[]) => fx.map((f) => f.kind);
const dmgTo = (fx: RpgFx[]) => fx.filter((f) => f.kind === 'hit').reduce((a, f) => a + (f as { damage: number }).damage, 0);

/** Run a whole enemy turn with every strike resolved the same way. */
function enemyTurn(e: RpgEngine, outcome: 'dodged' | 'hit' | 'unclear') {
  const { strikes } = e.startEnemyTurn();
  const out = strikes.flatMap((s: PendingStrike) => e.resolveStrike(s, outcome));
  e.endEnemyTurn();
  return { strikes, out };
}

describe('set effectiveness', () => {
  it('full sets are 1; partial sets scale modestly; nothing verified fizzles', () => {
    expect(effectiveness(full())).toBe(1);
    expect(effectiveness(part(5, 8))).toBeCloseTo(0.35 + 0.65 * (5 / 8));
    expect(effectiveness(part(1, 8))).toBeGreaterThan(0.4);
    expect(effectiveness(part(0, 8))).toBe(0);
    expect(effectiveness(part(3, 8), 0.7)).toBe(0.7); // Echo of Resolve floor
  });

  it('sided sets only credit each side up to its target (no double-counting one side)', () => {
    const lopsided: SetWork = { done: 10, target: 5, sided: true, sides: { left: 10, right: 0 }, full: false };
    const even: SetWork = { done: 6, target: 5, sided: true, sides: { left: 3, right: 3 }, full: false };
    expect(effectiveness(lopsided)).toBeCloseTo(0.35 + 0.65 * 0.5);
    expect(effectiveness(even)).toBeCloseTo(0.35 + 0.65 * 0.6);
  });
});

describe('abilities and recharge', () => {
  it('an ability cannot be used two turns running, and at least three are always ready', () => {
    const e = new RpgEngine(['iron_husk'], { hp: 100, maxHp: 100 }, LOADOUT);
    e.useAbility('upper', full());
    enemyTurn(e, 'dodged');
    expect(e.available('upper')).toBe(false);
    expect(['legs', 'cardio', 'core'].every((f) => e.available(f as 'legs'))).toBe(true);
    e.useAbility('legs', full());
    enemyTurn(e, 'dodged');
    expect(e.available('upper')).toBe(true);
    expect(e.available('legs')).toBe(false);
  });

  it('a set with no verified reps fizzles and does not use up the ability', () => {
    const e = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, LOADOUT);
    const fx = e.useAbility('upper', part(0));
    expect(kinds(fx)).toEqual(['fizzle']);
    enemyTurn(e, 'dodged');
    expect(e.available('upper')).toBe(true);
  });

  it('5 of 8 reps deals a proportionate partial hit, never zero and never a full one', () => {
    const a = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, LOADOUT);
    const b = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, LOADOUT);
    const d5 = dmgTo(a.useAbility('upper', part(5)));
    const d8 = dmgTo(b.useAbility('upper', full()));
    expect(d5).toBeGreaterThan(d8 * 0.6);
    expect(d5).toBeLessThan(d8);
  });
});

describe('enemy mechanics make ability choice matter', () => {
  it('armour blunts damage until upper-body abilities break it', () => {
    const a = new RpgEngine(['iron_husk'], { hp: 100, maxHp: 100 }, LOADOUT);
    const blunt = dmgTo(a.useAbility('legs', full()));
    const b = new RpgEngine(['iron_husk'], { hp: 100, maxHp: 100 }, LOADOUT);
    const fx = b.useAbility('upper', full());
    expect(fx.some((f) => f.kind === 'armorBreak')).toBe(true);
    expect(b.foes[0].armor).toBe(1);
    enemyTurn(b, 'dodged');
    const after = dmgTo(b.useAbility('legs', full()));
    expect(after).toBeGreaterThan(blunt * 1.3);
    expect(b.hint('upper').level === 'strong' || b.foes[0].armor === 0).toBe(true);
  });

  it('a charge lands next turn unless disrupted or staggered', () => {
    const hook: Loadout = { ...LOADOUT, upper: 'hook' };
    // Undisrupted: turn 1 jab, turn 2 wind-up, turn 3 the two-strike charge.
    const a = new RpgEngine(['bone_charger'], { hp: 100, maxHp: 100 }, hook);
    a.useAbility('core', full());
    enemyTurn(a, 'dodged');
    a.useAbility('cardio', part(1));
    expect(enemyTurn(a, 'dodged').strikes).toHaveLength(0); // winding up
    expect(a.shownIntent(a.foes[0]).kind).toBe('attack');
    expect(a.hint('upper').level).toBe('strong');
    a.useAbility('core', full());
    expect(enemyTurn(a, 'hit').strikes).toHaveLength(2);
    // Disrupted while wound up: the charge never lands.
    const b = new RpgEngine(['bone_charger'], { hp: 100, maxHp: 100 }, hook);
    b.useAbility('core', full());
    enemyTurn(b, 'dodged');
    b.useAbility('cardio', part(1));
    enemyTurn(b, 'dodged');
    const fx = b.useAbility('upper', full());
    expect(fx.some((f) => f.kind === 'disrupt')).toBe(true);
    expect(enemyTurn(b, 'hit').strikes.every((s) => s.attack !== 'Horn Charge')).toBe(true);
  });

  it('area and chain abilities hit a whole pack; single-target hits one', () => {
    const e = new RpgEngine(['haze_wisp', 'haze_wisp', 'haze_wisp'], { hp: 100, maxHp: 100 }, LOADOUT);
    const quake = e.useAbility('legs', full()).filter((f) => f.kind === 'hit');
    expect(new Set(quake.map((f) => (f as { uid: number }).uid)).size).toBe(3);
    const s = new RpgEngine(['haze_wisp', 'haze_wisp', 'haze_wisp'], { hp: 100, maxHp: 100 }, LOADOUT);
    const sunder = s.useAbility('upper', full()).filter((f) => f.kind === 'hit');
    expect(new Set(sunder.map((f) => (f as { uid: number }).uid)).size).toBe(1);
    expect(s.hint('legs').level).toBe('strong');
  });

  it('lightning tears through a ward twice as fast; fire is resisted', () => {
    const arc = new RpgEngine(['hollow_acolyte'], { hp: 100, maxHp: 100 }, LOADOUT);
    arc.useAbility('cardio', full());
    const ember = new RpgEngine(['hollow_acolyte'], { hp: 100, maxHp: 100 }, { ...LOADOUT, cardio: 'ember' });
    ember.useAbility('cardio', full());
    expect(arc.foes[0].ward).toBe(0);
    expect(ember.foes[0].ward).toBeGreaterThan(0);
    expect(arc.hint('cardio').level).toBe('strong');
  });

  it('the boss summons, charges, wards and armours up — and no single movement is required', () => {
    const e = new RpgEngine(['warden_of_haze'], { hp: 999, maxHp: 999 }, LOADOUT);
    const seen = new Set<string>();
    for (let turn = 0; turn < 40 && e.outcome === 'ongoing'; turn++) {
      // Never upper body (say push-ups were excluded today): legs, cardio and core only.
      const fam = (['legs', 'cardio', 'core'] as const).find((f) => e.available(f))!;
      e.useAbility(fam, full());
      const { fx } = e.startEnemyTurn();
      fx.forEach((f) => seen.add(f.kind === 'enemyAct' ? f.text.split(':')[1]?.trim() ?? f.text : f.kind));
      e.endEnemyTurn();
    }
    expect(seen.has('summon')).toBe(true);
    expect(seen.has('ward')).toBe(true);
    expect(seen.has('armorUp')).toBe(true);
    expect(e.outcome).toBe('victory');
  });
});

describe('blessings interact', () => {
  it('Tempered Edge breaks more armour; Aftershock punishes staggers', () => {
    const e = new RpgEngine(['iron_husk'], { hp: 100, maxHp: 100 }, LOADOUT, { blessings: ['tempered_edge'] });
    e.useAbility('upper', full());
    expect(e.foes[0].armor).toBe(0);
    const a = new RpgEngine(['haze_wisp', 'haze_wisp'], { hp: 100, maxHp: 100 }, LOADOUT, { blessings: ['aftershock'] });
    const fx = a.useAbility('legs', full());
    expect(fx.filter((f) => f.kind === 'stagger').length).toBeGreaterThan(0);
    expect(fx.filter((f) => f.kind === 'hit').length).toBeGreaterThan(2);
  });

  it('Static Mantle + Storm Charge + a shield throw blocked damage back', () => {
    const e = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, LOADOUT, { blessings: ['static_mantle'] });
    e.useAbility('cardio', part(1)); // +1 charge
    enemyTurn(e, 'dodged');
    e.hero.shield = 20; // as if a ward was up
    const { strikes } = e.startEnemyTurn();
    const out = e.resolveStrike(strikes[0], 'hit');
    expect(out.some((f) => f.kind === 'counter')).toBe(true);
  });

  it('Full Circle fires after all four families', () => {
    const e = new RpgEngine(['warden_of_haze'], { hp: 999, maxHp: 999 }, LOADOUT, { blessings: ['full_circle'] });
    const fams = ['upper', 'legs', 'cardio', 'core'] as const;
    let burst = false;
    for (const f of fams) {
      burst = e.useAbility(f, full()).some((x) => x.kind === 'heartburst') || burst;
      enemyTurn(e, 'dodged');
    }
    expect(burst).toBe(true);
  });

  it('Quickened Heart lets an ability repeat; Second Wind recharges on a dodge', () => {
    const q = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, LOADOUT, { blessings: ['quickened_heart'] });
    q.useAbility('upper', part(1));
    enemyTurn(q, 'dodged');
    expect(q.available('upper')).toBe(true);
    const s = new RpgEngine(['iron_husk'], { hp: 100, maxHp: 100 }, LOADOUT, { blessings: ['second_wind'] });
    s.useAbility('upper', part(1));
    enemyTurn(s, 'dodged'); // dodging the Stone Fist readies Sunder at once
    expect(s.available('upper')).toBe(true);
  });
});

describe('dodging and HP', () => {
  it('a missed dodge costs HP (shield first); a dodge or an unclear read costs nothing', () => {
    const e = new RpgEngine(['iron_husk'], { hp: 100, maxHp: 100 }, LOADOUT);
    e.useAbility('core', full()); // shield 32
    const { strikes } = e.startEnemyTurn();
    const hit = e.resolveStrike(strikes[0], 'hit').find((f) => f.kind === 'strike') as Extract<RpgFx, { kind: 'strike' }>;
    expect(hit.absorbed).toBeGreaterThan(0);
    expect(e.hero.hp).toBe(100);
    e.endEnemyTurn();
    e.hero.shield = 0;
    e.useAbility('legs', full());
    const t2 = e.startEnemyTurn();
    e.endEnemyTurn();
    expect(t2.strikes).toHaveLength(0); // Harden: no attack
    e.useAbility('cardio', full());
    const t3 = e.startEnemyTurn();
    expect(t3.strikes.map((s) => s.height)).toEqual(['high', 'low']);
    e.resolveStrike(t3.strikes[0], 'unclear');
    e.resolveStrike(t3.strikes[1], 'dodged');
    expect(e.hero.hp).toBe(100);
  });

  it('defeat only comes from missed dodges, and ends the fight', () => {
    const e = new RpgEngine(['iron_husk'], { hp: 5, maxHp: 100 }, LOADOUT);
    e.useAbility('upper', part(0)); // exhausted: fizzles, no HP lost for it
    expect(e.hero.hp).toBe(5);
    const { strikes } = e.startEnemyTurn();
    const out = e.resolveStrike(strikes[0], 'hit');
    expect(e.outcome).toBe('defeat');
    expect(kinds(out)).toContain('defeat');
  });
});

describe('dodge reading from the camera', () => {
  const feed = (r: DodgeReader, frames: ((t: number) => ReturnType<typeof standPose> | null)[], t0 = 0) => {
    let t = t0;
    let last = r.update(null, t);
    for (const f of frames) last = r.update(f((t += FRAME_MS)), t);
    return { last, t };
  };

  it('needs a still baseline first; standing up is never a dodge', () => {
    const r = new DodgeReader();
    // Rising out of a squat (like getting up) while the baseline forms: nothing counts.
    const rising = Array.from({ length: 20 }, (_, i) => (t: number) => squatPose(80 - i * 4, t));
    const a = feed(r, rising);
    expect(a.last.ducking).toBe(false);
    expect(a.last.hops).toBe(0);
    const b = feed(r, Array.from({ length: 20 }, () => (t: number) => squatPose(0, t)), a.t);
    expect(b.last.baseline).toBe(true);
  });

  it('a quick squat is a duck; a small hop is a hop; marching is neither', () => {
    const r = new DodgeReader();
    let s = feed(r, Array.from({ length: 20 }, () => (t: number) => squatPose(0, t)));
    s = feed(r, Array.from({ length: 6 }, () => (t: number) => squatPose(70, t)), s.t);
    expect(s.last.ducking).toBe(true);
    const h = new DodgeReader();
    let q = feed(h, Array.from({ length: 20 }, () => (t: number) => standPose(t)));
    q = feed(h, [...Array.from({ length: 4 }, () => (t: number) => standPose(t, { bob: 0.04 })), ...Array.from({ length: 6 }, () => (t: number) => standPose(t))], q.t);
    expect(q.last.hops).toBe(1);
    const m = new DodgeReader();
    let w = feed(m, Array.from({ length: 20 }, () => (t: number) => standPose(t)));
    w = feed(m, Array.from({ length: 60 }, (_, i) => (t: number) => standPose(t, { liftL: i % 10 < 5 ? 0.6 : 0, liftR: i % 10 >= 5 ? 0.6 : 0 })), w.t);
    expect(w.last.hops).toBe(0);
    expect(w.last.ducking).toBe(false);
  });
});

describe('strike timing', () => {
  const run = (st: StrikeTimer, sample: (t: number) => DodgeSample | null, ms = 5000) => {
    let res = null;
    for (let t = 0; t <= ms && !res; t += 33) res = st.update(t, sample(t));
    return res;
  };
  const good = (ducking = false, hops = 0): DodgeSample => ({ tracking: 'good', ducking, hops });

  it('ducking in the window dodges a HIGH strike; standing still is a hit', () => {
    expect(run(new StrikeTimer('high'), (t) => good(t > 2000 && t < 2800))).toBe('dodged');
    expect(run(new StrikeTimer('high'), () => good())).toBe('hit');
  });

  it('a hop in the window dodges a LOW strike; ducking under a low sweep does not', () => {
    expect(run(new StrikeTimer('low'), (t) => good(false, t > 2300 ? 1 : 0))).toBe('dodged');
    expect(run(new StrikeTimer('low'), (t) => good(t > 2000))).toBe('hit');
    // A hop long before the window doesn't count.
    expect(run(new StrikeTimer('low'), (t) => good(false, t > 300 ? 1 : 0))).toBe('hit');
  });

  it('out of view: the attack waits; lost during the swing: unclear, never a hit', () => {
    const st = new StrikeTimer('high');
    for (let t = 0; t < 6000; t += 33) st.update(t, { tracking: 'lost', ducking: false, hops: 0 });
    expect(st.outcome).toBeNull(); // still waiting for you
    const mid = new StrikeTimer('high');
    expect(run(mid, (t) => (t < 1800 ? good() : { tracking: 'lost', ducking: false, hops: 0 }))).toBe('unclear');
  });

  it('controller fallback: the right button in time', () => {
    const st = new StrikeTimer('low', undefined, true);
    let res = null;
    for (let t = 0; t <= 5000 && !res; t += 33) {
      if (t === 2310) st.press('hop', t);
      res = st.update(t, null);
    }
    expect(res).toBe('dodged');
    const miss = new StrikeTimer('low', undefined, true);
    let r2 = null;
    for (let t = 0; t <= 5000 && !r2; t += 33) {
      if (t === 2310) miss.press('duck', t);
      r2 = miss.update(t, null);
    }
    expect(r2).toBe('hit');
  });
});

describe('learning curve', () => {
  it('the training dummy falls to one set of push-ups plus one more attack', async () => {
    const e = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, LOADOUT);
    e.useAbility('upper', full());
    enemyTurn(e, 'dodged');
    e.useAbility('legs', full());
    expect(e.outcome).toBe('victory');
    const d = new RpgEngine(['echo_dummy'], { hp: 100, maxHp: 100 }, LOADOUT);
    expect(d.hint('core').text).toMatch(/no damage/);
  });

  it('attack cues fade from obvious to body language along each route', async () => {
    const { ROUTES } = await import('../src/rpg/expedition');
    const order = { obvious: 0, clear: 1, subtle: 2 } as const;
    for (const r of Object.values(ROUTES)) {
      const cues = r.nodes.filter((n) => n.enemies).map((n) => n.cues!);
      expect(cues[0]).toBe('obvious');
      expect(cues.at(-1)).toBe('subtle');
      for (let i = 1; i < cues.length; i++) expect(order[cues[i]]).toBeGreaterThanOrEqual(order[cues[i - 1]]);
    }
  });
});
