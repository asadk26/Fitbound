import { useEffect, useRef, useState } from 'react';
import { CombatEngine, type CombatEffect } from '../combat/CombatEngine';
import type { EnemyDef } from '../combat/enemies';
import { getExercise, type ExerciseDefinition } from '../exercise/registry';
import { ExerciseSessionController, type SessionSnapshot } from '../exercise/session';
import type { ExerciseEvent } from '../exercise/types';
import { audio } from '../game/audio';
import { bus } from '../game/bus';
import type { PlayerStats } from '../game/progression';
import { getSave } from '../game/store';
import { input } from '../input/InputHub';
import { iconDataUrl } from '../phaser/art';
import { endBattle, startBattle } from '../phaser/game';
import { tracker } from '../pose/PoseTracker';
import type { PlannedSet } from '../trial/config';
import { CameraView } from './CameraView';
import { GUIDANCE } from './guidance';
import { GestureMenu, HoldRing, useInputEvents, useMotion } from './motionUi';

/**
 * Hands-free battle for the Motion Trial. The encounter's plan decides the
 * exercises; the camera decides when each set starts (a readiness check) and
 * counts every rep. Between sets the game announces the next exercise and
 * gives a short rest that the player can cut short (right hand) or extend
 * (left hand) without touching the phone.
 */
export interface BattleResult {
  victory: boolean;
  hpLeft: number;
  reps: Record<string, { camera: number; manual: number }>;
  trackingLosses: number;
}

/** How to stand for each exercise with the phone fixed in front of you. */
export const FIXED_CAMERA_POSE: Record<string, string> = {
  pushup: 'Turn SIDEWAYS to the phone, then get down into push-up position. Arms straight to start.',
  squat: 'Stand FACING the phone, feet shoulder-width apart, whole body in view.',
  jumping_jack: 'Stand FACING the phone, arms by your sides, feet together.',
  plank: 'Turn sideways to the phone and get into a plank.',
};

type Stage = 'intro' | 'next' | 'set' | 'resolve' | 'victory';

const REST_FIRST = 5;
const REST_BETWEEN = 8;

export function AutoBattle({ enemy, plan, stats, hp, heroName, onDone }: { enemy: EnemyDef; plan: PlannedSet[]; stats: PlayerStats; hp: number; heroName: string; onDone: (r: BattleResult) => void }) {
  const [engine] = useState(() => {
    const e = new CombatEngine(enemy, stats);
    e.state.playerHp = Math.min(hp, stats.maxHp);
    return e;
  });
  const [stage, setStageState] = useState<Stage>('intro');
  const stageRef = useRef<Stage>('intro');
  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
    input.setMode(s === 'set' ? 'exercise' : 'menu');
  };
  const [planIdx, setPlanIdx] = useState(0);
  const planIdxRef = useRef(0);
  const [rest, setRest] = useState(REST_FIRST);
  const [restHeld, setRestHeld] = useState(false);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({ p: engine.state.playerHp, max: engine.state.playerMaxHp, e: engine.state.enemyHp, emax: engine.state.enemyMaxHp });
  const [flash, setFlash] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const ctrl = useRef<ExerciseSessionController | null>(null);
  const timers = useRef<number[]>([]);
  const stats$ = useRef<BattleResult>({ victory: false, hpLeft: hp, reps: {}, trackingLosses: 0 });
  const lastStage = useRef('');
  const lastCount = useRef(0);
  const wasLost = useRef(false);
  const lostCueAt = useRef(0);
  const r = useMotion();

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const current = (): ExerciseDefinition => getExercise(plan[Math.min(planIdxRef.current, plan.length - 1)].exerciseId);
  const target = () => plan[Math.min(planIdxRef.current, plan.length - 1)].target;

  const emit = (fx: CombatEffect[]) => {
    if (!fx.length) return;
    bus.emit('battle:effects', { effects: fx });
    const s = engine.state;
    setHud({ p: s.playerHp, max: s.playerMaxHp, e: s.enemyHp, emax: s.enemyMaxHp });
    for (const f of fx) if (f.kind === 'telegraph' || f.kind === 'resisted') setNote(f.text);
  };

  // Lifecycle
  useEffect(() => {
    startBattle({
      enemyId: enemy.id,
      enemyName: enemy.name,
      heroName,
      playerHp: engine.state.playerHp,
      playerMaxHp: engine.state.playerMaxHp,
      enemyHp: engine.state.enemyHp,
      enemyMaxHp: engine.state.enemyMaxHp,
      outdoor: true,
      hud: false,
    });
    input.setMode('menu');
    audio.say(enemy.intro);
    later(() => announceNext(REST_FIRST), 2400);
    const off = tracker.subscribe((f) => {
      const c = ctrl.current;
      if (!c || stageRef.current !== 'set') return;
      const sn = c.update(f.frame, f.now);
      cues(sn, f.now);
      setSnap(sn);
    });
    return () => {
      off();
      timers.current.forEach(clearTimeout);
      audio.duck(false);
      endBattle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rest countdown between sets.
  useEffect(() => {
    if (stage !== 'next' || restHeld || paused) return;
    if (rest <= 0) {
      beginSet();
      return;
    }
    const id = window.setTimeout(() => {
      if (rest <= 3) audio.countdown(false);
      setRest((x) => x - 1);
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, rest, restHeld, paused]);

  function announceNext(restS: number) {
    const ex = current();
    setRest(restS);
    setRestHeld(false);
    setNote(null);
    setStage('next');
    audio.nextExercise();
    audio.say(`Next: ${ex.name}. ${FIXED_CAMERA_POSE[ex.id] ?? ''}`);
  }

  function beginSet() {
    const ex = current();
    const s = getSave();
    const c = new ExerciseSessionController(ex, ex.createDetector!(s.settings.difficulty), target(), onExerciseEvent, { setupStuckMs: 20000, activeStuckMs: 20000 });
    ctrl.current = c;
    lastStage.current = '';
    lastCount.current = 0;
    wasLost.current = false;
    setSnap(null);
    emit(engine.beginSet(ex.id));
    if (ex.ability.effect === 'arcane') bus.emit('battle:charge', { level: 0.05, color: ex.ability.color });
    audio.duck(true);
    setStage('set');
  }

  function onExerciseEvent(ev: ExerciseEvent) {
    const fx = engine.handle(ev);
    emit(fx);
    const ex = getExercise(ev.exerciseId);
    const rec = (stats$.current.reps[ex.id] ??= { camera: 0, manual: 0 });
    if (ev.type === 'rep') {
      rec[ev.source]++;
      audio.rep(ev.index, ev.target);
      if (ev.index < ev.target) audio.say(String(ev.index));
      setFlash((f) => f + 1);
    } else if (ev.type === 'setComplete' || ev.type === 'setEnded') {
      if (ev.type === 'setComplete') {
        audio.setComplete();
        audio.say('Set complete!');
      }
      audio.duck(false);
      const completed = ev.type === 'setComplete';
      later(() => resolve(completed), completed ? 1500 : 400);
    }
  }

  function resolve(completed: boolean) {
    ctrl.current = null;
    setStage('resolve');
    if (engine.state.outcome === 'victory') {
      later(win, 1800);
      return;
    }
    later(() => {
      const fx = engine.enemyTurn();
      if (engine.state.outcome === 'defeat') {
        // The trial never ends on a knockout: shake it off and carry on.
        engine.state.outcome = 'ongoing';
        engine.state.playerHp = engine.state.playerMaxHp;
        setNote('You stumble — but the trial restores you!');
        audio.defeat();
      }
      emit(fx.filter((f) => f.kind !== 'defeat'));
      if (completed) planIdxRef.current = Math.min(planIdxRef.current + 1, plan.length - 1);
      setPlanIdx(planIdxRef.current);
      later(() => announceNext(REST_BETWEEN), 1600);
    }, 700);
  }

  function win() {
    setStage('victory');
    audio.say('Victory!');
    stats$.current.victory = true;
    stats$.current.hpLeft = engine.state.playerHp;
    later(() => onDone(stats$.current), 3200);
  }

  function cues(sn: SessionSnapshot, now: number) {
    if (sn.stage !== lastStage.current) {
      if (sn.stage === 'countdown') audio.say('Ready');
      if (sn.stage === 'active' && lastStage.current === 'countdown') {
        audio.exerciseStart();
        audio.say('Go!');
      }
      lastStage.current = sn.stage;
    }
    if (sn.stage === 'countdown') {
      const n = Math.ceil(sn.countdownLeftMs / 1000);
      if (n !== lastCount.current && n > 0) {
        lastCount.current = n;
        audio.countdown(false);
      }
    }
    const lost = sn.last?.tracking === 'lost';
    if (lost && !wasLost.current && now - lostCueAt.current > 6000 && sn.stage !== 'setup') {
      lostCueAt.current = now;
      stats$.current.trackingLosses++;
      audio.trackingLost();
      audio.say('Tracking lost. Move back into view.', false);
    }
    wasLost.current = lost;
  }

  // Gestures work between sets and while paused; never during a set.
  useInputEvents((e) => {
    if (e.type === 'pause' && stageRef.current === 'set' && !paused) {
      ctrl.current?.pause();
      setPaused(true);
      input.setMode('menu');
      audio.gesture();
      return;
    }
    if (paused) return; // the pause menu handles its own input
    if (stageRef.current === 'next') {
      if (e.type === 'confirm') {
        audio.gesture();
        beginSet();
      } else if (e.type === 'back') {
        audio.gesture();
        setRestHeld((h) => !h);
      } else if (e.type === 'pause') setPaused(true);
    }
  });

  const resume = () => {
    setPaused(false);
    if (stageRef.current === 'set') {
      input.setMode('exercise');
      ctrl.current?.resume(performance.now());
    }
  };

  const ex = current();
  const sn = snap;
  const active = sn?.stage === 'active' || sn?.stage === 'complete';
  const guidance = sn?.last?.guidance ? GUIDANCE[sn.last.guidance] : null;
  const tracking = sn?.last?.tracking ?? 'lost';
  const isBoss = plan.length > 1;

  return (
    <div className="tvb" style={{ ['--ability' as string]: ex.ability.color }}>
      <div className="tvb-top">
        <div className="tvb-hp">
          <span>{heroName}</span>
          <div className="bar">
            <i style={{ width: `${(hud.p / hud.max) * 100}%` }} />
          </div>
        </div>
        <div className="tvb-hp tvb-hp-enemy">
          <span>{enemy.name}</span>
          <div className="bar enemy">
            <i style={{ width: `${(hud.e / hud.emax) * 100}%` }} />
          </div>
        </div>
      </div>

      {stage === 'next' && !paused && (
        <div className="tvb-card">
          <div className="tvb-card-head">
            <img src={iconDataUrl(ex.ability.icon)} alt="" className="pix-icon" />
            <div>
              <small>{isBoss ? `Phase ${planIdx + 1} of ${plan.length} · ` : ''}Next exercise</small>
              <b>
                {plan[Math.min(planIdx, plan.length - 1)].target} {ex.name}
              </b>
              <span>{ex.ability.name}</span>
            </div>
            <div className="tvb-rest">{restHeld ? '❚❚' : rest}</div>
          </div>
          <p className="tvb-pose">{FIXED_CAMERA_POSE[ex.id]}</p>
          <div className="gmenu-hints">
            <HoldRing value={r?.hold.confirm ?? 0} label="start now" hand="right" />
            <HoldRing value={r?.hold.back ?? 0} label={restHeld ? 'resume timer' : 'more rest'} hand="left" />
          </div>
        </div>
      )}

      {stage === 'set' && (
        <>
          <div className="tvb-banner">
            <img src={iconDataUrl(ex.ability.icon)} alt="" className="pix-icon" />
            <b>{ex.name}</b>
            <span>{ex.ability.name}</span>
          </div>
          {sn?.stage === 'countdown' && <div className="tvb-countdown">{Math.max(1, Math.ceil(sn.countdownLeftMs / 1000))}</div>}
          {active && (
            <div className="tvb-count" key={flash}>
              {sn!.count}
              <small>/{sn!.target}</small>
            </div>
          )}
          <div className={`tvb-guide ${guidance ? '' : 'ok'}`}>
            {sn?.stage === 'setup' ? (sn.last?.ready ? 'Hold still — starting…' : (guidance ?? FIXED_CAMERA_POSE[ex.id])) : sn?.stage === 'countdown' ? 'Get ready!' : sn?.stage === 'complete' ? 'Set complete!' : (guidance ?? 'Keep going!')}
          </div>
          {sn?.manualMode && <div className="manual-badge">MANUAL COUNT · not camera-verified</div>}
        </>
      )}

      {stage === 'resolve' && note && <div className="tvb-note">{note}</div>}
      {stage === 'victory' && <div className="tvb-victory">VICTORY!</div>}

      {(stage === 'set' || stage === 'next') && (
        <CameraView className="tvb-cam" good={tracking === 'good'}>
          <span className={`cam-tag trk-${tracking}`}>{tracking === 'good' ? '● Tracking' : tracking === 'partial' ? '● Weak' : '● Not seen'}</span>
        </CameraView>
      )}

      {/* Touch controls for whoever set up the phone; never needed mid-set. */}
      <div className="tvb-touch">
        {stage === 'set' && !paused && (
          <button className="btn btn-sm btn-ghost" onClick={() => input.press('pause', 'touch')}>
            Pause
          </button>
        )}
        {stage === 'set' && sn?.fallbackAvailable && !sn.manualMode && (
          <button className="btn btn-sm btn-warn" onClick={() => ctrl.current?.enableManualMode()}>
            Count manually
          </button>
        )}
        {stage === 'set' && sn?.manualMode && (
          <button className="btn btn-big" onPointerDown={() => ctrl.current?.manualRep()}>
            +1 rep (manual)
          </button>
        )}
      </div>

      {paused && (
        <div className="tv-overlay">
          <GestureMenu
            title="Paused"
            text="Take your time. Your progress in this set is kept."
            options={[
              { id: 'resume', label: 'Resume', icon: 'star' },
              { id: 'end', label: 'End this set', detail: 'Reps so far still count', icon: 'lock' },
            ]}
            onChoose={(id) => {
              if (id === 'resume') resume();
              else {
                setPaused(false);
                ctrl.current?.stop('stopped');
              }
            }}
            onBack={resume}
          />
        </div>
      )}
    </div>
  );
}
