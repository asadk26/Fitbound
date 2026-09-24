import { useEffect, useRef, useState } from 'react';
import { CAL_STEPS } from '../input/calibration';
import { BLOCKER_TEXT } from '../exercise/diagnostics';
import { startMotion, tilt } from '../input/tilt';
import type { InputMode } from '../input/modes';
import type { NeutralPose } from '../input/motion';
import { tracker, TrackerError } from '../pose/PoseTracker';
import { CameraView } from '../ui/CameraView';
import { GUIDANCE } from '../ui/guidance';
import type { CtrlLinkState } from './link';
import { bridge, link } from './session';

/**
 * The phone in Connected Play: a camera-and-status controller, not a game
 * screen. It never renders the game; it shows whether it is connected, what
 * the camera sees (only when useful — painting video costs battery), what
 * mode the game is in and exercise progress, plus touch controls as a
 * fallback. Everything it detects is sent as small interpreted events.
 */
const NEUTRAL_KEY = 'fitbound.ctrl.neutral';

const MODE_LABEL: Record<InputMode, string> = {
  off: 'Waiting for the game',
  calibration: 'Setup',
  explore: 'Exploring',
  dialogue: 'Talking',
  menu: 'Menu',
  exercise: 'Exercise',
  ready: 'Stand tall to continue',
};

const CAMERA_KEY = 'fitbound.ctrl.camera';

type CameraPref = { id: string | null; wide: boolean };

function saveCameraPref(p: CameraPref): void {
  try {
    localStorage.setItem(CAMERA_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/**
 * Which camera to use. Browsers only reveal camera names after access has
 * been allowed once, so this also lives on the dashboard, where changing it
 * restarts the camera.
 */
function CameraPicker({ pref, onChange, onApply }: { pref: CameraPref; onChange: (p: CameraPref) => void; onApply?: () => void }) {
  const [cams, setCams] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    void tracker.listCameras().then(setCams).catch(() => {});
  }, []);
  const zoom = tracker.zoomRange();
  return (
    <details className="small">
      <summary>
        Camera: {pref.id ? (cams.find((c) => c.id === pref.id)?.label ?? 'chosen camera') : bridge.facing === 'user' ? 'front (default)' : 'back (default)'}
        {pref.wide ? ' · widest view' : ''}
      </summary>
      <p>If your phone lists an ultra-wide camera, it can see your whole body from closer. Wider lenses make you smaller in the picture, which can make tracking less reliable — try it and compare in a push-up set. The list fills in once the camera has been allowed. After switching, recalibrate from the pause menu.</p>
      <select value={pref.id ?? ''} onChange={(e) => onChange({ ...pref, id: e.target.value || null })}>
        <option value="">Default ({bridge.facing === 'user' ? 'front' : 'back'} camera)</option>
        {cams.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <label className="check">
        <input type="checkbox" checked={pref.wide} onChange={(e) => onChange({ ...pref, wide: e.target.checked })} /> Use the widest zoom if this camera offers it
        {zoom ? ` (this one: ${zoom.min}×–${zoom.max}×)` : ''}
      </label>
      {onApply && (
        <button className="ghost" onClick={onApply}>
          Restart camera with this choice
        </button>
      )}
    </details>
  );
}

function loadCameraPref(): CameraPref {
  try {
    const v = JSON.parse(localStorage.getItem(CAMERA_KEY) ?? 'null');
    if (v && (typeof v.id === 'string' || v.id === null) && typeof v.wide === 'boolean') return v;
  } catch {
    /* ignore */
  }
  return { id: null, wide: false };
}

function useLinkState(): CtrlLinkState {
  const [s, setS] = useState(link.state);
  useEffect(() => link.onState(setS), []);
  return s;
}

/** Re-render a few times a second; the bridge itself runs per frame. */
function useTicker(ms: number): void {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function ControllerApp() {
  const ls = useLinkState();
  const [started, setStarted] = useState(false);

  // Pair from the QR code's token (kept in the URL fragment, which is never
  // sent to a server) or resume this tab's session.
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get('pair');
    if (token) {
      history.replaceState(null, '', location.pathname + location.search);
      link.connect({ token });
    } else if (link.hasSession) link.connect();
    try {
      const n = JSON.parse(sessionStorage.getItem(NEUTRAL_KEY) ?? 'null') as NeutralPose | null;
      if (n && typeof n.thigh === 'number') bridge.restoreNeutral(n);
    } catch {
      /* ignore */
    }
  }, []);

  if (ls.phase === 'idle' || ls.phase === 'ended' || (ls.phase === 'joining' && !link.hasSession)) return <PairScreen ls={ls} />;
  if (!started) return <StartScreen ls={ls} onStart={() => setStarted(true)} />;
  return <Dashboard ls={ls} />;
}

function PairScreen({ ls }: { ls: CtrlLinkState }) {
  const [code, setCode] = useState('');
  const joining = ls.phase === 'joining';
  return (
    <main className="pad pad-center">
      <h1>
        FIT<span>BOUND</span> controller
      </h1>
      <p>Scan the QR code on the TV, or type the 6-digit code it shows.</p>
      <form
        className="pair-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{6}$/.test(code)) link.connect({ code });
        }}
      >
        <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Pairing code" />
        <button className="big" disabled={code.length !== 6 || joining}>
          {joining ? 'Connecting…' : 'Connect'}
        </button>
      </form>
      {ls.error && <p className="bad">{ls.error}</p>}
      <p className="small">This page must be opened over HTTPS from the PC running FITBOUND. Your camera stays on this phone: only movements and rep counts are sent.</p>
    </main>
  );
}

function StartScreen({ ls, onStart }: { ls: CtrlLinkState; onStart: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pref, setPref] = useState(loadCameraPref);
  const secure = window.isSecureContext;
  const savePref = (p: CameraPref) => {
    setPref(p);
    saveCameraPref(p);
  };
  const start = async () => {
    setBusy(true);
    setErr(null);
    bridge.camera = 'starting';
    bridge.model = 'loading';
    bridge.sendStatus(true);
    tracker.facing = bridge.facing;
    tracker.deviceId = pref.id;
    tracker.wide = pref.wide;
    // Motion-sensor permission must be asked from this tap (iOS); used only
    // to notice if the phone gets knocked out of place.
    bridge.tilt = tilt;
    void startMotion(tilt);
    try {
      await tracker.start(bridge.modelSize);
      bridge.camera = 'running';
      bridge.model = 'ready';
      bridge.cameraError = undefined;
      onStart();
    } catch (e) {
      const code = e instanceof TrackerError ? e.code : 'unknown';
      bridge.camera = 'error';
      if (code === 'model') bridge.model = 'error';
      bridge.cameraError = e instanceof Error ? e.message : String(e);
      setErr(bridge.cameraError);
    } finally {
      bridge.sendStatus(true);
      setBusy(false);
    }
    // Keep the screen awake while playing (iOS 16.4+, Android Chrome).
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } };
    nav.wakeLock?.request('screen').catch(() => {});
  };
  return (
    <main className="pad pad-center">
      <div className="pills">
        <Pill ok={ls.phase === 'connected'} label={ls.phase === 'connected' ? 'Paired' : 'Connecting…'} />
        <Pill ok={ls.hostOnline} label={ls.hostOnline ? 'Game online' : 'Game offline'} />
      </div>
      <h1>Paired!</h1>
      <p>Put the phone in its spot — landscape, low down (a low shelf, or leaning against a wall near the floor), 2.5–3 m from where you’ll stand — then start the camera. The TV will guide you from there.</p>
      {!secure && <p className="bad">This page isn’t a secure (HTTPS) page, so the browser won’t allow the camera. Open the https:// address shown on the PC.</p>}
      <button className="big" disabled={busy} onClick={start}>
        {busy ? 'Starting camera…' : 'Start camera'}
      </button>
      <CameraPicker pref={pref} onChange={savePref} />
      {err && <p className="bad">{err}</p>}
      {err && (
        <button className="ghost" onClick={onStart}>
          Continue with touch controls only
        </button>
      )}
      <p className="small">Video is processed on this phone and never sent or saved. Keep this page open and the phone unlocked while you play.</p>
    </main>
  );
}

function Dashboard({ ls }: { ls: CtrlLinkState }) {
  useTicker(250);
  const [preview, setPreview] = useState<boolean | null>(null);
  const [touch, setTouch] = useState(false);
  const [tick, setTick] = useState(false);
  const [camPref, setCamPref] = useState(loadCameraPref);
  const lastAction = useRef<number>(0);

  // Frames → bridge; a steady tick keeps touch controls, heartbeats and
  // status flowing even when the camera is off.
  useEffect(() => {
    const off = tracker.subscribe((f) => bridge.frame(f.frame, f.now));
    const id = window.setInterval(() => bridge.tick(), 100);
    const hb = window.setInterval(() => link.send({ type: 'HEARTBEAT' }), 1000);
    link.send({ type: 'HELLO', version: 1, facing: tracker.facing });
    bridge.sendStatus(true);
    return () => {
      off();
      clearInterval(id);
      clearInterval(hb);
    };
  }, []);

  // Resend status whenever the link comes back.
  useEffect(() => {
    if (ls.phase === 'connected') bridge.sendStatus(true);
  }, [ls.phase]);

  // Remember calibration for this tab so a reload doesn't lose it.
  useEffect(() => {
    if (bridge.neutral) {
      try {
        sessionStorage.setItem(NEUTRAL_KEY, JSON.stringify(bridge.neutral));
      } catch {
        /* ignore */
      }
    }
  });

  // Optional click on recognised input — only when the PC's sound is off, so
  // the two devices never both sound for the same thing.
  const la = bridge.lastAction;
  useEffect(() => {
    if (!la || la.at === lastAction.current) return;
    lastAction.current = la.at;
    if (tick && !bridge.pcSound) click();
  }, [la, tick]);

  const mode = bridge.mode;
  const trk = bridge.tracking;
  const cam = bridge.camera;
  const showPreview = preview ?? (mode === 'calibration' || mode === 'off' || trk === 'lost');
  const p = bridge.progress;
  const cal = bridge.calibration;
  const recent = la && performance.now() - la.at < 1500 ? la.label : null;
  const connected = ls.phase === 'connected' && ls.hostOnline;

  return (
    <main className="pad">
      <div className="pills">
        <Pill ok={connected} warn={ls.phase === 'reconnecting'} label={ls.phase === 'reconnecting' ? 'Reconnecting…' : !ls.hostOnline ? 'Game offline' : 'Connected'} />
        <Pill ok={cam === 'running'} warn={cam === 'starting'} label={cam === 'running' ? 'Camera on' : cam === 'starting' ? 'Camera starting' : cam === 'error' ? 'Camera error' : 'Camera off'} />
        <Pill ok={trk === 'good'} warn={trk === 'partial'} label={trk === 'good' ? 'Tracking you' : trk === 'partial' ? 'Weak tracking' : 'Not seeing you'} />
      </div>

      <section className="mode">
        <small>Game mode</small>
        <b>{MODE_LABEL[mode]}</b>
        {bridge.game?.title && <span>{bridge.game.title}</span>}
        {bridge.game?.notice && <span className="bad">{bridge.game.notice}</span>}
        {tilt.moved && <span className="warn">The phone moved since calibration — put it back, or recalibrate from the pause menu.</span>}
      </section>

      {mode === 'ready' && (
        <button className="big" onClick={() => bridge.touch('ready')}>
          Continue
        </button>
      )}

      {mode === 'calibration' && cal && (
        <section className="card">
          <small>Setup step</small>
          <b>{CAL_STEPS.find((s) => s.id === cal.step)?.title}</b>
          {cal.hint && <span>{cal.hint}</span>}
          <Bar value={cal.progress} />
        </section>
      )}

      {p && (
        <section className="card">
          <small>{p.exerciseName}</small>
          <b className="reps">
            {p.count}
            <small>/{p.target || '…'}</small>
          </b>
          <Bar value={p.target ? p.count / p.target : 0} />
          {p.manualMode && <span className="warn">MANUAL COUNT · not camera-verified</span>}
          {p.paused && <span className="warn">Paused</span>}
          {!p.manualMode && bridge.exerciseBlocker && <span className="warn">{BLOCKER_TEXT[bridge.exerciseBlocker]}</span>}
          {!p.manualMode && !bridge.exerciseBlocker && bridge.exerciseGuidance && <span>{GUIDANCE[bridge.exerciseGuidance] ?? ''}</span>}
          {!p.manualMode && bridge.exerciseFallback && (
            <button className="warnbtn" onClick={() => bridge.manualMode()}>
              Camera struggling? Count manually
            </button>
          )}
          {p.manualMode && (
            <button className="big" onPointerDown={() => bridge.manualRep()}>
              +1 rep (manual)
            </button>
          )}
        </section>
      )}

      <div className={`action ${recent ? 'on' : ''}`}>{recent ?? ' '}</div>

      {showPreview && cam === 'running' && <CameraView className="pad-cam" fps={10} good={trk === 'good'} />}

      <div className="row">
        <button className="ghost" onClick={() => setPreview(!showPreview)}>
          {showPreview ? 'Hide camera' : 'Show camera'}
        </button>
        <button className="ghost" onClick={() => setTouch(!touch)}>
          {touch ? 'Hide touch controls' : 'Touch controls'}
        </button>
        <button className="pause" onClick={() => bridge.touch('pause')}>
          ❚❚ Pause
        </button>
      </div>

      {touch && <TouchPad mode={mode} />}

      <CameraPicker
        pref={camPref}
        onChange={(p) => {
          setCamPref(p);
          saveCameraPref(p);
        }}
        onApply={async () => {
          tracker.stop();
          tracker.deviceId = camPref.id;
          tracker.wide = camPref.wide;
          bridge.camera = 'starting';
          bridge.sendStatus(true);
          try {
            await tracker.start(bridge.modelSize);
            bridge.camera = 'running';
            bridge.cameraError = undefined;
          } catch (e) {
            bridge.camera = 'error';
            bridge.cameraError = e instanceof Error ? e.message : String(e);
          }
          bridge.sendStatus(true);
        }}
      />

      <label className="small check">
        <input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} /> Click on this phone when a move is recognised (only while the PC’s sound is off)
      </label>
    </main>
  );
}

function TouchPad({ mode }: { mode: InputMode }) {
  const hold = (down: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    bridge.touchForward(down);
  };
  if (mode === 'explore')
    return (
      <div className="touchpad">
        <button onClick={() => bridge.touch('left')}>↺ Turn</button>
        <button className="walk" onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerCancel={hold(false)} onPointerLeave={hold(false)}>
          ▲ Walk (hold)
        </button>
        <button onClick={() => bridge.touch('right')}>Turn ↻</button>
        <button onClick={() => bridge.touch('back')}>Back</button>
        <button onClick={() => bridge.touch('confirm')}>Interact</button>
      </div>
    );
  if (mode === 'menu' || mode === 'dialogue')
    return (
      <div className="touchpad">
        <button onClick={() => bridge.touch('left')}>◀</button>
        <button onClick={() => bridge.touch('confirm')}>Choose</button>
        <button onClick={() => bridge.touch('right')}>▶</button>
        <button onClick={() => bridge.touch('back')}>Back</button>
      </div>
    );
  if (mode === 'calibration')
    return (
      <div className="touchpad">
        <button onClick={() => bridge.hub.command({ type: 'confirm' }, 'touch')}>Confirm step</button>
        <button onClick={() => bridge.hub.command({ type: 'back' }, 'touch')}>Skip floor check</button>
      </div>
    );
  return null;
}

function Pill({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return <span className={`pill ${ok ? 'ok' : warn ? 'warn' : 'bad'}`}>{label}</span>;
}

function Bar({ value }: { value: number }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

let ctx: AudioContext | null = null;
function click(): void {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1200;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.06);
  } catch {
    /* audio unavailable */
  }
}
