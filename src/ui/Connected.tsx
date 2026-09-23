import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import qrcode from 'qrcode-generator';
import { updateSave } from '../game/store';
import { host, type LinkState } from '../net/host';
import type { CalState } from '../input/calibration';
import { CalibrationPanel, useCalibrationCues, type CalibrationResult } from './Calibration';
import { useMotion } from './motionUi';
import { useSave } from './useSave';

/**
 * Connected Play on the PC: the phone is the motion controller, this page
 * runs the game, and the TV shows this page over HDMI.
 */
export function useLink(): LinkState {
  return useSyncExternalStore(
    (f) => host.subscribe(f),
    () => host.state,
  );
}

/** A QR code drawn as one SVG path (no HTML injection). */
function QrCode({ text }: { text: string }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d, n };
  }, [text]);
  return (
    <svg className="qr" viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label="QR code for the phone controller page" shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

function Check({ ok, pending, children }: { ok: boolean; pending?: boolean; children: React.ReactNode }) {
  return <li className={ok ? 'done' : pending ? 'now' : ''}>{ok ? '✓ ' : pending ? '… ' : '○ '}{children}</li>;
}

export function MotionSettings() {
  const save = useSave();
  const m = save.settings.motion;
  const seg = <T extends string | number>(label: string, value: T, options: [T, string][], set: (v: T) => void) => (
    <div className="toggle-row">
      <span>{label}</span>
      <div className="seg">
        {options.map(([v, l]) => (
          <button key={String(v)} className={`btn btn-sm ${value === v ? '' : 'btn-ghost'}`} onClick={() => set(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <>
      {seg('Turn per lean', m.turnStep, [[45, '45°'], [90, '90°']], (v) => updateSave((s) => void (s.settings.motion.turnStep = v)))}
      {seg('Lean sensitivity', m.lean, [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], (v) => updateSave((s) => void (s.settings.motion.lean = v)))}
      {seg('March sensitivity', m.march, [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], (v) => updateSave((s) => void (s.settings.motion.march = v)))}
    </>
  );
}

export function ConnectedSetup({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const s = useLink();
  const [now, setNow] = useState(Date.now());
  const [goodSince, setGoodSince] = useState<number | null>(null);

  useEffect(() => {
    host.start();
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const st = s.status;
  const connected = s.controller === 'connected';
  const camOk = connected && st?.camera === 'running';
  const modelOk = camOk && st?.model === 'ready';
  const seen = modelOk && st?.tracking !== 'lost';
  useEffect(() => {
    if (seen && goodSince === null) setGoodSince(Date.now());
    if (!seen && goodSince !== null) setGoodSince(null);
  }, [seen, goodSince]);
  // Hands-free: once the phone sees the player for a few seconds, go on.
  const autoIn = goodSince !== null ? Math.max(0, 5 - Math.floor((now - goodSince) / 1000)) : null;
  const started = useRef(false);
  useEffect(() => {
    if (autoIn === 0 && !started.current) {
      started.current = true;
      onStart();
    }
  }, [autoIn, onStart]);

  const url = s.pairing?.urls[0];
  const left = s.pairing ? Math.max(0, Math.ceil((s.pairing.expiresAt - now) / 1000)) : 0;

  return (
    <div className="title-screen">
      <div className="title-card setup-card connected-card">
        <h2>Connected Play</h2>
        <p className="muted small">The phone is your motion controller; this computer runs the game. Connect it to the TV with HDMI and press F11 for full screen.</p>

        {s.relay === 'unavailable' && (
          <div className="warn-box">
            <b>The Connected Play relay isn’t running.</b>
            <span>
              On this computer, run <code>npm run play</code> in the FITBOUND folder, then open <code>http://localhost:8080</code> in this browser.
            </span>
          </div>
        )}
        {s.relay === 'connecting' && <p>Connecting to the relay…</p>}
        {s.error && <p className="warn-text">{s.error}</p>}

        {s.relay === 'online' && !connected && s.controller === 'none' && s.pairing && url && (
          <div className="pair-grid">
            <QrCode text={`${url}#pair=${s.pairing.token}`} />
            <div className="pair-info">
              <ol className="setup-steps">
                <li>Put the phone on the same Wi-Fi as this computer.</li>
                <li>Scan the code with the phone’s camera and open the link in Safari (or Chrome).</li>
                <li>
                  If the browser warns that the connection isn’t private, choose <b>Show Details → visit this website</b> — it’s this computer’s own certificate.
                </li>
              </ol>
              <p>
                Or open <code>{url}</code> and type
              </p>
              <div className="pair-code">{s.pairing.code}</div>
              <p className="muted small">
                Code expires in {left}s{' '}
                <button className="btn btn-sm btn-ghost" onClick={() => host.repair()}>
                  New code
                </button>
              </p>
              {s.pairing.urls.length > 1 && <p className="muted small">Other addresses for this computer: {s.pairing.urls.slice(1).join(' · ')}</p>}
            </div>
          </div>
        )}
        {s.relay === 'online' && s.pairing && !url && <p className="warn-text">This computer has no network address. Connect it to Wi-Fi or Ethernet on the same network as the phone.</p>}

        {(connected || s.controller === 'lost') && (
          <ol className="calib-steps">
            <Check ok={connected} pending={!connected}>
              {connected ? 'Phone connected' : 'Phone connection lost — waiting for it to reconnect…'}
            </Check>
            <Check ok={camOk} pending={connected && !camOk}>
              {st?.camera === 'error' ? `Camera problem on the phone: ${st.error ?? 'unknown error'}` : camOk ? 'Camera allowed' : 'Tap “Start camera” on the phone and allow access'}
            </Check>
            <Check ok={modelOk} pending={camOk && !modelOk}>
              {st?.model === 'error' ? 'The pose model failed to load on the phone' : 'Pose tracking ready'}
            </Check>
            <Check ok={!!seen} pending={modelOk && !seen}>
              {seen ? 'The phone can see you' : 'Stand 2.5–3 m in front of the phone'}
            </Check>
          </ol>
        )}

        <details className="setup-settings">
          <summary>Controls</summary>
          <MotionSettings />
        </details>

        <div className="row">
          <button
            className="btn btn-ghost"
            onClick={() => {
              host.stop();
              onBack();
            }}
          >
            Back
          </button>
          {(connected || s.controller === 'lost') && (
            <button className="btn btn-ghost" onClick={() => host.repair()}>
              Pair a different phone
            </button>
          )}
          <button className="btn btn-big" disabled={!modelOk} onClick={onStart}>
            {autoIn !== null ? `Start calibration (${autoIn})` : 'Start calibration'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The TV side of calibration in Connected Play: the phone runs the checks. */
export function RemoteCalibration({ onDone }: { onDone: (r: CalibrationResult) => void }) {
  const s = useLink();
  const r = useMotion();
  const state: CalState = s.calibration ?? { step: 'body', progress: 0, hint: null, floorOk: false };
  useCalibrationCues(state, onDone);
  return (
    <CalibrationPanel state={state} r={r}>
      <div className="calib-cam calib-remote">
        <ControllerStatus big />
      </div>
    </CalibrationPanel>
  );
}

/** Phone connection / tracking status (replaces the camera picture on the TV). */
export function ControllerStatus({ big = false }: { big?: boolean }) {
  const s = useLink();
  const r = useMotion();
  const st = s.status;
  const conn = s.controller === 'connected';
  const trk = r?.tracking ?? st?.tracking ?? 'lost';
  return (
    <div className={`ctrl-status ${big ? 'big' : ''} ${conn ? '' : 'lost'}`}>
      <span className={`dot ${conn ? 'ok' : 'bad'}`}>📱 {conn ? 'Phone connected' : 'Phone disconnected'}</span>
      {conn && <span className={`dot ${trk === 'good' ? 'ok' : trk === 'partial' ? 'warn' : 'bad'}`}>{trk === 'good' ? 'Tracking you' : trk === 'partial' ? 'Weak tracking' : 'Not seeing you'}</span>}
      {big && conn && <span className="muted small">The camera picture stays on the phone — nothing is sent to this computer but your movements.</span>}
    </div>
  );
}

/** Full-screen notice while the controller is missing. */
export function ControllerLost() {
  return (
    <div className="tv-lost tv-lost-ctrl">
      <b>Controller disconnected</b>
      <span>Reconnecting… keep the FITBOUND page open on the phone, unlocked, on the same Wi-Fi.</span>
    </div>
  );
}
