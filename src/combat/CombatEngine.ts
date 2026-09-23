import { getExercise, type AbilityEffect } from '../exercise/registry';
import type { ExerciseEvent } from '../exercise/types';
import type { PlayerStats } from '../game/progression';
import type { DamageType, EnemyDef } from './enemies';

/**
 * Turn-based combat rules, independent of rendering and of the camera.
 *
 * The engine consumes ExerciseEvents and returns CombatEffects describing
 * what happened, which the battle scene animates. Per-rep damage is the set's
 * budget divided by the rep target, so a beginner doing 3 push-ups hits as
 * hard per *set* as an advanced player doing 8 — difficulty changes the
 * workout, not your standing in the game.
 */
export type CombatEffect =
  | { kind: 'hit'; exerciseId: string; effect: AbilityEffect; damage: number; hp: number; maxHp: number; finisher: boolean; rep?: number; target?: number; manual: boolean }
  | { kind: 'shield'; amount: number; total: number; finisher: boolean }
  | { kind: 'heal'; amount: number; hp: number; maxHp: number; finisher: boolean }
  | { kind: 'charge'; level: number }
  | { kind: 'combo'; mult: number }
  | { kind: 'resisted'; text: string }
  | { kind: 'enemyAttack'; name: string; damage: number; absorbed: number; hp: number; maxHp: number }
  | { kind: 'telegraph'; text: string }
  | { kind: 'phaseBreak'; phase: number; name: string; nextPhase: number | null }
  | { kind: 'victory' }
  | { kind: 'defeat' };

export interface BattleState {
  playerHp: number;
  playerMaxHp: number;
  shield: number;
  enemyHp: number;
  enemyMaxHp: number;
  phase: number;
  turn: number;
  lastExercise: string | null;
  veiledExercise: string | null;
  patternIndex: number;
  outcome: 'ongoing' | 'victory' | 'defeat';
  /** Reps counted per verification source, for honest reporting. */
  repsBySource: { camera: number; manual: number };
  setsCompleted: number;
}

const COMBO_MULT = 1.25;

export class CombatEngine {
  readonly state: BattleState;
  private comboThisSet = 1;

  constructor(
    readonly enemy: EnemyDef,
    private readonly stats: PlayerStats,
    private readonly rng: () => number = Math.random,
  ) {
    this.state = {
      playerHp: stats.maxHp,
      playerMaxHp: stats.maxHp,
      shield: 0,
      enemyHp: enemy.maxHp,
      enemyMaxHp: enemy.maxHp,
      phase: 0,
      turn: 1,
      lastExercise: null,
      veiledExercise: null,
      patternIndex: 0,
      outcome: 'ongoing',
      repsBySource: { camera: 0, manual: 0 },
      setsCompleted: 0,
    };
  }

  get currentPhase() {
    return this.enemy.phases?.[this.state.phase] ?? null;
  }

  /** Call when the player picks an ability, before any reps arrive. */
  beginSet(exerciseId: string): CombatEffect[] {
    const s = this.state;
    this.comboThisSet = s.lastExercise !== null && s.lastExercise !== exerciseId ? COMBO_MULT : 1;
    const out: CombatEffect[] = [];
    if (this.comboThisSet > 1) out.push({ kind: 'combo', mult: this.comboThisSet });
    return out;
  }

  handle(ev: ExerciseEvent): CombatEffect[] {
    if (this.state.outcome !== 'ongoing') return [];
    const ex = getExercise(ev.exerciseId);
    const effect = ex.ability.effect;
    const out: CombatEffect[] = [];

    switch (ev.type) {
      case 'rep': {
        this.state.repsBySource[ev.source]++;
        const manual = ev.source === 'manual';
        const t = Math.max(1, ev.target);
        if (effect === 'slash') this.damage(out, ev.exerciseId, effect, (this.stats.atk * 3) / t, 'physical', false, manual, ev.index, t);
        else if (effect === 'arcane') {
          this.damage(out, ev.exerciseId, effect, (this.stats.mag * 1) / t, 'magic', false, manual, ev.index, t);
          out.push({ kind: 'charge', level: ev.index / t });
        } else if (effect === 'shield') {
          this.addShield(out, (this.stats.def * 3) / t, false);
          // Each squat also shoves with the shield, so a squat set can win a fight.
          this.damage(out, ev.exerciseId, effect, this.stats.atk / t, 'physical', false, manual, ev.index, t);
        }
        break;
      }
      case 'holdTick': {
        if (effect === 'bulwark') this.heal(out, this.stats.maxHp * 0.05, false);
        break;
      }
      case 'setComplete': {
        this.state.setsCompleted++;
        const m = this.comboThisSet;
        if (effect === 'slash') this.damage(out, ev.exerciseId, effect, this.stats.atk * 2 * m, 'physical', true, ev.verification === 'manual');
        else if (effect === 'arcane') this.damage(out, ev.exerciseId, effect, this.stats.mag * 4 * m, 'magic', true, ev.verification === 'manual');
        else if (effect === 'shield') {
          this.addShield(out, this.stats.def * 1.5, true);
          this.damage(out, ev.exerciseId, effect, this.stats.atk * 1.5 * m, 'physical', true, ev.verification === 'manual');
        } else if (effect === 'bulwark') {
          this.heal(out, this.stats.maxHp * 0.25, true);
          this.addShield(out, this.stats.def * 2, true);
        }
        this.breakPhaseIfRequired(out, ev.exerciseId);
        this.state.lastExercise = ev.exerciseId;
        break;
      }
      case 'setEnded': {
        if (ev.completed > 0) this.state.lastExercise = ev.exerciseId;
        break;
      }
    }
    this.checkVictory(out);
    return out;
  }

  /** The enemy acts. Call after the player's set has finished. */
  enemyTurn(): CombatEffect[] {
    const s = this.state;
    const out: CombatEffect[] = [];
    if (s.outcome !== 'ongoing') return out;

    const phase = this.currentPhase;
    const move = phase ? { ...phase.attack, telegraph: undefined, veil: false } : this.enemy.pattern[s.patternIndex % this.enemy.pattern.length];
    s.patternIndex++;

    if (move.veil) s.veiledExercise = s.lastExercise;

    if (move.mult > 0) {
      const variance = 0.9 + this.rng() * 0.2;
      const raw = Math.max(1, Math.round(this.enemy.atk * move.mult * variance));
      const absorbed = Math.min(s.shield, raw);
      s.shield -= absorbed;
      const dmg = raw - absorbed;
      s.playerHp = Math.max(0, s.playerHp - dmg);
      out.push({ kind: 'enemyAttack', name: move.name, damage: dmg, absorbed, hp: s.playerHp, maxHp: s.playerMaxHp });
    }
    if (move.telegraph) out.push({ kind: 'telegraph', text: move.telegraph });

    if (!phase) {
      const next = this.enemy.pattern[s.patternIndex % this.enemy.pattern.length];
      if (next.telegraph && !move.telegraph) out.push({ kind: 'telegraph', text: next.telegraph });
    }

    if (s.playerHp <= 0) {
      s.outcome = 'defeat';
      out.push({ kind: 'defeat' });
    }
    s.turn++;
    return out;
  }

  private damage(
    out: CombatEffect[],
    exerciseId: string,
    effect: AbilityEffect,
    raw: number,
    type: DamageType,
    finisher: boolean,
    manual: boolean,
    rep?: number,
    target?: number,
  ): void {
    const s = this.state;
    let mult = 1 - this.enemy.resist[type];
    if (s.veiledExercise === exerciseId) {
      mult *= 0.5;
      if (finisher) out.push({ kind: 'resisted', text: 'The Shadow Veil dulls it! Switch exercises.' });
    }
    const phase = this.currentPhase;
    if (phase && phase.required !== exerciseId) {
      mult *= phase.offTypeMultiplier;
      if (finisher) out.push({ kind: 'resisted', text: `${phase.name} resists! Use ${getExercise(phase.required).ability.name}.` });
    }
    const dmg = Math.max(1, Math.round(raw * mult));
    const floor = this.phaseFloor();
    s.enemyHp = Math.max(floor, s.enemyHp - dmg);
    out.push({ kind: 'hit', exerciseId, effect, damage: dmg, hp: s.enemyHp, maxHp: s.enemyMaxHp, finisher, rep, target, manual });
    // Chip damage can also wear a phase down: the required exercise is the
    // fast path, never a hard lock.
    if (phase && s.enemyHp <= floor && floor > 0) this.advancePhase(out);
  }

  private breakPhaseIfRequired(out: CombatEffect[], exerciseId: string): void {
    const phase = this.currentPhase;
    if (!phase || phase.required !== exerciseId) return;
    const floor = this.phaseFloor();
    this.state.enemyHp = floor;
    if (floor > 0) this.advancePhase(out);
  }

  private advancePhase(out: CombatEffect[]): void {
    const s = this.state;
    const phases = this.enemy.phases!;
    const broken = s.phase;
    s.phase = Math.min(s.phase + 1, phases.length - 1);
    s.veiledExercise = null;
    out.push({ kind: 'phaseBreak', phase: broken, name: phases[broken].name, nextPhase: s.phase === broken ? null : s.phase });
  }

  /** Lowest HP the enemy can reach in its current phase. */
  private phaseFloor(): number {
    const phases = this.enemy.phases;
    if (!phases) return 0;
    const n = phases.length;
    return Math.round((this.enemy.maxHp * (n - 1 - this.state.phase)) / n);
  }

  private addShield(out: CombatEffect[], amount: number, finisher: boolean): void {
    const s = this.state;
    const cap = Math.round(s.playerMaxHp * 0.6);
    const a = Math.max(1, Math.round(amount));
    s.shield = Math.min(cap, s.shield + a);
    out.push({ kind: 'shield', amount: a, total: s.shield, finisher });
  }

  private heal(out: CombatEffect[], amount: number, finisher: boolean): void {
    const s = this.state;
    const a = Math.max(1, Math.round(amount));
    s.playerHp = Math.min(s.playerMaxHp, s.playerHp + a);
    out.push({ kind: 'heal', amount: a, hp: s.playerHp, maxHp: s.playerMaxHp, finisher });
  }

  private checkVictory(out: CombatEffect[]): void {
    if (this.state.enemyHp <= 0 && this.state.outcome === 'ongoing') {
      this.state.outcome = 'victory';
      out.push({ kind: 'victory' });
    }
  }
}
