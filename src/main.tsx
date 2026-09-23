import { createRoot } from 'react-dom/client';
import App from './App';
import { bus } from './game/bus';
import { getSave, updateSave } from './game/store';
import { getGame } from './phaser/game';
import './styles.css';

// `?debug` exposes internals for browser automation. It grants nothing a
// player couldn't already do from devtools.
if (new URLSearchParams(location.search).has('debug')) {
  void Promise.all([import('./testing/poses'), import('./pose/PoseTracker'), import('./input/InputHub'), import('./phaser/diorama/layout')]).then(([poses, pose, hub, layout]) => {
    (window as unknown as { __fb: unknown }).__fb = { bus, getSave, updateSave, getGame, poses, tracker: pose.tracker, input: hub.input, layout };
  });
}

// Wait briefly for the pixel font so Phaser text renders with it.
const fontReady = document.fonts?.load('8px "Press Start 2P"').catch(() => undefined) ?? Promise.resolve();
Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
