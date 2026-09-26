import { useEffect, useRef, useState } from 'react';
import type { RecoveryMove } from '../../exercise/recovery';
import { audio } from '../../game/audio';
import { input } from '../../input/InputHub';
import { useInputEvents } from '../motionUi';
import { Demo } from './Demo';

/**
 * Plays a guided sequence of timed movements (the Awakening, Haven yoga, the
 * Heart's Rest): a demonstration, the cue, and a countdown. Nothing is
 * scored and the camera isn't needed. A / Enter moves on, P or B pauses,
 * and "Finish here" ends early — only time actually spent is reported.
 */
export function Guided({ seq, label, onDone }: { seq: RecoveryMove[]; label: string; onDone: (ms: number, completed: boolean) => void }) {
  const [m, setM] = useState(0);
  const [st, setSt] = useState(0);
  const [left, setLeft] = useState(seq[0]?.steps[0]?.s ?? 0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const spent = useRef(0);
  const ended = useRef(false);

  const finish = (completed: boolean) => {
    if (ended.current) return;
    ended.current = true;
    onDone(spent.current, completed);
  };

  useEffect(() => {
    input.setMode('menu');
    audio.calm(true);
    return () => audio.calm(false);
  }, []);

  useEffect(() => {
    const step = seq[m]?.steps[st];
    if (!step) return;
    audio.say(st === 0 ? `${seq[m].name}. ${step.say}` : step.say);
    setLeft(step.s);
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      spent.current += 1000;
      setLeft((x) => x - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [m, st, seq]);

  function advance() {
    const move = seq[m];
    if (!move) return finish(true);
    if (st + 1 < move.steps.length) return setSt(st + 1);
    if (m + 1 < seq.length) {
      setM(m + 1);
      setSt(0);
      return;
    }
    finish(true);
  }

  useEffect(() => {
    if (left <= 0 && seq[m]?.steps[st]) {
      const t = window.setTimeout(advance, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  useInputEvents((e) => {
    if (e.type === 'confirm') advance();
    else if (e.type === 'pause' || e.type === 'back') setPaused((p) => !p);
    else if (e.type === 'resume') setPaused(false);
  });

  const move = seq[m];
  const step = move?.steps[st];
  if (!move || !step) return null;
  const total = seq.length;
  return (
    <div className="guided">
      <small className="guided-label">
        {label} · {move.name} · {m + 1} of {total}
      </small>
      {move.demo && <Demo kind={move.demo} paused={paused} />}
      <b className="guided-cue">{step.say}</b>
      <span className="guided-pos">{move.position}</span>
      <div className="guided-timer">{paused ? '❚❚' : Math.max(0, left)}</div>
      <div className="row guided-actions">
        <button className="btn btn-sm" onClick={advance}>
          Next (A / Enter)
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume' : 'Pause (P)'}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => finish(false)}>
          Finish here
        </button>
      </div>
    </div>
  );
}
