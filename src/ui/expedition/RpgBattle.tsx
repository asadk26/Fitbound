import { useEffect, useRef, useState } from 'react';
import { BLOCKER_TEXT } from '../../exercise/diagnostics';
import { FAMILIES, FAMILY_INFO, getExercise, targetLabel, type Family } from '../../exercise/registry';
import type { SessionSnapshot } from '../../exercise/session';
import type { Difficulty } from '../../exercise/types';
import { audio } from '../../game/audio';
import { bus, type RpgFoeView } from '../../game/bus';
import { input, type InputMode } from '../../input/InputHub';
import { tilt } from '../../input/tilt';
import { host } from '../../net/host';
import { iconDataUrl } from '../../phaser/art';
import { endRpgBattle, startRpgBattle } from '../../phaser/game';
import { blessing } from '../../rpg/blessings';
import { STRIKE_TIMING, StrikeTimer } from '../../rpg/dodge';
import { RpgEngine, type Foe, type PendingStrike, type RpgFx, type SetWork } from '../../rpg/engine';
import type { Cues } from '../../rpg/enemies';
import { abilityLoadout } from '../../rpg/expedition';
import type { ExLoadout } from '../../rpg/loadout';
import { Calibration } from '../Calibration';
import { CameraView } from '../CameraView';
import { ControllerStatus, RemoteCalibration, useLink } from '../Connected';
import { GUIDANCE } from '../guidance';
import { GestureMenu, HoldRing, useInputEvents, useMotion } from '../motionUi';
import { PausableTimers } from '../pausableTimers';
import { DodgeSource } from './dodgeSource';
import { SetRunner, type SetResult } from './setRunner';

/**
 * One expedition fight.
 *
 *   choose   pick one of four ability cards (menus: no body tracking needed)
 *   set      do the movement; "Finish set" resolves early with what's verified
 *   resolve  the ability lands
 *   ready    stand tall (or press Continue) — nothing attacks until you do
 *   enemy    foes act; any attacks become strikes to dodge
 *   dodge    HIGH → duck, LOW → hop; out of view the attack waits for you
 *
 * Enemy attacks never happen during a set. After a floor exercise there is
 * extra time to get up before the first strike.
 */
export type BattleStage = 'intro' | 'choose' | 'set' | 'resolve' | 'ready' | 'enemy' | 'dodge' | 'victory' | 'defeat';

const MODE_FOR: Record<BattleStage, InputMode> = { intro: 'menu', choose: 'menu', set: 'exercise', resolve: 'menu', ready: 'ready', enemy: 'menu', dodge: 'dodge', victory: 'menu', defeat: 'menu' };

export interface FightResult {
  outcome: 'victory' | 'defeat';
  hp: number;
  /** Movements used here for the first time on this setup. */
  firstChecks: string[];
}

export interface RpgBattleProps {
  enemies: string[];
  hpScale?: number;
  title: string;
  boss?: boolean;
  hero: { hp: number; maxHp: number };
  loadout: ExLoadout;
  target: (exerciseId: string) => number;
  blessings: string[];
  connected: boolean;
  difficulty: Difficulty;
  dodgeInput: 'body' | 'controller';
  /** How plainly attacks announce themselves in this fight. */
  cues: Cues;
  /** First fight of a run: explain how to read attacks (on screen, once). */
  tutorial?: boolean;
  onDodgeInput: (d: 'body' | 'controller') => void;
  onSet: (r: SetResult) => void;
  onDodge: (o: 'dodged' | 'hit' | 'unclear', detail: { h: 'high' | 'low'; cues: string }) => void;
  onDone: (r: FightResult) => void;
  onLeave: () => void;
}

/** Foes charge across this long before impact (the stance is readable well before). */
const APPROACH_MS = 650;

interface StrikeView {
  i: number;
  n: number;
  s: PendingStrike;
  left: number;
  waiting: string | null;
  result: string | null;
}

const view = (f: Foe): RpgFoeView => ({ uid: f.uid, sprite: f.def.sprite, tint: f.def.tint, scale: f.def.scale, name: f.def.name });

export function RpgBattle(p: RpgBattleProps) {
  const [engine] = useState(() => {
    const e = new RpgEngine(p.enemies, p.hero, abilityLoadout(p.loadout), { blessings: p.blessings });
    if (p.hpScale && p.hpScale !== 1) for (const f of e.foes) f.hp = f.maxHp = Math.round(f.maxHp * p.hpScale);
    return e;
  });
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);
  const [stage, setStageState] = useState<BattleStage>('intro');
  const stageRef = useRef<BattleStage>('intro');
  const [sel, setSel] = useState(0);
  const selRef = useRef(0);
  const [family, setFamily] = useState<Family | null>(null);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [recal, setRecal] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [strike, setStrikeState] = useState<StrikeView | null>(null);
  const strikeRef = useRef<StrikeView | null>(null);
  const setStrike = (v: StrikeView | null) => {
    strikeRef.current = v;
    setStrikeState(v);
  };
  const [floorRest, setFloorRest] = useState(false);
  const timers = useRef(new PausableTimers());
  const runner = useRef<SetRunner | null>(null);
  const dodge = useRef(new DodgeSource(p.connected));
  const strikes = useRef<PendingStrike[]>([]);
  const timer = useRef<StrikeTimer | null>(null);
  const firstChecks = useRef<string[]>([]);
  const lastSetFloor = useRef(false);
  const link = useLink();
  const r = useMotion();
  const ctrlLost = p.connected && link.controller !== 'connected';
  const props = useRef(p);
  props.current = p;

  const later = (fn: () => void, ms: number) => timers.current.later(fn, ms);
  const setStage = (s: BattleStage) => {
    stageRef.current = s;
    setStageState(s);
    if (!pausedRef.current) input.setMode(MODE_FOR[s]);
  };
  const fx = (list: RpgFx[], foes?: RpgFoeView[]) => {
    if (list.length || foes?.length) bus.emit('rpg:fx', { fx: list, foes });
    for (const f of list) if (f.kind === 'enemyAct') setNote(f.text);
    // The in-world HUD follows once the animations have played.
    window.setTimeout(pushStatus, foes?.length ? 500 : 0);
    refresh();
  };
  const pushStatus = () =>
    bus.emit('rpg:foes', {
      foes: engine.foes.map((f) => ({ uid: f.uid, hp: f.hp, maxHp: f.maxHp, ward: f.ward, armor: f.armor, intent: intentText(engine, f), charging: !!f.charging || engine.shownIntent(f).kind === 'charge', staggered: f.staggered })),
    });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    startRpgBattle({ foes: engine.foes.map(view), heroHp: engine.hero.hp, heroMaxHp: engine.hero.maxHp, backdrop: p.boss ? 'dungeon' : 'meadow', boss: !!p.boss });
    window.setTimeout(pushStatus, 900);
    input.setMode('menu');
    const first = engine.foes[0].def;
    setNote(first.tip);
    audio.say(`${first.intro} ${first.tip}`);
    later(() => toChoose(), 3000);
    return () => {
      timers.current.clear();
      runner.current?.dispose();
      dodge.current.stop();
      if (strikeLoop.current !== null) clearInterval(strikeLoop.current);
      input.setExercise(null);
      endRpgBattle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usable = (): Family[] => FAMILIES.filter((f) => engine.available(f));

  function toChoose() {
    const u = usable();
    const cur = FAMILIES[selRef.current];
    if (!u.includes(cur)) {
      const i = FAMILIES.indexOf(u[0] ?? 'upper');
      selRef.current = i;
      setSel(i);
    }
    setFamily(null);
    setSnap(null);
    setStage('choose');
    audio.nextExercise();
  }

  // ── Player turn ─────────────────────────────────────────────────────────
  function pick(f: Family) {
    if (!engine.available(f) || stageRef.current !== 'choose') {
      audio.error();
      return;
    }
    const slot = p.loadout[f]!;
    const ex = getExercise(slot.exerciseId);
    const target = p.target(ex.id);
    setFamily(f);
    setNote(null);
    lastSetFloor.current = ex.floor;
    if (slot.firstCheck && !firstChecks.current.includes(ex.id)) firstChecks.current.push(ex.id);
    const rn = new SetRunner({
      connected: p.connected,
      difficulty: p.difficulty,
      onSnap: (sn) => setSnap(sn),
      onEvent: (e) => {
        if (e.type === 'rep') {
          audio.rep(e.index, e.target);
          if (!ex.sided && e.index < e.target) audio.say(String(e.index), false);
        }
      },
      onEnd: (res) => afterSet(f, res),
    });
    runner.current = rn;
    setStage('set');
    rn.begin(ex, target);
    audio.duck(true);
    audio.say(`${engine.abilityFor(f).name}. ${targetLabel(ex, target)} ${ex.name}. ${ex.camera.instructions[0] ?? ''}`);
  }

  function afterSet(f: Family, res: SetResult) {
    runner.current = null;
    audio.duck(false);
    props.current.onSet(res);
    const ex = getExercise(res.exerciseId);
    const work: SetWork = { done: res.done, target: res.target, sided: ex.sided, sides: res.sides, full: res.full };
    if (res.full) {
      audio.setComplete();
      audio.say('Set complete!');
    } else if (res.done > 0) audio.say(`Finished. ${res.done} ${ex.kind === 'hold' ? 'seconds' : ''} counted.`);
    setStage('resolve');
    fx(engine.useAbility(f, work));
    later(() => {
      if (engine.outcome === 'victory') return win();
      setStage('ready');
      setFloorRest(ex.floor);
      audio.say(ex.floor ? 'Take your time getting up. Stand tall when you are ready.' : 'Stand tall, arms relaxed, when you are ready.');
    }, 1800);
  }

  // ── Enemy turn ──────────────────────────────────────────────────────────
  function enemyTurn() {
    setStage('enemy');
    const before = new Set(engine.foes.map((f) => f.uid));
    const t = engine.startEnemyTurn();
    const added = engine.foes.filter((f) => !before.has(f.uid)).map(view);
    fx(t.fx, added);
    strikes.current = t.strikes;
    later(() => {
      if (engine.outcome === 'victory') return win();
      if (t.strikes.length) {
        dodge.current.start();
        setStage('dodge');
        runStrike(0);
      } else endTurn();
    }, Math.min(2600, 700 + t.fx.length * 350));
  }

  const strikeLoop = useRef<number | null>(null);
  function runStrike(i: number) {
    const s = strikes.current[i];
    if (!s) return endTurn();
    const controller = props.current.dodgeInput === 'controller';
    // Extra wind-up for the first strike after a floor exercise.
    const timing = { ...STRIKE_TIMING, telegraphMs: STRIKE_TIMING.telegraphMs + (i === 0 && lastSetFloor.current ? 1200 : 0) };
    const st = new StrikeTimer(s.height, timing, controller);
    timer.current = st;
    const cues = props.current.cues;
    // Purely visual: the foe's wind-up is the cue (no spoken calls).
    bus.emit('rpg:strike', { uid: s.from, height: s.height, phase: 'telegraph', cues });
    let swung = false;
    let charging = false;
    if (strikeLoop.current !== null) clearInterval(strikeLoop.current);
    strikeLoop.current = window.setInterval(() => {
      if (pausedRef.current) return;
      const now = performance.now();
      const smp = controller ? null : dodge.current.sample(now);
      let waiting: string | null = null;
      if (!controller) {
        if (!smp || smp.tracking !== 'good') waiting = 'Step into view — the attack waits for you (or Pause → Dodge with a controller)';
        else if (!smp.baseline) waiting = 'Stand still for a moment…';
        if (smp) bus.emit('rpg:pose', { duck: smp.duck, airborne: smp.airborne });
      }
      // Until a standing baseline exists nothing can count, so the clock holds.
      const res = !controller && smp && !smp.baseline && st.state !== 'window' ? null : st.update(now, controller ? null : smp ? { tracking: smp.tracking, ducking: smp.ducking, hops: smp.hops } : { tracking: 'lost', ducking: false, hops: 0 });
      if (!charging && st.impactIn <= APPROACH_MS && st.state === 'window') {
        charging = true;
        bus.emit('rpg:strike', { uid: s.from, height: s.height, phase: 'approach', cues, ms: st.impactIn });
      }
      if (!swung && st.impactIn <= 0) {
        swung = true;
        bus.emit('rpg:strike', { uid: s.from, height: s.height, phase: 'swing' });
      }
      setStrike({ i, n: strikes.current.length, s, left: Math.max(0, st.impactIn), waiting: st.state === 'window' ? null : waiting, result: null });
      if (!res) return;
      clearInterval(strikeLoop.current!);
      strikeLoop.current = null;
      if (!swung) bus.emit('rpg:strike', { uid: s.from, height: s.height, phase: 'swing' });
      props.current.onDodge(res, { h: s.height, cues: String(cues) });
      fx(engine.resolveStrike(s, res));
      setStrike({ i, n: strikes.current.length, s, left: 0, waiting: null, result: res });
      later(() => {
        bus.emit('rpg:strike', { uid: s.from, height: s.height, phase: 'clear' });
        if (engine.outcome === 'defeat') return lose();
        if (engine.outcome === 'victory') return win();
        runStrike(i + 1);
      }, 1100);
    }, 50);
  }

  function endTurn() {
    dodge.current.stop();
    setStrike(null);
    fx(engine.endEnemyTurn());
    if (engine.outcome === 'defeat') return lose();
    toChoose();
  }

  function win() {
    setStage('victory');
    later(() => props.current.onDone({ outcome: 'victory', hp: engine.hero.hp, firstChecks: firstChecks.current }), 2600);
  }

  function lose() {
    setStage('defeat');
    later(() => props.current.onDone({ outcome: 'defeat', hp: 0, firstChecks: firstChecks.current }), 2800);
  }

  // ── Pause / recalibrate ─────────────────────────────────────────────────
  const setPaused = (v: boolean) => {
    pausedRef.current = v;
    setPausedState(v);
    if (v) {
      timers.current.pause();
      runner.current?.pause();
      input.setMode('menu');
    } else {
      timers.current.resume();
      input.setMode(MODE_FOR[stageRef.current]);
      runner.current?.resume();
      // A strike interrupted by the pause starts over with a fresh wind-up.
      const cur = strikeRef.current;
      if (stageRef.current === 'dodge' && cur && !cur.result) {
        dodge.current.start();
        runStrike(cur.i);
      }
    }
  };
  const canResume = !p.connected || (link.controller === 'connected' && host.cameraReady);
  const resume = () => {
    if (!canResume) return audio.error();
    setPaused(false);
  };
  const startRecal = () => {
    if (!pausedRef.current) setPaused(true);
    input.calibrationKind = 'quick';
    input.setMode('calibration');
    setRecal(true);
  };
  const endRecal = () => {
    if (!p.connected) tilt.setReference();
    setRecal(false);
    input.setMode('menu');
    setNote('Recalibrated. Resume when you are in position.');
    audio.levelUp();
  };

  // Phone dropped: freeze everything; the fight is kept.
  useEffect(() => {
    if (ctrlLost && !pausedRef.current && stageRef.current !== 'victory' && stageRef.current !== 'defeat') setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlLost]);

  // ── Input ───────────────────────────────────────────────────────────────
  useInputEvents((e) => {
    const st = stageRef.current;
    if (e.type === 'recalibrate' && !recal && st !== 'victory' && st !== 'defeat') {
      audio.gesture();
      return startRecal();
    }
    if (e.type === 'pause' && !pausedRef.current && st !== 'victory' && st !== 'defeat') {
      audio.gesture();
      return setPaused(true);
    }
    if (e.type === 'finish' && runner.current?.running) {
      audio.gesture();
      if (pausedRef.current) {
        pausedRef.current = false;
        setPausedState(false);
        timers.current.resume();
      }
      runner.current.finish();
      return;
    }
    if (pausedRef.current) {
      if (e.type === 'resume' && !recal) resume();
      return;
    }
    if (st === 'choose') {
      if (e.type === 'nav') {
        const u = usable();
        if (!u.length) return;
        const order = FAMILIES.filter((f) => u.includes(f));
        const cur = order.indexOf(FAMILIES[selRef.current]);
        const next = order[(cur + e.dir + order.length) % order.length];
        selRef.current = FAMILIES.indexOf(next);
        setSel(selRef.current);
        audio.select();
      } else if (e.type === 'confirm') pick(FAMILIES[selRef.current]);
    } else if (st === 'ready' && e.type === 'ready') {
      audio.gesture();
      setFloorRest(false);
      enemyTurn();
    } else if (st === 'dodge' && (e.type === 'duck' || e.type === 'hop')) {
      timer.current?.press(e.type, performance.now());
    }
  });

  // ── Render ──────────────────────────────────────────────────────────────
  const h = engine.hero;
  const physical = stage === 'set' || stage === 'ready' || stage === 'dodge';
  const ex = family ? getExercise(p.loadout[family]!.exerciseId) : null;
  const tracking = snap?.last?.tracking ?? 'lost';

  return (
    <div className="rpg">
      <div className="rpg-party">
        <small>{p.title}</small>
        <b>Hero</b>
        <div className="bar">
          <i style={{ width: `${(h.hp / h.maxHp) * 100}%` }} />
        </div>
        <span className="rpg-stats">
          ♥ {h.hp}/{h.maxHp}
          {h.shield > 0 && <span className="rpg-shield"> ◆ {h.shield}</span>}
          {h.charge > 0 && <span className="rpg-charge"> ⚡{'•'.repeat(h.charge)}</span>}
          {h.counter > 0 && <span className="rpg-counter"> ↺</span>}
        </span>
        {p.blessings.length > 0 && (
          <span className="rpg-bless">
            {p.blessings.map((b) => (
              <img key={b} src={iconDataUrl(blessing(b).icon)} alt={blessing(b).name} title={`${blessing(b).name}: ${blessing(b).text}`} className="pix-icon" />
            ))}
          </span>
        )}
      </div>

      {stage === 'choose' && !paused && (
        <div className="rpg-cmd">
          {FAMILIES.map((fam, i) => {
            const slot = p.loadout[fam];
            if (!slot)
              return (
                <div key={fam} className="rpg-cmd-item off">
                  <b>{FAMILY_INFO[fam].name} · resting</b>
                </div>
              );
            const a = engine.abilityFor(fam);
            const e2 = getExercise(slot.exerciseId);
            const ready = engine.available(fam);
            const hint = engine.hint(fam);
            return (
              <button
                key={fam}
                className={`rpg-cmd-item ${i === sel ? 'sel' : ''} ${ready ? '' : 'cool'} hint-${hint.level}`}
                style={{ ['--fam' as string]: a.color }}
                onClick={() => pick(fam)}
                onPointerMove={(ev) => (ev.movementX || ev.movementY) && ready && ((selRef.current = i), setSel(i))}
              >
                <span className="rpg-cmd-row">
                  <img src={iconDataUrl(a.icon)} alt="" className="pix-icon" />
                  <b>{a.name}</b>
                  {ready && hint.level === 'strong' && <span className="rpg-cmd-star">★</span>}
                  {!ready && <span className="rpg-cmd-cd">recharging</span>}
                </span>
                {i === sel && (
                  <>
                    <span className="rpg-cmd-ex">
                      {targetLabel(e2, p.target(e2.id))} · {e2.name}
                      {slot.firstCheck ? ' · first-time check' : ''}
                    </span>
                    <span className="rpg-cmd-role">
                      {a.role}
                      {hint.text ? ` — ${hint.text}` : ''}
                    </span>
                  </>
                )}
              </button>
            );
          })}
          <div className="rpg-cmd-hint">
            <span className="hint-chip">◀ ▶ / lean to choose</span>
            <HoldRing value={r?.hold.confirm ?? 0} label="use" hand="right" />
          </div>
        </div>
      )}

      {stage === 'set' && ex && (
        <div className="rpg-set">
          <div className="rpg-set-head">
            <small>{engine.abilityFor(family!).name}</small>
            <b>{ex.name}</b>
          </div>
          {snap && (snap.stage === 'active' || snap.stage === 'complete') ? (
            <div className="tvb-count">
              {ex.kind === 'hold' ? Math.floor(snap.heldMs / 1000) : snap.count}
              <small>/{snap.target}{ex.kind === 'hold' ? 's' : ''}</small>
            </div>
          ) : snap?.stage === 'countdown' ? (
            <div className="tvb-countdown">{Math.max(1, Math.ceil(snap.countdownLeftMs / 1000))}</div>
          ) : (
            <div className="rpg-prepare">Step into view when ready — {ex.camera.instructions[0]}</div>
          )}
          {ex.sided && snap?.sides && (
            <div className="rpg-sides">
              <span className={snap.sides.left >= snap.target ? 'done' : ''}>Left {snap.sides.left}/{snap.target}</span>
              <span className={snap.sides.right >= snap.target ? 'done' : ''}>Right {snap.sides.right}/{snap.target}</span>
            </div>
          )}
          <div className={`tvb-guide ${snap?.last?.guidance ? '' : 'ok'}`}>
            {snap?.stage === 'setup'
              ? snap.last?.diag?.blocker
                ? `Not starting: ${BLOCKER_TEXT[snap.last.diag.blocker]}`
                : snap.last?.guidance
                  ? GUIDANCE[snap.last.guidance]
                  : 'Get into position'
              : snap?.last?.guidance
                ? GUIDANCE[snap.last.guidance]
                : 'Keep going — or say “Finish set” when you’ve had enough'}
          </div>
          {snap?.manualMode && <div className="manual-badge">MANUAL COUNT · not camera-verified</div>}
          <div className="rpg-set-actions">
            <button className="btn btn-sm" onClick={() => runner.current?.finish()}>
              Finish set (F · Y)
            </button>
            {snap?.fallbackAvailable && !snap.manualMode && (
              <button className="btn btn-sm btn-warn" onClick={() => runner.current?.enableManual()}>
                Count manually
              </button>
            )}
            {snap?.manualMode && ex.kind === 'reps' && (
              <button className="btn btn-sm" onPointerDown={() => runner.current?.manualRep()}>
                +1 (manual)
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'ready' && !paused && (
        <div className="tvb-card tvb-ready rpg-readycard">
          <div className="tvb-card-head">
            <img src={iconDataUrl('shield')} alt="" className="pix-icon" />
            <div>
              <small>Your foes ready themselves</small>
              <b>{floorRest ? 'Take your time getting up' : 'Stand tall, arms relaxed'}</b>
              <span>Nothing attacks until you’re ready. Then watch how they move.</span>
            </div>
          </div>
          <div className="xpbar">
            <div style={{ width: `${(r?.readyProgress ?? 0) * 100}%` }} />
          </div>
          <button className="btn" onClick={() => input.press('ready', 'touch')}>
            I’m ready (A · Enter)
          </button>
        </div>
      )}

      {stage === 'dodge' && strike && !paused && strike.waiting && !strike.result && <div className="rpg-waitchip">{strike.waiting}</div>}
      {stage === 'dodge' && strike && !paused && p.tutorial && !strike.result && !strike.waiting && (
        <div className="rpg-tip">
          Watch the enemy. <b>Rearing up</b> → duck. <b>Crouching low</b> → a small hop.
          {p.dodgeInput === 'controller' ? ' (Controller: ▼ duck · ▲ / A hop)' : ''}
        </div>
      )}

      {(stage === 'intro' || stage === 'enemy' || stage === 'resolve') && note && <div className="tvb-note">{note}</div>}

      {physical && p.connected && (
        <div className="tvb-cam tv-pip-ctrl">
          <ControllerStatus />
        </div>
      )}
      {physical && !p.connected && (
        <CameraView className="tvb-cam" good={tracking === 'good'}>
          <span className={`cam-tag trk-${tracking}`}>{tracking === 'good' ? '● Tracking' : tracking === 'partial' ? '● Weak' : '● Not seen'}</span>
        </CameraView>
      )}

      <div className="tvb-touch">
        {stage !== 'victory' && stage !== 'defeat' && !paused && (
          <button className="btn btn-sm btn-ghost" onClick={() => input.press('pause', 'touch')}>
            Pause
          </button>
        )}
      </div>

      {paused && recal && (
        <div className="tv-overlay tv-overlay-full">{p.connected ? <RemoteCalibration kind="quick" onDone={endRecal} /> : <Calibration kind="quick" camera={{ state: 'running' }} onDone={endRecal} />}</div>
      )}

      {paused && !recal && (
        <div className="tv-overlay">
          <GestureMenu
            title="Paused"
            text={ctrlLost ? 'The phone controller disconnected. The fight is kept; resume once it reconnects.' : 'The fight, your HP and this set’s reps are kept. Say “Resume” or choose below.'}
            options={[
              { id: 'resume', label: canResume ? 'Resume' : 'Resume (waiting for the phone…)', icon: 'star' },
              ...(runner.current?.running ? [{ id: 'finish', label: 'Finish this set', detail: 'Verified reps so far power the ability', icon: 'sword' }] : []),
              { id: 'recal', label: 'Recalibrate', detail: 'Quick; keeps the fight', icon: 'shield' },
              { id: 'dodge', label: p.dodgeInput === 'body' ? 'Dodge with a controller' : 'Dodge with your body', detail: p.dodgeInput === 'body' ? 'For couch play: ▼ duck, ▲ / A hop' : 'Duck and hop in front of the camera', icon: 'wind' },
              { id: 'leave', label: 'Leave expedition', detail: 'Saves your run as it was before this fight', icon: 'lock' },
            ]}
            onChoose={(id) => {
              if (id === 'resume') resume();
              else if (id === 'finish') {
                setPaused(false);
                runner.current?.finish();
              } else if (id === 'recal') startRecal();
              else if (id === 'dodge') p.onDodgeInput(p.dodgeInput === 'body' ? 'controller' : 'body');
              else if (id === 'leave') p.onLeave();
            }}
            onBack={resume}
          />
        </div>
      )}
    </div>
  );
}

/** What a foe will do next, for the in-world HUD. Never reveals high or low. */
function intentText(engine: RpgEngine, f: Foe): string {
  if (f.staggered) return 'STAGGERED';
  const i = engine.shownIntent(f);
  switch (i.kind) {
    case 'attack':
      return f.charging ? 'CHARGED!' : i.strikes.length > 1 ? `ATTACK x${i.strikes.length}` : 'ATTACK';
    case 'charge':
      return 'WINDING UP';
    case 'ward':
      return 'WARD';
    case 'armor':
      return 'HARDEN';
    case 'summon':
      return 'SUMMON';
    case 'rest':
      return '…';
  }
}
