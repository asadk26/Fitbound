import { useEffect, useRef, useState } from 'react';
import { input, type InputEvent } from '../input/InputHub';
import type { MotionReading } from '../input/motion';
import { audio } from '../game/audio';
import { iconDataUrl } from '../phaser/art';

/** Latest motion reading, re-rendering at most ~15 times a second. */
export function useMotion(): MotionReading | null {
  const [r, setR] = useState<MotionReading | null>(input.latest);
  useEffect(() => {
    let last = 0;
    let pending: MotionReading | null = null;
    let timer: number | null = null;
    const off = input.onReading((x) => {
      pending = x;
      const now = performance.now();
      if (now - last > 66) {
        last = now;
        setR(x);
      } else if (timer === null) {
        timer = window.setTimeout(() => {
          timer = null;
          last = performance.now();
          setR(pending);
        }, 70);
      }
    });
    return () => {
      off();
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
  return r;
}

/** Subscribe to input events (motion, keyboard, touch) for this component. */
export function useInputEvents(fn: (e: InputEvent) => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => input.on((e) => ref.current(e)), []);
}

/** A circular progress ring showing how long a gesture has been held. */
export function HoldRing({ value, label, hand }: { value: number; label: string; hand: 'right' | 'left' | 'both' }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className={`holdring ${value > 0 ? 'active' : ''}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="holdring-track" />
        <circle cx="32" cy="32" r={r} className="holdring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
      </svg>
      <span className="holdring-icon">{hand === 'both' ? '🙌' : '✋'}</span>
      <span className="holdring-label">
        {hand === 'right' ? 'Raise RIGHT hand' : hand === 'left' ? 'Raise LEFT hand' : 'Both hands up'} · {label}
      </span>
    </span>
  );
}

/** Feet that light on each step, a lean gauge, and the tracking state. */
export function MotionMeter({ r }: { r: MotionReading | null }) {
  const [flash, setFlash] = useState<'left' | 'right' | null>(null);
  useInputEvents((e) => {
    if (e.type === 'step') {
      const foot = input.latest?.lastFoot ?? null;
      setFlash(foot);
      window.setTimeout(() => setFlash(null), 220);
    }
  });
  const lean = r?.steer ?? 0;
  const lost = !r || r.tracking === 'lost';
  return (
    <div className={`meter ${lost ? 'meter-lost' : ''}`}>
      <div className="meter-feet">
        <span className={`foot ${flash === 'left' ? 'on' : ''}`}>L</span>
        <span className={`foot ${flash === 'right' ? 'on' : ''}`}>R</span>
        <b className={r?.marching ? 'go' : ''}>{lost ? 'Not tracking' : r?.marching ? 'Marching!' : 'March to move'}</b>
      </div>
      <div className="meter-lean">
        <span>◀ lean</span>
        <div className="lean-track">
          <i className="lean-dead" />
          <i className="lean-dot" style={{ left: `${50 + lean * 45}%` }} />
        </div>
        <span>lean ▶</span>
      </div>
    </div>
  );
}

export interface MenuOption {
  id: string;
  label: string;
  detail?: string;
  icon?: string;
}

/**
 * A menu you drive with your body: lean left/right to move the highlight,
 * raise your right hand to choose, left hand to go back. Taps and arrow
 * keys work too.
 */
export function GestureMenu({ title, text, options, onChoose, onBack, initial = 0 }: { title: string; text?: string; options: MenuOption[]; onChoose: (id: string) => void; onBack?: () => void; initial?: number }) {
  const [sel, setSel] = useState(initial);
  const r = useMotion();
  const selRef = useRef(sel);
  selRef.current = sel;
  useInputEvents((e) => {
    if (e.type === 'nav') {
      setSel((s) => Math.max(0, Math.min(options.length - 1, s + e.dir)));
      audio.select();
    } else if (e.type === 'confirm') {
      audio.gesture();
      onChoose(options[selRef.current].id);
    } else if (e.type === 'back' && onBack) {
      audio.gesture();
      onBack();
    }
  });
  return (
    <div className="gmenu">
      <h2>{title}</h2>
      {text && <p className="gmenu-text">{text}</p>}
      <div className="gmenu-options">
        {options.map((o, i) => (
          <button key={o.id} className={`gmenu-opt ${i === sel ? 'sel' : ''}`} onClick={() => onChoose(o.id)} onPointerEnter={() => setSel(i)}>
            {o.icon && <img src={iconDataUrl(o.icon)} alt="" className="pix-icon" />}
            <b>{o.label}</b>
            {o.detail && <span>{o.detail}</span>}
          </button>
        ))}
      </div>
      <div className="gmenu-hints">
        {options.length > 1 && <span className="hint-chip">Lean ◀ ▶ to choose</span>}
        <HoldRing value={r?.hold.confirm ?? 0} label="choose" hand="right" />
        {onBack && <HoldRing value={r?.hold.back ?? 0} label="back" hand="left" />}
      </div>
    </div>
  );
}
