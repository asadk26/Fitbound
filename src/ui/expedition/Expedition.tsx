import { useEffect, useRef, useState } from 'react';
import { getExercise } from '../../exercise/registry';
import { audio } from '../../game/audio';
import { getSave, updateSave } from '../../game/store';
import { GamepadInput } from '../../input/gamepad';
import { input } from '../../input/InputHub';
import { motionPreset } from '../../input/motion';
import { tilt } from '../../input/tilt';
import { host } from '../../net/host';
import { showSanctuary, showScene } from '../../phaser/game';
import { tracker, TrackerError } from '../../pose/PoseTracker';
import { atPhaseBoundary, clearExpedition, currentNode, loadExpedition, newExpedition, ROUTES, saveExpedition, type ExNode, type ExpeditionState, type NodeKind } from '../../rpg/expedition';
import { generateLoadout, setTarget } from '../../rpg/loadout';
import { STORY } from '../../rpg/story';
import { activeLoadout, applyReadiness, hasWork, needsReadiness, sessionRecord, startSession, upsertRecord } from '../../rpg/session';
import { addDodge, addMarch, addSet, addTime, newWorkout } from '../../rpg/workout';
import { Calibration } from '../Calibration';
import { ControllerLost, RemoteCalibration, useLink } from '../Connected';
import { useInputEvents } from '../motionUi';
import { toggleTraversal } from '../TrialRun';
import { CinemaPlayer } from '../Cinema';
import type { Script } from '../../story/cinema';
import { OPENING, ritualReason, ritualScript, type RitualReason } from '../../story/scripts';
import { BlessingPick, Fallen, Haven, Mirror, PathView, Summary } from './Events';
import { Journal } from './Journal';
import { MovementLab } from './MovementLab';
import { RpgBattle } from './RpgBattle';
import { Returning } from './Returning';
import { Sanctuary } from './Sanctuary';
import { marchNeedsBody, Travel, type MarchTally } from './Travel';
import type { SetResult } from './setRunner';

/**
 * FITBOUND: Heart of Haze — an expedition.
 *
 * Sanctuary (setup) → the path → fights, blessings, the Mirror, a Haven →
 * the Warden → summary. The body is only needed for physical moments: menus,
 * choices and the Haven work from the couch with a gamepad, and the camera
 * check happens right before the first fight rather than at the start.
 */
type View = 'cinema' | 'sanctuary' | 'journal' | 'lab' | 'calibrate' | 'return' | 'path' | 'travel' | 'node' | 'fallen' | 'summary';

export function Expedition({ connected, resume, onExit }: { connected: boolean; resume: boolean; onExit: () => void }) {
  // Resuming is a new workout session of the same expedition (bible §18): the
  // last sitting's session is already in the history (or is written now, if
  // the app closed before it could be), and on another day you're asked how
  // you feel before anything physical.
  const [newDay] = useState(() => {
    const saved = resume ? loadExpedition() : null;
    return !!saved && needsReadiness(saved);
  });
  const [x, setXState] = useState<ExpeditionState | null>(() => {
    const saved = resume ? loadExpedition() : null;
    if (!saved) return null;
    if (hasWork(saved) && !getSave().workouts.some((r) => r.id === saved.workout.id)) {
      const rec = { ...sessionRecord(saved), outcome: 'suspended' as const };
      updateSave((s) => void (s.workouts = upsertRecord(s.workouts, rec)));
    }
    return startSession(saved);
  });
  /** The real run, set aside while the Lab plays a scratch encounter. */
  const realRun = useRef<ExpeditionState | null>(null);
  const xRef = useRef(x);
  // Arriving at the Sanctuary: the opening the first time, the short reconstruction ritual after that.
  const [cine, setCine] = useState<{ script: Script; restored: boolean; then: () => void } | null>(() => (resume && x ? null : arrival(() => setView('sanctuary'))));
  const [view, setView] = useState<View>(() => (resume && x ? (newDay ? 'return' : 'path') : 'cinema'));
  const viewRef = useRef(view);
  viewRef.current = view;
  const [debug, setDebug] = useState<ExNode | null>(null);
  const [nodeKey, setNodeKey] = useState(0);
  const calibrated = useRef(false);
  const afterCal = useRef<() => void>(() => setView('path'));
  const [camera, setCamera] = useState<{ state: string; message?: string }>({ state: 'starting' });
  const link = useLink();
  const ctrlLost = connected && link.controller !== 'connected';

  const commit = (next: ExpeditionState, persist = true) => {
    xRef.current = next;
    setXState(next);
    if (persist && !debug) saveExpedition(next);
  };
  const mutate = (fn: (d: ExpeditionState) => void, persist = true) => {
    const d = structuredClone(xRef.current!);
    fn(d);
    commit(d, persist);
  };

  // Camera + inputs for the whole expedition.
  useEffect(() => {
    // (An arriving cinematic has already taken the stage.)
    if (viewRef.current !== 'cinema') showScene('Diorama', { attract: true });
    input.reader.configure(motionPreset(getSave().settings.motion));
    let offFeed = () => {};
    if (connected) host.start();
    else {
      input.useRemote(false);
      tracker.facing = getSave().settings.cameraFacing;
      offFeed = tracker.subscribe((f) => input.feed(f.frame, f.now));
      tracker
        .start(getSave().settings.model)
        .then(() => setCamera({ state: 'running' }))
        .catch((e) => setCamera({ state: 'error', message: e instanceof TrackerError ? e.message : String(e) }));
    }
    const detach = input.attachKeyboard(window);
    // Select (gamepad) or T switches march ⇄ gamepad travel, on the trail only.
    const toggle = () => viewRef.current === 'travel' && toggleTraversal();
    const pad = new GamepadInput(input, toggle);
    pad.start();
    const onKey = (e: KeyboardEvent) => e.code === 'KeyT' && !e.repeat && toggle();
    window.addEventListener('keydown', onKey);
    input.setMode('menu');
    return () => {
      window.removeEventListener('keydown', onKey);
      offFeed();
      detach();
      pad.stop();
      if (!connected) tracker.stop();
      input.setMode('off');
      if (connected) host.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Where the time goes (pacing, bible §18): marching, encounters, and the rest.
  const viewSince = useRef({ view, at: performance.now(), run: x?.id });
  useEffect(() => {
    const prev = viewSince.current;
    const now = performance.now();
    viewSince.current = { view, at: now, run: xRef.current?.id };
    const bucket = prev.view === 'travel' ? 'march' : prev.view === 'node' ? 'encounters' : prev.view === 'path' || prev.view === 'calibrate' || prev.view === 'fallen' ? 'other' : null;
    const cur = xRef.current;
    if (!bucket || !cur || debug || cur.id !== prev.run) return;
    mutate((d) => addTime(d.workout, bucket, now - prev.at), cur.status === 'active' || cur.status === 'suspended');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Tell the phone what's happening, for its dashboard.
  useEffect(() => {
    if (!connected) return;
    const n = x ? currentNode(x) : null;
    host.send({ type: 'GAME', title: view === 'sanctuary' || view === 'cinema' || view === 'journal' ? 'The Sanctuary' : view === 'node' && n ? n.title : 'Heart of Haze', hint: '', exercise: null, paused: false, notice: null });
  }, [connected, view, x, link.controller]);

  /** Quick camera check before the first physical node this session. */
  const needCamera = (then: () => void) => {
    if (calibrated.current) return then();
    afterCal.current = then;
    input.calibrationKind = 'quick';
    setView('calibrate');
    input.setMode('calibration');
    audio.say('Quick camera check. Step into view and stand tall.');
  };
  const onCalibrated = () => {
    calibrated.current = true;
    if (!connected) tilt.setReference();
    input.setMode('menu');
    afterCal.current();
  };

  // The Sanctuary screen sits in the garden (in the rain, until the first restoration).
  useEffect(() => {
    if (view === 'sanctuary') showSanctuary(getSave().story.restored);
  }, [view]);

  /** Play the reconstruction ritual for this reason, then show the Sanctuary. */
  const ritual = (reason: RitualReason) => {
    const s = getSave();
    const then = () => {
      updateSave((d) => {
        d.story.rituals++;
        d.story.lastVisit = Date.now();
      });
      setView('sanctuary');
    };
    setCine({ script: ritualScript(reason, s.story.rituals), restored: s.story.restored, then });
    setView('cinema');
  };
  const firstRestoration = useRef(false);

  useInputEvents((e) => {
    if (e.type === 'recalibrate' && (view === 'path' || view === 'sanctuary')) {
      calibrated.current = false;
      const back = view;
      needCamera(() => setView(back));
    }
  });

  // ── Flow ─────────────────────────────────────────────────────────────────
  const begin = (prefs: ExpeditionState['prefs'], loadout: ExpeditionState['loadout'], route: ExpeditionState['route']) => {
    const s = getSave();
    const targets: Record<string, number> = {};
    for (const slot of Object.values(loadout)) if (slot) targets[slot.exerciseId] = setTarget(getExercise(slot.exerciseId), prefs, s.exerciseTargets);
    // Starting afresh over a saved run: that run's last session goes into the history first.
    const old = loadExpedition();
    if (old && old.id !== xRef.current?.id) recordHistory({ ...old, workout: { ...old.workout, outcome: 'ended' } });
    firstRestoration.current = false;
    const next = newExpedition(route, prefs, loadout, targets);
    commit(next);
    routeNext();
  };

  /** What comes after a node: march to the next stop, or (blessings) happen right here. */
  const routeNext = () => {
    const cur = xRef.current!;
    const n = currentNode(cur);
    if (!n) return finish(cur.fallen ? 'defeat' : 'victory');
    if (!n.at) return enter();
    if (atPhaseBoundary(cur)) return setView('path');
    goTravel();
  };

  const [travelKey, setTravelKey] = useState(0);
  const goTravel = () => {
    const go = () => {
      setTravelKey((k) => k + 1);
      setView('travel');
    };
    if (marchNeedsBody()) needCamera(go);
    else go();
  };

  const recordMarch = (m: MarchTally) => mutate((d) => addMarch(d.workout, m.steps, Math.round(m.active), Math.round(m.assisted)));

  const target = (id: string) => xRef.current?.targets[id] ?? setTarget(getExercise(id), xRef.current?.prefs ?? getSave().expeditionPrefs, getSave().exerciseTargets);

  const enter = () => {
    const cur = xRef.current!;
    const n = currentNode(cur);
    if (!n) return finish(cur.fallen ? 'defeat' : 'victory');
    const physical = n.kind === 'fight' || n.kind === 'boss';
    const go = () => {
      setDebug(null);
      setNodeKey((k) => k + 1);
      setView('node');
    };
    if (n.kind === 'haven') mutate((d) => void (d.hp = d.maxHp));
    if (physical) needCamera(go);
    else go();
  };

  const backToLab = () => {
    setDebug(null);
    xRef.current = realRun.current;
    setXState(realRun.current);
    realRun.current = null;
    setView('lab');
  };

  const advance = () => {
    if (debug) return backToLab();
    mutate((d) => void d.index++);
    routeNext();
  };

  const finish = (outcome: 'victory' | 'defeat' | 'ended') => {
    mutate((d) => {
      d.workout.outcome = outcome;
      d.status = outcome === 'victory' ? 'complete' : 'ended';
    }, false);
    const done = xRef.current!;
    recordHistory(done);
    clearExpedition();
    if (outcome === 'victory') {
      audio.victory();
      // A reignition. The first one stops the Sanctuary's rain, for good.
      firstRestoration.current = !getSave().story.restored;
      updateSave((s) => {
        s.story.restored = true;
        s.story.reignitions++;
      });
    }
    setView('summary');
  };

  /** Save and stop: the expedition waits; this sitting's session is complete and recorded. */
  const suspend = () => {
    mutate((d) => {
      d.status = 'suspended';
      d.workout.outcome = 'suspended';
    });
    recordHistory(xRef.current!);
    setView('summary');
  };

  const onSet = (r: SetResult) => {
    const ex = getExercise(r.exerciseId);
    mutate((d) =>
      addSet(d.workout, {
        exerciseId: r.exerciseId,
        family: ex.family,
        at: Date.now(),
        camera: r.camera,
        manual: r.manual,
        left: r.sides?.left ?? 0,
        right: r.sides?.right ?? 0,
        holdMs: r.holdMs,
        ...(r.holdSides ? { holdSides: r.holdSides } : {}),
        target: r.target,
        full: r.full,
        finishedEarly: r.ending === 'finished',
        activeMs: r.activeMs,
      }),
    );
    updateSave((s) => {
      s.totals.cameraReps += r.camera;
      s.totals.manualReps += r.manual;
      s.totals.holdSeconds += Math.floor(r.holdMs / 1000);
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const node: ExNode | null = debug ?? (x ? currentNode(x) : null);

  return (
    <div className="expedition">
      {view === 'cinema' && cine && (
        <CinemaPlayer
          key={cine.script.id + cine.restored}
          script={cine.script}
          restored={cine.restored}
          onDone={() => {
            const then = cine.then;
            setCine(null);
            then();
          }}
        />
      )}
      {view === 'sanctuary' && (
        <Sanctuary
          connected={connected}
          onBegin={begin}
          onLab={() => setView('lab')}
          onJournal={() => setView('journal')}
          onBack={onExit}
        />
      )}
      {view === 'journal' && <Journal onBack={() => setView('sanctuary')} />}
      {view === 'lab' && (
        <MovementLab
          connected={connected}
          onBack={() => setView(x && x.status === 'active' ? 'path' : 'sanctuary')}
          onJump={(kind: NodeKind, enemies?: string[]) => {
            // A scratch run (the real run's loadout if there is one); never saved.
            const s = getSave();
            realRun.current = xRef.current;
            const lo = xRef.current?.loadout ?? generateLoadout(s.expeditionPrefs, s.calibrations, s.workouts);
            const scratch = newExpedition('standard', xRef.current?.prefs ?? s.expeditionPrefs, lo, xRef.current?.targets ?? {});
            scratch.blessings = xRef.current?.blessings ?? [];
            scratch.workout = newWorkout(s.expeditionPrefs.intensity, 1);
            xRef.current = scratch;
            setXState(scratch);
            const n: ExNode = { kind, phase: 1, title: kind === 'boss' || enemies?.includes('warden_of_haze') ? 'Before the Spark' : 'Lab encounter', enemies };
            setDebug(n);
            const go = () => {
              setNodeKey((k) => k + 1);
              setView('node');
            };
            if (enemies) needCamera(go);
            else go();
          }}
        />
      )}

      {view === 'calibrate' && (connected ? <RemoteCalibration kind="quick" onDone={onCalibrated} /> : <Calibration kind="quick" camera={camera} onDone={onCalibrated} />)}

      {view === 'return' && x && (
        <Returning
          x={x}
          onDone={(prefs, loadout) => {
            const s = getSave();
            updateSave((d) => void (d.expeditionPrefs = { ...d.expeditionPrefs, intensity: prefs.intensity, sore: prefs.sore, soreAt: prefs.soreAt, dumbbells: prefs.dumbbells }));
            commit(applyReadiness({ ...xRef.current!, loadout }, prefs, s.exerciseTargets));
            setView('path');
          }}
        />
      )}
      {view === 'path' && x && <PathView x={x} onContinue={() => (currentNode(x)?.at && x.battle?.index !== x.index ? goTravel() : enter())} onStop={suspend} />}
      {view === 'travel' && x && (
        <Travel
          key={travelKey}
          x={x}
          connected={connected}
          onArrive={(m) => {
            recordMarch(m);
            enter();
          }}
          onShrine={() => {
            if (xRef.current?.shrineUsed) return;
            mutate((d) => {
              d.shrineUsed = true;
              d.hp = Math.min(d.maxHp, d.hp + 30);
            });
            audio.heal();
            audio.say(STORY.shrine);
          }}
          onStop={(m) => {
            recordMarch(m);
            suspend();
          }}
          onRecalibrate={() => {
            calibrated.current = false;
            needCamera(() => {
              setTravelKey((k) => k + 1);
              setView('travel');
            });
          }}
        />
      )}

      {view === 'node' && x && node && (node.kind === 'fight' || node.kind === 'boss') && (
        <RpgBattle
          key={nodeKey}
          enemies={node.enemies!}
          hpScale={node.hpScale}
          title={node.title}
          boss={node.kind === 'boss' || node.enemies!.includes('warden_of_haze')}
          hero={{ hp: x.hp, maxHp: x.maxHp }}
          loadout={debug ? x.loadout : activeLoadout(x)}
          resume={!debug && x.battle?.index === x.index ? x.battle : undefined}
          onCheckpoint={(b) => !debug && mutate((d) => void (d.battle = { ...b, index: d.index }))}
          target={target}
          blessings={x.blessings}
          connected={connected}
          difficulty={getSave().settings.difficulty}
          dodgeInput={x.dodgeInput}
          tutorial={node.enemies!.includes('echo_dummy')}
          cues={getSave().settings.attackCues === 'obvious' ? 'obvious' : (node.cues ?? ROUTES.standard.nodes.find((n) => n.enemies?.join() === node.enemies!.join())?.cues ?? 'obvious')}
          onDodgeInput={(d) => mutate((s) => void (s.dodgeInput = d))}
          onSet={onSet}
          onDodge={(o, detail) => mutate((d) => addDodge(d.workout, o, detail))}
          onDone={(res) => {
            if (res.outcome === 'victory') {
              mutate((d) => {
                d.hp = Math.max(1, res.hp);
                delete d.battle;
              });
              if (res.leave && !debug) {
                // Asked to leave during the set that won the fight: save just past it.
                mutate((d) => void d.index++);
                return suspend();
              }
              advance();
            } else {
              mutate((d) => {
                d.fallen = true;
                d.workout.rpgDefeats++;
                delete d.battle;
              });
              if (debug) backToLab();
              else setView('fallen');
            }
          }}
          onLeave={(b) => {
            if (debug) return backToLab();
            mutate((d) => void (d.battle = { ...b, index: d.index }));
            suspend();
          }}
        />
      )}
      {view === 'node' && x && node?.kind === 'blessing' && (
        <BlessingPick
          key={nodeKey}
          held={x.blessings}
          loadout={x.loadout}
          onPick={(id) => {
            mutate((d) => void d.blessings.push(id));
            audio.levelUp();
            advance();
          }}
        />
      )}
      {view === 'node' && x && node?.kind === 'mirror' && (
        <Mirror
          key={nodeKey}
          x={x}
          onDone={(l) => {
            if (l)
              mutate((d) => {
                d.loadout = l;
                for (const slot of Object.values(l)) if (slot && !d.targets[slot.exerciseId]) d.targets[slot.exerciseId] = setTarget(getExercise(slot.exerciseId), d.prefs, getSave().exerciseTargets);
              });
            advance();
          }}
        />
      )}
      {view === 'node' && x && node?.kind === 'haven' && (
        <Haven
          key={nodeKey}
          onDone={(ms) => {
            mutate((d) => {
              d.hp = d.maxHp;
              d.workout.recoveryMs += ms;
            });
            advance();
          }}
        />
      )}

      {view === 'fallen' && x && <Fallen onEnd={() => finish('defeat')} />}

      {view === 'summary' && x && (
        <Summary
          x={x}
          onFeedback={(fb) =>
            updateSave((s) => {
              const rec = s.workouts.find((r) => r.id === x.workout.id);
              if (rec) rec.feedback = fb;
            })
          }
          onAgain={() => {
            const done = xRef.current!;
            setXState(null);
            xRef.current = null;
            const outcome = done.workout.outcome;
            ritual(
              ritualReason({
                outcome: outcome === 'victory' || outcome === 'defeat' || outcome === 'ended' || outcome === 'suspended' ? outcome : undefined,
                firstRestoration: firstRestoration.current,
                fell: done.fallen,
              }),
            );
            firstRestoration.current = false;
          }}
          onExit={onExit}
        />
      )}

      {ctrlLost && view !== 'summary' && view !== 'sanctuary' && view !== 'cinema' && view !== 'journal' && view !== 'lab' && <ControllerLost />}
      {x && view === 'path' && <div className="exp-route">{ROUTES[x.route].name}</div>}
    </div>
  );
}

/**
 * What plays on arriving at the Sanctuary from the title screen: the opening
 * once (marked seen even if skipped, so it never repeats by itself), then the
 * short ritual, with Elara's line depending on how long you've been away.
 */
function arrival(arrived: () => void): { script: Script; restored: boolean; then: () => void } {
  const s = getSave();
  const now = Date.now();
  const visited = () => updateSave((d) => void (d.story.lastVisit = now));
  if (!s.story.openingSeen)
    return {
      script: OPENING,
      restored: false,
      then: () => {
        updateSave((d) => {
          d.story.openingSeen = true;
          d.story.lastVisit = now;
        });
        arrived();
      },
    };
  const daysAway = s.story.lastVisit ? (now - s.story.lastVisit) / 86_400_000 : 0;
  return {
    script: ritualScript(ritualReason({ daysAway }), s.story.rituals),
    restored: s.story.restored,
    then: () => {
      visited();
      updateSave((d) => void d.story.rituals++);
      arrived();
    },
  };
}
/** Add a finished session to the save's history (for varying future loadouts). */
function recordHistory(x: ExpeditionState): void {
  if (!hasWork(x)) return;
  updateSave((s) => {
    const was = s.workouts.find((r) => r.id === x.workout.id);
    s.workouts = upsertRecord(s.workouts, sessionRecord(x));
    if (x.workout.outcome === 'victory' && was?.outcome !== 'victory') s.clears++;
  });
}
