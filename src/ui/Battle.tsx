import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { CombatEngine, type CombatEffect } from '../combat/CombatEngine';
import { ENEMIES } from '../combat/enemies';
import { getExercise, isPlayable, targetFor, type ExerciseDefinition } from '../exercise/registry';
import { ExerciseSessionController, type SessionSnapshot } from '../exercise/session';
import type { ExerciseEvent, GuidanceCode } from '../exercise/types';
import { audio } from '../game/audio';
import { bus } from '../game/bus';
import { levelForXp, statsFor, unlocksAtLevel, type PlayerStats } from '../game/progression';
import { getSave, updateSave } from '../game/store';
import { iconDataUrl } from '../phaser/art';
import { endBattle, startBattle } from '../phaser/game';
import { preloadPose, tracker, TrackerError } from '../pose/PoseTracker';
import { ExercisePanel, type CameraStatus } from './ExercisePanel';
import { SPOKEN } from './guidance';
import { useSave } from './useSave';

export type BattleOutcome = 'victory' | 'defeat' | 'fled';

type Mode = 'intro' | 'menu' | 'exercise' | 'resolving' | 'transition' | 'victory' | 'defeat';

export interface Rewards {
  xp: number;
  gold: number;
  xpBefore: number;
  levelBefore: number;
  levelAfter: number;
  statsBefore: PlayerStats;
  statsAfter: PlayerStats;
  unlocked: ExerciseDefinition[];
  bossCleared: boolean;
  cameraReps: number;
  manualReps: number;
}

interface Props {
  enemyId: string;
  onExit: (outcome: BattleOutcome, rewards?: Rewards) => void;
}

const TRANSITION_S = 15;

/** Exposes the live session snapshot to browser automation when ?debug is set. */
function debugHook(v: object): void {
  const fb = (window as unknown as { __fb?: Record<string, unknown> }).__fb;
  if (fb) Object.assign(fb, v);
}

export function Battle({ enemyId, onExit }: Props) {
  const save = useSave();
  const enemy = ENEMIES[enemyId];
  const [engine] = useState(() => {
    const s = getSave();
    return new CombatEngine(enemy, statsFor(levelForXp(s.xp), s.upgrades));
  });
  const [mode, setModeState] = useState<Mode>('intro');
  const modeRef = useRef<Mode>('intro');
  const setMode = (m: Mode) => {
    modeRef.current = m;
    setModeState(m);
  };
  const [exercise, setExercise] = useState<ExerciseDefinition | null>(null);
  const ctrlRef = useRef<ExerciseSessionController | null>(null);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [camera, setCamera] = useState<CameraStatus>({ state: tracker.active ? 'running' : 'idle' });
  const rawRef = useRef<NormalizedLandmark[] | null>(null);
  const [message, setMessage] = useState(enemy.tip);
  const [transitionLeft, setTransitionLeft] = useState(TRANSITION_S);
  const [transitionPaused, setTransitionPaused] = useState(false);
  const [manualHold, setManualHold] = useState(false);
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [hp, setHp] = useState({ p: engine.state.playerHp, max: engine.state.playerMaxHp, shield: 0, e: engine.state.enemyHp, emax: engine.state.enemyMaxHp });
  const phaseBroke = useRef(false);
  const timers = useRef<number[]>([]);
  const lastStage = useRef<string>('');
  const lastCount = useRef(-1);
  const lastSpoken = useRef<{ code: GuidanceCode | null; at: number }>({ code: null, at: 0 });
  const committed = useRef(false);
  const heldSeconds = useRef(0);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const snapRef = useRef<SessionSnapshot | null>(null);
  snapRef.current = snap;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const syncHp = () => {
    const s = engine.state;
    setHp({ p: s.playerHp, max: s.playerMaxHp, shield: s.shield, e: s.enemyHp, emax: s.enemyMaxHp });
  };

  const emitFx = (fx: CombatEffect[]) => {
    if (!fx.length) return;
    bus.emit('battle:effects', { effects: fx });
    for (const f of fx) {
      if (f.kind === 'phaseBreak') phaseBroke.current = true;
      if (f.kind === 'telegraph' || f.kind === 'resisted') setMessage(f.text);
    }
    syncHp();
  };

  // ── Battle lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSave();
    startBattle({
      enemyId,
      heroName: s.heroName,
      playerHp: engine.state.playerHp,
      playerMaxHp: engine.state.playerMaxHp,
      enemyHp: engine.state.enemyHp,
      enemyMaxHp: engine.state.enemyMaxHp,
    });
    preloadPose(s.settings.model);
    audio.say(enemy.intro);
    later(() => setMode('menu'), 1800);

    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request('screen')
      .then((l) => (wakeLock.current = l))
      .catch(() => {});

    tracker.onFrame(({ frame, raw, now, fps }) => {
      rawRef.current = raw;
      const c = ctrlRef.current;
      if (!c || modeRef.current !== 'exercise') return;
      const sn = c.update(frame, now);
      setSnap(sn);
      debugHook({ snap: sn, now });
      setCamera((cs) => (cs.state === 'running' && Math.abs((cs.fps ?? 0) - fps) < 2 ? cs : { state: 'running', fps }));
      cueAudio(sn, now);
    });

    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      tracker.onFrame(null);
      tracker.stop();
      wakeLock.current?.release().catch(() => {});
      audio.duck(false);
      endBattle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual mode / no camera: tick the session without camera frames.
  useEffect(() => {
    if (mode !== 'exercise') return;
    const id = window.setInterval(() => {
      const c = ctrlRef.current;
      if (!c) return;
      const s = snapRef.current;
      if (s?.manualMode || camera.state === 'error') {
        const sn = c.update(null, performance.now());
        setSnap(sn);
        cueAudio(sn, performance.now());
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, camera.state]);

  // Boss phase transition countdown.
  useEffect(() => {
    if (mode !== 'transition' || transitionPaused) return;
    const id = window.setInterval(() => {
      setTransitionLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [mode, transitionPaused]);

  useEffect(() => {
    if (mode !== 'transition') return;
    if (transitionLeft > 0 && transitionLeft <= 3) audio.countdown(false);
    const req = engine.currentPhase?.required;
    if (transitionLeft === 0 && req) chooseAbility(getExercise(req));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, transitionLeft]);

  // ── Audio cues while exercising ─────────────────────────────────────────
  function cueAudio(sn: SessionSnapshot, now: number) {
    if (sn.stage !== lastStage.current) {
      if (sn.stage === 'countdown') {
        audio.say('Ready');
        lastCount.current = 3;
        audio.countdown(false);
      }
      if (sn.stage === 'active' && lastStage.current === 'countdown') {
        audio.countdown(true);
        audio.say(ctrlRef.current?.isHold ? 'Hold!' : 'Go!');
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
    const code = sn.last?.guidance ?? null;
    const spoken = code ? SPOKEN[code] : undefined;
    if (spoken && sn.stage !== 'complete' && (code !== lastSpoken.current.code || now - lastSpoken.current.at > 6000) && now - lastSpoken.current.at > 2500) {
      lastSpoken.current = { code, at: now };
      audio.say(spoken, false);
    }
  }

  // ── Exercise events → combat ────────────────────────────────────────────
  const onExerciseEvent = (ev: ExerciseEvent) => {
    const fx = engine.handle(ev);
    emitFx(fx);
    if (ev.type === 'rep') {
      audio.rep(ev.index, ev.target);
      if (ev.index < ev.target) audio.say(String(ev.index));
    } else if (ev.type === 'holdTick') {
      heldSeconds.current += 5;
      const left = Math.round((ev.targetMs - ev.heldMs) / 1000);
      audio.say(`${left} seconds`);
    } else if (ev.type === 'setComplete' || ev.type === 'setEnded') {
      if (ev.type === 'setComplete') audio.say(ev.verification === 'camera' ? 'Set complete!' : 'Set complete.');
      audio.duck(false);
      later(finishSet, ev.type === 'setComplete' ? 1700 : 500);
    }
  };

  const ensureCamera = async () => {
    if (tracker.active) {
      setCamera({ state: 'running' });
      return;
    }
    setCamera({ state: 'starting' });
    try {
      await tracker.start(getSave().settings.model);
      setCamera({ state: 'running' });
    } catch (e) {
      const msg = e instanceof TrackerError ? e.message : String(e);
      setCamera({ state: 'error', message: msg });
      ctrlRef.current?.markCameraUnavailable();
      if (ctrlRef.current) setSnap(ctrlRef.current.update(null, performance.now()));
    }
  };

  const chooseAbility = (ex: ExerciseDefinition) => {
    if (!isPlayable(ex)) return;
    const s = getSave();
    audio.unlock();
    audio.select();
    const target = targetFor(ex, s.settings.difficulty, s.settings.targetAdjust);
    const detector = ex.createDetector!(s.settings.difficulty);
    const ctrl = new ExerciseSessionController(ex, detector, target, onExerciseEvent);
    if (cameraRef.current.state === 'error') ctrl.markCameraUnavailable();
    ctrlRef.current = ctrl;
    lastStage.current = '';
    setManualHold(false);
    setSnap(null);
    emitFx(engine.beginSet(ex.id));
    if (ex.ability.effect === 'arcane') bus.emit('battle:charge', { level: 0.05, color: ex.ability.color });
    setExercise(ex);
    setMode('exercise');
    audio.duck(true);
    audio.say(`${ex.ability.name}. ${ex.kind === 'hold' ? `Hold a ${ex.name.toLowerCase()} for ${target} seconds.` : `${target} ${ex.name.toLowerCase()}.`} ${ex.camera.view === 'side' ? 'Turn sideways to the camera.' : 'Face the camera, whole body in view.'}`);
    void ensureCamera();
  };

  function finishSet() {
    ctrlRef.current = null;
    setExercise(null);
    setSnap(null);
    if (engine.state.outcome === 'victory') {
      setMode('resolving');
      later(win, 2400);
      return;
    }
    setMode('resolving');
    later(() => {
      const fx = engine.enemyTurn();
      emitFx(fx);
      later(
        () => {
          if (engine.state.outcome === 'defeat') {
            setMode('defeat');
            return;
          }
          if (enemy.phases && phaseBroke.current) {
            phaseBroke.current = false;
            const phase = engine.currentPhase!;
            setMessage(phase.intro);
            setTransitionLeft(TRANSITION_S);
            setTransitionPaused(false);
            setMode('transition');
            const next = getExercise(phase.required);
            audio.say(`${phase.intro} Next: ${next.name}. Take a breath and reposition your phone.`);
            return;
          }
          setMode('menu');
        },
        fx.length ? 1300 : 200,
      );
    }, 800);
  }

  const commitTotals = () => {
    if (committed.current) return;
    committed.current = true;
    const r = engine.state.repsBySource;
    updateSave((s) => {
      s.totals.cameraReps += r.camera;
      s.totals.manualReps += r.manual;
      s.totals.holdSeconds += heldSeconds.current;
    });
  };

  function win() {
    commitTotals();
    const before = getSave();
    const levelBefore = levelForXp(before.xp);
    const isBoss = !!enemy.phases;
    const after = updateSave((s) => {
      s.xp += enemy.xp;
      s.gold += enemy.gold;
      if (enemy.id !== 'dummy' && !s.defeated.includes(enemy.id)) s.defeated.push(enemy.id);
      s.totals.battlesWon++;
      if (isBoss) s.clears++;
    });
    const levelAfter = levelForXp(after.xp);
    const unlocked: ExerciseDefinition[] = [];
    for (let l = levelBefore + 1; l <= levelAfter; l++) unlocked.push(...unlocksAtLevel(l));
    // Auto-equip newly unlocked, playable abilities while there's room.
    const playableNew = unlocked.filter(isPlayable);
    if (playableNew.length) {
      updateSave((s) => {
        for (const ex of playableNew) if (s.loadout.length < 4 && !s.loadout.includes(ex.id)) s.loadout.push(ex.id);
      });
    }
    setRewards({
      xp: enemy.xp,
      gold: enemy.gold,
      xpBefore: before.xp,
      levelBefore,
      levelAfter,
      statsBefore: statsFor(levelBefore, before.upgrades),
      statsAfter: statsFor(levelAfter, after.upgrades),
      unlocked,
      bossCleared: isBoss,
      cameraReps: engine.state.repsBySource.camera,
      manualReps: engine.state.repsBySource.manual,
    });
    setMode('victory');
    if (levelAfter > levelBefore) later(() => audio.levelUp(), 900);
  }

  const flee = () => {
    commitTotals();
    audio.select();
    onExit('fled');
  };

  // ── Menu contents ───────────────────────────────────────────────────────
  const phase = engine.currentPhase;
  const menuAbilities = useMemo(() => {
    const ids = [...save.loadout];
    if (phase && !ids.includes(phase.required)) ids.push(phase.required);
    return ids.map(getExercise).filter(isPlayable);
  }, [save.loadout, phase]);

  const difficulty = save.settings.difficulty;

  return (
    <>
      {mode === 'menu' && (
        <div className="sheet battle-menu">
      <div className="battle-hud">
            <div className="hud-chip">
              HP {hp.p}/{hp.max}
              {hp.shield > 0 && <span className="shield-chip"> +{hp.shield} shield</span>}
            </div>
            <div className="hud-chip">
              {enemy.name} {hp.e}/{hp.emax}
              {phase && <span className="phase-chip"> · {phase.name}</span>}
            </div>
          </div>
          <p className="battle-msg">{message}</p>
          <div className="ability-grid">
            {menuAbilities.map((ex) => {
              const t = targetFor(ex, difficulty, save.settings.targetAdjust);
              const weak = phase?.required === ex.id;
              const combo = engine.state.lastExercise !== null && engine.state.lastExercise !== ex.id;
              const veiled = engine.state.veiledExercise === ex.id;
              return (
                <button key={ex.id} className={`ability ${weak ? 'ability-weak' : ''}`} style={{ ['--ability' as string]: ex.ability.color }} onClick={() => chooseAbility(ex)}>
                  <img src={iconDataUrl(ex.ability.icon)} alt="" className="pix-icon" />
                  <span className="ability-name">{ex.ability.name}</span>
                  <span className="ability-ex">
                    {ex.kind === 'hold' ? `${ex.name} ${t}s` : `${t} ${ex.name}`}
                  </span>
                  {weak && <span className="tag tag-gold">Weak point</span>}
                  {!weak && combo && <span className="tag">Combo ×1.25</span>}
                  {veiled && <span className="tag tag-dim">Veiled −50%</span>}
                </button>
              );
            })}
          </div>
          <div className="row">
            <span className="rest-note">Take your time — rest as long as you like between sets.</span>
            <button className="btn btn-ghost" onClick={flee}>
              Retreat
            </button>
          </div>
        </div>
      )}

      {mode === 'transition' && phase && (
        <div className="sheet transition">
          <h3>{phase.name}</h3>
          <p>{phase.intro}</p>
          <div className="next-ex">
            <img src={iconDataUrl(getExercise(phase.required).ability.icon)} alt="" className="pix-icon" />
            <div>
              <b>Next: {getExercise(phase.required).name}</b>
              <span>{getExercise(phase.required).camera.view === 'side' ? 'Turn sideways to the camera.' : 'Face the camera, whole body in view.'}</span>
            </div>
            <div className="big-timer">{transitionPaused ? '❚❚' : transitionLeft}</div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => chooseAbility(getExercise(phase.required))}>
              Start now
            </button>
            <button className="btn btn-ghost" onClick={() => setTransitionPaused((p) => !p)}>
              {transitionPaused ? 'Resume countdown' : 'I need more rest'}
            </button>
            <button className="btn btn-ghost" onClick={() => setMode('menu')}>
              Choose ability
            </button>
          </div>
        </div>
      )}

      {mode === 'exercise' && exercise && (
        <ExercisePanel
          exercise={exercise}
          snap={snap}
          camera={camera}
          rawRef={rawRef}
          showSkeleton={save.settings.showSkeleton}
          manualHoldRunning={manualHold}
          onPause={() => {
            const c = ctrlRef.current;
            if (!c) return;
            c.pause();
            setSnap(c.update(null, performance.now()));
          }}
          onResume={() => {
            const c = ctrlRef.current;
            if (!c) return;
            c.resume(performance.now());
            setSnap(c.update(null, performance.now()));
          }}
          onStop={() => ctrlRef.current?.stop('stopped')}
          onManual={() => {
            const c = ctrlRef.current;
            if (!c) return;
            c.enableManualMode();
            setSnap(c.update(null, performance.now()));
          }}
          onManualRep={() => {
            const c = ctrlRef.current;
            if (!c) return;
            c.manualRep();
            setSnap(c.update(null, performance.now()));
          }}
          onManualHold={(run) => {
            ctrlRef.current?.setManualHold(run);
            setManualHold(run);
          }}
        />
      )}

      {mode === 'defeat' && (
        <div className="modal-back">
          <div className="modal">
            <h2>Worn out</h2>
            <p>You fought well. There is no penalty — you keep all your experience. Rest up at the inn and come back when you’re ready.</p>
            <button
              className="btn btn-big"
              onClick={() => {
                commitTotals();
                onExit('defeat');
              }}
            >
              Return to the village
            </button>
          </div>
        </div>
      )}

      {mode === 'victory' && rewards && <VictoryModal rewards={rewards} enemyName={enemy.name} onDone={() => onExit('victory', rewards)} />}
    </>
  );
}

function VictoryModal({ rewards, enemyName, onDone }: { rewards: Rewards; enemyName: string; onDone: () => void }) {
  const leveled = rewards.levelAfter > rewards.levelBefore;
  const [showLevel, setShowLevel] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShowLevel(true), 900);
    return () => clearTimeout(t);
  }, []);
  const d = (k: keyof PlayerStats) => rewards.statsAfter[k] - rewards.statsBefore[k];
  return (
    <div className="modal-back">
      <div className="modal victory">
        <h2 className="shine">{rewards.bossCleared ? 'The Warden Falls!' : 'Victory!'}</h2>
        <p>
          {enemyName} defeated.
          {rewards.bossCleared && ' Light floods the Hollow Deep and the corruption lifts from Maplebrook.'}
        </p>
        <div className="reward-row">
          <span className="reward">+{rewards.xp} XP</span>
          <span className="reward gold">+{rewards.gold} gold</span>
        </div>
        <p className="verify-note">
          This battle: {rewards.cameraReps} camera-verified reps{rewards.manualReps ? `, ${rewards.manualReps} counted manually` : ''}.
        </p>
        {leveled && showLevel && (
          <div className="levelup">
            <div className="levelup-title">LEVEL UP! Lv {rewards.levelAfter}</div>
            <div className="levelup-stats">
              <span>HP +{d('maxHp')}</span>
              <span>ATK +{d('atk')}</span>
              <span>DEF +{d('def')}</span>
              <span>MAG +{d('mag')}</span>
            </div>
          </div>
        )}
        {showLevel &&
          rewards.unlocked.map((ex) => (
            <div key={ex.id} className="unlock-card">
              <img src={iconDataUrl(ex.ability.icon)} alt="" className="pix-icon" />
              <div>
                <b>New ability: {ex.ability.name}</b>
                <span>
                  {ex.name}
                  {isPlayable(ex) ? ' — equipped if you had a free slot. Manage it under Abilities.' : ' — camera detector still in development, so it can’t be equipped yet.'}
                </span>
              </div>
            </div>
          ))}
        <button className="btn btn-big" onClick={onDone}>
          Continue
        </button>
      </div>
    </div>
  );
}
