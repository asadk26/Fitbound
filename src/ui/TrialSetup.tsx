import type { TrialTargets } from '../trial/config';
import { DEFAULT_TARGETS } from '../trial/config';
import { updateSave } from '../game/store';
import { useSave } from './useSave';
import { MotionSettings } from './Connected';

/**
 * One screen of setup before the Motion Trial: where to put the phone, how
 * to mirror to a TV, and the few settings a tester might change. This is the
 * last screen that needs a tap.
 */
const TARGET_ROWS: [keyof TrialTargets, string][] = [
  ['pushup', 'Push-ups (Skeleton)'],
  ['squat', 'Squats (Golem)'],
  ['jumping_jack', 'Jumping jacks (Mage)'],
  ['bossPushup', 'Boss push-ups'],
  ['bossSquat', 'Boss squats'],
  ['bossJack', 'Boss jumping jacks'],
];

export function TrialSetup({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const save = useSave();
  const t = save.settings.trialTargets;
  const setT = (k: keyof TrialTargets, v: number) => updateSave((s) => void (s.settings.trialTargets = { ...s.settings.trialTargets, [k]: Math.max(1, Math.min(50, v)) }));

  return (
    <div className="title-screen">
      <div className="title-card setup-card">
        <h2>Motion Trial setup</h2>
        <div className="setup-grid">
          <PlacementDiagram />
          <ol className="setup-steps">
            <li>
              <b>Phone:</b> landscape, on something steady about <b>knee height</b> (a low shelf, a chair or a stack of books), screen and camera facing your play space.
            </li>
            <li>
              <b>Distance:</b> stand about <b>2.5–3 m (8–10 ft)</b> away on a clear floor. You’ll need room to lie down sideways for push-ups right there.
            </li>
            <li>
              <b>TV:</b> mirror the phone to your TV (iPhone: Control Centre → Screen Mirroring). Optional, but it’s much easier to see.
            </li>
            <li>
              <b>After you tap Start</b>, you won’t need to touch the phone again: the camera walks you through setup.
            </li>
          </ol>
        </div>

        <details className="setup-settings">
          <summary>Trial settings</summary>
          <div className="toggle-row">
            <span>Camera</span>
            <div className="seg">
              <button className={`btn btn-sm ${save.settings.cameraFacing === 'user' ? '' : 'btn-ghost'}`} onClick={() => updateSave((s) => void (s.settings.cameraFacing = 'user'))}>
                Front (selfie)
              </button>
              <button className={`btn btn-sm ${save.settings.cameraFacing === 'environment' ? '' : 'btn-ghost'}`} onClick={() => updateSave((s) => void (s.settings.cameraFacing = 'environment'))}>
                Back (wider, sharper)
              </button>
            </div>
          </div>
          <p className="muted small">Using the back camera? Point the back of the phone at yourself — the TV shows the game.</p>
          {TARGET_ROWS.map(([k, label]) => (
            <div className="adj-row" key={k}>
              <span>{label}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setT(k, t[k] - 1)}>
                −
              </button>
              <b>{t[k]}</b>
              <button className="btn btn-ghost btn-sm" onClick={() => setT(k, t[k] + 1)}>
                +
              </button>
            </div>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={() => updateSave((s) => void (s.settings.trialTargets = { ...DEFAULT_TARGETS }))}>
            Reset rep targets
          </button>
          <MotionSettings />
          <div className="toggle-row">
            <span>Sound &amp; spoken cues</span>
            <div className="seg">
              <button className={`btn btn-sm ${save.settings.sound ? '' : 'btn-ghost'}`} onClick={() => updateSave((s) => void (s.settings.sound = !s.settings.sound))}>
                Sound {save.settings.sound ? 'on' : 'off'}
              </button>
              <button className={`btn btn-sm ${save.settings.voice ? '' : 'btn-ghost'}`} onClick={() => updateSave((s) => void (s.settings.voice = !s.settings.voice))}>
                Voice {save.settings.voice ? 'on' : 'off'}
              </button>
            </div>
          </div>
        </details>

        <p className="safety">Clear the area around you. The game counts movement for play only — it doesn’t judge form. Stop if anything hurts; pause any time with both hands up.</p>
        <div className="row">
          <button className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
          <button className="btn btn-big" onClick={onStart}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

function PlacementDiagram() {
  return (
    <svg className="placement" viewBox="0 0 320 170" role="img" aria-label="Phone at knee height about three metres in front of the player, TV behind the phone">
      <rect x="0" y="150" width="320" height="20" fill="#5a3d2a" />
      {/* TV */}
      <rect x="6" y="40" width="70" height="44" rx="4" fill="#1a1c2c" stroke="#94b0c2" strokeWidth="3" />
      <rect x="12" y="46" width="58" height="32" fill="#38b764" />
      <rect x="36" y="84" width="10" height="30" fill="#566c86" />
      {/* Phone on a stand */}
      <rect x="92" y="112" width="30" height="38" fill="#8a5a34" />
      <rect x="96" y="96" width="22" height="14" rx="3" fill="#29366f" stroke="#f4f4f4" strokeWidth="2" />
      <path d="M118 102 L262 40 M118 104 L262 150" stroke="#ffcd75" strokeWidth="2" strokeDasharray="6 5" />
      {/* Player */}
      <circle cx="250" cy="52" r="11" fill="#f2c49a" />
      <path d="M250 64 L250 108 M250 76 L232 92 M250 76 L268 92 M250 108 L238 146 M250 108 L262 146" stroke="#c9424f" strokeWidth="7" strokeLinecap="round" />
      <path d="M124 160 L240 160" stroke="#f4f4f4" strokeWidth="2" markerEnd="url(#a)" markerStart="url(#a)" />
      <defs>
        <marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10z" fill="#f4f4f4" />
        </marker>
      </defs>
      <text x="182" y="156" fill="#f4f4f4" fontSize="11" textAnchor="middle">2.5–3 m</text>
    </svg>
  );
}
