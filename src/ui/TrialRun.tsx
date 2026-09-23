import { useEffect, useMemo, useRef, useState } from 'react';
import { bus } from '../game/bus';
import { audio } from '../game/audio';
import { levelForXp, statsFor, type PlayerStats } from '../game/progression';
import { getSave, updateSave } from '../game/store';
import { input } from '../input/InputHub';
import { setDioramaState, showScene } from '../phaser/game';
import { tracker, TrackerError } from '../pose/PoseTracker';
import { BOONS, encounterPlan, parseTargets, trialEnemy, type TrialEnemy } from '../trial/config';
import { AutoBattle, type BattleResult } from './AutoBattle';
import { Calibration } from './Calibration';
import { CameraView } from './CameraView';
import { GestureMenu, HoldRing, MotionMeter, useInputEvents, useMotion } from './motionUi';

/**
 * The Motion Trial: place the phone once, calibrate, then play a short
 * adventure entirely with your body.
 *
 *   Part 1 (exploration): march to the banner, steer to the dummy and strike
 *   it, read the signpost and accept the trial.
 *   Part 2 (combat): push-ups, squats, jumping jacks, then a three-phase boss.
 */
type Stage = 'calibrate' | 'explore' | 'dialog' | 'battle' | 'reward' | 'summary';

interface Objective {
  id: string;
  title: string;
  hint: string;
  target: string;
  interact?: string;
  prompt?: string;
  enemy?: TrialEnemy;
}

const OBJECTIVES: Objective[] = [
  { id: 'banner', title: 'March to the banner', hint: 'March in place — lift your knees — to walk forward.', target: 'banner' },
  { id: 'dummy', title: 'Steer to the training dummy', hint: 'Keep marching and lean left or right to turn.', target: 'dummy', interact: 'dummy', prompt: 'strike the dummy' },
  { id: 'signpost', title: 'Read the signpost by the gate', hint: 'Follow the trail. Lean to steer.', target: 'signpost', interact: 'signpost', prompt: 'read the sign' },
  { id: 'skeleton', title: 'Face the Skeleton', hint: 'Walk up to it. Push-ups ahead!', target: 'skeleton', enemy: 'skeleton' },
  { id: 'golem', title: 'Face the Stone Golem', hint: 'Walk up to it. Squats ahead!', target: 'golem', enemy: 'golem' },
  { id: 'mage', title: 'Face the Shadow Mage', hint: 'Walk up to it. Jumping jacks ahead!', target: 'mage', enemy: 'mage' },
  { id: 'warden', title: 'Challenge the Dungeon Warden', hint: 'The final guardian: push-ups, squats and jumping jacks.', target: 'warden', enemy: 'warden' },
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

export function TrialRun({ onExit }: { onExit: () => void }) {
  const save = getSave();
  const targets = useMemo(() => parseTargets(location.search, save.settings.trialTargets), [save.settings.trialTargets]);
  const [stage, setStageState] = useState<Stage>('calibrate');
  const stageRef = useRef<Stage>('calibrate');
  const [camera, setCamera] = useState<{ state: string; message?: string }>({ state: 'starting' });
  const [obj, setObj] = useState(0);
  const objRef = useRef(0);
  const [near, setNear] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [defeated, setDefeated] = useState<string[]>([]);
  const [enemyId, setEnemyId] = useState<TrialEnemy | null>(null);
  const [bonus, setBonus] = useState({ atk: 0, def: 0, mag: 0 });
  const [hp, setHp] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [lostBanner, setLostBanner] = useState(false);
  const log = useRef<Log>({ startedAt: Date.now(), calibratedAt: null, exploreSteps: 0, gestures: 0, floorOk: false, trackingLosses: 0, reps: {}, partTimes: {} });
  const r = useMotion();

  const stats: PlayerStats = useMemo(() => {
    const s = statsFor(levelForXp(save.xp), save.upgrades);
    return { ...s, atk: s.atk + bonus.atk, def: s.def + bonus.def, mag: s.mag + bonus.mag };
  }, [save.xp, save.upgrades, bonus]);

  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
    if (s === 'calibrate') input.setMode('calibration');
    else if (s === 'explore') input.setMode('explore');
    else if (s !== 'battle') input.setMode('menu');
  };

  // Camera + motion input for the whole session.
  useEffect(() => {
    showScene('Diorama', { attract: false });
    tracker.facing = getSave().settings.cameraFacing;
    const offFeed = tracker.subscribe((f) => input.feed(f.frame, f.now));
    tracker
      .start(getSave().settings.model)
      .then(() => setCamera({ state: 'running' }))
      .catch((e) => setCamera({ state: 'error', message: e instanceof TrackerError ? e.message : String(e) }));
    const detach = input.attachKeyboard(window);
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    const offs = [
      bus.on('diorama:near', ({ id }) => setNear(id)),
      bus.on('diorama:reached', ({ id }) => {
        if (id === OBJECTIVES[objRef.current]?.target && !OBJECTIVES[objRef.current].interact) advance();
      }),
      bus.on('world:encounter', ({ enemyId }) => {
        if (stageRef.current !== 'explore') return;
        setEnemyId(enemyId as TrialEnemy);
        setStage('battle');
      }),
    ];
    input.setMode('calibration');
    return () => {
      offFeed();
      detach();
      offs.forEach((f) => f());
      tracker.stop();
      input.setMode('off');
      lock?.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the diorama in sync with the objective.
  useEffect(() => {
    const o = OBJECTIVES[obj];
    // Only the current guardian engages; the others wait on the board.
    setDioramaState({
      target: o?.target ?? null,
      interact: o?.interact ? [o.interact] : [],
      enemies: o?.enemy && !defeated.includes(o.enemy) ? [o.enemy] : [],
      defeated,
      gateOpen,
    });
  }, [obj, gateOpen, defeated]);

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

  // Tracking-lost cue while exploring.
  const lostSince = useRef<number | null>(null);
  const lostCue = useRef(0);
  useEffect(() => {
    if (stage !== 'explore') return;
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
  }, [stage]);

  useInputEvents((e) => {
    if (e.type === 'step' && stageRef.current === 'explore') log.current.exploreSteps++;
    if (e.type === 'confirm' || e.type === 'back' || e.type === 'pause') log.current.gestures++;
    if (stageRef.current !== 'explore') return;
    if (e.type === 'pause') {
      setPaused(true);
      input.setMode('menu');
      audio.gesture();
      return;
    }
    if (paused) return;
    const o = OBJECTIVES[objRef.current];
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

  return (
    <div className="trial">
      {stage === 'calibrate' && (
        <Calibration
          camera={camera}
          onDone={(res) => {
            log.current.calibratedAt = Date.now();
            log.current.floorOk = res.floorOk;
            setStage('explore');
            audio.say(OBJECTIVES[0].title + '. ' + OBJECTIVES[0].hint);
          }}
        />
      )}

      {stage === 'explore' && current && (
        <>
          <div className="tv-objective">
            <small>
              {obj < 3 ? `Part 1 · Exploration ${obj + 1}/3` : `Part 2 · Combat ${obj - 2}/4`}
            </small>
            <b>{current.title}</b>
            <span>{current.hint}</span>
          </div>
          <CameraView className="tv-pip" good={r?.tracking === 'good'} />
          <div className="tv-bottom">
            <MotionMeter r={r} />
            {current.interact && near === current.interact && <HoldRing value={r?.hold.confirm ?? 0} label={current.prompt ?? 'interact'} hand="right" />}
            <HoldRing value={r?.hold.pause ?? 0} label="pause" hand="both" />
          </div>
          {lostBanner && <div className="tv-lost">Tracking lost — step back into view</div>}
          <button className="btn btn-sm btn-ghost tv-touch-pause" onClick={() => input.press('pause', 'touch')}>
            Pause
          </button>
        </>
      )}

      {stage === 'dialog' && (
        <div className="tv-overlay">
          <GestureMenu
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
            setDefeated((d) => [...d, enemyId]);
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
            title="Choose a reward"
            text="The guardian falls! Pick a boon for the rest of the trial."
            options={BOONS.map((b) => ({ id: b.id, label: b.name, detail: b.text, icon: b.icon }))}
            initial={1}
            onChoose={(id) => {
              if (id === 'heal') setHp(stats.maxHp);
              else setBonus((b) => ({ ...b, [id]: b[id as 'atk' | 'def' | 'mag'] + 3 }));
              audio.levelUp();
              setStage('explore');
              advance();
            }}
          />
        </div>
      )}

      {stage === 'summary' && <Summary log={log.current} onExit={onExit} onAgain={() => location.reload()} />}

      {paused && stage === 'explore' && (
        <div className="tv-overlay">
          <GestureMenu
            title="Paused"
            options={[
              { id: 'resume', label: 'Resume', icon: 'star' },
              { id: 'recal', label: 'Recalibrate', detail: 'Moved the phone? Run setup again', icon: 'shield' },
              { id: 'quit', label: 'Quit trial', icon: 'lock' },
            ]}
            onChoose={(id) => {
              setPaused(false);
              if (id === 'resume') input.setMode('explore');
              if (id === 'recal') setStage('calibrate');
              if (id === 'quit') onExit();
            }}
            onBack={() => {
              setPaused(false);
              input.setMode('explore');
            }}
          />
        </div>
      )}

      {floorWarn && stage === 'explore' && obj >= 3 && <div className="tv-warn">Floor check was skipped — push-ups may not track from this phone position.</div>}
    </div>
  );
}

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
