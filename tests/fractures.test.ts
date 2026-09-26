import { describe, expect, it } from 'vitest';
import { RpgEngine } from '../src/rpg/engine';
import { newExpedition, sanitizeExpedition, routeNodes, currentNode } from '../src/rpg/expedition';
import { materialize, planExpedition, reachable, SELECTION, weight, type Fracture, type PlanContext, type Scenario } from '../src/rpg/fractures';
import { DEFAULT_PREFS, generateLoadout } from '../src/rpg/loadout';
import { rng } from '../src/testing/poses';

// Made-up content: the architecture must not depend on what has been built.
const F: Fracture[] = [
  { id: 'medieval', name: 'Medieval', introductory: true },
  { id: 'prehistoric', name: 'Prehistoric', introductory: true },
  { id: 'modern', name: 'Modern', introductory: true },
  { id: '1800s', name: 'The 1800s', unlockAt: 1 },
];
const sc = (id: string, fracture: string, role: 'A' | 'B'): Scenario => ({
  id,
  fracture,
  role,
  title: id,
  plannedSets: role === 'A' ? 11 : 12,
  nodes: [
    { kind: 'fight', title: `${id} fight`, at: 'dummyStop', pool: [['iron_husk'], ['bone_charger']] },
    { kind: 'fight', title: `${id} warm-up`, at: 'signStop', pool: [['echo_dummy']], early: true },
    { kind: 'blessing' },
    { kind: 'boss', title: `${id} boss`, at: 'warden', stages: [{ enemies: ['iron_husk'] }, { enemies: ['bone_charger'], interlude: `${id}.rise` }], intro: `${id}.intro` },
  ],
});
const ctx = (p: Partial<PlanContext> = {}): PlanContext => ({ reignitions: 0, scenarios: {}, recent: [], ...p });

describe('fracture selection', () => {
  it('with no valid two-era pair there is no plan (the legacy route plays)', () => {
    expect(planExpedition([], F, ctx(), rng(1))).toBeNull();
    expect(planExpedition([sc('medieval.A', 'medieval', 'A')], F, ctx(), rng(1))).toBeNull();
    // One era's A and B together only in development.
    const both = [sc('medieval.A', 'medieval', 'A'), sc('medieval.B', 'medieval', 'B')];
    expect(planExpedition(both, F, ctx(), rng(1))).toBeNull();
    expect(planExpedition(both, F, ctx({ dev: true }), rng(1))).toEqual(['medieval.A', 'medieval.B']);
  });

  it('two different eras, each in a role that exists; roles are independent', () => {
    const all = [sc('medieval.A', 'medieval', 'A'), sc('prehistoric.B', 'prehistoric', 'B'), sc('modern.A', 'modern', 'A'), sc('modern.B', 'modern', 'B')];
    const r = rng(4);
    for (let i = 0; i < 200; i++) {
      const p = planExpedition(all, F, ctx({ recent: [['x']] }), r)!;
      expect(p[0].endsWith('.A') && p[1].endsWith('.B')).toBe(true);
      expect(p[0].split('.')[0]).not.toBe(p[1].split('.')[0]);
    }
    // A B scenario can come up without its era's A ever having been met.
    const seen = new Set(Array.from({ length: 200 }, () => planExpedition(all, F, ctx({ recent: [['x']] }), r)![1]));
    expect(seen.has('prehistoric.B')).toBe(true);
  });

  it('the introductory expedition starts in Medieval, with a surprise introductory era second', () => {
    const all = [sc('medieval.A', 'medieval', 'A'), sc('modern.A', 'modern', 'A'), sc('prehistoric.B', 'prehistoric', 'B'), sc('modern.B', 'modern', 'B'), sc('1800s.B', '1800s', 'B')];
    const r = rng(9);
    const seconds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const p = planExpedition(all, F, ctx({ reignitions: 1 }), r)!;
      expect(p[0]).toBe('medieval.A');
      seconds.add(p[1]);
    }
    expect([...seconds].sort()).toEqual(['modern.B', 'prehistoric.B']);
  });

  it('eras unlock for players by reignitions; development ignores that', () => {
    expect(reachable(F[3], ctx())).toBe(false);
    expect(reachable(F[3], ctx({ reignitions: 1 }))).toBe(true);
    expect(reachable(F[3], ctx({ dev: true }))).toBe(true);
    const all = [sc('1800s.A', '1800s', 'A'), sc('prehistoric.B', 'prehistoric', 'B')];
    expect(planExpedition(all, F, ctx({ recent: [['x']] }), rng(2))).toBeNull();
    expect(planExpedition(all, F, ctx({ recent: [['x']], reignitions: 1 }), rng(2))).toEqual(['1800s.A', 'prehistoric.B']);
  });

  it('never-met scenarios come up promptly and recent ones step back (tunable weights)', () => {
    const s = sc('modern.A', 'modern', 'A');
    expect(weight(s, ctx())).toBe(SELECTION.neverMet);
    expect(weight(s, ctx({ scenarios: { 'modern.A': { met: 2, bossReached: true, bossDefeated: false } }, recent: [['modern.A']] }))).toBe(SELECTION.last);
    const all = [sc('medieval.A', 'medieval', 'A'), sc('modern.A', 'modern', 'A'), sc('prehistoric.B', 'prehistoric', 'B')];
    const met = { 'medieval.A': { met: 5, bossReached: true, bossDefeated: true }, 'prehistoric.B': { met: 5, bossReached: true, bossDefeated: true } };
    const r = rng(12);
    let fresh = 0;
    for (let i = 0; i < 400; i++) if (planExpedition(all, F, ctx({ scenarios: met, recent: [['medieval.A', 'prehistoric.B']] }), r)![0] === 'modern.A') fresh++;
    expect(fresh / 400).toBeGreaterThan(0.85);
  });
});

describe('materialised routes', () => {
  const all = [sc('medieval.A', 'medieval', 'A'), sc('prehistoric.B', 'prehistoric', 'B')];
  it('A then the crossing then B; enemies drawn from pools; early nodes only early on', () => {
    const nodes = materialize(['medieval.A', 'prehistoric.B'], all, rng(3), { expeditions: 0 });
    expect(nodes.map((n) => n.kind)).toEqual(['fight', 'fight', 'blessing', 'boss', 'crossing', 'fight', 'fight', 'blessing', 'boss']);
    expect(nodes[0].phase).toBe(1);
    expect(nodes[4]).toMatchObject({ kind: 'crossing', title: 'The Stillpoint', phase: 2 });
    expect(nodes[3]).toMatchObject({ boss: 'A', intro: 'medieval.A.intro', enemies: ['iron_husk'], stages: [{ enemies: ['iron_husk'] }, { enemies: ['bone_charger'], interlude: 'medieval.A.rise' }] });
    expect(['iron_husk', 'bone_charger']).toContain(nodes[0].enemies![0]);
    const later = materialize(['medieval.A', 'prehistoric.B'], all, rng(3), { expeditions: 5 });
    expect(later.filter((n) => n.title.endsWith('warm-up'))).toHaveLength(0);
  });

  it('a saved route is the run’s own: content edits skip what no longer resolves, never the whole run', () => {
    const lo = generateLoadout(DEFAULT_PREFS, {}, [], rng(1));
    const x = newExpedition('standard', DEFAULT_PREFS, lo, {});
    x.plan = ['medieval.A', 'prehistoric.B'];
    x.nodes = materialize(x.plan, all, rng(3), { expeditions: 0 });
    x.index = 6;
    const ok = sanitizeExpedition(structuredClone(x))!;
    expect(routeNodes(ok)).toHaveLength(9);
    expect(currentNode(ok)!.title).toBe(x.nodes[6].title);
    // An enemy removed from the game: that fight (before the current node) is skipped and the index follows.
    const edited = structuredClone(x);
    edited.nodes![0].enemies = ['no_longer_exists'];
    const back = sanitizeExpedition(edited)!;
    expect(routeNodes(back)).toHaveLength(8);
    expect(currentNode(back)!.title).toBe(x.nodes[6].title);
  });
});

describe('staged bosses', () => {
  it('the next stage keeps the hero, cooldowns and charge; the fight goes on', () => {
    const e = new RpgEngine(['echo_dummy'], { hp: 70, maxHp: 100 }, { upper: 'sunder', legs: 'quake', cardio: 'arc', core: 'aegis' }, {});
    e.useAbility('cardio', { done: 10, target: 10, sided: false, full: true });
    e.useAbility('upper', { done: 10, target: 10, sided: false, full: true });
    expect(e.outcome).toBe('victory');
    const before = { hp: e.hero.hp, charge: e.hero.charge, cool: { ...e.cooldowns } };
    const added = e.nextStage(['bone_charger']);
    expect(e.outcome).toBe('ongoing');
    expect(added.map((f) => f.def.id)).toEqual(['bone_charger']);
    expect(e.living.map((f) => f.def.id)).toEqual(['bone_charger']);
    expect({ hp: e.hero.hp, charge: e.hero.charge, cool: e.cooldowns }).toEqual(before);
    // The save of a staged fight restores at the right stage.
    const snap = e.snapshot();
    expect(RpgEngine.restore(snap, {}, {})!.living.map((f) => f.def.id)).toEqual(['bone_charger']);
  });
});

describe('the built content', () => {
  it('Medieval A is valid: known enemies, known stops, its scenes registered', async () => {
    const { SCENARIOS, FRACTURES } = await import('../src/rpg/scenarios');
    const { RPG_ENEMIES } = await import('../src/rpg/enemies');
    const { NODES } = await import('../src/phaser/diorama/trailGraph');
    const { INTERLUDES, interludeLines } = await import('../src/story/interludes');
    const { FIGURES } = await import('../src/phaser/diorama/figures');
    const stops = new Set(NODES.map((n) => n.id));
    for (const s of SCENARIOS) {
      expect(FRACTURES.some((f) => f.id === s.fracture)).toBe(true);
      for (const n of materialize([s.id], SCENARIOS, () => 0, { expeditions: 0 })) {
        for (const e of [...(n.enemies ?? []), ...(n.stages ?? []).flatMap((st) => st.enemies)]) {
          expect(RPG_ENEMIES[e], e).toBeTruthy();
          expect(FIGURES[RPG_ENEMIES[e].sprite], RPG_ENEMIES[e].sprite).toBeTruthy();
        }
        if (n.at) expect(stops.has(n.at), n.at).toBe(true);
        for (const id of [n.intro, ...(n.stages ?? []).map((st) => st.interlude)].filter(Boolean) as string[]) {
          expect(INTERLUDES[id], id).toBeTruthy();
          expect(interludeLines(id, []).length).toBeGreaterThan(interludeLines(id, [id]).length);
        }
      }
    }
    const a = SCENARIOS.find((s) => s.id === 'medieval.A')!;
    const boss = materialize([a.id], SCENARIOS, () => 0, { expeditions: 0 }).find((n) => n.kind === 'boss')!;
    expect(boss.stages!.map((st) => st.enemies)).toEqual([['green_knight'], ['green_knight_headless']]);
  });

  it('with only Medieval A built, new expeditions stay on the legacy route', async () => {
    const { SCENARIOS, FRACTURES } = await import('../src/rpg/scenarios');
    expect(planExpedition(SCENARIOS, FRACTURES, ctx(), rng(1))).toBeNull();
    expect(planExpedition(SCENARIOS, FRACTURES, ctx({ dev: true }), rng(1))).toBeNull();
  });
});
