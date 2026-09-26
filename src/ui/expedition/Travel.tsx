import { useEffect, useRef, useState } from 'react';
import { audio } from '../../game/audio';
import { bus } from '../../game/bus';
import { getSave } from '../../game/store';
import { input } from '../../input/InputHub';
import { travel } from '../../phaser/diorama/travel';
import { setDioramaState, showScene } from '../../phaser/game';
import { iconDataUrl } from '../../phaser/art';
import { boardMarkers, currentNode, ROUTES, standingAt, type ExpeditionState } from '../../rpg/expedition';
import { STORY } from '../../rpg/story';
import { useSave } from '../useSave';
import { ControllerStatus } from '../Connected';
import { GestureMenu, HoldRing, MotionMeter, useInputEvents, useMotion } from '../motionUi';
import { toggleExpeditionTravel } from './travelPref';

/**
 * Marching between encounters, on the meadow board. The next encounter
 * stands at its trail stop; march in place (or use the gamepad / keys in
 * Assisted traversal) and the trail carries you there. A fork may offer the
 * Mossy Shrine detour, which restores some health once per run.
 */
export interface MarchTally {
  steps: number;
  active: number;
  assisted: number;
}

export function Travel({
  x,
  connected,
  onArrive,
  onShrine,
  onStop,
  onRecalibrate,
}: {
  x: ExpeditionState;
  connected: boolean;
  onArrive: (m: MarchTally) => void;
  onShrine: () => void;
  onStop: (m: MarchTally) => void;
  onRecalibrate: () => void;
}) {
  const save = useSave();
  const assisted = save.settings.motion.traversal === 'assisted';
  const node = currentNode(x)!;
  const target = `n${x.index}`;
  const r = useMotion();
  const [choice, setChoice] = useState<{ prompt: string; options: { dir: -1 | 1; label: string; detail: string; icon: string }[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(STORY.legs[node.title] ?? null);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [lost, setLost] = useState(false);
  const steps = useRef(0);
  const start = useRef({ active: travel.active, assisted: travel.assisted });
  const arrived = useRef(false);
  const tally = (): MarchTally => ({ steps: steps.current, active: travel.active - start.current.active, assisted: travel.assisted - start.current.assisted });
  const props = useRef({ onArrive, onShrine });
  props.current = { onArrive, onShrine };

  const setPaused = (p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
    input.setMode(p ? 'menu' : 'explore');
  };

  useEffect(() => {
    const nodes = ROUTES[x.route].nodes;
    setDioramaState({
      target,
      interact: x.shrineUsed ? [] : ['shrine'],
      enemies: [],
      defeated: nodes.map((_, i) => `n${i}`).filter((_, i) => i < x.index),
      gateOpen: true,
      expedition: { markers: boardMarkers(x.route), pace: 0.35, startAt: standingAt(x) },
    });
    showScene('Diorama', { attract: false });
    input.setMode('explore');
    const line = STORY.legs[node.title];
    if (line) audio.say(line);
    const t = window.setTimeout(() => setNotice(null), 9000);
    const offs = [
      bus.on('diorama:reached', ({ id }) => {
        if (id !== target || arrived.current) return;
        arrived.current = true;
        audio.levelUp();
        input.setMode('menu');
        window.setTimeout(() => props.current.onArrive(tally()), 700);
      }),
      bus.on('diorama:near', ({ id }) => {
        if (id === 'shrine') props.current.onShrine();
      }),
      bus.on('trail:choice', (c) => setChoice(c)),
      bus.on('trail:chosen', ({ label }) => setNotice(`Heading for the ${label}`)),
    ];
    return () => {
      clearTimeout(t);
      offs.forEach((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marching needs the body; gamepad travel doesn't.
  const lostSince = useRef<number | null>(null);
  useEffect(() => {
    if (assisted) return setLost(false);
    return input.onReading((rd) => {
      const now = performance.now();
      if (rd?.tracking === 'lost') {
        lostSince.current ??= now;
        setLost(now - lostSince.current > 1500);
      } else {
        lostSince.current = null;
        setLost(false);
      }
    });
  }, [assisted]);

  useInputEvents((e) => {
    if (e.type === 'step') steps.current++;
    if (e.type === 'recalibrate') return onRecalibrate();
    if (e.type === 'pause' && !pausedRef.current) {
      audio.gesture();
      return setPaused(true);
    }
    if (pausedRef.current && e.type === 'resume') setPaused(false);
  });

  return (
    <>
      <div className="tv-objective">
        <small>
          Phase {node.phase} · on the way to
        </small>
        <b>{node.title}</b>
        <span>{assisted ? 'Move with the gamepad stick or arrow keys.' : 'March in place — the trail carries you there.'}</span>
      </div>
      {connected && (
        <div className="tv-pip tv-pip-ctrl">
          <ControllerStatus bodyNeeded={!assisted} />
        </div>
      )}
      <div className="tv-bottom">
        {!assisted && <MotionMeter r={r} steering={false} />}
        {assisted && <span className="hint-chip">🎮 Assisted · Select / T to march again</span>}
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
      {notice && !paused && <div className="tv-notice travel-line">{notice}</div>}
      {lost && !paused && <div className="tv-lost">Step back into view to keep marching</div>}
      <button className="btn btn-sm btn-ghost tv-touch-pause" onClick={() => input.press('pause', 'touch')}>
        Pause
      </button>
      {paused && (
        <div className="tv-overlay tv-overlay-top">
          <GestureMenu
            title="Paused"
            options={[
              { id: 'resume', label: 'Resume', icon: 'star' },
              { id: 'traverse', label: assisted ? 'March to travel' : 'Travel with a gamepad', detail: assisted ? 'March in place to move' : 'Stick or arrow keys; not counted as exercise', icon: 'wind' },
              { id: 'recal', label: 'Recalibrate', icon: 'shield' },
              { id: 'stop', label: 'Save and stop here', detail: 'Resume later from this point', icon: 'lock' },
            ]}
            onChoose={(id) => {
              if (id === 'resume') setPaused(false);
              else if (id === 'traverse') toggleExpeditionTravel();
              else if (id === 'recal') onRecalibrate();
              else onStop(tally());
            }}
            onBack={() => setPaused(false)}
          />
        </div>
      )}
    </>
  );
}

/** Whether the camera is needed for this march (marching, not gamepad). */
export function marchNeedsBody(): boolean {
  return getSave().settings.motion.traversal !== 'assisted';
}
