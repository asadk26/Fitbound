import { useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio';
import { bus } from '../game/bus';
import { GamepadInput } from '../input/gamepad';
import { input } from '../input/InputHub';
import { paintPortrait, type Expression } from '../phaser/diorama/figures';
import { showCinema } from '../phaser/game';
import { CinemaRunner, VOICE_LINES, type Line, type Script } from '../story/cinema';
import { useInputEvents } from './motionUi';

const NAMES: Record<Line['who'], string> = { elara: 'Elara', hero: 'You' };

const portraits: Record<string, string> = {};
function portrait(who: Line['who'], face: Expression): string {
  const key = `${who}-${face}`;
  return (portraits[key] ??= paintPortrait(who, face).toDataURL());
}

/**
 * Plays a cinematic script: the Cinema scene stages it, this overlay shows
 * the dialogue and takes input. Lines wait for the player (A / Enter / Space
 * / click / a raised hand); B or Esc twice, or the Skip button, skips. No
 * body tracking is needed, and the browser's synthetic voice is never used:
 * lines are read, with music and ambience underneath (prerecorded voice can
 * be added by line id later).
 */
export function CinemaPlayer({ script, restored = false, ownInput = false, onDone }: { script: Script; restored?: boolean; ownInput?: boolean; onDone: (skipped: boolean) => void }) {
  const runner = useRef<CinemaRunner | null>(null);
  const [, setFrame] = useState(0);
  const [skipAsk, setSkipAsk] = useState(false);
  const [blink, setBlink] = useState(false);
  const voice = useRef<HTMLAudioElement | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    input.setMode('dialogue');
    let detach = () => {};
    let pad: GamepadInput | null = null;
    if (ownInput) {
      detach = input.attachKeyboard(window);
      pad = new GamepadInput(input, () => {});
      pad.start();
    }
    const r = new CinemaRunner(script, {
      onBeat: (b, _i, sound) => {
        bus.emit('cine:beat', { set: b.set, cues: b.cues ?? [], sound });
        voice.current?.pause();
        voice.current = null;
        if (b.line) {
          const url = VOICE_LINES[b.line.id];
          if (url) {
            voice.current = new Audio(url);
            void voice.current.play().catch(() => {});
          } else audio.lineTick();
        }
      },
      onDone: (skipped) => {
        voice.current?.pause();
        done.current(skipped);
      },
    });
    runner.current = r;
    const offReady = bus.on('cine:ready', () => {
      if (r.index < 0) r.start();
    });
    // Time comes from the scene, so what's on screen and the script never drift apart.
    const offTick = bus.on('cine:tick', ({ dt }) => {
      r.tick(Math.min(100, dt));
      setFrame((f) => (f + 1) % 1e6);
    });
    showCinema({ mode: 'play', restored });
    return () => {
      offReady();
      offTick();
      detach();
      pad?.stop();
      voice.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portraits blink now and then.
  useEffect(() => {
    let t = 0;
    const next = () => {
      t = window.setTimeout(
        () => {
          setBlink(true);
          t = window.setTimeout(() => {
            setBlink(false);
            next();
          }, 140);
        },
        2600 + Math.random() * 3200,
      );
    };
    next();
    return () => clearTimeout(t);
  }, []);

  const skipTimer = useRef(0);
  const askSkip = () => {
    if (skipAsk) return runner.current?.skip();
    setSkipAsk(true);
    clearTimeout(skipTimer.current);
    skipTimer.current = window.setTimeout(() => setSkipAsk(false), 2500);
  };
  useInputEvents((e) => {
    if (e.type === 'confirm') runner.current?.advance();
    else if (e.type === 'back' || e.type === 'pause') askSkip();
  });

  const r = runner.current;
  const line = r?.beat?.line ?? null;
  const shown = line ? line.text.slice(0, r!.visibleChars()) : '';
  const complete = !!line && shown.length === line.text.length;
  return (
    <div className="cinema" onClick={() => runner.current?.advance()}>
      <div className="cine-bar top" />
      <div className="cine-bar bottom" />
      {line?.offscreen && (
        <div className="cine-caption" key={line.id}>
          <span>{shown}</span>
          {complete && <i className="cine-more">▼</i>}
        </div>
      )}
      {line && !line.offscreen && (
        <div className={`cine-dialogue who-${line.who}`} key={line.id}>
          <img className="cine-portrait" src={portrait(line.who, blink ? 'blink' : (line.mood ?? 'neutral'))} alt="" />
          <div className="cine-text">
            <b>{NAMES[line.who]}</b>
            <p>
              {shown}
              {complete && <i className="cine-more">▼</i>}
            </p>
          </div>
        </div>
      )}
      <div className="cine-skip">
        {skipAsk ? <span>Press again to skip</span> : <span>A / Enter: continue · B / Esc: skip</span>}
        <button
          className="btn btn-sm btn-ghost"
          onClick={(e) => {
            e.stopPropagation();
            runner.current?.skip();
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
