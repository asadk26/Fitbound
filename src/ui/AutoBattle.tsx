import { useEffect, useRef, useState } from 'react';
import { CombatEngine, type CombatEffect } from '../combat/CombatEngine';
import type { EnemyDef } from '../combat/enemies';
import { getExercise, type ExerciseDefinition } from '../exercise/registry';
import { BLOCKER_TEXT, diagLines, SetDiagnostics } from '../exercise/diagnostics';
import { levelFrame } from '../exercise/level';
import { ExerciseSessionController, type SessionSnapshot } from '../exercise/session';
import type { ExerciseEvent } from '../exercise/types';
import { audio } from '../game/audio';
import { bus } from '../game/bus';
import type { PlayerStats } from '../game/progression';
import { getSave } from '../game/store';
import { input, type InputMode } from '../input/InputHub';
import { tilt } from '../input/tilt';
import { iconDataUrl } from '../phaser/art';
import { endBattle, startBattle } from '../phaser/game';
import { host } from '../net/host';
import { RemoteSet, type SetDriver } from '../net/remoteSet';
import { tracker } from '../pose/PoseTracker';
import type { PlannedSet } from '../trial/config';
import { Calibration } from './Calibration';
import { CameraView } from './CameraView';
import { ControllerStatus, RemoteCalibration, useLink } from './Connected';
import { PausableTimers } from './pausableTimers';
import { GUIDANCE } from './guidance';
import { GestureMenu, HoldRing, useInputEvents, useMotion } from './motionUi';

/**
 * Hands-free battle for the Motion Trial. The encounter's plan decides the
 * exercises; the camera decides when each set starts (a readiness check) and
 * counts every rep. Between sets the game announces the next exercise and
 * gives a short rest that the player can cut short (right hand) or extend
 * (left hand) without touching the phone.
 *
 * After each set the enemy waits until the player is ready: standing tall
 * with hands relaxed (or a Continue press). Pausing works in every phase and
 * freezes everything — timers, the set and the enemy — and the pause menu
 * can recalibrate without losing the fight's progress.
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

type Stage = 'intro' | 'next' | 'set' | 'ready' | 'resolve' | 'victory';

const MODE_FOR: Record<Stage, InputMode> = { intro: 'menu', next: 'menu', set: 'exercise', ready: 'ready', resolve: 'menu', victory: 'menu' };

/** How to pause mid-set for each exercise (see input/exercisePause.ts). */
const PAUSE_HINT: Record<string, string> = {
  pushup: 'Stand up, both hands high · pause',
  squat: 'Both hands high, hold · pause',
  jumping_jack: 'Feet together, both hands high, hold still · pause',
};

const REST_FIRST = 5;
const REST_BETWEEN = 8;

export function AutoBattle({
  enemy,
  plan,
  stats,
  hp,
  heroName,
  onDone,
  connected = false,
}: {
  enemy: EnemyDef;
  plan: PlannedSet[];
  stats: PlayerStats;
  hp: number;
  heroName: string;
  onDone: (r: BattleResult) => void;
  /** Connected Play: the phone counts reps, this page validates them. */
  connected?: boolean;
}) {
  const [engine] = useState(() => {
    const e = new CombatEngine(enemy, stats);
    e.state.playerHp = Math.min(hp, stats.maxHp);
    return e;
  });
  const [stage, setStageState] = useState<Stage>('intro');
  const stageRef = useRef<Stage>('intro');
  const pausedRef = useRef(false);
  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
    if (!pausedRef.current) input.setMode(MODE_FOR[s]);
  };
  const [planIdx, setPlanIdx] = useState(0);
  const planIdxRef = useRef(0);
  const [rest, setRest] = useState(REST_FIRST);
  const [restHeld, setRestHeld] = useState(false);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [paused, setPausedState] = useState(false);
  const [recal, setRecal] = useState(false);
  const [diag, setDiag] = useState<string[]>([]);
  const pendingCompleted = useRef(false);
  const setupSince = useRef<number | null>(null);
  const localDiag = useRef<SetDiagnostics | null>(null);
  const [hud, setHud] = useState({ p: engine.state.playerHp, max: engine.state.playerMaxHp, e: engine.state.enemyHp, emax: engine.state.enemyMaxHp });
  const [flash, setFlash] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  /** The live set: counted locally from the camera, or remotely by the phone. */
  const ctrl = useRef<SetDriver | null>(null);
  const link = useLink();
  const ctrlLost = connected && link.controller !== 'connected';
  const timers = useRef(new PausableTimers());
  const stats$ = useRef<BattleResult>({ victory: false, hpLeft: hp, reps: {}, trackingLosses: 0 });
  const lastStage = useRef('');
  const lastCount = useRef(0);
  const wasLost = useRef(false);
  const lostCueAt = useRef(0);
  const r = useMotion();

  const later = (fn: () => void, ms: number) => timers.current.later(fn, ms);
  const setPaused = (p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
    if (p) {
      timers.current.pause();
      input.setMode('menu');
    } else {
      timers.current.resume();
      input.setMode(MODE_FOR[stageRef.current]);
    }
  };
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
      if (!(c instanceof ExerciseSessionController) || stageRef.current !== 'set') return;
      // Detectors see the frame levelled by the calibrated camera roll.
      const sn = c.update(levelFrame(f.frame, input.reader.neutral?.rollDeg), f.now);
      localDiag.current?.feed(sn.last, sn.stage, f.now);
      cues(sn, f.now);
      setSnap(sn);
    });
    // Remote sets are driven by messages; refresh their view ten times a second.
    const poll = window.setInterval(() => {
      const c = ctrl.current;
      if (!(c instanceof RemoteSet) || stageRef.current !== 'set') return;
      const sn = c.snapshot();
      cues(sn, performance.now());
      setSnap(sn);
    }, 100);
    return () => {
      off();
      clearInterval(poll);
      timers.current.clear();
      input.setExercise(null);
      if (host.activeSet) {
        host.activeSet.end();
        host.activeSet = null;
      }
      audio.duck(false);
      endBattle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rest countdown between sets.
  useEffect(() => {
    if (stage !== 'next' || restHeld || paused || recal) return;
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
  }, [stage, rest, restHeld, paused, recal]);

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
    lastStage.current = '';
    lastCount.current = 0;
    wasLost.current = false;
    setupSince.current = null;
    setSnap(null);
    setDiag([]);
    input.setExercise(ex.id);
    host.lastDiag = null;
    if (connected) {
      // Switch the phone to exercise mode first, then tell it which detector to run.
      setStage('set');
      const setId = `${ex.id}-${Date.now().toString(36)}-${planIdxRef.current}`;
      const rs = new RemoteSet(setId, ex, target(), onExerciseEvent, (m) => host.send(m), s.settings.difficulty);
      host.activeSet = rs;
      ctrl.current = rs;
    } else {
      ctrl.current = new ExerciseSessionController(ex, ex.createDetector!(s.settings.difficulty), target(), onExerciseEvent, { setupStuckMs: 20000, activeStuckMs: 20000 });
      localDiag.current = new SetDiagnostics();
      setStage('set');
    }
    emit(engine.beginSet(ex.id));
    if (ex.ability.effect === 'arcane') bus.emit('battle:charge', { level: 0.05, color: ex.ability.color });
    audio.duck(true);
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
      later(() => afterSet(completed), completed ? 1500 : 400);
    }
  }

  /** The set is over. Unless the enemy fell, wait for the player to be ready. */
  function afterSet(completed: boolean) {
    const rs = ctrl.current instanceof RemoteSet ? ctrl.current : null;
    const summary = rs ? (rs.diagnostics ?? (host.lastDiag?.setId === rs.setId ? host.lastDiag.summary : null)) : (localDiag.current?.summary() ?? null);
    setDiag(summary && getSave().settings.motion.diagnostics ? diagLines(summary) : []);
    ctrl.current = null;
    localDiag.current = null;
    if (host.activeSet) host.activeSet = null;
    input.setExercise(null);
    if (engine.state.outcome === 'victory') {
      setStage('resolve');
      later(win, 1800);
      return;
    }
    pendingCompleted.current = completed;
    setStage('ready');
    audio.say('Stand tall, arms relaxed, when you are ready.');
  }

  function resolve(completed: boolean) {
    setStage('resolve');
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
    if (sn.stage === 'setup') setupSince.current ??= now;
    else setupSince.current = null;
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

  // Pause works in every phase; during a set only via that exercise's safe
  // gesture (or touch / keyboard / gamepad).
  useInputEvents((e) => {
    if (e.type === 'pause' && !pausedRef.current && stageRef.current !== 'victory') {
      if (stageRef.current === 'set') ctrl.current?.pause();
      setPaused(true);
      audio.gesture();
      return;
    }
    if (pausedRef.current) return; // the pause menu handles its own input
    if (stageRef.current === 'ready' && e.type === 'ready') {
      audio.gesture();
      resolve(pendingCompleted.current);
      return;
    }
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

  // Connected Play: if the phone drops out mid-set, freeze the set (no reps
  // can count) and the rest timer; the encounter itself is kept as it is.
  useEffect(() => {
    if (!ctrlLost || pausedRef.current) return;
    if (stageRef.current === 'set') ctrl.current?.pause();
    if (stageRef.current !== 'victory') setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlLost]);

  const canResume = !connected || (link.controller === 'connected' && host.ready);
  const resume = () => {
    if (!canResume) {
      audio.error();
      return;
    }
    setPaused(false);
    if (stageRef.current === 'set') ctrl.current?.resume(performance.now());
  };

  const startRecal = () => {
    input.calibrationKind = 'quick';
    input.setMode('calibration');
    setRecal(true);
  };
  const endRecal = () => {
    if (!connected) tilt.setReference();
    setRecal(false);
    input.setMode('menu');
    setNote('Recalibrated. Resume when you are in position.');
    audio.levelUp();
  };

  const ex = current();
  const sn = snap;
  const active = sn?.stage === 'active' || sn?.stage === 'complete';
  const guidance = sn?.last?.guidance ? GUIDANCE[sn.last.guidance] : null;
  const tracking = sn?.last?.tracking ?? 'lost';
  const isBoss = plan.length > 1;
  const blocker = sn?.last?.diag?.blocker ?? null;
  // Explain a set that won't start, once it has been stuck for a few seconds.
  const stuck = sn?.stage === 'setup' && setupSince.current !== null && performance.now() - setupSince.current > 4000;
  const pauseProgress = connected ? (host.activeSet?.pauseProgress ?? 0) : input.exercisePauseProgress;

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
            {sn?.stage === 'setup'
              ? sn.last?.ready
                ? 'Hold still — starting…'
                : stuck && blocker
                  ? `Not starting: ${BLOCKER_TEXT[blocker]}`
                  : (guidance ?? FIXED_CAMERA_POSE[ex.id])
              : sn?.stage === 'countdown'
                ? 'Get ready!'
                : sn?.stage === 'complete'
                  ? 'Set complete!'
                  : (guidance ?? 'Keep going!')}
          </div>
          {sn?.manualMode && <div className="manual-badge">MANUAL COUNT · not camera-verified</div>}
          {!paused && !sn?.manualMode && (
            <div className="tvb-pausering">
              <HoldRing value={pauseProgress} label={PAUSE_HINT[ex.id] ?? 'Stand, both hands high · pause'} hand="both" />
            </div>
          )}
        </>
      )}

      {stage === 'ready' && !paused && (
        <div className="tvb-card tvb-ready">
          <div className="tvb-card-head">
            <img src={iconDataUrl('shield')} alt="" className="pix-icon" />
            <div>
              <small>The {enemy.name} readies its move</small>
              <b>Stand tall, arms relaxed</b>
              <span>Take your time. The enemy waits until you're ready.</span>
            </div>
          </div>
          <div className="xpbar">
            <div style={{ width: `${(r?.readyProgress ?? 0) * 100}%` }} />
          </div>
          {diag.length > 0 && (
            <div className="tvb-diag">
              <b>Camera notes for that set</b>
              <ul>
                {diag.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="btn" onClick={() => input.press('ready', 'touch')}>
            Continue
          </button>
        </div>
      )}

      {(stage === 'resolve' || (paused && !recal)) && note && <div className="tvb-note">{note}</div>}
      {stage === 'victory' && <div className="tvb-victory">VICTORY!</div>}

      {(stage === 'set' || stage === 'next' || stage === 'ready') && connected && (
        <div className="tvb-cam tv-pip-ctrl">
          <ControllerStatus />
        </div>
      )}
      {(stage === 'set' || stage === 'next' || stage === 'ready') && !connected && (
        <CameraView className="tvb-cam" good={tracking === 'good'}>
          <span className={`cam-tag trk-${tracking}`}>{tracking === 'good' ? '● Tracking' : tracking === 'partial' ? '● Weak' : '● Not seen'}</span>
        </CameraView>
      )}

      {/* Touch controls for whoever set up the phone; never needed mid-set. */}
      <div className="tvb-touch">
        {stage !== 'victory' && !paused && (
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

      {paused && recal && (
        <div className="tv-overlay tv-overlay-full">
          {connected ? <RemoteCalibration kind="quick" onDone={endRecal} /> : <Calibration kind="quick" camera={{ state: 'running' }} onDone={endRecal} />}
        </div>
      )}

      {paused && !recal && (
        <div className="tv-overlay">
          <GestureMenu
            title="Paused"
            text={ctrlLost ? 'The phone controller disconnected. Your progress is kept; resume once it reconnects and can see you.' : 'Take your time. The enemy, your HP and the reps in this set are kept.'}
            options={[
              { id: 'resume', label: canResume ? 'Resume' : 'Resume (waiting for the phone…)', icon: 'star' },
              { id: 'recal', label: 'Recalibrate', detail: 'Quick; keeps the fight and your reps', icon: 'shield' },
              ...(stage === 'set' ? [{ id: 'end', label: 'End this set', detail: 'Reps so far still count', icon: 'lock' }] : []),
            ]}
            onChoose={(id) => {
              if (id === 'resume') resume();
              else if (id === 'recal') startRecal();
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
