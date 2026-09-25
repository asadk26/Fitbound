import { useEffect, useRef, useState } from 'react';
import { EXERCISES, FAMILIES, FAMILY_INFO, targetLabel, type ExerciseDefinition } from '../../exercise/registry';
import type { SessionSnapshot } from '../../exercise/session';
import { audio } from '../../game/audio';
import { getSave, updateSave } from '../../game/store';
import { input } from '../../input/InputHub';
import { STRIKE_TIMING, StrikeTimer } from '../../rpg/dodge';
import { RPG_ENEMIES } from '../../rpg/enemies';
import { ROUTES, type NodeKind } from '../../rpg/expedition';
import { CameraView } from '../CameraView';
import { ControllerStatus } from '../Connected';
import { GUIDANCE } from '../guidance';
import { useInputEvents } from '../motionUi';
import { useSave } from '../useSave';
import { useVoice, VoiceToggle } from '../VoiceUi';
import { DodgeSource } from './dodgeSource';
import { SetRunner, type SetResult } from './setRunner';

/**
 * The Movement Lab: try any movement on your own setup without playing an
 * expedition, and mark it checked when the count matched what you did (that
 * makes beta movements eligible for random loadouts). Also: dodge practice,
 * a voice-command test, and a debug encounter selector.
 */
type Tab = 'moves' | 'dodge' | 'voice' | 'jump';

export function MovementLab({ connected, onBack, onJump }: { connected: boolean; onBack: () => void; onJump: (kind: NodeKind, enemies?: string[]) => void }) {
  const [tab, setTab] = useState<Tab>('moves');
  useEffect(() => input.setMode('menu'), []);
  return (
    <div className="title-screen">
      <div className="title-card setup-card lab-card">
        <h2>Movement Lab</h2>
        <div className="seg lab-tabs">
          {(
            [
              ['moves', 'Movements'],
              ['dodge', 'Dodge practice'],
              ['voice', 'Voice test'],
              ['jump', 'Encounter select'],
            ] as [Tab, string][]
          ).map(([t, l]) => (
            <button key={t} className={`btn btn-sm ${tab === t ? '' : 'btn-ghost'}`} onClick={() => setTab(t)}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'moves' && <Moves connected={connected} />}
        {tab === 'dodge' && <DodgeDrill connected={connected} />}
        {tab === 'voice' && <VoiceTest />}
        {tab === 'jump' && <Jump onJump={onJump} />}
        <div className="row">
          <button className="btn btn-ghost" onClick={onBack}>
            Back to the Sanctuary
          </button>
        </div>
      </div>
    </div>
  );
}

function Moves({ connected }: { connected: boolean }) {
  const save = useSave();
  const [ex, setEx] = useState<ExerciseDefinition | null>(null);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [result, setResult] = useState<SetResult | null>(null);
  const runner = useRef<SetRunner | null>(null);
  useEffect(() => () => runner.current?.dispose(), []);
  useInputEvents((e) => {
    if (e.type === 'finish' || (e.type === 'pause' && runner.current?.running)) runner.current?.finish();
  });

  const start = (e: ExerciseDefinition) => {
    runner.current?.dispose();
    setEx(e);
    setSnap(null);
    setResult(null);
    const target = e.kind === 'hold' ? 10 : e.sided ? 2 : 3;
    const rn = new SetRunner({
      connected,
      difficulty: getSave().settings.difficulty,
      onSnap: setSnap,
      onEvent: (ev) => ev.type === 'rep' && audio.rep(ev.index, ev.target),
      onEnd: (r) => {
        setResult(r);
        input.setMode('menu');
        audio.say('Did the count match what you did?');
      },
    });
    runner.current = rn;
    input.setMode('exercise');
    rn.begin(e, target);
    audio.say(`${e.name}. ${e.camera.instructions.join(' ')}`);
  };
  const mark = (ok: boolean) => {
    if (ex && ok && result) updateSave((s) => void (s.calibrations[ex.id] = { at: Date.now(), reps: result.done }));
    if (ex && !ok) updateSave((s) => void delete s.calibrations[ex.id]);
    setEx(null);
    setResult(null);
    audio.select();
  };

  if (ex)
    return (
      <div className="lab-run">
        <h3>{ex.name}</h3>
        <ul className="setup-steps">
          {ex.camera.instructions.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        {ex.reliabilityNote && <p className="muted small">{ex.reliabilityNote}</p>}
        {!result ? (
          <>
            <div className="lab-count">
              {snap ? (ex.kind === 'hold' ? `${Math.floor(snap.heldMs / 1000)} / ${snap.target} s` : ex.sided && snap.sides ? `Left ${snap.sides.left} · Right ${snap.sides.right} (of ${snap.target} each)` : `${snap.count} / ${snap.target}`) : '…'}
            </div>
            <p className="tvb-guide">{snap?.stage === 'setup' ? (snap.last?.guidance ? GUIDANCE[snap.last.guidance] : 'Get into position') : snap?.stage === 'countdown' ? 'Get ready…' : snap?.last?.guidance ? GUIDANCE[snap.last.guidance] : 'Counting'}</p>
            {connected ? (
              <div className="lab-pip tv-pip-ctrl">
                <ControllerStatus />
              </div>
            ) : (
              <CameraView className="lab-pip" good={snap?.last?.tracking === 'good'} />
            )}
            <div className="row">
              <button className="btn" onClick={() => runner.current?.finish()}>
                Finish (F · Y · “Finish set”)
              </button>
              <button className="btn btn-ghost" onClick={() => (runner.current?.dispose(), setEx(null), input.setMode('menu'))}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="lab-count">
              Counted: {ex.kind === 'hold' ? `${Math.floor(result.holdMs / 1000)} s` : result.sides ? `left ${result.sides.left}, right ${result.sides.right}` : `${result.done} rep${result.done === 1 ? '' : 's'}`}
            </p>
            <p>Did that match what you actually did?</p>
            <div className="row">
              <button className="btn btn-big" onClick={() => mark(true)}>
                Yes — mark it checked
              </button>
              <button className="btn btn-ghost" onClick={() => mark(false)}>
                Not really
              </button>
              <button className="btn btn-ghost" onClick={() => start(ex)}>
                Try again
              </button>
            </div>
          </>
        )}
      </div>
    );

  const row = (e: ExerciseDefinition) => (
    <div key={e.id} className="lab-ex">
      <b>{e.name}</b>
      <span className={`rel rel-${e.reliability}`}>{e.reliability}</span>
      {e.equipment.length > 0 && <span className="rel">dumbbells</span>}
      {(e.reliability === 'stable' || save.calibrations[e.id]) && <span className="rel rel-ok">✓ checked</span>}
      <span className="muted small">
        {targetLabel(e, save.exerciseTargets[e.id] ?? e.range.default)} per set · {e.camera.view === 'side' ? 'side-on' : 'facing the phone'}
      </span>
      {e.createDetector && (
        <button className="btn btn-sm" onClick={() => start(e)}>
          Try it
        </button>
      )}
    </div>
  );
  return (
    <div className="lab-list">
      <div className="lab-family lab-punch">
        <h3>Punch test · for future boxing encounters</h3>
        <p className="muted small">
          Can one phone read straight punches, and tell your left from your right? Try both stances. Throw a sequence you know — say 5 left, then 5 right, then alternating — returning
          to guard each time, and compare the left and right counts. Nothing here affects fights.
        </p>
        {EXERCISES.filter((e) => !e.eligible.includes('combat')).map(row)}
      </div>
      {FAMILIES.map((f) => (
        <div key={f} className="lab-family">
          <h3 style={{ color: FAMILY_INFO[f].color }}>{FAMILY_INFO[f].name}</h3>
          {EXERCISES.filter((e) => e.family === f && e.eligible.includes('combat')).map(row)}
        </div>
      ))}
    </div>
  );
}

function DodgeDrill({ connected }: { connected: boolean }) {
  const [log, setLog] = useState<string[]>([]);
  const [now, setNow] = useState<{ h: 'high' | 'low'; left: number; wait: string | null } | null>(null);
  const [controller, setController] = useState(false);
  const src = useRef(new DodgeSource(connected));
  const loop = useRef<number | null>(null);
  const timer = useRef<StrikeTimer | null>(null);
  useEffect(
    () => () => {
      if (loop.current !== null) clearInterval(loop.current);
      src.current.stop();
      input.setMode('menu');
    },
    [],
  );
  useInputEvents((e) => {
    if (e.type === 'duck' || e.type === 'hop') timer.current?.press(e.type, performance.now());
  });
  const run = (n: number) => {
    if (n >= 4) {
      setNow(null);
      src.current.stop();
      input.setMode('menu');
      return;
    }
    const h: 'high' | 'low' = Math.random() < 0.5 ? 'high' : 'low';
    const st = new StrikeTimer(h, STRIKE_TIMING, controller);
    timer.current = st;
    loop.current = window.setInterval(() => {
      const s = controller ? null : src.current.sample();
      const wait = controller ? null : !s || s.tracking !== 'good' ? 'Step into view' : !s.baseline ? 'Stand still…' : null;
      const res = !controller && s && !s.baseline ? null : st.update(performance.now(), controller ? null : s ? { tracking: s.tracking, ducking: s.ducking, hops: s.hops } : { tracking: 'lost', ducking: false, hops: 0 });
      setNow({ h, left: st.impactIn, wait });
      if (res) {
        clearInterval(loop.current!);
        setLog((l) => [`${h.toUpperCase()}: ${res}`, ...l].slice(0, 8));
        res === 'dodged' ? audio.select() : audio.hurt();
        window.setTimeout(() => run(n + 1), 1200);
      }
    }, 50);
  };
  return (
    <div className="lab-run">
      <p>Stand facing the phone. HIGH: duck (a quick squat). LOW: a small hop. Four practice strikes; nothing is lost here.</p>
      <div className="seg">
        <button className={`btn btn-sm ${!controller ? '' : 'btn-ghost'}`} onClick={() => setController(false)}>
          Body
        </button>
        <button className={`btn btn-sm ${controller ? '' : 'btn-ghost'}`} onClick={() => setController(true)}>
          Controller (▼ duck · ▲ / A hop)
        </button>
      </div>
      {now ? (
        <div className={`rpg-strike ${now.h}`}>
          <b>{now.h === 'high' ? '▲ HIGH — DUCK!' : '▼ LOW — HOP!'}</b>
          {now.wait ? <span className="rpg-wait">{now.wait}</span> : <div className="rpg-strike-bar"><i style={{ width: `${Math.max(0, (now.left / STRIKE_TIMING.telegraphMs) * 100)}%` }} /></div>}
        </div>
      ) : (
        <button
          className="btn btn-big"
          onClick={() => {
            src.current.start();
            input.setMode('dodge');
            run(0);
          }}
        >
          Start practice
        </button>
      )}
      <ul>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function VoiceTest() {
  const v = useVoice();
  useEffect(() => input.setMode('menu'), []);
  return (
    <div className="lab-run">
      <VoiceToggle />
      <p>
        Status: <b>{v.status}</b>
        {v.engine ? ` · ${v.engine === 'on-device' ? 'on this computer' : 'online speech service'}` : ''}
      </p>
      <p>Last command heard: {v.heard ? `“${v.heard.text}” → ${v.heard.cmd ?? 'no command'} (${v.heard.verdict === 'not-now' ? 'not available on this screen' : v.heard.verdict})` : '—'}</p>
      <p className="muted small">Try “Pause” from across the room with the game audio playing. Commands only count when they’re the whole phrase; the game ignores anything heard while its own narrator is speaking. On this menu only “Pause” and “Recalibrate” apply; “Finish set” works during a set.</p>
    </div>
  );
}

function Jump({ onJump }: { onJump: (kind: NodeKind, enemies?: string[]) => void }) {
  const fights = [...new Map(ROUTES.standard.nodes.filter((n) => n.enemies).map((n) => [n.enemies!.join('+'), n])).values()];
  return (
    <div className="lab-run">
      <p className="muted small">For testing: jump straight into one encounter with your current loadout and blessings. Nothing here changes a saved run, and sets done here aren’t added to your expedition history.</p>
      <div className="ex-chips">
        {fights.map((n) => (
          <button key={n.title} className="btn btn-sm" onClick={() => onJump(n.kind, n.enemies)}>
            ⚔ {n.title} ({n.enemies!.map((e) => RPG_ENEMIES[e].name).join(', ')})
          </button>
        ))}
        <button className="btn btn-sm" onClick={() => onJump('blessing')}>
          ✦ Blessing
        </button>
        <button className="btn btn-sm" onClick={() => onJump('mirror')}>
          ◈ Mirror of Unlived Lives
        </button>
        <button className="btn btn-sm" onClick={() => onJump('haven')}>
          ❀ Haven
        </button>
      </div>
    </div>
  );
}
