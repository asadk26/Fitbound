import { createRoot } from 'react-dom/client';
import { ControllerApp } from './ControllerApp';
import './controller.css';

// `?debug` exposes internals for browser automation (nothing a player
// couldn't do from devtools).
if (new URLSearchParams(location.search).has('debug')) {
  void Promise.all([import('./session'), import('../pose/PoseTracker'), import('../testing/poses')]).then(([s, pose, poses]) => {
    (window as unknown as { __fbc: unknown }).__fbc = { bridge: s.bridge, link: s.link, tracker: pose.tracker, poses };
  });
}

createRoot(document.getElementById('root')!).render(<ControllerApp />);
