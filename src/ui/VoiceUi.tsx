import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSave, updateSave } from '../game/store';
import { VOICE_LABEL } from '../input/voice';
import { voice, type VoiceState } from '../input/voiceControl';

export function useVoice(): VoiceState {
  return useSyncExternalStore(
    (f) => voice.subscribe(f),
    () => voice.state,
  );
}

/** Switch voice commands on/off (must be a click: the browser asks for the microphone). */
export function VoiceToggle({ phoneOnly = false }: { phoneOnly?: boolean }) {
  const v = useVoice();
  const on = v.status === 'listening' || v.status === 'starting';
  if (v.status === 'unsupported')
    return <p className="muted small">Voice commands need Chrome or Edge on this computer (this browser has no speech recognition). Pause, Finish set and Recalibrate still work from the gamepad (Start, Y), keyboard (P, F) and the phone.</p>;
  return (
    <div className="voice-toggle">
      <button
        className={`btn btn-sm ${on ? '' : 'btn-ghost'}`}
        onClick={() => {
          if (on) {
            voice.disable();
            updateSave((s) => void (s.settings.voiceCommands = false));
          } else {
            void voice.enable();
            updateSave((s) => void (s.settings.voiceCommands = true));
          }
        }}
      >
        🎙 Voice commands {on ? 'on' : 'off'}
      </button>
      <span className="muted small">
        Say <b>Pause</b>, <b>Resume</b>, <b>Finish set</b> or <b>Recalibrate</b>.{' '}
        {v.engine === 'on-device' ? 'Recognised on this computer.' : on ? 'This browser sends the audio to its speech service (Google for Chrome, Microsoft for Edge) while listening — it needs the internet and isn’t offline.' : 'Uses this computer’s microphone.'}
        {phoneOnly && ' On an iPhone, voice can interrupt the camera — use it only if tracking stays smooth.'}
      </span>
      {v.error && <span className="warn-text small">{v.error}</span>}
    </div>
  );
}

/** Small listening indicator plus a flash of each recognised command. */
export function VoiceChip() {
  const v = useVoice();
  const [, setN] = useState(0);
  useEffect(() => {
    if (!v.heard) return;
    const id = window.setTimeout(() => setN((n) => n + 1), 2600);
    return () => clearTimeout(id);
  }, [v.heard]);
  // Start listening automatically if it was on last time (Chrome remembers the permission).
  useEffect(() => {
    if (!getSave().settings.voiceCommands || !voice.supported || voice.state.status !== 'off') return;
    // Only without a click if the microphone is already allowed; otherwise wait for the toggle.
    const perms = (navigator as Navigator & { permissions?: { query: (d: { name: string }) => Promise<{ state: string }> } }).permissions;
    perms
      ?.query({ name: 'microphone' })
      .then((p) => {
        if (p.state === 'granted') void voice.enable();
      })
      .catch(() => {});
  }, []);
  if (v.status === 'off' || v.status === 'unsupported') return null;
  const fresh = v.heard && performance.now() - v.heard.at < 2500;
  return (
    <div className={`voice-chip ${v.status}`}>
      <span>{v.status === 'listening' ? '🎙' : v.status === 'starting' ? '🎙…' : '🎙✕'}</span>
      {fresh && v.heard?.cmd && (
        <b className={v.heard.verdict}>
          {VOICE_LABEL[v.heard.cmd]}
          {v.heard.verdict === 'accepted' ? ' ✓' : ' — not available right now'}
        </b>
      )}
      {!fresh && v.status === 'denied' && <b className="not-now">Microphone blocked</b>}
    </div>
  );
}
