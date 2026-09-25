import { useEffect, useMemo, useRef, useState } from 'react';
import { bus } from '../game/bus';
import { audio } from '../game/audio';
import { levelForXp, statsFor, type PlayerStats } from '../game/progression';
import { getSave, updateSave } from '../game/store';
import { GamepadInput } from '../input/gamepad';
import { input, type InputMode } from '../input/InputHub';
import { motionPreset } from '../input/motion';
import { tilt } from '../input/tilt';
import { host } from '../net/host';
import { iconDataUrl } from '../phaser/art';
import { travel } from '../phaser/diorama/travel';
import { setDioramaState, showScene } from '../phaser/game';
import { tracker, TrackerError } from '../pose/PoseTracker';
import { BOONS, encounterPlan, parseTargets, trialEnemy, type TrialEnemy } from '../trial/config';
import { AutoBattle, type BattleResult } from './AutoBattle';
import { Calibration } from './Calibration';
import { CameraView } from './CameraView';
import { ControllerLost, ControllerStatus, RemoteCalibration, useLink } from './Connected';
import { GestureMenu, HoldRing, MotionMeter, useInputEvents, useMotion } from './motionUi';
import { useSave } from './useSave';

/**
 * The Motion Trial: place the phone once, calibrate, then play a short
 * adventure with your body.
 *
 *   Part 1 (exploration): march to the banner, on to the training dummy
 *   (strike it), then the signpost (accept the trial). With Guided
 *   Traversal the trail leads there; a fork offers a detour to a shrine.
 *   Part 2 (combat): the Skeleton, then the Golem and the Mage in whichever
 *   order you choose at the fork, then the Warden.
 *
 * Pause works from every phase: both hands up while standing, the touch
 * Pause button, P on the keyboard, or Start on a gamepad.
 */
type Stage = 'calibrate' | 'explore' | 'dialog' | 'battle' | 'reward' | 'summary';

interface Objective {
  id: string;
  title: string;
  hint: { guided: string; free: string };
  target: string;
  interact?: string;
  prompt?: string;
  /** Guardians to defeat (any order) before the objective is complete. */
  enemies?: TrialEnemy[];
}

export const OBJECTIVES: Objective[] = [
  { id: 'banner', title: 'March to the banner', hint: { guided: 'March in place — lift your knees — and the trail carries you there.', free: 'March in place — lift your knees — to walk forward.' }, target: 'banner' },
  { id: 'dummy', title: 'Visit the training dummy', hint: { guided: 'Keep marching. The trail leads you there.', free: 'Keep marching and lean left or right to turn.' }, target: 'dummy', interact: 'dummy', prompt: 'strike the dummy' },
  { id: 'signpost', title: 'Read the signpost by the gate', hint: { guided: 'March on. At the fork, lean toward the path you want.', free: 'Follow the trail. Lean to steer.' }, target: 'signpost', interact: 'signpost', prompt: 'read the sign' },
  { id: 'skeleton', title: 'Face the Skeleton', hint: { guided: 'March through the gate. Push-ups ahead!', free: 'Walk up to it. Push-ups ahead!' }, target: 'skeleton', enemies: ['skeleton'] },
  { id: 'pair', title: 'Face the Golem and the Mage', hint: { guided: 'At the fork, lean to choose who to face first.', free: 'Walk up to either: the Golem (squats) or the Mage (jumping jacks).' }, target: 'golem', enemies: ['golem', 'mage'] },
  { id: 'warden', title: 'Challenge the Dungeon Warden', hint: { guided: 'The final guardian: push-ups, squats and jumping jacks.', free: 'The final guardian: push-ups, squats and jumping jacks.' }, target: 'warden', enemies: ['warden'] },
];

interface Log {
  startedAt: number;
  calibratedAt: number | null;
  exploreSteps: number;
  gestures: number;
  floorOk: boolean;
  trackingLosses: number;
  reps: Record<string, { camera: number; manual: number }>;
  partTimes: Record<string, number>;
}

type Choice = { prompt: string; options: { dir: -1 | 1; label: string; detail: string; icon: string }[] };

const MODE_FOR: Record<Stage, InputMode | null> = { calibrate: 'calibration', explore: 'explore', dialog: 'dialogue', reward: 'menu', summary: 'menu', battle: null };

/** Switch Active ⇄ Assisted traversal (keeps the run and its rewards). */
export function toggleTraversal(): void {
  updateSave((s) => void (s.settings.motion.traversal = s.settings.motion.traversal === 'active' ? 'assisted' : 'active'));
  const t = getSave().settings.motion.traversal;
  audio.select();
  audio.say(t === 'active' ? 'Active traversal. March to move.' : 'Assisted traversal. Use the controller to move.', false);
}

export function TrialRun({ onExit, connected = false }: { onExit: () => void; /** Connected Play: a phone is the controller. */ connected?: boolean }) {
  const save = useSave();
  const targets = useMemo(() => parseTargets(location.search, getSave().settings.trialTargets), []);
  const [stage, setStageState] = useState<Stage>('calibrate');
  const stageRef = useRef<Stage>('calibrate');
  const [camera, setCamera] = useState<{ state: string; message?: string }>({ state: 'starting' });
  const [obj, setObj] = useState(0);
  const objRef = useRef(0);
  const [near, setNear] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [defeated, setDefeated] = useState<string[]>([]);
  const defeatedRef = useRef<string[]>([]);
  const [enemyId, setEnemyId] = useState<TrialEnemy | null>(null);
  const [bonus, setBonus] = useState({ atk: 0, def: 0, mag: 0 });
  const [hp, setHp] = useState<number | null>(null);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [lostBanner, setLostBanner] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejoining, setRejoining] = useState(false);
  const [shrineUsed, setShrineUsed] = useState(false);
  const [tiltMoved, setTiltMoved] = useState(false);
  const calKind = useRef<'full' | 'quick'>('full');
  const log = useRef<Log>({ startedAt: Date.now(), calibratedAt: null, exploreSteps: 0, gestures: 0, floorOk: false, trackingLosses: 0, reps: {}, partTimes: {} });
  const r = useMotion();
  const link = useLink();
  const ctrlLost = connected && link.controller !== 'connected';
  const guided = save.settings.motion.navigation === 'guided';
  const assisted = guided && save.settings.motion.traversal === 'assisted';

  const stats: PlayerStats = useMemo(() => {
    const s = statsFor(levelForXp(save.xp), save.upgrades);
    return { ...s, atk: s.atk + bonus.atk, def: s.def + bonus.def, mag: s.mag + bonus.mag };
  }, [save.xp, save.upgrades, bonus]);

  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
    if (s === 'calibrate') input.calibrationKind = calKind.current;
    const m = MODE_FOR[s];
    if (m && !pausedRef.current) input.setMode(m);
  };

  const setPaused = (p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
    if (p) input.setMode('menu');
    else {
      const m = MODE_FOR[stageRef.current];
      if (m) input.setMode(m);
    }
  };

  const flash = (text: string, ms = 2600) => {
    setNotice(text);
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), ms);
  };

  // Camera + motion input for the whole session.
  useEffect(() => {
    showScene('Diorama', { attract: false });
    travel.reset();
    input.reader.configure(motionPreset(getSave().settings.motion));
    let offFeed = () => {};
    if (connected) {
      // The phone runs the camera and detectors; this page only receives
      // validated commands (see net/host.ts).
      host.start();
    } else {
      input.useRemote(false);
      tracker.facing = getSave().settings.cameraFacing;
      offFeed = tracker.subscribe((f) => input.feed(f.frame, f.now));
      tracker
        .start(getSave().settings.model)
        .then(() => setCamera({ state: 'running' }))
        .catch((e) => setCamera({ state: 'error', message: e instanceof TrackerError ? e.message : String(e) }));
    }
    const detach = input.attachKeyboard(window);
    const pad = new GamepadInput(input, toggleTraversal);
    pad.start();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && !e.repeat) toggleTraversal();
    };
    window.addEventListener('keydown', onKey);
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    const tiltTimer = window.setInterval(() => setTiltMoved(tilt.moved), 1000);
    const offs = [
      bus.on('diorama:near', ({ id }) => setNear(id)),
      bus.on('diorama:reached', ({ id }) => {
        const o = OBJECTIVES[objRef.current];
        if (id === o?.target && !o.interact && !o.enemies) advance();
      }),
      bus.on('world:encounter', ({ enemyId }) => {
        if (stageRef.current !== 'explore' || pausedRef.current) return;
        setChoice(null);
        setEnemyId(enemyId as TrialEnemy);
        setStage('battle');
      }),
      bus.on('trail:choice', (c) => setChoice(c)),
      bus.on('trail:chosen', ({ label }) => flash(`Heading for the ${label}`)),
      bus.on('trail:rejoin', ({ active }) => setRejoining(active)),
    ];
    calKind.current = 'full';
    setStage('calibrate');
    return () => {
      offFeed();
      detach();
      pad.stop();
      window.removeEventListener('keydown', onKey);
      clearInterval(tiltTimer);
      offs.forEach((f) => f());
      if (!connected) tracker.stop();
      input.setMode('off');
      if (connected) host.stop();
      lock?.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the diorama in sync with the objective.
  useEffect(() => {
    const o = OBJECTIVES[obj];
    const remaining = (o?.enemies ?? []).filter((e) => !defeated.includes(e));
    setDioramaState({
      target: remaining[0] ?? o?.target ?? null,
      alt: remaining.slice(1),
      interact: [...(o?.interact ? [o.interact] : []), ...(shrineUsed ? [] : ['shrine'])],
      enemies: remaining,
      defeated,
      gateOpen,
    });
  }, [obj, gateOpen, defeated, shrineUsed]);

  function advance() {
    const name = OBJECTIVES[objRef.current]?.id;
    if (name) log.current.partTimes[name] = Date.now();
    objRef.current++;
    setObj(objRef.current);
    const next = OBJECTIVES[objRef.current];
    if (next) {
      audio.nextExercise();
      audio.say(next.title);
    }
  }

  // Connected Play: losing the phone stops movement at once (the host link
  // does that) and pauses exploration; resuming needs the phone back, its
  // camera running and the player in view.
  useEffect(() => {
    if (!ctrlLost) return;
    audio.trackingLost();
    audio.say('Controller disconnected. The game is paused.', false);
    if (stageRef.current === 'explore' || stageRef.current === 'dialog' || stageRef.current === 'reward') setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlLost]);

  // Tell the phone what's going on, for its dashboard.
  useEffect(() => {
    if (!connected) return;
    const o = OBJECTIVES[obj];
    const title = stage === 'calibrate' ? 'Setup' : stage === 'battle' ? 'Battle' : stage === 'summary' ? 'Trial complete' : (o?.title ?? '');
    const choiceText = choice ? choice.options.map((x) => `${x.dir < 0 ? '◀ lean left' : 'lean right ▶'}: ${x.label}`).join(' · ') : null;
    host.send({ type: 'GAME', title, hint: stage === 'explore' ? (o?.hint[guided ? 'guided' : 'free'] ?? '') : '', exercise: null, paused, notice: choiceText });
  }, [connected, stage, obj, paused, link.controller, choice, guided]);

  // Tracking-lost cue while exploring.
  const lostSince = useRef<number | null>(null);
  const lostCue = useRef(0);
  useEffect(() => {
    // Assisted traversal (gamepad / keys) doesn't need the body: no tracking warnings while exploring.
    if (stage !== 'explore' || assisted) {
      setLostBanner(false);
      return;
    }
    const off = input.onReading((x) => {
      const now = performance.now();
      if (!x) return;
      if (x.tracking === 'lost') {
        lostSince.current ??= now;
        if (now - lostSince.current > 1200) {
          setLostBanner(true);
          if (now - lostCue.current > 8000) {
            lostCue.current = now;
            log.current.trackingLosses++;
            audio.trackingLost();
            audio.say('Tracking lost. Step back into view.', false);
          }
        }
      } else {
        lostSince.current = null;
        setLostBanner(false);
      }
    });
    return off;
  }, [stage, assisted]);

  useInputEvents((e) => {
    if (e.type === 'step' && stageRef.current === 'explore') log.current.exploreSteps++;
    if (e.type === 'confirm' || e.type === 'back' || e.type === 'pause') log.current.gestures++;
    const st = stageRef.current;
    if (pausedRef.current && st !== 'battle' && e.type === 'resume' && canResume) {
      setPaused(false);
      return;
    }
    if (e.type === 'recalibrate' && (st === 'explore' || st === 'dialog' || st === 'reward')) {
      calKind.current = 'quick';
      pausedRef.current = false;
      setPausedState(false);
      setStage('calibrate');
      return;
    }
    // Pause from exploration, dialogue and reward menus (battles handle their own).
    if (e.type === 'pause' && !pausedRef.current && (st === 'explore' || st === 'dialog' || st === 'reward')) {
      setPaused(true);
      audio.gesture();
      return;
    }
    if (pausedRef.current || st !== 'explore') return;
    const o = OBJECTIVES[objRef.current];
    if (e.type === 'confirm' && near === 'shrine' && !shrineUsed) {
      audio.heal();
      audio.say('The shrine restores you.');
      setHp(stats.maxHp);
      setShrineUsed(true);
      flash('The Mossy Shrine restores your health');
      return;
    }
    if (e.type === 'confirm' && o?.interact && near === o.interact) {
      audio.gesture();
      if (o.interact === 'dummy') {
        bus.emit('diorama:hit', { id: 'dummy' });
        window.setTimeout(advance, 700);
      } else if (o.interact === 'signpost') setStage('dialog');
    }
  });

  const current = OBJECTIVES[obj];
  const floorWarn = stage !== 'calibrate' && !log.current.floorOk;
  // In Connected Play, only resume once the phone is back and ready.
  const canResume = !connected || (link.controller === 'connected' && host.ready);
  const phoneMoved = connected ? !!link.status?.moved : tiltMoved;
  const interactPrompt = near === 'shrine' && !shrineUsed ? 'rest at the shrine' : current?.interact && near === current.interact ? current.prompt : null;
  const combatN = defeated.length + 1;

  const onCalibrated = (res: { floorOk: boolean }) => {
    const first = calKind.current === 'full';
    log.current.calibratedAt = Date.now();
    if (first) log.current.floorOk = res.floorOk;
    if (!connected) tilt.setReference();
    calKind.current = 'quick';
    setStage('explore');
    if (first) audio.say(OBJECTIVES[0].title + '. ' + OBJECTIVES[0].hint[guided ? 'guided' : 'free']);
  };

  return (
    <div className="trial">
      {stage === 'calibrate' && connected && <RemoteCalibration kind={calKind.current} onDone={onCalibrated} />}
      {stage === 'calibrate' && !connected && <Calibration kind={calKind.current} camera={camera} onDone={onCalibrated} />}

      {stage === 'explore' && current && (
        <>
          <div className="tv-objective">
            <small>{obj < 3 ? `Part 1 · Exploration ${obj + 1}/3` : `Part 2 · Combat ${Math.min(combatN, 4)}/4`}</small>
            <b>{current.title}</b>
            <span>{assisted ? 'Assisted traversal: move with the gamepad stick or arrow keys.' : current.hint[guided ? 'guided' : 'free']}</span>
          </div>
          {connected ? (
            <div className="tv-pip tv-pip-ctrl">
              <ControllerStatus bodyNeeded={!assisted} />
            </div>
          ) : (
            <CameraView className="tv-pip" good={r?.tracking === 'good'} />
          )}
          <div className="tv-bottom">
            {!assisted && <MotionMeter r={r} steering={!guided} />}
            {assisted && <span className="hint-chip">🎮 Assisted · Select / T to march again</span>}
            {interactPrompt && <HoldRing value={r?.hold.confirm ?? 0} label={interactPrompt} hand="right" />}
            <HoldRing value={r?.hold.pause ?? 0} label="pause" hand="both" />
          </div>
          {choice && !paused && (
            <div className="trail-choice">
              <b>{choice.prompt}</b>
              <div className="trail-options">
                {[...choice.options]
                  .sort((a, b) => a.dir - b.dir)
                  .map((o) => (
                    <button key={o.label} className={`trail-opt ${o.dir < 0 ? 'left' : 'right'}`} onClick={() => input.press(o.dir < 0 ? 'left' : 'right', 'touch')}>
                      <span className="trail-lean">{o.dir < 0 ? '◀ Lean left' : 'Lean right ▶'}</span>
                      <img src={iconDataUrl(o.icon)} alt="" className="pix-icon" />
                      <b>{o.label}</b>
                      <span>{o.detail}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          {notice && <div className="tv-notice">{notice}</div>}
          {rejoining && <div className="tv-notice">Heading back to the trail…</div>}
          {lostBanner && <div className="tv-lost">Tracking lost — step back into view</div>}
          <button className="btn btn-sm btn-ghost tv-touch-pause" onClick={() => input.press('pause', 'touch')}>
            Pause
          </button>
        </>
      )}

      {stage === 'dialog' && (
        <div className="tv-overlay">
          <GestureMenu
            active={!paused}
            title="The Trial Gate"
            text={`Four guardians wait beyond the ward: ${targets.pushup} push-ups, ${targets.squat} squats and ${targets.jumping_jack} jumping jacks — then the Warden, who demands all three. Keep the phone where it is; the game will tell you how to face it for each exercise.`}
            options={[
              { id: 'go', label: 'Begin the trial', icon: 'sword' },
              { id: 'later', label: 'Not yet', icon: 'lock' },
            ]}
            onChoose={(id) => {
              setStage('explore');
              if (id === 'go') {
                setGateOpen(true);
                advance();
              }
            }}
            onBack={() => setStage('explore')}
          />
        </div>
      )}

      {stage === 'battle' && enemyId && (
        <AutoBattle
          key={enemyId}
          connected={connected}
          enemy={trialEnemy(enemyId, stats, targets)}
          plan={encounterPlan(enemyId, targets)}
          stats={stats}
          hp={hp ?? stats.maxHp}
          heroName={save.heroName}
          onDone={(res: BattleResult) => {
            for (const [k, v] of Object.entries(res.reps)) {
              const rec = (log.current.reps[k] ??= { camera: 0, manual: 0 });
              rec.camera += v.camera;
              rec.manual += v.manual;
            }
            log.current.trackingLosses += res.trackingLosses;
            setHp(res.hpLeft);
            const e = trialEnemy(enemyId, stats, targets);
            updateSave((s) => {
              s.xp += e.xp;
              s.gold += e.gold;
              s.totals.battlesWon++;
              s.totals.cameraReps += Object.values(res.reps).reduce((a, b) => a + b.camera, 0);
              s.totals.manualReps += Object.values(res.reps).reduce((a, b) => a + b.manual, 0);
            });
            defeatedRef.current = [...defeatedRef.current, enemyId];
            setDefeated(defeatedRef.current);
            setEnemyId(null);
            if (enemyId === 'warden') {
              log.current.partTimes.warden = Date.now();
              setStage('summary');
              audio.victory();
            } else {
              setStage('reward');
            }
          }}
        />
      )}

      {stage === 'reward' && (
        <div className="tv-overlay">
          <GestureMenu
            active={!paused}
            title="Choose a reward"
            text="The guardian falls! Pick a boon for the rest of the trial."
            options={BOONS.map((b) => ({ id: b.id, label: b.name, detail: b.text, icon: b.icon }))}
            initial={1}
            onChoose={(id) => {
              if (id === 'heal') setHp(stats.maxHp);
              else setBonus((b) => ({ ...b, [id]: b[id as 'atk' | 'def' | 'mag'] + 3 }));
              audio.levelUp();
              setStage('explore');
              // Objectives with two guardians finish when both are down.
              const o = OBJECTIVES[objRef.current];
              if (!o?.enemies || o.enemies.every((x) => defeatedRef.current.includes(x))) advance();
            }}
          />
        </div>
      )}

      {stage === 'summary' && <Summary log={log.current} onExit={onExit} onAgain={() => location.reload()} />}

      {paused && stage !== 'battle' && stage !== 'summary' && (
        <div className="tv-overlay tv-overlay-top">
          <GestureMenu
            title="Paused"
            text={ctrlLost ? 'The phone controller disconnected. Resume becomes available once it reconnects and can see you.' : undefined}
            options={[
              { id: 'resume', label: canResume ? 'Resume' : 'Resume (waiting for the phone…)', icon: 'star' },
              { id: 'recal', label: 'Recalibrate', detail: 'Quick: stand in view, then stand still', icon: 'shield' },
              ...(guided ? [{ id: 'traverse', label: assisted ? 'Switch to Active' : 'Switch to Assisted', detail: assisted ? 'March to move along the trail' : 'Move with a gamepad or the keyboard', icon: 'wind' }] : []),
              { id: 'quit', label: 'Quit trial', icon: 'lock' },
            ]}
            onChoose={(id) => {
              if (id === 'resume' && !canResume) {
                audio.error();
                return;
              }
              if (id === 'traverse') {
                toggleTraversal();
                return;
              }
              if (id === 'recal') {
                calKind.current = 'quick';
                pausedRef.current = false;
                setPausedState(false);
                setStage('calibrate');
                return;
              }
              setPaused(false);
              if (id === 'quit') onExit();
            }}
            onBack={() => {
              if (!canResume) return;
              setPaused(false);
            }}
          />
        </div>
      )}

      {phoneMoved && stage !== 'calibrate' && stage !== 'summary' && <div className="tv-warn tv-warn-top">The phone moved since calibration — put it back, or Pause → Recalibrate.</div>}
      {ctrlLost && stage !== 'summary' && <ControllerLost />}

      {floorWarn && stage === 'explore' && obj >= 3 && <div className="tv-warn">Floor check was skipped — push-ups may not track from this phone position.</div>}
    </div>
  );
}

/** The hero figure is ~104 board units tall, about 1.7 m: metres per board unit. */
const BOARD_M = 1.7 / 104;

function Summary({ log, onExit, onAgain }: { log: Log; onExit: () => void; onAgain: () => void }) {
  const mins = Math.max(1, Math.round((Date.now() - log.startedAt) / 60000));
  const rows = [
    ['pushup', 'Push-ups'],
    ['squat', 'Squats'],
    ['jumping_jack', 'Jumping jacks'],
  ] as const;
  const cam = rows.reduce((a, [k]) => a + (log.reps[k]?.camera ?? 0), 0);
  const man = rows.reduce((a, [k]) => a + (log.reps[k]?.manual ?? 0), 0);
  return (
    <div className="tv-overlay">
      <div className="gmenu summary">
        <h2>Trial Complete!</h2>
        <p className="gmenu-text">The Warden falls and the meadow is safe. About {mins} minute{mins === 1 ? '' : 's'} of play.</p>
        <table className="sum-table">
          <tbody>
            {rows.map(([k, label]) => (
              <tr key={k}>
                <th>{label}</th>
                <td>{log.reps[k]?.camera ?? 0} camera-verified</td>
                <td>{log.reps[k]?.manual ? `${log.reps[k].manual} manual` : ''}</td>
              </tr>
            ))}
            <tr>
              <th>Marching steps</th>
              <td>{log.exploreSteps}</td>
              <td />
            </tr>
            <tr>
              <th>Trail by marching</th>
              <td>{Math.round(travel.active * BOARD_M)} m</td>
              <td />
            </tr>
            {travel.assisted > 50 && (
              <tr>
                <th>Trail by controller</th>
                <td>{Math.round(travel.assisted * BOARD_M)} m</td>
                <td>not counted as exercise</td>
              </tr>
            )}
            <tr>
              <th>Gestures used</th>
              <td>{log.gestures}</td>
              <td />
            </tr>
            <tr>
              <th>Tracking losses</th>
              <td>{log.trackingLosses}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <p className="gmenu-text">
          {cam} reps counted by the camera{man ? `, ${man} counted manually` : ''}.{log.floorOk ? '' : ' The floor check was skipped this session.'}
        </p>
        <GestureMenu
          title=""
          options={[
            { id: 'again', label: 'Play again', icon: 'star' },
            { id: 'title', label: 'Title screen', icon: 'lock' },
          ]}
          onChoose={(id) => (id === 'again' ? onAgain() : onExit())}
        />
      </div>
    </div>
  );
}
