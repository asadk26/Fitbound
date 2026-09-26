import type { Cues } from './enemies';
import type { ExNode } from './expedition';

/**
 * Fractures and their scenarios (bible §9; proposals/foundation.md §1).
 *
 * A fracture is an era. Each fracture can have two independent scenarios:
 * role A (a first-fracture route ending with its miniboss) and role B (a
 * second-fracture route ending with its main boss). Only scenarios that have
 * been built are listed; nothing here invents placeholder content.
 *
 * An expedition is planned as [A scenario, B scenario] from two different
 * eras, then *materialised* into concrete nodes that are saved with the run,
 * so later content edits never break or shift a saved expedition.
 */
export interface Fracture {
  id: string;
  name: string;
  /** Available from the start (bible §9.4: Medieval, Prehistoric, Modern). */
  introductory?: boolean;
  /** Reignitions needed before players can reach it (the 1800s: 1, the Future: 2). */
  unlockAt?: number;
}

export interface StageDef {
  enemies: string[];
  /** Scene played before this stage begins (full the first time, short after). */
  interlude?: string;
}

export type NodeTemplate =
  | { kind: 'fight'; title: string; at: string; pool: string[][]; cues?: Cues; leg?: string; hpScale?: number; early?: boolean }
  | { kind: 'blessing' | 'mirror' | 'haven'; title?: string; at?: string; leg?: string }
  | { kind: 'boss'; title: string; at: string; stages: StageDef[]; intro?: string; cues?: Cues; leg?: string; hpScale?: number };

export interface Scenario {
  id: string;
  fracture: string;
  role: 'A' | 'B';
  title: string;
  /** Planned sets for this half of an expedition (the workout director's figure). */
  plannedSets: number;
  nodes: NodeTemplate[];
}

/** Per-scenario progress in the save: persists through wins, falls and quits. */
export interface ScenarioFlags {
  /** Expeditions (or previews) that included it. */
  met: number;
  bossReached: boolean;
  bossDefeated: boolean;
}

export interface PlanContext {
  reignitions: number;
  scenarios: Record<string, ScenarioFlags>;
  /** The last few expeditions' plans, newest first. */
  recent: string[][];
  /** Development: ignore player-facing unlocks, and allow one era's A and B together. */
  dev?: boolean;
}

/**
 * Selection weights. Starting values, meant to be tuned from play rather
 * than treated as balanced (creator, 2026-09-26).
 */
export const SELECTION = {
  /** A scenario the player has never met: shows up promptly. */
  neverMet: 3,
  /** Played in the last expedition. */
  last: 0.25,
  /** Played two expeditions ago. */
  twoAgo: 0.5,
};

/** Fractures the player can reach (player-facing unlocks; bible §9.4). */
export function reachable(f: Fracture, ctx: PlanContext): boolean {
  if (ctx.dev) return true;
  return !!f.introductory || (f.unlockAt ?? Infinity) <= ctx.reignitions;
}

export function weight(s: Scenario, ctx: PlanContext): number {
  let w = 1;
  if (!(ctx.scenarios[s.id]?.met > 0)) w *= SELECTION.neverMet;
  if (ctx.recent[0]?.includes(s.id)) w *= SELECTION.last;
  if (ctx.recent[1]?.includes(s.id)) w *= SELECTION.twoAgo;
  return w;
}

function pick<T>(items: { v: T; w: number }[], rng: () => number): T | null {
  const total = items.reduce((a, x) => a + x.w, 0);
  if (!items.length || total <= 0) return null;
  let r = rng() * total;
  for (const x of items) {
    r -= x.w;
    if (r <= 0) return x.v;
  }
  return items[items.length - 1].v;
}

/**
 * Plan an expedition: an A scenario and a B scenario from two different eras,
 * among the implemented, reachable ones. Null when no valid pair exists yet
 * (the legacy route is used then). The introductory expedition starts in
 * Medieval when its A scenario exists, with a surprise second era.
 */
export function planExpedition(scenarios: Scenario[], fractures: Fracture[], ctx: PlanContext, rng: () => number): [string, string] | null {
  const byId = new Map(fractures.map((f) => [f.id, f]));
  const ok = scenarios.filter((s) => byId.has(s.fracture) && reachable(byId.get(s.fracture)!, ctx));
  const As = ok.filter((s) => s.role === 'A');
  const Bs = ok.filter((s) => s.role === 'B');
  const pairs: { v: [string, string]; w: number }[] = [];
  for (const a of As) for (const b of Bs) if (a.fracture !== b.fracture || ctx.dev) pairs.push({ v: [a.id, b.id], w: weight(a, ctx) * weight(b, ctx) });
  if (!pairs.length) return null;
  // The introductory expedition: Medieval first, the second era a surprise among the other introductory eras.
  if (!ctx.recent.length) {
    const intro = pairs.filter((p) => p.v[0] === 'medieval.A' && byId.get(scenarios.find((s) => s.id === p.v[1])!.fracture)?.introductory);
    const chosen = pick(intro, rng);
    if (chosen) return chosen;
  }
  return pick(pairs, rng);
}

/**
 * Concrete nodes for a plan: each scenario's route, enemy groups drawn from
 * its pools, with the temporal crossing between the two halves. A one-item
 * plan is a development preview of a single scenario.
 */
export function materialize(plan: string[], scenarios: Scenario[], rng: () => number, opts: { expeditions: number }): ExNode[] {
  const out: ExNode[] = [];
  plan.forEach((id, half) => {
    const s = scenarios.find((x) => x.id === id);
    if (!s) return;
    if (half > 0) out.push({ kind: 'crossing', phase: 2, title: 'The Crossing', scenario: id });
    const phase = half === 0 ? 1 : 2;
    for (const t of s.nodes) {
      if (t.kind === 'fight') {
        if (t.early && opts.expeditions >= 3) continue;
        const group = t.pool[Math.floor(rng() * t.pool.length)];
        out.push({
          kind: 'fight',
          phase,
          title: t.title,
          enemies: [...group],
          at: t.at,
          scenario: id,
          ...(t.cues ? { cues: t.cues } : {}),
          ...(t.leg ? { leg: t.leg } : {}),
          ...(t.hpScale ? { hpScale: t.hpScale } : {}),
        });
      } else if (t.kind === 'boss') {
        out.push({
          kind: 'boss',
          phase,
          title: t.title,
          enemies: [...t.stages[0].enemies],
          at: t.at,
          scenario: id,
          boss: s.role,
          ...(t.stages.length > 1 ? { stages: t.stages.map((st) => ({ enemies: [...st.enemies], ...(st.interlude ? { interlude: st.interlude } : {}) })) } : {}),
          ...(t.intro ? { intro: t.intro } : {}),
          ...(t.cues ? { cues: t.cues } : {}),
          ...(t.leg ? { leg: t.leg } : {}),
          ...(t.hpScale ? { hpScale: t.hpScale } : {}),
        });
      } else {
        out.push({ kind: t.kind, phase, title: t.title ?? DEFAULT_TITLES[t.kind], scenario: id, ...(t.at ? { at: t.at } : {}), ...(t.leg ? { leg: t.leg } : {}) });
      }
    }
  });
  return out;
}

const DEFAULT_TITLES = { blessing: 'A Fragment Remembered', mirror: 'The Mirror of Unlived Lives', haven: 'A Quiet Haven' };

/** Planned sets for a plan (sum of its scenarios'). */
export function plannedSetsFor(plan: string[], scenarios: Scenario[]): number {
  return plan.reduce((a, id) => a + (scenarios.find((s) => s.id === id)?.plannedSets ?? 0), 0);
}
